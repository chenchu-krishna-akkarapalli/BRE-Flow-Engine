"""Payslip PDF report extraction via the Rust payslip-cli engine.

Transport is a short-lived subprocess framed over stdin, replicating the
cibil-cli engine bridge: a wall-clock timeout is enforceable per call,
PDF firewall inspection is performed before subprocess execution, and the
uploaded PDF is framed over stdin without persisting to disk.

stdin frame: [8-byte little-endian blocks-JSON length][blocks JSON][raw PDF]
"""

import asyncio
import json
import os
import shutil
import struct
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from app.core.config import settings
from app.core.exceptions import InvalidPayloadError
from app.core.logging import logger, redact_pii
from app.services.pdf_firewall import inspect

ACCEPTED_CONTENT_TYPES = frozenset({"application/pdf"})
STATUS_SUCCESS = "SUCCESS"

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
_ENGINE_DEFAULT_RELATIVE = Path("cibil-pdf-scrapper/target/release/payslip-cli.exe")
_ENGINE_DEFAULT_ABSOLUTE = _PROJECT_ROOT / "cibil-pdf-scrapper" / "target" / "release" / "payslip-cli.exe"


class PayslipEngineError(RuntimeError):
    """The payslip engine is unavailable: binary missing, timed out, or unusable output."""


class PayslipDocumentError(InvalidPayloadError):
    """The engine ran but could not read this document."""


def _binary_path() -> Optional[str]:
    """Configured binary, else workspace release build, else PATH."""
    configured = getattr(settings, "PAYSLIP_ENGINE_BINARY", "") or os.getenv("PAYSLIP_ENGINE_BINARY", "")
    if configured:
        return configured if Path(configured).exists() else None

    for candidate in (
        _ENGINE_DEFAULT_ABSOLUTE,
        _ENGINE_DEFAULT_ABSOLUTE.with_suffix(""),
        _ENGINE_DEFAULT_RELATIVE,
        _ENGINE_DEFAULT_RELATIVE.with_suffix(""),
    ):
        if candidate.exists():
            return str(candidate)
    return shutil.which("payslip-cli")


def missing_component() -> Optional[str]:
    """Name the missing engine, or None when present."""
    if _binary_path() is None:
        return (
            "the payslip-cli engine binary was not found. Build it with "
            "`cargo build --release --bin payslip-cli` inside cibil-pdf-scrapper/, "
            "or set PAYSLIP_ENGINE_BINARY to its path."
        )
    return None


def validate_upload(content: bytes, content_type: Optional[str], filename: str) -> None:
    """Validate content type of uploaded document."""
    if (content_type or "").lower() not in ACCEPTED_CONTENT_TYPES:
        raise InvalidPayloadError(
            f"'{filename}' is {content_type or 'of unknown type'}; upload the payslip report as a PDF."
        )


def _to_rupees(amount_obj: Any) -> Optional[float]:
    """Convert amount dict (paise / raw string) or number into rupee float."""
    if isinstance(amount_obj, dict):
        if "paise" in amount_obj and isinstance(amount_obj["paise"], (int, float)):
            return round(float(amount_obj["paise"]) / 100.0, 2)
        if "raw" in amount_obj and amount_obj["raw"]:
            raw_str = str(amount_obj["raw"]).replace(",", "").strip()
            try:
                return float(raw_str)
            except ValueError:
                pass
    elif isinstance(amount_obj, (int, float)):
        return float(amount_obj)
    elif isinstance(amount_obj, str) and amount_obj.strip():
        raw_str = amount_obj.replace(",", "").strip()
        try:
            return float(raw_str)
        except ValueError:
            pass
    return None


