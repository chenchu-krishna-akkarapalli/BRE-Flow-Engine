from typing import Any, Dict, List

# Evaluates residential property ownership, office premises, and guarantor requirements
class ResidenceEvaluator:
    # Evaluates residence and guarantor policy rules
    def evaluate(self, payload: Dict[str, Any], bank_rules: Dict[str, Any]) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        prop_status = payload.get("property_status")
        guarantor = payload.get("guarantor_provided", False)
        if prop_status in {"RENTED", "SEPARATE_BOTH_RENTED"} and not guarantor:
            results.append({"rule_id": "RES-205", "passed": False, "reason": "Guarantor required for rented premises"})
        return results
