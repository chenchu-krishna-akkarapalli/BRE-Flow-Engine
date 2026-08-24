# Version 1 API aggregator router mounting all domain endpoint modules
from fastapi import APIRouter

from app.api.v1.endpoints import (
    applications,
    approvals,
    auth,
    commissions,
    documents,
    health,
    notifications,
    onboarding,
    pipeline,
    regional,
    telemetry,
    tenants,
    verification,
)

router = APIRouter()

router.include_router(health.router, tags=["Health & Diagnostics"])
router.include_router(auth.router, prefix="/auth", tags=["Universal Auth Server"])
router.include_router(onboarding.router, prefix="/onboarding", tags=["Onboarding BRE Evaluation"])
router.include_router(documents.router, prefix="/onboarding/documents", tags=["Document Extraction & OCR"])
router.include_router(verification.router, prefix="/onboarding/verification", tags=["Identity & OTP Verification"])
router.include_router(applications.router, prefix="/onboarding/applications", tags=["Applications & Exports"])
router.include_router(tenants.router, prefix="/tenants", tags=["Tenant Management"])
router.include_router(pipeline.router, prefix="/pipeline", tags=["Sales Pipeline & Leads"])
router.include_router(approvals.router, prefix="/approvals", tags=["Underwriting & Approvals"])
router.include_router(commissions.router, prefix="/commissions", tags=["Commissions & Ledgers"])
router.include_router(regional.router, prefix="/regional", tags=["Regional Hierarchy"])
router.include_router(telemetry.router, prefix="/telemetry", tags=["Perfect Logs & Telemetry"])
router.include_router(notifications.router, prefix="/notifications", tags=["Real-time Notifications"])
