from datetime import datetime, timezone
import json
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status
from app.api.deps import get_current_tenant
from app.api.schemas.rules import JDMRuleDeployRequest, JDMRuleDeployResponse, RuleMetadataResponse
from app.services.bre_engine import ZEN_RULES_DIR, bre_engine_service

router = APIRouter()


@router.post("/deploy", response_model=JDMRuleDeployResponse)
async def deploy_jdm_rules(
    payload: JDMRuleDeployRequest,
    current_tenant: str = Depends(get_current_tenant),
):
    """Deploys a custom JDM JSON decision model AST for a tenant and hot-reloads it into RAM."""
    target_tenant = payload.tenant_id or current_tenant
    tenant_dir = ZEN_RULES_DIR / "tenants" / target_tenant
    tenant_dir.mkdir(parents=True, exist_ok=True)

    file_path = tenant_dir / f"{payload.rule_name}.json"
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(payload.jdm_content, f, indent=2)

    # Hot reload compiled rules into RAM
    bre_engine_service.load_all_rules()

    return JDMRuleDeployResponse(
        success=True,
        message=f"Successfully deployed JDM rule '{payload.rule_name}' for tenant '{target_tenant}'.",
        rule_name=payload.rule_name,
        tenant_id=target_tenant,
        deployed_at=datetime.now(timezone.utc).isoformat(),
    )


@router.get("/{rule_name}", response_model=RuleMetadataResponse)
async def get_rule_metadata(rule_name: str, tenant_id: str = Depends(get_current_tenant)):
    """Fetches JDM metadata for a compiled decision model in < 30 ms."""
    rule_data = bre_engine_service._get_rule_set(rule_name, tenant_id=tenant_id)
    if not rule_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Rule set '{rule_name}' not found.",
        )

    rules = rule_data.get("rules", []) if isinstance(rule_data, dict) else []
    categories = list(set(r.get("category", "General") for r in rules))

    return RuleMetadataResponse(
        rule_name=rule_name,
        description=rule_data.get("description", "FlowBRE Decision Model"),
        total_rules_count=len(rules),
        categories=categories,
    )
