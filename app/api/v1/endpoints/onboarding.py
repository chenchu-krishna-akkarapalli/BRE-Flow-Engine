import json
import time
from typing import Any, Dict, Literal, Optional, Tuple

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_tenant
from app.api.schemas.onboarding import (
    CibilExtractionResponse,
    CompanyIdentity,
    DocumentExtractionResponse,
    HUFIdentity,
    IndividualIdentity,
    OnboardingEvaluationRequest,
    OnboardingEvaluationResponse,
    OnboardingFormEvaluationResponse,
    OnboardingFormRequest,
    OtpSendRequest,
    OtpSendResponse,
    OtpVerifyRequest,
    OtpVerifyResponse,
    RejectionReasonDetail,
)
from app.core.database import get_db
from app.core.logging import logger, redact_pan, redact_pii
from app.db.models.application import ApplicationModel
from app.db.models.audit_log import AuditLogModel
from app.db.models.rule_execution import RuleExecutionModel
from app.db.rls import set_tenant_rls_context
from app.services.bre_engine import bre_engine_service
from app.services.cibil_service import CibilEngineError, extract_cibil_report
from app.services.export_service import build_excel, build_pdf
from app.services.ocr_service import extract_aadhaar_card, extract_pan_card, validate_upload
from app.services.verification_service import send_otp, verify_otp

router = APIRouter()

# The seeded default tenant carries a UUID primary key; the header value
# "default" is its human-facing code.
DEFAULT_TENANT_ROW_ID = "00000000-0000-0000-0000-000000000000"
AUDIT_ACTION_FORM_EVALUATION = "ONBOARDING_FORM_EVALUATION"


def _tenant_row_id(tenant_id: str) -> str:
    return DEFAULT_TENANT_ROW_ID if tenant_id == "default" else tenant_id


def _rejection_details(evaluation: Dict[str, Any]) -> list[RejectionReasonDetail]:
    return [
        RejectionReasonDetail(rule_id=r["rule_id"], category=r["category"], message=r["message"])
        for r in evaluation["rejection_reasons"]
    ]


