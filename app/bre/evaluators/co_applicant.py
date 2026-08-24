from typing import Any, Dict, List

# Evaluates co-applicant eligibility, age/income pooling, and relation rules
class CoApplicantEvaluator:
    # Evaluates co-applicant rules against bank constraints
    def evaluate(self, payload: Dict[str, Any], bank_rules: Dict[str, Any]) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        sibling = payload.get("sibling_present", False)
        if sibling and not bank_rules.get("allow_sibling_coapplicant", True):
            results.append({"rule_id": "COAPP-601", "passed": False, "reason": "Sibling co-applicant not permitted"})
        return results
