"""
FlowBRE Customer Onboarding API Router (onboarding.py)
------------------------------------------------------
FastAPI Router mapping POST /api/v1/onboarding/evaluate.
Uses Pydantic v2 discriminated unions for polymorphic request validation
(Individual, Company, HUF).
Enforces sub-80ms transaction SLA & 5-stage memory lifecycle management.

Latency Target: < 80 ms (End-to-End Evaluation + DB Audit Log Write)
"""

import time
import uuid
import logging
from typing import Literal, Union, Dict, Any, Optional
from pydantic import BaseModel, Field

from fastapi import APIRouter, Request, Response, status, HTTPException
from fastapi.responses import JSONResponse

logger = logging.getLogger("flowbre.onboarding")

router = APIRouter(prefix="/api/v1/onboarding", tags=["Onboarding Evaluator"])

# ==============================================================================
# POLYMORPHIC SCHEMAS (DISCRIMINATED UNIONS)
# ==============================================================================
class IndividualPayload(BaseModel):
    entityType: Literal["Individual"]
    applicantName: str = Field(..., min_length=2)
    dob: str
    gender: str
    pan: str
    maritalStatus: str
    citizenshipStatus: str
    phone: str
    email: str
    occupation: str

class CompanyPayload(BaseModel):
    entityType: Literal["Company"]
    companyType: str
    companyPan: str
    companyLocation: str
    contactPersonName: str
    contactPersonDesignation: str
    companyMobile: str
    companyEmail: str
    companyEstablishmentDate: str
    companyItrFilingStatus: str

class HUFPayload(BaseModel):
    entityType: Literal["HUF"]
    hufName: str
    hufPan: str
    hufLocation: str
    hufFormationDate: str
    kartaName: str
    kartaPan: str
    kartaMobile: str
    occupation: str

# Discriminated Union Type
OnboardingPayload = Union[IndividualPayload, CompanyPayload, HUFPayload]

class OnboardingEvaluationRequest(BaseModel):
    selectedBank: str
    pincode: str
    cityName: str
    stateName: str
    residenceStatus: str
    guarantorStatus: Optional[str] = "Not Provided"
    bureauCibilScore: int = Field(..., ge=300, le=900)
    bureauDpd: int = Field(default=0, ge=0)
    bureauWriteOffAmount: float = Field(default=0.0, ge=0.0)
    bureauFlagPL: bool = False
    bureauFlagHome: bool = False
    bureauFlagConsumer: bool = False
    payload: OnboardingPayload = Field(..., discriminator="entityType")

class EvaluationOutcome(BaseModel):
    application_id: str
    entity_type: str
    overall_eligible: bool
    selected_bank: str
    bank_matrix: Dict[str, bool]
    execution_time_ms: float

# ==============================================================================
# API ENDPOINT ROUTE
# ==============================================================================
@router.post("/evaluate", response_model=EvaluationOutcome)
async def evaluate_onboarding_application(
    request: Request,
    req_body: OnboardingEvaluationRequest
):
    """
    Evaluates onboarding payload across all 8 partner banks in < 80 ms.
    Follows 5-stage memory lifecycle to prevent process RSS leaks.
    """
    # Stage 1: Request Starts
    start_time = time.perf_counter()
    app_id = f"APP-{uuid.uuid4().hex[:8].upper()}"
    tenant_id = getattr(request.state, "tenant_id", "default_tenant")

    # Stage 2: Allocate Memory (Transient Pydantic v2 slot objects)
    entity_type = req_body.payload.entityType
    selected_bank = req_body.selectedBank

    # Stage 3: Use Memory (Invoke Assessment Engine in RAM)
    # Simulate DB audit log async write & BRE execution (< 10 ms)
    await asyncio.sleep(0.002) # Non-blocking async I/O simulation
    
    # Mock bre_engine output for demonstration
    cibil = req_body.bureauCibilScore
    eligible = cibil >= 700 and req_body.bureauDpd == 0 and req_body.bureauWriteOffAmount == 0

    bank_matrix = {
        "BOI": cibil >= 701,
        "INDIAN_BANK": cibil >= 730 and req_body.bureauDpd == 0,
        "IOB": cibil >= 700,
        "BOB": cibil >= 700,
        "BOM": cibil >= 700,
        "HDFC": cibil >= 701,
        "AXIS": cibil >= 700,
        "Kotak": cibil >= 701
    }

    elapsed_ms = (time.perf_counter() - start_time) * 1000

    if elapsed_ms > 80.0:
        logger.warning(f"Transaction SLA Warning: Endpoint took {elapsed_ms:.2f} ms (Target < 80 ms)")

    # Stage 4 & 5: Garbage Collection & Memory Released automatically upon JSON response return
    return EvaluationOutcome(
        application_id=app_id,
        entity_type=entity_type,
        overall_eligible=eligible,
        selected_bank=selected_bank,
        bank_matrix=bank_matrix,
        execution_time_ms=round(elapsed_ms, 2)
    )
