# Root APIRouter aggregating all versioned domain sub-routers
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

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health & Diagnostics"])
api_router.include_router(auth.router, prefix="/auth", tags=["Universal Auth Server"])
api_router.include_router(onboarding.router, prefix="/onboarding", tags=["Onboarding BRE Evaluation"])
api_router.include_router(documents.router, prefix="/onboarding/documents", tags=["Document Extraction & OCR"])
api_router.include_router(verification.router, prefix="/onboarding/verification", tags=["Identity & OTP Verification"])
api_router.include_router(applications.router, prefix="/onboarding/applications", tags=["Applications & Exports"])
api_router.include_router(tenants.router, prefix="/tenants", tags=["Tenant Management"])
api_router.include_router(pipeline.router, prefix="/pipeline", tags=["Sales Pipeline & Leads"])
api_router.include_router(approvals.router, prefix="/approvals", tags=["Underwriting & Approvals"])
api_router.include_router(commissions.router, prefix="/commissions", tags=["Commissions & Ledgers"])
api_router.include_router(regional.router, prefix="/regional", tags=["Regional Hierarchy"])
api_router.include_router(telemetry.router, prefix="/telemetry", tags=["Perfect Logs & Telemetry"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["Real-time Notifications"])
