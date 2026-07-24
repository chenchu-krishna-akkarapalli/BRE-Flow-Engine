from fastapi import APIRouter

from app.api.v1.endpoints import auth, health, onboarding

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health & Diagnostics"])
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(onboarding.router, prefix="/onboarding", tags=["Onboarding BRE Evaluation"])
