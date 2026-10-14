"""Payslip PDF extraction: local text/OCR reading, then a local model, verified.

Everything runs on this host: pdfium reads the text layer (Tesseract OCRs scanned
pages), a local Ollama model returns the figures as JSON, and the payslip's own
arithmetic decides whether they are verified (payslip_llm, payslip_gate). PDF
firewall inspection runs first, and the upload is never written to disk.
"""

import asyncio
import json
from typing import Any, Dict, List, Optional, Tuple

import pypdfium2 as pdfium
import pytesseract

from app.core.config import settings
from app.core.exceptions import InvalidPayloadError
from app.core.logging import logger, redact_pii
from app.services import payslip_llm, payslip_reader
from app.services.pdf_firewall import inspect

ACCEPTED_CONTENT_TYPES = frozenset({"application/pdf"})
STATUS_SUCCESS = "SUCCESS"


class PayslipEngineError(RuntimeError):
    """Payslip reading is unavailable on this server (model down, timeout)."""


class PayslipDocumentError(InvalidPayloadError):
    """The document could not be read as a payslip."""


def validate_upload(content: bytes, content_type: Optional[str], filename: str) -> None:
    """Validate content type of uploaded document."""
    if (content_type or "").lower() not in ACCEPTED_CONTENT_TYPES:
        raise InvalidPayloadError(
            f"'{filename}' is {content_type or 'of unknown type'}; upload the payslip report as a PDF."
        )


def _to_rupees(amount_obj: Any) -> Optional[float]:
    """Convert amount dict (value / paise / raw string) or number into rupee float."""
    if isinstance(amount_obj, dict):
        if "value" in amount_obj and isinstance(amount_obj["value"], (int, float)):
            return round(float(amount_obj["value"]), 2)
        if "paise" in amount_obj and isinstance(amount_obj["paise"], (int, float)):
            return round(float(amount_obj["paise"]) / 100.0, 2)
        if "payable" in amount_obj and isinstance(amount_obj["payable"], dict):
            return _to_rupees(amount_obj["payable"])
        if "actual" in amount_obj and isinstance(amount_obj["actual"], dict):
            return _to_rupees(amount_obj["actual"])
        if "raw_value_string" in amount_obj and amount_obj["raw_value_string"]:
            raw_str = str(amount_obj["raw_value_string"]).replace(",", "").strip()
            try:
                return float(raw_str)
            except ValueError:
                pass
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
    statements = data.get("statements") if isinstance(data.get("statements"), list) else []
    first_stmt = statements[0] if statements and isinstance(statements[0], dict) else {}

    summary_obj = first_stmt.get("summary") if isinstance(first_stmt.get("summary"), dict) else {}
    gross_obj = summary_obj.get("gross_salary") or data.get("gross_earnings") or {}
    net_obj = summary_obj.get("net_pay") or data.get("net_pay") or {}
    employee_obj = data.get("employee") if isinstance(data.get("employee"), dict) else {}
    employer_obj = data.get("employer") if isinstance(data.get("employer"), dict) else {}

    parsed_gross = _to_rupees(gross_obj)
    parsed_net = _to_rupees(net_obj)

    # Extract total_deductions, total_allowances, and total_incentives_and_bonus from summary_obj
    summary_deductions_val = _to_rupees(summary_obj.get("total_deductions"))
    total_allowances_val = _to_rupees(summary_obj.get("total_allowances"))
    total_incentives_val = _to_rupees(summary_obj.get("total_incentives_and_bonus"))

    # Parse earnings breakdown, excluding annual compensation / YTD tax figures
    earnings_breakdown: List[Dict[str, Any]] = []
    total_earnings_sum = 0.0

    raw_earnings = (
        first_stmt.get("earnings", {}).get("items")
        if isinstance(first_stmt.get("earnings"), dict)
        else data.get("earnings")
    ) or []

    for item in raw_earnings:
        if isinstance(item, dict):
            amt = _to_rupees(item.get("amount") or item.get("amount_payable"))
            lbl = item.get("raw_label") or item.get("label")
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

    raw_deductions = (
        first_stmt.get("deductions", {}).get("items")
        if isinstance(first_stmt.get("deductions"), dict)
        else data.get("deductions")
    ) or []

    for item in raw_deductions:
        if isinstance(item, dict):
            amt = _to_rupees(item.get("amount") or item.get("amount_payable"))
            lbl = str(item.get("raw_label") or item.get("label") or "")
            cat = str(item.get("canonical_category") or "")
            if lbl and not _is_annual_label(lbl):
                deductions_breakdown.append({"label": lbl, "amount": amt})
                if amt and amt > 0:
                    total_deductions_sum += amt

                lbl_lower = lbl.lower()
                if "provident_fund" in cat or "provident fund" in lbl_lower or "pf" == lbl_lower:
                    pf_amount = amt
                elif "professional_tax" in cat or "professional tax" in lbl_lower or "pt" == lbl_lower:
                    pt_amount = amt
                elif "income_tax_tds" in cat or "income tax" in lbl_lower or "tds" in lbl_lower or "tax" in lbl_lower:
                    if it_amount is None:
                        it_amount = amt

    if summary_deductions_val is not None and summary_deductions_val >= 0:
        total_deductions = round(summary_deductions_val, 2)
    else:
        total_deductions = round(total_deductions_sum, 2)

    if parsed_net and 0 < parsed_net <= monthly_gross_salary:
        monthly_net_salary = round(parsed_net, 2)
    else:
        monthly_net_salary = round(max(0.0, monthly_gross_salary - total_deductions), 2)

    salary_payment_method = _detect_salary_payment_method(data, employee_obj)

    # Engine's arithmetic gate; a missing status (older engine) is never trusted.
    metadata_obj = data.get("metadata") if isinstance(data.get("metadata"), dict) else {}
    review_reasons = metadata_obj.get("review_reasons") or []
    review_required = metadata_obj.get("extraction_status") != "auto_accept"

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
        "totalAllowances": total_allowances_val,
        "totalIncentivesAndBonus": total_incentives_val,
        "earningsBreakdown": earnings_breakdown,
        "deductionsBreakdown": deductions_breakdown,
        "employeeMetadata": {k: v for k, v in employee_metadata.items() if v is not None},
    }

    return {
        # Flat convenience keys for backward compatibility and store draft mapping
        "grossSalary": monthly_gross_salary,
        "netSalary": monthly_net_salary,
        "totalAllowances": total_allowances_val,
        "totalIncentivesAndBonus": total_incentives_val,
        "employerName": employer_name,
        "applicantName": applicant_name,
        "panNumber": pan_number,
        "providentFund": pf_amount,
        "professionalTax": pt_amount,
        "incomeTax": it_amount,
        "salaryPaymentMethod": salary_payment_method,
        "reviewRequired": review_required,
        "reviewReasons": review_reasons,
        "extractionConfidence": metadata_obj.get("extraction_confidence_overall"),
        "extractionSource": metadata_obj.get("extraction_source", "local_model"),
        "textSource": metadata_obj.get("text_source", "pdf_text"),
        "ocrLowConfidenceTokens": metadata_obj.get("ocr_low_confidence_tokens") or [],
        # Nested Relational payload
        "evaluated": evaluated,
        "transparentBreakdown": transparent_breakdown,
    }


