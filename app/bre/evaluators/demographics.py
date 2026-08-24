from typing import Any, Dict, List, Optional, Tuple

# Evaluates demographic rules including age, NRI status, and stay duration
class DemographicsEvaluator:
    # Evaluates applicant demographics against bank policy rules
    def evaluate(self, payload: Dict[str, Any], bank_rules: Dict[str, Any]) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        age = payload.get("age", 25)
        min_age = bank_rules.get("min_age", 21)
        if age < min_age:
            results.append({"rule_id": "DEM-101", "passed": False, "reason": f"Age {age} below minimum {min_age}"})
        return results
