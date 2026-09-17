#!/usr/bin/env python3
"""Fast batch parser script for ITR documents in itr-test.

Extracts text from PDF content streams, parses ITR-V and Return fields into JSON matching
itr-output-reff.json, and writes individual JSON files to itr-output/.
"""

import json
import re
import zlib
from pathlib import Path


def extract_text_from_pdf(pdf_path: Path) -> str:
    """Fast text extraction from PDF streams."""
    try:
        content = pdf_path.read_bytes()
    except Exception:
        return ""

    text_chunks = []
    
    # Extract uncompressed or compressed streams
    for match in re.finditer(rb"stream\r?\n(.*?)\r?\nendstream", content, re.DOTALL):
        stream_bytes = match.group(1)
        if len(stream_bytes) > 200000:
            continue  # Skip huge binary image streams
            
        try:
            decompressed = zlib.decompress(stream_bytes)
        except Exception:
            decompressed = stream_bytes

        # Fast string extraction using regex on ASCII/UTF-8 printables
        str_matches = re.findall(rb"\(([\x20-\x7E]{2,})\)\s*T[jJ]", decompressed)
        for sm in str_matches:
            text_chunks.append(sm.decode("ascii", errors="ignore"))

    return " \n ".join(text_chunks)


def parse_amount(val: str) -> int:
    """Clean amount string to integer."""
    if not val:
        return 0
    cleaned = val.strip().replace(",", "").replace("Rs.", "").replace("₹", "")
    if cleaned in ("", "Nil", "-", "NIL"):
        return 0
    try:
        return int(float(cleaned))
    except ValueError:
        return 0


def parse_itr_text(text: str, filename: str) -> dict:
    """Parse extracted text into ItrDocument JSON schema."""
    doc = {
        "_meta": {
            "ocr_used": False,
            "source": "text_layer"
        },
        "assessee_info": {
            "pan": None,
            "name": None,
            "address": None,
            "status": None,
            "assessment_year": None,
            "financial_year": None
        },
        "return_details": {
            "form_number": None,
            "filed_u_s": None,
            "acknowledgement_number": None,
            "date_of_filing": None
        },
        "taxable_income_and_tax_details": {
            "current_year_business_loss": 0,
            "total_income": 0,
            "book_profit_under_mat": 0,
            "adjusted_total_income_under_amt": 0,
            "net_tax_payable": 0,
            "interest_and_fee_payable": 0,
            "total_tax_interest_and_fee_payable": 0,
            "taxes_paid": 0,
            "tax_payable_or_refundable": 0
        },
        "accreted_income_and_tax_details": {
            "accreted_income_u_s_115td": 0,
            "additional_tax_payable_u_s_115td": 0,
            "interest_payable_u_s_115te": 0,
            "additional_tax_and_interest_payable": 0,
            "tax_and_interest_paid": 0,
            "accreted_tax_payable_or_refundable": 0
        },
        "verification_details": {
            "electronically_transmitted_on": None,
            "ip_address": None,
            "verified_by": None,
            "verifier_pan": None,
            "verification_date": None,
            "evc_code": None,
            "verification_mode": None,
            "barcode_hash": None
        }
    }

    # PAN
    m = re.search(r"[A-Z]{5}[0-9]{4}[A-Z]{1}", text)
    if m:
        doc["assessee_info"]["pan"] = m.group(0)

    # Name
    m = re.search(r"Name\s+([A-Za-z\s]{3,30})", text, re.IGNORECASE)
    if m:
        doc["assessee_info"]["name"] = m.group(1).strip()

    # Assessment Year
    m = re.search(r"20[2-3][0-9]\s*-\s*[0-9]{2,4}", text)
    if m:
        ay = m.group(0).replace(" ", "")
        doc["assessee_info"]["assessment_year"] = ay
        try:
            start_yr = int(ay[:4])
            doc["assessee_info"]["financial_year"] = f"{start_yr - 1}-{str(start_yr % 100).zfill(2)}"
        except Exception:
            pass
    elif "2024-25" in filename or "24-25" in filename:
        doc["assessee_info"]["assessment_year"] = "2024-25"
        doc["assessee_info"]["financial_year"] = "2023-24"
    elif "2025-26" in filename or "25-26" in filename:
        doc["assessee_info"]["assessment_year"] = "2025-26"
        doc["assessee_info"]["financial_year"] = "2024-25"
    elif "2023-24" in filename or "23-24" in filename:
        doc["assessee_info"]["assessment_year"] = "2023-24"
        doc["assessee_info"]["financial_year"] = "2022-23"

    # Form Number
    m = re.search(r"ITR-[1-7]", text, re.IGNORECASE)
    if m:
        doc["return_details"]["form_number"] = m.group(0).upper()
    else:
        doc["return_details"]["form_number"] = "ITR-V"

    # Acknowledgement Number
    m = re.search(r"[0-9]{15}", text)
    if m:
        doc["return_details"]["acknowledgement_number"] = m.group(0)

    # Total Income
    m = re.search(r"Total\s*Income\s*([0-9,]{4,12})", text, re.IGNORECASE)
    if m:
        doc["taxable_income_and_tax_details"]["total_income"] = parse_amount(m.group(1))

    return doc


def main():
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent
    test_dir = project_root / "itr-test"
    output_dir = project_root / "itr-output"

    output_dir.mkdir(parents=True, exist_ok=True)

    pdf_files = sorted(list(test_dir.glob("*.pdf"))) + sorted(list(test_dir.glob("*.PDF")))
    pdf_files = sorted(list(set(pdf_files)))

    print(f"Processing {len(pdf_files)} PDF files in {test_dir}...")

    processed = 0
    for pdf_path in pdf_files:
        text = extract_text_from_pdf(pdf_path)
        doc = parse_itr_text(text, pdf_path.name)

        out_path = output_dir / f"{pdf_path.stem}.json"
        out_path.write_text(json.dumps(doc, indent=2), encoding="utf-8")
        processed += 1

        pan = doc["assessee_info"]["pan"] or "N/A"
        ay = doc["assessee_info"]["assessment_year"] or "N/A"
        income = doc["taxable_income_and_tax_details"]["total_income"]
        ack = doc["return_details"]["acknowledgement_number"] or "N/A"

        print(f"[{processed}/{len(pdf_files)}] {pdf_path.name} -> PAN: {pan} | AY: {ay} | Ack: {ack} | Income: ₹{income:,}")

    print(f"\nDone! Processed {processed} ITR PDFs into JSON files in {output_dir}")


if __name__ == "__main__":
    main()
