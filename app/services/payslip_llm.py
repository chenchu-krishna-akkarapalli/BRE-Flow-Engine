"""Payslip extraction with a local model, verified by the payslip's own arithmetic.

The model runs in Ollama on this host or private network; no external API is
called. It reads the slip's rows and returns a fixed JSON schema. Its answer is
never trusted on its own: every amount and identifier must be printed on the slip
(next to its label, for line items), and the totals must reconcile (payslip_gate).
A failed answer gets one retry with the reasons spelled out; whatever still fails
is returned as needs-review, never as verified.
"""

import json
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import httpx

from app.core.config import settings
from app.core.logging import logger, redact_pii
from app.services import payslip_gate
from app.services.payslip_reader import Row

# The sign must touch the digits: "79,010.00 - 12,357.00" is a subtraction, not a negative.
_SIGNED_NUMBER = re.compile(r"(-|\()?(\d[\d,]*(?:\.\d+)?)")
_WORD = re.compile(r"[a-z]{2,}")
_TOTAL_LABEL = re.compile(r"^\s*(sub\s*)?(total|gross|net)\b", re.IGNORECASE)
_EMPLOYER_LABEL = re.compile(r"\bemployer\b", re.IGNORECASE)
_PAN = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")
_MONTHS = ("january", "february", "march", "april", "may", "june", "july",
           "august", "september", "october", "november", "december")

_SYSTEM_PROMPT = """You extract this month's pay figures from an Indian salary slip and return JSON.

The input is the slip's text, one line per visual row, with table cells separated by " | ".

Rules:
- earnings and deductions: one entry per pay component, with its label as printed and its amount for this month. Skip components whose amount is 0.
- gross_salary, total_deductions, net_pay: copy the totals exactly as printed on rows such as "Total Earnings", "Gross", "Total Deduction", "Net Pay", "Net Salary" or "Take Home". Never add numbers up yourself; if a total is not printed, return null.
- Year-to-date, annual, CTC, projected and income-tax worksheet figures are not this month's pay; leave them out.
- Employer contributions (employer PF, employer NPS, employer ESI) are paid by the company, not the employee; they are neither earnings nor deductions.
- month and year: the pay period the slip is for.
- employee_name, employer_name, pan, uan, bank_account: copy exactly as printed, or null if not printed.

Example input:
ACME LTD | Pay slip for the month of March 2025
Employee Name | Ravi Kumar | PAN | ABCDE1234F
Bank A/c No | 123456789012 | UAN | 100200300400
Basic Salary 20,000.00 | Provident Fund 1,800.00
HRA: 8,000.00 | Prof. Tax: 200.00
Special Allowance 0.00 | Loan Recovery 0.00
Total Earnings 28,000.00 | Total Deductions 2,000.00
Net Pay 26,000.00
YTD Gross 84,000.00

Example output:
{"month": "March", "year": 2025, "employee_name": "Ravi Kumar", "employer_name": "ACME LTD", "pan": "ABCDE1234F", "uan": "100200300400", "bank_account": "123456789012", "earnings": [{"label": "Basic Salary", "value": 20000}, {"label": "HRA", "value": 8000}], "deductions": [{"label": "Provident Fund", "value": 1800}, {"label": "Prof. Tax", "value": 200}], "gross_salary": 28000, "total_deductions": 2000, "net_pay": 26000}"""

_ITEM = {
    "type": "object",
    "properties": {"label": {"type": "string"}, "value": {"type": "number"}},
    "required": ["label", "value"],
    "additionalProperties": False,
}
_NULLABLE_NUMBER = {"anyOf": [{"type": "number"}, {"type": "null"}]}
_NULLABLE_STRING = {"anyOf": [{"type": "string"}, {"type": "null"}]}
_IDENTITY_KEYS = ("employee_name", "employer_name", "pan", "uan", "bank_account")

