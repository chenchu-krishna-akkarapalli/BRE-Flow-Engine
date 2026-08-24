from typing import Any, Dict, List

# Compiles per-bank passed and failed policy evaluation audit reports
class BreReportGenerator:
    # Aggregates multi-bank evaluation outcomes into structured reports
    def compile_report(self, evaluation_results: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "eligible": evaluation_results.get("overall_eligible", False),
            "bank_eligibility": evaluation_results.get("bank_eligibility", {}),
            "rejection_reasons": evaluation_results.get("rejection_reasons", []),
            "evaluation_report": evaluation_results.get("evaluation_report", {}),
        }