async def _run_engine(pdf_bytes: bytes, doc_id: str) -> Dict[str, Any]:
    """Spawn payslip-cli, frame request over stdin, return envelope dict."""
    binary = _binary_path()
    if binary is None:
        raise PayslipEngineError(missing_component() or "The payslip engine is unavailable.")

    frame = struct.pack("<Q", 2) + b"[]" + pdf_bytes
    argv = [binary, "-"]
    proc = await asyncio.create_subprocess_exec(
        *argv,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(frame), timeout=settings.PAYSLIP_ENGINE_TIMEOUT_S
        )
    except asyncio.TimeoutError as exc:
        proc.kill()
        await proc.wait()
        raise PayslipEngineError(
            f"The payslip engine exceeded its {settings.PAYSLIP_ENGINE_TIMEOUT_S:.0f}s budget."
        ) from exc

    if proc.returncode != 0:
        logger.error(f"payslip-cli exit={proc.returncode} stderr={redact_pii(stderr[:512].decode('utf-8', 'replace'))}")
        raise PayslipDocumentError(
            f"'{doc_id}' could not be read as a payslip report; the file appears damaged or invalid."
        )

    try:
        return json.loads(stdout)
    except json.JSONDecodeError as exc:
        raise PayslipEngineError("The payslip engine returned malformed JSON.") from exc


def _detect_salary_payment_method(data: Dict[str, Any], employee_obj: Dict[str, Any]) -> str:
    """Derive 'Bank Account' vs 'Cash' from employee bank/PF/UAN details and transfer keywords."""
    if not isinstance(employee_obj, dict):
        employee_obj = {}

    for key in ("bank_account", "pf_number", "uan", "bank_name", "esi_number"):
        val = str(employee_obj.get(key) or "").strip()
        if val and val.upper() not in ("NONE", "NIL", "N/A", "NULL", "-"):
            return "Bank Account"

    # Search raw text lines or labels for bank transfer indicators
    raw_blob = json.dumps(data).lower()
    keywords = ("bank account", "bank transfer", "neft", "rtgs", "imps", "account no", "ac no", "hdfc", "icici", "sbi", "axis", "kotak")
    if any(kw in raw_blob for kw in keywords):
        return "Bank Account"

    return "Cash"


ANNUAL_KEYWORDS = (
    "compensation",
    "annual",
    "ytd",
    "projected",
    "ctc",
    "taxable income",
    "retainer",
    "reported by the employee",
    "tax payable",
    "tax deducted so far",
    "tax payable/refundable",
    "chapter vi-a",
    "exemption under section",
    "add any other income",
    "other sections under",
    "total income",
    "sec 10 exemption",
)


def _is_annual_label(label: str) -> bool:
    lbl_lower = (label or "").lower()
    return any(kw in lbl_lower for kw in ANNUAL_KEYWORDS)


MAX_MONTHLY_LINE_ITEM = 10_000_000.0  # 1 Crore monthly item cap