async def _read(content: bytes, doc_id: str) -> payslip_reader.PdfText:
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(payslip_reader.read_pdf, content), timeout=settings.PAYSLIP_OCR_TIMEOUT_S
        )
    except asyncio.TimeoutError as exc:
        raise PayslipEngineError(f"Reading the PDF exceeded its {settings.PAYSLIP_OCR_TIMEOUT_S:.0f}s budget.") from exc
    except payslip_reader.OcrUnavailable as exc:
        raise PayslipDocumentError(
            f"'{doc_id}' is a scanned payslip and OCR is not installed on this server "
            "(install Tesseract: `apt-get install tesseract-ocr` / `winget install UB-Mannheim.TesseractOCR`)."
        ) from exc
    except (pdfium.PdfiumError, pytesseract.TesseractError) as exc:
        raise PayslipDocumentError(f"'{doc_id}' could not be read; the file appears damaged or password-protected.") from exc


def _as_payslip_data(text: payslip_reader.PdfText, result: payslip_llm.Extraction) -> Dict[str, Any]:
    """Shape a verified extraction like the payload map_to_payslip_fields reads."""
    identity = result.identity
    return {
        "statements": [result.statement],
        "employee": {
            "name": identity.get("employee_name"),
            "pan": identity.get("pan"),
            "uan": identity.get("uan"),
            "bank_account": identity.get("bank_account"),
        },
        "employer": {"name": identity.get("employer_name")},
        "metadata": {
            "page_count": text.pages,
            "extraction_status": result.status,
            "review_reasons": result.reasons,
            "extraction_confidence_overall": result.confidence,
            "extraction_source": "local_model",
            "text_source": text.source,
            "ocr_low_confidence_tokens": text.low_confidence_digits,
        },
        # The payment-method detector scans the slip text for bank keywords.
        "raw": {"lines": [{"page": row.page, "segments": row.cells} for row in text.rows]},
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

    text = await _read(content, filename)
    if not text.rows:
        return {}, "FAILED", "No text could be read from this PDF."

    try:
        result = await payslip_llm.extract(text.rows, filename)
    except payslip_llm.ModelUnavailable as exc:
        raise PayslipEngineError(f"The payslip reader is unavailable: {exc}.") from exc
    if result is None:
        return {}, "FAILED", "The payslip could not be read. Please upload a clearer copy."

    fields = map_to_payslip_fields(_as_payslip_data(text, result))
    logger.info(
        f"Payslip extracted from '{redact_pii(filename)}' ({len(content)} bytes, {text.source}, "
        f"attempts={result.attempts}): {redact_pii(dict(fields))}"
    )
    if fields["reviewRequired"]:
        return fields, STATUS_SUCCESS, (
            "Payslip read, but its totals did not reconcile; check the figures against the payslip."
        )
    return fields, STATUS_SUCCESS, "Payslip report parsed successfully."
