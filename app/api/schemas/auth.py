from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

# Individual navigation item node in role navigation tree
class NavItemNode(BaseModel):
    name: str = Field(..., description="Navigation label")
    href: str = Field(..., description="Target route URL")
    icon: str = Field(..., description="Lucide icon identifier name")
    badge: Optional[str] = Field(None, description="Optional badge text")
    badgeType: Optional[str] = Field(None, description="Badge styling variant")

# Navigation group section containing categorized navigation items
class NavGroupNode(BaseModel):
    title: str = Field(..., description="Section title")
    items: List[NavItemNode] = Field(default_factory=list, description="Navigation items")

# Authentication challenge request payload
class ChallengeRequest(BaseModel):
    username: str = Field(..., min_length=1, description="Username or user email identifier")
    tenant_id: Optional[str] = Field(None, description="Optional tenant UUID or code override")

# Authentication challenge response payload with tenant scope context
class ChallengeResponse(BaseModel):
    nonce_id: str = Field(..., description="Unique cryptographic nonce identifier")
    nonce: str = Field(..., description="Single-use random challenge nonce")
    salt: Optional[str] = Field(None, description="Cryptographic salt for key derivation")
    challenge_type: str = Field(default="ARGON2_PROOF", description="Challenge type proof")
    tenant_uuid: Optional[str] = Field(None, description="Resolved tenant UUID context")
    tenant_name: Optional[str] = Field(None, description="Resolved tenant organization name")
    role: Optional[str] = Field(None, description="User platform or tenant role")
    email: Optional[str] = Field(None, description="Resolved user email")
    expires_in_seconds: int = Field(default=60, description="Nonce validity window in seconds")

# Verification request proof payload
class VerifyChallengeRequest(BaseModel):
    username: str = Field(..., min_length=1, description="Username or user identifier")
    nonce_id: str = Field(..., description="Nonce ID issued during challenge")
    proof_signature: str = Field(..., description="Derived hash proof signature")
    tenant_id: Optional[str] = Field(None, description="Target tenant UUID")
    mfa_code: Optional[str] = Field(None, description="TOTP code if MFA is active")

# Scoped JWT authentication response with auto-generated role navigation nodes
class AuthTokenResponse(BaseModel):
    access_token: str = Field(..., description="Signed access JWT token")
    refresh_token: Optional[str] = Field(None, description="Cryptographic refresh token")
    token_type: str = Field(default="bearer", description="OAuth2 token scheme")
    expires_in_minutes: int = Field(default=1440, description="Token TTL in minutes")
    tenant_uuid: Optional[str] = Field(None, description="Bound tenant dynamic UUID")
    user_id: str = Field(..., description="Authenticated user account ID")
    username: str = Field(..., description="User unique username")
    role: str = Field(..., description="Primary RBAC role key")
    permissions: List[str] = Field(default_factory=list, description="Assigned granular permissions")
    role_nodes: List[NavGroupNode] = Field(default_factory=list, description="Auto-generated role navigation nodes")

# Token refresh request payload
class TokenRefreshRequest(BaseModel):
    refresh_token: str = Field(..., min_length=1, description="Refresh token string")

# Active user session profile
class UserSessionInfo(BaseModel):
    user_id: str = Field(..., description="User unique identifier")
    username: str = Field(..., description="User account username")
    email: Optional[str] = Field(None, description="User verified email")
    tenant_id: Optional[str] = Field(None, description="Bound tenant identifier")
    role: str = Field(..., description="Assigned governance role")
    permissions: List[str] = Field(default_factory=list, description="List of permission codes")
    role_nodes: List[NavGroupNode] = Field(default_factory=list, description="Authorized navigation items")
