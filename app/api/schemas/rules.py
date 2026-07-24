from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class JDMRuleDeployRequest(BaseModel):
    rule_name: str = Field(..., description="Target rule file name e.g. risk_assessment")
    tenant_id: str = Field(default="default", description="Target tenant ID for deployment")
    jdm_content: Dict[str, Any] = Field(..., description="Compiled JDM JSON AST decision model")


class JDMRuleDeployResponse(BaseModel):
    success: bool = True
    message: str
    rule_name: str
    tenant_id: str
    deployed_at: str


class RuleMetadataResponse(BaseModel):
    rule_name: str
    description: str
    total_rules_count: int
    categories: List[str]