_SCHEMA = {
    "type": "object",
    "properties": {
        "month": _NULLABLE_STRING,
        "year": {"anyOf": [{"type": "integer"}, {"type": "null"}]},
        **{key: _NULLABLE_STRING for key in _IDENTITY_KEYS},
        "earnings": {"type": "array", "items": _ITEM},
        "deductions": {"type": "array", "items": _ITEM},
        "gross_salary": _NULLABLE_NUMBER,
        "total_deductions": _NULLABLE_NUMBER,
        "net_pay": _NULLABLE_NUMBER,
    },
    "required": ["month", "year", *_IDENTITY_KEYS, "earnings", "deductions", "gross_salary", "total_deductions", "net_pay"],
    "additionalProperties": False,
}

# Tests inject an httpx.MockTransport here; production uses the network default.
_transport: Optional[httpx.AsyncBaseTransport] = None


class ModelUnavailable(RuntimeError):
    """The local model server could not be reached or did not answer in time."""


@dataclass
class Extraction:
    statement: Dict[str, Any]
    identity: Dict[str, Optional[str]]
    reasons: List[str]
    checks_run: int
    attempts: int = 1

    @property
    def status(self) -> str:
        return payslip_gate.AUTO_ACCEPT if not self.reasons else payslip_gate.NEEDS_REVIEW

    @property
    def confidence(self) -> float:
        checks = self.checks_run + sum(r.startswith("llm_ungrounded") for r in self.reasons)
        return round(max(checks - len(self.reasons), 0) / checks, 2) if checks else 0.0


def _has_number(text: str, value: float) -> bool:
    """The amount is printed with the same sign: "-66,850.00" or "(66,850.00)" for a negative."""
    for sign, digits in _SIGNED_NUMBER.findall(text):
        try:
            if abs(float(digits.replace(",", "")) - abs(value)) < 0.005 and bool(sign) == (value < 0):
                return True
        except ValueError:
            continue
    return False


def find_source_line(value: Any, label: str, lines: List[str]) -> Optional[int]:
    """Index of a line printing this amount; None if the slip never prints it.

    With a label, a word of it must sit in the amount's own cell or the cell just
    before it, so a two-column row cannot lend one column's amount to the other's label.
    """
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return None
    words = set(_WORD.findall(label.lower()))
    for i, text in enumerate(lines):
        # Any "|" is a cell rule, whether the reader split the row or the slip drew it.
        cells = [cell.strip() for cell in text.split("|") if cell.strip()]
        for c, cell in enumerate(cells):
            if not _has_number(cell, float(value)):
                continue
            nearby = " ".join(cells[max(c - 1, 0): c + 1]).lower()
            if not words or words & set(_WORD.findall(nearby)):
                return i
    return None


def _squash(text: str) -> str:
    return re.sub(r"\s+", "", text).lower()


def grounded_identity(extracted: Dict[str, Any], lines: List[str]) -> Dict[str, Optional[str]]:
    """Identifiers the slip actually prints; anything else becomes None."""
    page = _squash(" ".join(lines))
    identity: Dict[str, Optional[str]] = {}
    for key in _IDENTITY_KEYS:
        value = str(extracted.get(key) or "").strip().lstrip(":").strip()
        if key == "pan":
            value = value.upper()
            if not _PAN.match(value):
                value = ""
        identity[key] = value if value and _squash(value) in page else None
    return identity


def _grounded_period(extracted: Dict[str, Any], lines: List[str]) -> Tuple[Optional[str], Optional[int]]:
    """Month and year the slip prints, by name ("July 2026") or as a date ("01.04.2024")."""
    text = " ".join(lines).lower()
    year = extracted.get("year")
    year = year if isinstance(year, int) and str(year) in text else None
    asked = str(extracted.get("month") or "").strip().lower()[:3]
    month = next((m for m in _MONTHS if m[:3] == asked), None) if len(asked) == 3 else None
    if month and month[:3] not in text:
        number = _MONTHS.index(month) + 1
        as_date = re.search(rf"\b0?{number}[./-]{year}\b|\b\d{{1,2}}[./-]0?{number}[./-]{year}\b", text) if year else None
        month = month if as_date else None
    return (month.capitalize() if month else None), year


def _amount(value: float, label: str, method: str, confidence: float) -> Dict[str, Any]:
    return {
        "value": round(float(value), 2),
        "currency": "INR",
        "raw_label": label,
        "raw_value_string": f"{value:.2f}",
        "match_method": method,
        "confidence": confidence,
    }


