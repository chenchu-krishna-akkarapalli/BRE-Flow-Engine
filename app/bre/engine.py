import time
from typing import Any, Dict, Optional

from app.bre.matrix_rules import BANK_MATRIX_RULES

# High-throughput RAM rule execution orchestrator executing under 10ms
class BREEngine:
    # Orchestrates in-memory policy rules evaluation across partner banks
    def evaluate(self, payload: Dict[str, Any], tenant_id: Optional[str] = "default") -> Dict[str, Any]:
        start_time = time.perf_counter()
        bank_code = payload.get("selected_bank", "BOI")
        bank_rules = BANK_MATRIX_RULES.get(bank_code, {})
        reasons = []
        age = payload.get("age", 25)
        if age < bank_rules.get("min_age", 21):
            reasons.append(f"Age {age} is below minimum 21")
        eligible = len(reasons) == 0
        elapsed_ms = (time.perf_counter() - start_time) * 1000.0
        return {
            "eligible": eligible,
            "bank_code": bank_code,
            "rejection_reasons": reasons,
            "execution_time_ms": elapsed_ms,
        }
