"""Label-free acceptance gate: a payslip's own arithmetic decides whether an
extraction can be trusted, so unseen layouts need no expected JSON.

Port of the former Rust `payslip-domain::gate`; check names are unchanged
because they reach the frontend as `reviewReasons`.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

AUTO_ACCEPT = "auto_accept"
NEEDS_REVIEW = "needs_review"

# Payslips round per line item; a rupee absorbs that without hiding real misses.
TOLERANCE_PAISE = 100


@dataclass
class GateResult:
    checks_run: int = 0
    failures: List[str] = field(default_factory=list)

    @property
    def status(self) -> str:
        return AUTO_ACCEPT if not self.failures else NEEDS_REVIEW

    @property
    def confidence(self) -> float:
        if not self.checks_run:
            return 0.0
        return round((self.checks_run - len(self.failures)) / self.checks_run, 2)


def is_unpaid_grade_pay(label: str) -> bool:
    """7th-CPC government slips print GRADE PAY beside BASIC PAY but leave it out of gross.
    The gate accepts its exclusion only when that makes the earnings match exactly."""
    return "GRADE PAY" in label.upper()


def _paise(field_: Optional[Dict[str, Any]]) -> Optional[int]:
    value = (field_ or {}).get("value")
    return None if value is None else round(value * 100)


def _is_computed(field_: Optional[Dict[str, Any]]) -> bool:
    return str((field_ or {}).get("match_method") or "").startswith("computed")


def _sum_items(items: List[Dict[str, Any]]) -> int:
    return sum(_paise(i.get("amount")) or 0 for i in items)


def evaluate(statement: Dict[str, Any]) -> GateResult:
    summary = statement.get("summary") or {}
    period = statement.get("period") or {}
    earnings = (statement.get("earnings") or {}).get("items") or []
    deductions = (statement.get("deductions") or {}).get("items") or []
    gross = _paise(summary.get("gross_salary"))
    ded = _paise(summary.get("total_deductions"))
    net = _paise(summary.get("net_pay"))
    result = GateResult()

    def check(ok: bool, reason: str) -> None:
        result.checks_run += 1
        if not ok:
            result.failures.append(reason)

    check(gross is not None, "gross_salary_missing")
    check(net is not None, "net_pay_missing")
    # Without a deduction total nothing ties net to gross: a missed deduction would
    # leave "net = gross" looking consistent. A slip with none states 0.00.
    check(ded is not None, "total_deductions_missing")
    check(bool(period.get("month")) and bool(period.get("year")), "period_missing")
    check(bool(earnings), "no_earning_items")

    if net is not None:
        check(net > 0, "net_pay_not_positive")
    if gross is not None and net is not None:
        check(net <= gross, "net_exceeds_gross")

    # A computed total trivially equals its own components; only stated totals count.
    if gross is not None and not _is_computed(summary.get("gross_salary")):
        items = _sum_items(earnings)
        grade = _sum_items([i for i in earnings if is_unpaid_grade_pay(i.get("raw_label", ""))])
        ok = abs(gross - items) <= TOLERANCE_PAISE or (grade != 0 and abs(gross - (items - grade)) <= TOLERANCE_PAISE)
        check(ok, "earning_items_do_not_sum_to_gross")
    if gross is not None and ded is not None and net is not None and not _is_computed(summary.get("total_deductions")):
        check(abs(gross - ded - net) <= TOLERANCE_PAISE, "gross_minus_deductions_does_not_equal_net")
    if ded:
        check(abs(ded - _sum_items(deductions)) <= TOLERANCE_PAISE, "deduction_items_do_not_sum_to_total")

    return result
