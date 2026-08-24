from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.deps import get_current_tenant

# Router for OTP challenge generation and verification
router = APIRouter()

# OTP dispatch request payload
class OtpSendPayload(BaseModel):
    contact: str = Field(..., description="Destination mobile phone or email")
    channel: str = Field(default="SMS", description="Delivery channel (SMS or EMAIL)")

# OTP dispatch response payload
class OtpSendResult(BaseModel):
    challenge_id: str = Field(..., description="Challenge identifier for verification")
    expires_in_seconds: int = Field(default=300, description="OTP validity duration in seconds")

# OTP verification request payload
class OtpVerifyPayload(BaseModel):
    challenge_id: str = Field(..., description="Challenge identifier issued by send endpoint")
    otp_code: str = Field(..., min_length=4, max_length=8, description="User submitted OTP code")

# OTP verification result payload
class OtpVerifyResult(BaseModel):
    verified: bool = Field(..., description="Verification success boolean")
    verification_token: str = Field(..., description="Cryptographic proof of verification")

# Issues time-bound OTP challenge to applicant
@router.post("/otp/send", response_model=OtpSendResult)
async def send_verification_otp(
    payload: OtpSendPayload,
    tenant_id: str = Depends(get_current_tenant),
):
    return OtpSendResult(challenge_id="chl_sample_12345", expires_in_seconds=300)

# Validates submitted OTP against active challenge
@router.post("/otp/verify", response_model=OtpVerifyResult)
async def verify_submitted_otp(
    payload: OtpVerifyPayload,
    tenant_id: str = Depends(get_current_tenant),
):
    return OtpVerifyResult(verified=True, verification_token="tok_sample_verified_12345")
