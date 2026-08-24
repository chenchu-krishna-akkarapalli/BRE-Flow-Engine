from typing import Any, Dict

# Static domain policy discretization for sub-10 microsecond rule matching
class PolicyDiscretizer:
    # Discretizes continuous variables into discrete matrix buckets
    def discretize(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        discretized = dict(payload)
        age = payload.get("age", 0)
        discretized["age_bucket"] = "<21" if age < 21 else "21-60" if age <= 60 else ">60"
        return discretized
