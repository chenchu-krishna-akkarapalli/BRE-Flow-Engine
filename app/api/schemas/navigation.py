from typing import List, Optional
from pydantic import BaseModel, Field

class NavModuleItem(BaseModel):
    code: str = Field(..., description="Module code identifier e.g. PIPELINE, APPROVALS")
    name: str = Field(..., description="Display title for the sidebar link")
    path: str = Field(..., description="Resolved route path with tenantUuid interpolated")
    icon: str = Field(..., description="Lucide icon name identifier")
    badge: Optional[str] = Field(None, description="Optional highlight badge text")
    badge_type: Optional[str] = Field(None, description="Badge styling variant: brand, emerald, amber, rose")
    can_create: bool = Field(False, description="Permission to create entries in module")
    can_edit: bool = Field(False, description="Permission to edit entries in module")
    can_approve: bool = Field(False, description="Permission to approve underwriting in module")

class NavSectionGroup(BaseModel):
    title: str = Field(..., description="Category group title e.g. Portal Navigation")
    section_key: str = Field(..., description="Category identifier key")
    items: List[NavModuleItem] = Field(default_factory=list, description="List of accessible items in group")

class NavigationModulesResponse(BaseModel):
    tenant_id: str
    role: str
    sections: List[NavSectionGroup]

# Schemas for Dynamic Module Catalog Management
class ModuleCatalogItem(BaseModel):
    id: Optional[str] = None
    code: str
    name: str
    route_template: str
    icon_name: str
    section_key: str
    section_title: str
    badge: Optional[str] = None
    badge_type: Optional[str] = None
    min_tier_level: int = 6
    is_core: bool = False
    is_active: bool = True
    sort_order: int = 0
    description: Optional[str] = None

class ModuleCatalogCreate(BaseModel):
    code: str = Field(..., description="Unique module code identifier, uppercase e.g. DOC_VAULT")
    name: str = Field(..., description="Display title for the module")
    route_template: str = Field(..., description="Route pattern e.g. /{tenant}/documents")
    icon_name: str = Field("FileText", description="Lucide icon identifier")
    section_key: str = Field("PORTAL_NAV", description="Section key identifier")
    section_title: str = Field("Portal Navigation", description="Section display title")
    badge: Optional[str] = None
    badge_type: Optional[str] = None
    min_tier_level: int = 6
    is_core: bool = False
    is_active: bool = True
    sort_order: int = 0
    description: Optional[str] = None

class ModuleCatalogUpdate(BaseModel):
    name: Optional[str] = None
    route_template: Optional[str] = None
    icon_name: Optional[str] = None
    section_key: Optional[str] = None
    section_title: Optional[str] = None
    badge: Optional[str] = None
    badge_type: Optional[str] = None
    min_tier_level: Optional[int] = None
    is_core: Optional[bool] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None
    description: Optional[str] = None

# Role Permission Matrix Schemas
class RolePermissionMatrixItem(BaseModel):
    role_key: str
    module_code: str
    can_view: bool = True
    can_create: bool = False
    can_edit: bool = False
    can_approve: bool = False

class RolePermissionMatrixUpdateRequest(BaseModel):
    permissions: List[RolePermissionMatrixItem]

# Tenant Module Entitlement Schemas
class TenantModuleEntitlementItem(BaseModel):
    tenant_id: str
    module_code: str
    is_enabled: bool = True
    custom_name: Optional[str] = None

class TenantModuleToggleRequest(BaseModel):
    is_enabled: bool = True
    custom_name: Optional[str] = None