def build_statement(
    extracted: Dict[str, Any], lines: List[str], pages: List[Optional[int]]
) -> Tuple[Dict[str, Any], List[str]]:
    """Turn model output into a statement, dropping any value the slip does not print."""
    failures: List[str] = []

    def items(kind: str) -> List[Dict[str, Any]]:
        kept = []
        for item in extracted.get(kind) or []:
            label = str(item.get("label") or "")
            # Small models sometimes list the totals row or an employer contribution as a
            # component; neither ever is one.
            if _TOTAL_LABEL.match(label) or _EMPLOYER_LABEL.search(label):
                continue
            # A zero changes no sum; it is dropped before grounding so an OCR-split
            # label on an empty row cannot fail the slip.
            if item.get("value") == 0:
                continue
            source = find_source_line(item.get("value"), label, lines)
            if source is None:
                failures.append(f"llm_ungrounded_{kind}_item")
                continue
            kept.append({
                "raw_label": label,
                "canonical_category": "llm_unclassified",
                "amount": _amount(item["value"], label, "llm_extracted", 0.8),
                "frequency": "monthly",
                "page": pages[source],
            })
        return kept

    earnings, deductions = items("earnings"), items("deductions")

    def total(key: str, label: str, components: Optional[List[Dict[str, Any]]] = None) -> Optional[Dict[str, Any]]:
        value = extracted.get(key)
        if value is not None:
            # Totals are printed under varied wording, so only the number itself must appear.
            if find_source_line(value, "", lines) is not None:
                return _amount(value, label, "llm_extracted", 0.8)
            failures.append(f"llm_ungrounded_{key}")
            return None
        # An unstated total may be summed; the gate then skips its own sum check.
        if components:
            return _amount(sum(i["amount"]["value"] for i in components), label, "computed_from_components", 0.7)
        return None

    gross = total("gross_salary", "GROSS PAY", earnings)
    deducted = total("total_deductions", "TOTAL DEDUCTIONS", deductions)
    net = total("net_pay", "NET PAY")
    # Some slips print gross and deductions but no net line. Derived from two printed
    # totals (whose items the gate still sums) and marked computed, never as read.
    if net is None and extracted.get("net_pay") is None and gross and deducted and not any(
        str(f.get("match_method")).startswith("computed") for f in (gross, deducted)
    ):
        net = _amount(gross["value"] - deducted["value"], "NET PAY", "computed_from_gross_minus_deductions", 0.7)

    month, year = _grounded_period(extracted, lines)
    statement = {
        "period": {"period_type": "monthly", "month": month, "year": year},
        "earnings": {"items": earnings},
        "deductions": {"items": deductions},
        "summary": {"gross_salary": gross, "total_deductions": deducted, "net_pay": net},
        "reconciliation": None,
    }
    return statement, failures


def repair_feedback(statement: Dict[str, Any], reasons: List[str]) -> Optional[str]:
    """Plain-language account of why an answer failed the gate, for one retry; None if not fixable."""
    summary = statement["summary"]
    value = lambda key: (summary.get(key) or {}).get("value")
    total = lambda kind: sum(i["amount"]["value"] for i in statement[kind]["items"])
    notes = []
    if "earning_items_do_not_sum_to_gross" in reasons and value("gross_salary") is not None:
        notes.append(
            f"Your earnings add up to {total('earnings'):,.2f} but the slip's printed gross is "
            f"{value('gross_salary'):,.2f}, a difference of {value('gross_salary') - total('earnings'):,.2f}. "
            "The printed total is right: do not change it. An earning row is missing or one does not belong; "
            "find it among the earnings rows for this month."
        )
    if "deduction_items_do_not_sum_to_total" in reasons and value("total_deductions") is not None:
        notes.append(
            f"Your deductions add up to {total('deductions'):,.2f} but the slip's printed total deductions is "
            f"{value('total_deductions'):,.2f}, a difference of {value('total_deductions') - total('deductions'):,.2f}. "
            "The printed total is right: do not change it. A deduction row is missing or one does not belong; "
            "find it among the deductions rows for this month, keeping each amount's sign as printed."
        )
    if "gross_minus_deductions_does_not_equal_net" in reasons:
        notes.append("Gross minus total deductions does not equal the net pay you gave; re-check which printed totals are this month's.")
    if "net_pay_missing" in reasons or "total_deductions_missing" in reasons or "gross_salary_missing" in reasons:
        notes.append("A total is missing; copy it if the slip prints it.")
    if any(r.startswith("llm_ungrounded") for r in reasons):
        notes.append("Some amounts you gave are not printed on the slip next to their label; copy amounts exactly as printed.")
    return " ".join(notes) or None


