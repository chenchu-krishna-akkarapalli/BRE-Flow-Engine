from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, Field

class RoleHierarchyNodeBase(BaseModel):
    role_key: str = Field(..., description="Unique role key, e.g. AREA_MANAGER")
    display_name: str = Field(..., description="Human-readable role label")
    department: str = Field("SALES", description="Department grouping: SALES, CORPORATE, etc.")
    parent_role_key: Optional[str] = Field(None, description="Direct parent role key in hierarchy")
    tier_level: int = Field(6, description="Computed hierarchy depth tier: 0 for root, 1 for heads, 2+ for downwards flow")
    is_system_role: bool = Field(False, description="Whether this is a protected system role")
    description: Optional[str] = Field(None, description="Operational scope and description")
    allowed_subordinates: List[str] = Field(default_factory=list, description="List of subordinate role keys")
    validation_constraints: List[str] = Field(default_factory=list, description="Rules and audit checks applied to role")

class RoleHierarchyNodeCreate(BaseModel):
    role_key: str = Field(..., description="Uppercase identifier, e.g. ZONAL_HEAD")
    display_name: str = Field(..., description="Display title for UI")
    department: str = Field("SALES", description="Department e.g. SALES or CORPORATE")
    parent_role_key: Optional[str] = Field(None, description="Direct reporting node")
    description: Optional[str] = None
    validation_constraints: Optional[List[str]] = None

class RoleHierarchyNodeResponse(RoleHierarchyNodeBase):
    id: str
    tenant_id: str
    created_at: datetime
    updated_at: datetime

class RoleUserAssignment(BaseModel):
    id: str
    tenant_id: str
    name: str
    email: str
    role_key: str
    status: str = "ACTIVE"
    hierarchy_tier: int