def map_to_payslip_fields(data: Dict[str, Any]) -> Dict[str, Any]:
    """Translate raw payslip engine JSON payload to structured Nested Relational format."""
    gross_obj = data.get("gross_earnings") or {}
    net_obj = data.get("net_pay") or {}
    employee_obj = data.get("employee") if isinstance(data.get("employee"), dict) else {}
    employer_obj = data.get("employer") if isinstance(data.get("employer"), dict) else {}

    parsed_gross = _to_rupees(gross_obj)
    parsed_net = _to_rupees(net_obj)

    # Parse earnings breakdown, excluding annual compensation / YTD tax figures
    earnings_breakdown: List[Dict[str, Any]] = []
    total_earnings_sum = 0.0
    for item in data.get("earnings") or []:
        if isinstance(item, dict):
            amt = _to_rupees(item.get("amount"))
            lbl = item.get("label")
            if lbl and not _is_annual_label(str(lbl)):
                if amt is None or (amt > 0 and amt <= MAX_MONTHLY_LINE_ITEM):
                    earnings_breakdown.append({"label": str(lbl), "amount": amt})
                    if amt and amt > 0:
                        total_earnings_sum += amt

    # Extract Monthly Gross Salary directly from document label (parsed_gross)
    if parsed_gross and parsed_gross > 0:
        monthly_gross_salary = round(parsed_gross, 2)
    else:
        monthly_gross_salary = round(total_earnings_sum, 2)

    total_earnings = monthly_gross_salary
    annual_gross_salary = round(monthly_gross_salary * 12.0, 2)

    # Parse deductions breakdown
    deductions_breakdown: List[Dict[str, Any]] = []
    total_deductions_sum = 0.0
    pf_amount: Optional[float] = None
    pt_amount: Optional[float] = None
    it_amount: Optional[float] = None

    for item in data.get("deductions") or []:
        if isinstance(item, dict):
            amt = _to_rupees(item.get("amount"))
            lbl = str(item.get("label") or "")
            if lbl and not _is_annual_label(lbl):
                deductions_breakdown.append({"label": lbl, "amount": amt})
                if amt and amt > 0:
                    total_deductions_sum += amt

                lbl_lower = lbl.lower()
                if "provident fund" in lbl_lower or "pf" == lbl_lower:
                    pf_amount = amt
                elif "professional tax" in lbl_lower or "pt" == lbl_lower:
                    pt_amount = amt
                elif "income tax" in lbl_lower or "tds" in lbl_lower or "tax" in lbl_lower:
                    if it_amount is None:
                        it_amount = amt

    total_deductions = round(total_deductions_sum, 2)
    if parsed_net and 0 < parsed_net <= monthly_gross_salary:
        monthly_net_salary = round(parsed_net, 2)
    else:
        monthly_net_salary = round(max(0.0, monthly_gross_salary - total_deductions), 2)

    salary_payment_method = _detect_salary_payment_method(data, employee_obj)

    employer_name = employer_obj.get("name")
    applicant_name = employee_obj.get("name")
    pan_number = employee_obj.get("pan")
    bank_account = employee_obj.get("bank_account")
    pf_number = employee_obj.get("pf_number")
    uan = employee_obj.get("uan")

    employee_metadata = {
        "applicantName": applicant_name,
        "panNumber": pan_number,
        "employerName": employer_name,
        "bankAccount": bank_account,
        "pfNumber": pf_number,
        "uan": uan,
    }

    evaluated = {
        "monthlyGrossSalary": monthly_gross_salary,
        "annualGrossSalary": annual_gross_salary,
        "salaryPaymentMethod": salary_payment_method,
    }

    transparent_breakdown = {
        "monthlyNetSalary": monthly_net_salary,
        "totalEarnings": total_earnings,
        "totalDeductions": total_deductions,
        "earningsBreakdown": earnings_breakdown,
        "deductionsBreakdown": deductions_breakdown,
        "employeeMetadata": {k: v for k, v in employee_metadata.items() if v is not None},
    }

    return {
        # Flat convenience keys for backward compatibility and store draft mapping
        "grossSalary": monthly_gross_salary,
        "netSalary": monthly_net_salary,
        "employerName": employer_name,
        "applicantName": applicant_name,
        "panNumber": pan_number,
        "providentFund": pf_amount,
        "professionalTax": pt_amount,
        "incomeTax": it_amount,
        "salaryPaymentMethod": salary_payment_method,
        # Nested Relational payload
        "evaluated": evaluated,
        "transparentBreakdown": transparent_breakdown,
    }


async def extract_payslip_report(
    content: bytes, content_type: Optional[str], filename: str
) -> Tuple[Dict[str, Any], str, str]:
    """Parse an uploaded Payslip PDF into Step-3 draft fields."""
    validate_upload(content, content_type, filename)

    verdict = inspect(content, filename)
    if verdict.active_content_found:
        logger.warning(
            f"Active content detected in payslip upload '{redact_pii(filename)}': "
            f"{verdict.as_log_fields()}"
        )

    data = await _run_engine(content, doc_id=filename)
    if "error" in data:
        status = "FAILED"
        message = str(data["error"])
        logger.warning(f"Payslip extraction error for '{redact_pii(filename)}': {message}")
        return {}, status, message

    fields = map_to_payslip_fields(data)
    logger.info(
        f"Payslip extracted from '{redact_pii(filename)}' ({len(content)} bytes): "
        f"{redact_pii(dict(fields))}"
    )
    return fields, STATUS_SUCCESS, "Payslip report parsed successfully."
