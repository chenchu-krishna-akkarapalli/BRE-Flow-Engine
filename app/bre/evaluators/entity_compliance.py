from typing import Any, Dict, List

# Evaluates legal entity compliance including HUF restrictions and corporate registration
class EntityComplianceEvaluator:
    # Evaluates entity structure against bank policies
    def evaluate(self, payload: Dict[str, Any], bank_rules: Dict[str, Any]) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        entity_type = payload.get("entity_type")
        if entity_type == "HUF" and not bank_rules.get("allow_huf", True):
            results.append({"rule_id": "ENT-502", "passed": False, "reason": "Bank disallows HUF onboarding"})
        return results
