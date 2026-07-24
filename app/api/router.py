from fastapi import APIRouter

from app.api.v1.endpoints import auth, health, onboarding, rules

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health & Diagnostics"])
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(onboarding.router, prefix="/onboarding", tags=["Onboarding BRE Evaluation"])
api_router.include_router(rules.router, prefix="/rules", tags=["JDM Rule Management"])
