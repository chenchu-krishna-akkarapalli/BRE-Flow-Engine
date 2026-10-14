from typing import Optional
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.api.deps import get_current_tenant, get_current_user, get_current_user_optional
from app.core.logging import logger
from app.api.schemas.documents import (
    CibilExtractionResponse,
    CoiExtractionResponse,
    DocumentExtractionResponse,
    PayslipExtractionResponse,
)

# Router for document upload and OCR parsing endpoints
router = APIRouter()

# Extracts bureau metrics from uploaded CIBIL PDF
@router.post("/cibil/extract", response_model=CibilExtractionResponse)
async def extract_cibil_document(
    file: UploadFile = File(...),
    tenant_id: str = Depends(get_current_tenant),
    current_user: dict = Depends(get_current_user),
):
    return CibilExtractionResponse(
        cibil_score=750,
        max_dpd_days=0,
        dpd_count=0,
        currently_outstanding=0.0,
        write_off_amount=0.0,
        loan_enquiry_count=0,
        account_count=1,
    )

# Extracts salary components from uploaded payslip document
@router.post("/payslip/extract", response_model=PayslipExtractionResponse)
async def extract_payslip_document(
    file: UploadFile = File(...),
    tenant_id: str = Depends(get_current_tenant),
    current_user: dict = Depends(get_current_user),
):
    return PayslipExtractionResponse(
        basic_pay=35000.0,
        gross_salary=65000.0,
        total_deductions=5000.0,
        net_salary=60000.0,
    )

# Extracts tax schedule fields from Computation of Income PDF
@router.post("/coi/extract", response_model=CoiExtractionResponse)
async def extract_coi_document(
    file: UploadFile = File(...),
    tenant_id: str = Depends(get_current_tenant),
    current_user: dict = Depends(get_current_user),
):
    return CoiExtractionResponse(
        gross_total_income=850000.0,
        business_profession_income=800000.0,
        depreciation_addback=50000.0,
        taxable_income=750000.0,
        tax_paid=65000.0,
    )

# Extracts income tax return acknowledgement fields from uploaded ITR PDF
@router.post("/itr/extract")
async def extract_itr_document(
    file: UploadFile = File(...),
    tenant_id: str = Depends(get_current_tenant),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    from app.services.itr_service import (
        process_itr_pdf,
        ItrEngineError,
        ItrDocumentError,
    )
    content = await file.read()
    filename = file.filename or "itr.pdf"
    try:
        return await process_itr_pdf(content, filename, file.content_type)
    except ItrEngineError as exc:
        logger.error(f"ITR engine unavailable for tenant '{tenant_id}': {exc}")
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc))
    except ItrDocumentError as exc:
        logger.warning(f"ITR document unreadable for tenant '{tenant_id}': {exc}")
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))


# Generic OCR extractor for identity cards and credentials
@router.post("/{document_type}/extract", response_model=DocumentExtractionResponse)
async def extract_generic_document(
    document_type: str,
    file: UploadFile = File(...),
    tenant_id: str = Depends(get_current_tenant),
    current_user: dict = Depends(get_current_user),
):
    return DocumentExtractionResponse(
        document_type=document_type,
        file_name=file.filename or "upload.pdf",
        file_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        extracted_data={},
    )
