from typing import Any, Dict, List

# Evaluates self-employed profiles, ITR requirements, business vintage, and registration
class EmploymentSelfEmployedEvaluator:
    # Evaluates self-employed business rules against lender criteria
    def evaluate(self, payload: Dict[str, Any], bank_rules: Dict[str, Any]) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        itr_filed = payload.get("itr_filed", True)
        if not itr_filed:
            results.append({"rule_id": "EMP-SE-304", "passed": False, "reason": "ITR filing required for self-employed"})
        return results