def _context_window(prompt: str) -> int:
    # Ollama silently drops the start of an over-long prompt; size the window to fit.
    return max(4096, min(32768, len(prompt) // 3 + 2048))


async def _ask(prompt: str, doc_id: str, repair: Optional[Tuple[Dict[str, Any], str]]) -> Optional[Dict[str, Any]]:
    """One model call. None for unusable output; ModelUnavailable if the server cannot answer."""
    messages = [{"role": "system", "content": _SYSTEM_PROMPT}, {"role": "user", "content": prompt}]
    if repair is not None:
        previous, feedback = repair
        messages += [
            {"role": "assistant", "content": json.dumps(previous)},
            {"role": "user", "content": f"{feedback} Return the corrected JSON."},
        ]
    request = {
        "model": settings.PAYSLIP_LLM_MODEL,
        "messages": messages,
        "format": _SCHEMA,
        "stream": False,
        # Loading 4-5 GB of weights dominates a cold call; keep them resident between uploads.
        "keep_alive": "30m",
        "options": {"temperature": 0, "seed": 0, "num_ctx": _context_window(prompt) + (2048 if repair else 0)},
    }
    try:
        async with httpx.AsyncClient(
            base_url=settings.PAYSLIP_LLM_URL, timeout=settings.PAYSLIP_LLM_TIMEOUT_S, transport=_transport
        ) as client:
            response = await client.post("/api/chat", json=request)
            response.raise_for_status()
            body = response.json()
    except httpx.TimeoutException as exc:
        raise ModelUnavailable(f"the local model did not answer within {settings.PAYSLIP_LLM_TIMEOUT_S:.0f}s") from exc
    except httpx.HTTPStatusError as exc:
        raise ModelUnavailable(f"the local model returned HTTP {exc.response.status_code}") from exc
    except (httpx.TransportError, ValueError) as exc:
        raise ModelUnavailable(f"the local model server is unreachable ({type(exc).__name__})") from exc

    if body.get("done_reason") not in (None, "stop"):
        logger.warning(f"Payslip model stopped with '{body.get('done_reason')}' for '{redact_pii(doc_id)}'")
        return None
    try:
        answer = json.loads((body.get("message") or {}).get("content") or "")
    except json.JSONDecodeError:
        logger.error(f"Payslip model returned invalid JSON for '{redact_pii(doc_id)}'")
        return None
    return answer if isinstance(answer, dict) else None


async def extract(rows: List[Row], doc_id: str) -> Optional[Extraction]:
    """Read a payslip with the local model; the best verified attempt, or None if it never answered usably."""
    lines = [row.text() for row in rows]
    pages = [row.page for row in rows]
    prompt = "\n".join(lines)
    best: Optional[Extraction] = None
    repair = None
    for attempt in (1, 2):
        answer = await _ask(prompt, doc_id, repair)
        if answer is None:
            break
        statement, failures = build_statement(answer, lines, pages)
        gate = payslip_gate.evaluate(statement)
        current = Extraction(statement, grounded_identity(answer, lines), failures + gate.failures, gate.checks_run, attempt)
        # A retry can make things worse; keep whichever attempt failed fewer checks.
        if best is None or len(current.reasons) <= len(best.reasons):
            best = current
        if not current.reasons:
            break
        feedback = repair_feedback(statement, current.reasons)
        if feedback is None:
            break
        logger.info(f"Payslip model retrying '{redact_pii(doc_id)}' after: {current.reasons}")
        repair = (answer, feedback)
    return best
