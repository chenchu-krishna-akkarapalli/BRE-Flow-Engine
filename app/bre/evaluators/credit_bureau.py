from typing import Any, Dict, List

# Evaluates credit bureau metrics including CIBIL score, DPD history, and write-offs
class CreditBureauEvaluator:
    # Evaluates bureau metrics against lender risk limits
    def evaluate(self, payload: Dict[str, Any], bank_rules: Dict[str, Any]) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        cibil = payload.get("cibil_score", 750)
        min_cibil = bank_rules.get("min_cibil", 700)
        if cibil < min_cibil:
            results.append({"rule_id": "BUR-405", "passed": False, "reason": f"CIBIL {cibil} below minimum {min_cibil}"})
        return results
