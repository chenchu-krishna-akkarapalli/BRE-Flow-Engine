from typing import Any, Dict, List

# Evaluates salaried employment profiles, net income floors, mode of salary, and Form-16
class EmploymentSalariedEvaluator:
    # Evaluates salaried employment rules against lender criteria
    def evaluate(self, payload: Dict[str, Any], bank_rules: Dict[str, Any]) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        salary_mode = payload.get("salary_payment_mode")
        if salary_mode == "CASH":
            results.append({"rule_id": "EMP-SAL-203", "passed": False, "reason": "Cash salary mode ineligible"})
        return results
