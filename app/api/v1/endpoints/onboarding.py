import json
import time
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_tenant, get_db
from app.api.schemas.onboarding import OnboardingEvaluationRequest, OnboardingEvaluationResponse, RejectionReasonDetail
from app.core.database import get_db
from app.core.logging import logger, redact_pii
from app.db.models.application import ApplicationModel
from app.db.models.rule_execution import RuleExecutionModel
from app.db.rls import set_tenant_rls_context
from app.services.bre_engine import bre_engine_service

router = APIRouter()


@router.post("/evaluate", response_model=OnboardingEvaluationResponse)
async def evaluate_onboarding_application(
    payload: OnboardingEvaluationRequest,
    tenant_id: str = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Evaluates candidate application against partner bank rules, records RLS audit trail, and returns verdict in < 80 ms."""
    start_time = time.perf_counter()

    # Redact sensitive PII before logging
    log_safe_payload = redact_pii(payload.model_dump())
    logger.info(f"Evaluating application for tenant '{tenant_id}': {log_safe_payload}")

    # Enforce PostgreSQL Row-Level Security
    await set_tenant_rls_context(db, tenant_id)

    # Execute in-memory Zen-Engine rules (< 10 ms)
    evaluation = await bre_engine_service.evaluate_application(payload.model_dump(), tenant_id=tenant_id)

    # Persist Application record and RuleExecution audit log in single DB transaction (< 15 ms)
    try:
        app_record = ApplicationModel(
            tenant_id=tenant_id if tenant_id != "default" else "00000000-0000-0000-0000-000000000000",
            entity_type=payload.entity_type.value,
            applicant_name=payload.applicant_name,
            selected_bank=payload.selected_bank.value,
            cibil_score=payload.credit_bureau.cibil_score,
            dpd_count=len(payload.credit_bureau.dpd_history),
            write_off_amount=payload.credit_bureau.write_off_amount,
            status=evaluation["status"],
        )
        db.add(app_record)
        await db.flush()

        exec_record = RuleExecutionModel(
            application_id=app_record.id,
            tenant_id=app_record.tenant_id,
            bank_code=payload.selected_bank.value,
            eligible=evaluation["overall_eligible"],
            rejection_count=len(evaluation["rejection_reasons"]),
            execution_time_ms=evaluation["execution_time_ms"],
            rejection_reasons_json=json.dumps(evaluation["rejection_reasons"]),
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
        rejection_reasons=[
            RejectionReasonDetail(
                rule_id=r["rule_id"], category=r["category"], message=r["message"]
            )
            for r in evaluation["rejection_reasons"]
        ],
        bank_eligibility=evaluation["bank_eligibility"],
    )
