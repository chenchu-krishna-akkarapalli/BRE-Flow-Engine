"""Business Rules Engine: deterministic credit decisioning over the target schema.

Rules are data, not branches, so they can be versioned and audited. Every fired
rule is returned with its reason, making each decision explainable.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any, Callable, Final

RULESET_VERSION: Final[str] = "bre-2026.02.1"


class Decision(str, Enum):
    APPROVE = "APPROVE"
    REFER = "REFER"
    DECLINE = "DECLINE"


@dataclass(frozen=True, slots=True)
class Rule:
    code: str
    description: str
    decision: Decision
    predicate: Callable[[dict[str, Any]], bool]


def _score(r: dict[str, Any]) -> int:
    return int(r.get("CIBIL_Score") or 0)


def _write_off_total(r: dict[str, Any]) -> int:
    return sum(
        v for v in (r.get("Write_Off_Details") or {}).values() if isinstance(v, (int, float))
    )


def _overdue(r: dict[str, Any]) -> int:
    return int((r.get("Currently_Outstanding") or {}).get("Total_Overdue") or 0)


def _max_recent_dpd(r: dict[str, Any]) -> int:
    """Worst numeric DPD across the two most recent reported years."""
    worst = 0
    for entry in (r.get("DPD") or {}).values():
        if not isinstance(entry, dict):
            continue
        years = sorted((k for k in entry if k.isdigit()), reverse=True)[:2]
        for y in years:
            for v in (entry.get(y) or {}).values():
                if isinstance(v, int):
                    worst = max(worst, v)
    return worst


def _enquiries_30d(r: dict[str, Any]) -> int:
    return int((r.get("Loan_Enquiry") or {}).get("Past_30_Days") or 0)


RULES: Final[tuple[Rule, ...]] = (
    Rule("WO_PRESENT", "Written-off balance reported", Decision.DECLINE,
         lambda r: _write_off_total(r) > 0),
    Rule("DPD_SEVERE", "DPD above 90 days in the last two years", Decision.DECLINE,
         lambda r: _max_recent_dpd(r) > 90),
    Rule("SCORE_LOW", "CIBIL score below 650", Decision.DECLINE,
         lambda r: 0 < _score(r) < 650),
    Rule("OVERDUE_OPEN", "Outstanding overdue balance", Decision.REFER,
         lambda r: _overdue(r) > 0),
    Rule("DPD_MILD", "DPD between 30 and 90 days", Decision.REFER,
         lambda r: 30 <= _max_recent_dpd(r) <= 90),
    Rule("SCORE_THIN", "No usable score reported", Decision.REFER,
         lambda r: _score(r) == 0),
    Rule("ENQUIRY_BURST", "4 or more credit enquiries in 30 days", Decision.REFER,
         lambda r: _enquiries_30d(r) >= 4),
)

_SEVERITY: Final[dict[Decision, int]] = {
    Decision.APPROVE: 0, Decision.REFER: 1, Decision.DECLINE: 2
}


@dataclass(slots=True)
class BreOutcome:
    decision: Decision
    ruleset_version: str
    triggered: list[dict[str, str]]
    signals: dict[str, int]


def evaluate(report: dict[str, Any]) -> BreOutcome:
    """Most severe fired rule wins; all fired rules are returned for audit."""
    triggered: list[dict[str, str]] = []
    decision = Decision.APPROVE

    for rule in RULES:
        try:
            fired = rule.predicate(report)
        except Exception:  # noqa: BLE001 - a malformed field must not 500
            continue
        if fired:
            triggered.append({
                "code": rule.code,
                "description": rule.description,
                "decision": rule.decision.value,
            })
            if _SEVERITY[rule.decision] > _SEVERITY[decision]:
                decision = rule.decision

    return BreOutcome(
        decision=decision,
        ruleset_version=RULESET_VERSION,
        triggered=triggered,
        signals={
            "cibil_score": _score(report),
            "write_off_total": _write_off_total(report),
            "total_overdue": _overdue(report),
            "max_recent_dpd": _max_recent_dpd(report),
            "enquiries_past_30_days": _enquiries_30d(report),
        },
    )