@router.post("/evaluate", response_model=OnboardingEvaluationResponse)
async def evaluate_onboarding_application(
    payload: OnboardingEvaluationRequest,
    tenant_id: str = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Evaluates candidate application against partner bank rules, records RLS audit trail, and returns verdict in < 80 ms."""
    start_time = time.perf_counter()

    # `mode="json"` is load-bearing, not cosmetic: python-mode dumping leaves
    # enum MEMBERS in the dict, and `str(BankCode.HDFC)` is "BankCode.HDFC",
    # not "HDFC". The engine compares these fields as strings, so a python-mode
    # payload silently fell back to the default bank, never matched a
    # property_status, and never saw an HUF entity type.
    engine_payload = payload.model_dump(mode="json")

    # Redact sensitive PII before logging
    log_safe_payload = redact_pii(engine_payload)
    logger.info(f"Evaluating application for tenant '{tenant_id}': {log_safe_payload}")

    # Enforce PostgreSQL Row-Level Security
    await set_tenant_rls_context(db, tenant_id)

    # Execute in-memory Zen-Engine rules (< 10 ms)
    evaluation = await bre_engine_service.evaluate_application(engine_payload, tenant_id=tenant_id)

    # Persist Application record and RuleExecution audit log in single DB transaction (< 15 ms)
    try:
        app_record = ApplicationModel(
            tenant_id=_tenant_row_id(tenant_id),
            entity_type=payload.entity_type.value,
            applicant_name=payload.applicant_name,
            pan_masked=redact_pan(payload.pan) if payload.pan else None,
            occupation=payload.occupation.value,
            property_status=payload.property_status.value,
            guarantor_provided=payload.guarantor_provided,
            is_nri=payload.is_nri,
            selected_bank=payload.selected_bank.value,
            cibil_score=payload.credit_bureau.cibil_score,
            dpd_count=len(payload.credit_bureau.dpd_history),
            write_off_amount=payload.credit_bureau.write_off_amount,
            write_off_type=payload.credit_bureau.write_off_type,
            status=evaluation["status"],
            overall_eligible=evaluation["overall_eligible"],
        )
        db.add(app_record)
        await db.flush()

        exec_record = RuleExecutionModel(
            application_id=app_record.id,
            tenant_id=app_record.tenant_id,
            bank_code=payload.selected_bank.value,
            eligible=evaluation["overall_eligible"],
            rejection_count=len(evaluation["rejection_reasons"]),
            executed_rules_count=evaluation["executed_rules_count"],
            execution_time_ms=evaluation["execution_time_ms"],
            rejection_reasons_json=json.dumps(evaluation["rejection_reasons"]),
            bank_eligibility_json=evaluation["bank_eligibility"],
            evaluation_report_json=evaluation["evaluation_report"],
        )
        db.add(exec_record)
    except Exception as e:
        await db.rollback()
        logger.warning(f"DB persistence bypassed for evaluation due to schema / connection state: {e}")

    total_time_ms = round((time.perf_counter() - start_time) * 1000, 3)

    return OnboardingEvaluationResponse(
        success=True,
        status=evaluation["status"],
        overall_eligible=evaluation["overall_eligible"],
        executed_rules_count=evaluation["executed_rules_count"],
        execution_time_ms=total_time_ms,
        rejection_reasons=_rejection_details(evaluation),
        bank_eligibility=evaluation["bank_eligibility"],
        evaluation_report=evaluation["evaluation_report"],
    )


def _build_application_record(
    form: OnboardingFormRequest,
    engine_payload: Dict[str, Any],
    evaluation: Dict[str, Any],
    tenant_row_id: str,
) -> ApplicationModel:
    """Project the polymorphic submission onto the application table.

    Queryable attributes become typed columns; the entity-specific remainder is
    kept verbatim (PII-redacted) in `entity_detail_json`, so a Company row does
    not carry a dozen NULL Individual columns and vice versa.
    """
    identity = form.identity
    banking = form.banking
    bureau = engine_payload["credit_bureau"]

    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    if isinstance(identity, IndividualIdentity):
        contact_email, contact_phone = identity.email, identity.phone
    elif isinstance(identity, CompanyIdentity):
        contact_email, contact_phone = identity.company_email, identity.company_mobile
    elif isinstance(identity, HUFIdentity):
        contact_phone = identity.karta_mobile

    # Redacting the detail document keeps raw PAN/DOB out of the database
    # entirely — the masked PAN column is the only identity token persisted.
    entity_detail = redact_pii(
        {
            "identity": identity.model_dump(mode="json", by_alias=True),
            "occupation": form.occupation.model_dump(mode="json", by_alias=True),
            "banking": banking.model_dump(mode="json", by_alias=True),
            "co_applicant": (
                form.co_applicant.model_dump(mode="json", by_alias=True) if form.co_applicant else None
            ),
        }
    )

    return ApplicationModel(
        tenant_id=tenant_row_id,
        entity_type=identity.entity_type.value,
        applicant_name=identity.display_name,
        pan_masked=redact_pan(identity.primary_pan),
        contact_email=contact_email,
        contact_phone=contact_phone,
        is_nri=engine_payload["is_nri"],
        pincode=form.address.pincode if form.address else None,
        city_name=form.address.city_name if form.address else None,
        state_name=form.address.state_name if form.address else None,
        resident_details=form.address.resident_details.value if form.address else None,
        profile_type=form.occupation.profile_type,
        occupation=engine_payload["occupation"],
        property_status=engine_payload["property_status"],
        guarantor_provided=engine_payload["guarantor_provided"],
        business_establishment_date=engine_payload.get("business_establishment_date"),
        current_itr_amount=engine_payload.get("current_itr"),
        business_itr_years=engine_payload.get("business_itr_years"),
        prev_itr_amount=engine_payload.get("previous_itr"),
        selected_bank=banking.selected_bank.value,
        loan_type=banking.loan_type.value,
        existing_account_bank=banking.existing_account_bank.value,
        existing_car_loan_bank=banking.existing_car_loan_bank.value,
        cibil_score=banking.cibil_score,
        cibil_pl_score=banking.cibil_pl_score,
        dpd_count=len(bureau["dpd_history"]),
        max_dpd_days=banking.dpd,
        loan_enquiry_count=1 if banking.has_loan_enquiry else 0,
        currently_outstanding=banking.currently_outstanding,
        write_off_amount=bureau["write_off_amount"],
        write_off_type=bureau["write_off_type"],
        co_applicant_age_relation=(
            form.co_applicant.age_relation.value if form.co_applicant else None
        ),
        co_applicant_income_relation=(
            form.co_applicant.income_relation.value if form.co_applicant else None
        ),
        status=evaluation["status"],
        overall_eligible=evaluation["overall_eligible"],
        entity_detail_json=entity_detail,
    )


async def _persist_form_evaluation(
    db: AsyncSession,
    form: OnboardingFormRequest,
    engine_payload: Dict[str, Any],
    evaluation: Dict[str, Any],
    tenant_id: str,
) -> Tuple[Optional[str], bool]:
    """Write the application, its rule-execution trail and the compliance audit
    row in one transaction. Returns (application_id, persisted)."""
    tenant_row_id = _tenant_row_id(tenant_id)
    try:
        app_record = _build_application_record(form, engine_payload, evaluation, tenant_row_id)
        db.add(app_record)
        await db.flush()

        db.add(
            RuleExecutionModel(
                application_id=app_record.id,
                tenant_id=tenant_row_id,
                bank_code=app_record.selected_bank,
                eligible=evaluation["overall_eligible"],
                rejection_count=len(evaluation["rejection_reasons"]),
                executed_rules_count=evaluation["executed_rules_count"],
                execution_time_ms=evaluation["execution_time_ms"],
                rejection_reasons_json=json.dumps(evaluation["rejection_reasons"]),
                bank_eligibility_json=evaluation["bank_eligibility"],
                evaluation_report_json=evaluation["evaluation_report"],
            )
        )
        db.add(
            AuditLogModel(
                tenant_id=tenant_row_id,
                action=AUDIT_ACTION_FORM_EVALUATION,
                performed_by=tenant_id,
                entity_type=app_record.entity_type,
                resource_id=app_record.id,
                details_document={
                    "status": evaluation["status"],
                    "selected_bank": app_record.selected_bank,
                    "profile_type": app_record.profile_type,
                    "rejection_reasons": evaluation["rejection_reasons"],
                    "bank_eligibility": evaluation["bank_eligibility"],
                    "submission": app_record.entity_detail_json,
                },
            )
        )
        return app_record.id, True
    except Exception as e:
        await db.rollback()
        logger.warning(f"DB persistence bypassed for form evaluation due to schema / connection state: {e}")
        return None, False


@router.post("/evaluate/form", response_model=OnboardingFormEvaluationResponse)
async def evaluate_onboarding_form(
    form: OnboardingFormRequest,
    tenant_id: str = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Evaluate a 5-step onboarding wizard submission (Individual / Company / HUF).

    The polymorphic payload is validated against the entity-type branch it
    declares, flattened into the bank-matrix input vocabulary in memory, scored
    against the RAM ruleset (< 10 ms), and persisted with a PII-redacted audit
    trail — all inside the 80 ms CRUD budget.
    """
    start_time = time.perf_counter()

    engine_payload = form.to_engine_payload()

    log_safe_payload = redact_pii(engine_payload)
    logger.info(
        f"Evaluating {form.identity.entity_type.value} onboarding form for tenant "
        f"'{tenant_id}': {log_safe_payload}"
    )

    await set_tenant_rls_context(db, tenant_id)

    evaluation = await bre_engine_service.evaluate_application(engine_payload, tenant_id=tenant_id)

    application_id, persisted = await _persist_form_evaluation(
        db, form, engine_payload, evaluation, tenant_id
    )

    total_time_ms = round((time.perf_counter() - start_time) * 1000, 3)

    return OnboardingFormEvaluationResponse(
        success=True,
        status=evaluation["status"],
        overall_eligible=evaluation["overall_eligible"],
        executed_rules_count=evaluation["executed_rules_count"],
        execution_time_ms=total_time_ms,
        rejection_reasons=_rejection_details(evaluation),
        bank_eligibility=evaluation["bank_eligibility"],
        # The per-bank audit trail the review screen's collapsible cards and the
        # PDF/Excel exports render. It was being persisted but never returned,
        # so the wizard's audit cards had nothing to open.
        evaluation_report=evaluation["evaluation_report"],
        application_id=application_id,
        entity_type=form.identity.entity_type,
        selected_bank=form.banking.selected_bank,
        persisted=persisted,
    )


# --------------------------------------------------------------------------- #
# Document export
# --------------------------------------------------------------------------- #

EXPORT_MEDIA_TYPES = {
    "excel": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "pdf": "application/pdf",
}


def _applicant_parameters(app_row: ApplicationModel) -> Dict[str, Any]:
    """Report header fields, drawn from the persisted row.

    PAN is already masked on the row (`AB******4F`) — the raw value never
    reaches the database, so the export cannot leak it.
    """
    return {
        "Application ID": app_row.id,
        "Status": app_row.status,
        "Entity Type": app_row.entity_type,
        "Applicant": app_row.applicant_name,
        "PAN (masked)": app_row.pan_masked,
        "Primary Bank": app_row.selected_bank,
        "Loan Type": app_row.loan_type,
        "Profile": app_row.profile_type,
        "Occupation": app_row.occupation,
        "Property Status": app_row.property_status,
        "Pincode": app_row.pincode,
        "CIBIL Score": app_row.cibil_score,
        "Max DPD (days)": app_row.max_dpd_days,
        "Loan Enquiries": app_row.loan_enquiry_count,
        "Currently Outstanding": app_row.currently_outstanding,
        "Write-off Amount": app_row.write_off_amount,
        "Write-off Type": app_row.write_off_type,
        "Business ITR Years": app_row.business_itr_years,
        "Evaluated At": app_row.created_at.isoformat() if app_row.created_at else None,
    }


@router.get("/applications/{application_id}/export")
async def export_application_report(
    application_id: str,
    format: Literal["pdf", "excel"] = Query("pdf", description="Document format."),
    tenant_id: str = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Stream the evaluation audit report as a PDF or Excel workbook.

    Built entirely in memory (`BytesIO`) — no temp files on the request path.
    """
    await set_tenant_rls_context(db, tenant_id)

    app_row = (
        await db.execute(select(ApplicationModel).where(ApplicationModel.id == application_id))
    ).scalar_one_or_none()
    if app_row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Application {application_id} not found.")

    execution = (
        await db.execute(
            select(RuleExecutionModel).where(RuleExecutionModel.application_id == application_id)
        )
    ).scalar_one_or_none()
    report = (execution.evaluation_report_json if execution else None) or {}
    if not report:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Application {application_id} has no stored evaluation report to export.",
        )

    parameters = _applicant_parameters(app_row)
    stream = build_pdf(parameters, report) if format == "pdf" else build_excel(parameters, report)
    suffix = "pdf" if format == "pdf" else "xlsx"
    filename = f"flowbre-eligibility-{application_id}.{suffix}"

    logger.info(f"Exported {format} report for application {application_id} (tenant '{tenant_id}')")
    return StreamingResponse(
        stream,
        media_type=EXPORT_MEDIA_TYPES[format],
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# --------------------------------------------------------------------------- #
# Document extraction & OTP verification (add-on.md)
#
# These sit OUTSIDE the < 80 ms CRUD budget by nature: Tesseract takes seconds.
# They run in a worker thread so the evaluation path keeps its latency, and the
# uploaded document is never written to a durable store — only the extracted
# field survives the request, and Aadhaar only ever in masked form.
# --------------------------------------------------------------------------- #

DOCUMENT_EXTRACTORS = {"pan": extract_pan_card, "aadhaar": extract_aadhaar_card}


@router.post("/documents/cibil/extract", response_model=CibilExtractionResponse)
async def extract_cibil_report_document(
    file: UploadFile = File(..., description="CIBIL consumer report PDF, up to 5 MB."),
    tenant_id: str = Depends(get_current_tenant),
):
    """Parse a CIBIL report with the Rust engine and return Step-4 bureau fields."""
    content = await file.read()
    filename = file.filename or "cibil-report.pdf"

    try:
        extracted, extraction_status, message = await extract_cibil_report(
            content, file.content_type, filename
        )
    except CibilEngineError as exc:
        # A missing engine is an operator problem, not a bad request, and never
        # a fabricated bureau history: the applicant types the values in instead.
        logger.error(f"CIBIL engine unavailable for tenant '{tenant_id}': {exc}")
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc))

    return CibilExtractionResponse(
        success=extraction_status == "SUCCESS",
        filename=filename,
        size_bytes=len(content),
        status=extraction_status,
        message=message,
        extracted=extracted,
    )


@router.post("/documents/{document_type}/extract", response_model=DocumentExtractionResponse)
async def extract_document(
    document_type: Literal["pan", "aadhaar"],
    file: UploadFile = File(..., description="JPEG, PNG or PDF, up to 5 MB."),
    tenant_id: str = Depends(get_current_tenant),
):
    """Read a PAN or Aadhaar card with openbharatocr and return its fields."""
    content = await file.read()
    filename = file.filename or f"{document_type}-upload"
    validate_upload(content, file.content_type, filename)

    # Never raises for a missing OCR stack: `simulated` says which path ran.
    extracted, simulated = await DOCUMENT_EXTRACTORS[document_type](
        content, file.content_type, filename
    )
    logger.info(
        f"Extracted {document_type} for tenant '{tenant_id}' from "
        f"'{redact_pii(filename)}' ({len(content)} bytes, simulated={simulated}): "
        f"{redact_pii(dict(extracted))}"
    )
    return DocumentExtractionResponse(
        document_type=document_type,
        filename=filename,
        size_bytes=len(content),
        extracted=extracted,
        populated=any(v for v in extracted.values()),
        simulated=simulated,
    )


@router.post("/verification/otp/send", response_model=OtpSendResponse)
async def send_verification_otp(
    payload: OtpSendRequest,
    tenant_id: str = Depends(get_current_tenant),
):
    """Issue a demo OTP challenge for a PAN (email) or mobile number."""
    result = send_otp(payload.channel, payload.target)
    logger.info(f"OTP requested by tenant '{tenant_id}' via {payload.channel}")
    return OtpSendResponse(**result)


@router.post("/verification/otp/verify", response_model=OtpVerifyResponse)
async def confirm_verification_otp(
    payload: OtpVerifyRequest,
    tenant_id: str = Depends(get_current_tenant),
):
    """Check a code against its challenge. Correct codes verify exactly once."""
    return OtpVerifyResponse(**verify_otp(payload.challenge_id, payload.code))
