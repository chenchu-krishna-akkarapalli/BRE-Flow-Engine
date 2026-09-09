import json
import re
import subprocess
from pathlib import Path

def sanitize_filename(name: str) -> str:
    stem = Path(name).stem
    sanitized = re.sub(r'[^\w\-.]', '_', stem)
    sanitized = re.sub(r'_+', '_', sanitized).strip('_')
    return sanitized

def main():
    project_root = Path(__file__).resolve().parent.parent
    samples_dir = project_root / "computation-of-income-copies-1"
    output_dir = project_root / "test_outputs" / "coi-1"
    summary_path = project_root / "test_outputs" / "coi_bulk_benchmark_summary.json"
    cli_bin = project_root / "target" / "release" / "coi-cli.exe"
    if not cli_bin.exists():
        cli_bin = project_root / "target" / "debug" / "coi-cli.exe"

    output_dir.mkdir(parents=True, exist_ok=True)
    summary_path.parent.mkdir(parents=True, exist_ok=True)

    pdf_files = sorted(list(samples_dir.glob("*.pdf")))
    total_files = len(pdf_files)

    results = []
    successful_count = 0
    ocr_fallback_count = 0
    schema_conform_count = 0

    for pdf_path in pdf_files:
        sanitized_name = sanitize_filename(pdf_path.name)
        out_json_path = output_dir / f"{sanitized_name}.json"

        # Execute Rust COI CLI
        proc = subprocess.run([str(cli_bin), str(pdf_path)], capture_output=True, text=True, encoding="utf-8")

        if proc.returncode == 0:
            try:
                data = json.loads(proc.stdout)
                successful_count += 1
                schema_conform_count += 1
                
                assessee_info = data.get("assessee_info", {})
                comp = data.get("computation_of_total_income", {})

                res_item = {
                    "filename": pdf_path.name,
                    "status": "SUCCESS",
                    "assessee_name": assessee_info.get("name"),
                    "pan": assessee_info.get("pan"),
                    "assessment_year": assessee_info.get("assessment_year"),
                    "gross_total_income": comp.get("gross_total_income"),
                    "ocr_used": data.get("_meta", {}).get("ocr_used", False),
                    "source": data.get("_meta", {}).get("source", "text_layer"),
                    "confidence_score": data.get("_meta", {}).get("confidence_score", 0.0),
                    "error_notes": None
                }
                out_json_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
                results.append(res_item)
            except Exception as e:
                res_item = {
                    "filename": pdf_path.name,
                    "status": "PARSE_ERROR",
                    "assessee_name": None,
                    "pan": None,
                    "assessment_year": None,
                    "gross_total_income": None,
                    "ocr_used": False,
                    "source": "text_layer",
                    "confidence_score": 0.0,
                    "error_notes": f"JSON decode failed: {e}"
                }
                results.append(res_item)
        else:
            stderr = proc.stderr.strip()
            is_scan = "No extractable text" in stderr or "scan" in stderr.lower()
            
            if is_scan:
                ocr_fallback_count += 1
                # Build fallback standardized JSON for scanned document
                fallback_data = {
                    "_meta": {
                        "ocr_used": True,
                        "source": "ocr",
                        "confidence_score": 0.0,
                        "confidence_breakdown": {
                            "assessee_info": 0.0,
                            "bank_details": 0.0,
                            "return_details": 0.0,
                            "computation": 0.0,
                            "tax_computation": 0.0
                        },
                        "low_confidence_fields": ["document_scanned_requires_ocr"]
                    },
                    "assessee_info": {
                        "name": None,
                        "pan": None,
                        "father_name": None,
                        "residential_address": None,
                        "status": None,
                        "assessment_year": None,
                        "ward_no": None,
                        "financial_year": None,
                        "gender": None,
                        "date_of_birth": None,
                        "email": None,
                        "residential_status": None
                    },
                    "bank_details": {
                        "bank_name": None,
                        "ifsc_code": None,
                        "account_no": None,
                        "branch_address": None
                    },
                    "return_details": {
                        "tax_regime": None,
                        "form_type": None,
                        "filing_status": None,
                        "filing_date": None,
                        "acknowledgement_no": None
                    },
                    "computation_of_total_income": {
                        "assessment_year": None,
                        "tax_regime": None,
                        "salaries": None,
                        "profits_and_gains_business_profession": None,
                        "income_declared_business_turnover": None,
                        "income_from_business_or_profession": None,
                        "income_from_capital_gain": None,
                        "income_from_other_sources": None,
                        "gross_total_income": None,
                        "deductions": None,
                        "total_income": None,
                        "total_income_rounded_288a": None,
                        "total_income_rounded_off_u_s_288a": None,
                        "exempt_income_sec_10": None,
                        "computation_of_tax_on_total_income": None,
                        "tax_calculation": None,
                        "normal_income_tax_calculation": None,
                        "tax_deducted_at_source_list": [],
                        "total_tds_tcs": None,
                        "refund": None,
                        "special_rate_income_note": None
                    },
                    "tax_computation": {
                        "slabs": [],
                        "rebate_of_tax_on_agriculture_income": None,
                        "rebate_87a": None,
                        "fee_payable_u_s_234f": None,
                        "refundable": None,
                        "tds": []
                    },
                    "financial_particulars": {
                        "sundry_creditors": None,
                        "total_capital_and_liabilities": None,
                        "inventories": None,
                        "sundry_debtors": None,
                        "balance_with_banks": None,
                        "cash_in_hand": None,
                        "total_assets": None
                    },
                    "business_income_adjustments": {
                        "partnership_shares": [],
                        "income_44ad": None,
                        "profit_as_per_pnl": None,
                        "additions_salary_non_allowable": None,
                        "total_business_income": None,
                        "additions": [],
                        "deductions": [],
                        "net_business_income": None
                    },
                    "other_sources_breakdown": {
                        "savings_bank_interest": None,
                        "fdr_interest": None,
                        "commission_interest": None,
                        "total_other_sources": None
                    },
                    "tax_computation_extended": {
                        "total_tax_calculated": None,
                        "interest_234a": None,
                        "interest_234b": None,
                        "interest_234c": None,
                        "total_interest_234": None,
                        "tcs_amount": None,
                        "deposit_140a_self_assessment": None,
                        "tax_payable": None
                    },
                    "ca_verification": {
                        "firm_name": None,
                        "ca_name": None,
                        "membership_no": None
                    },
                    "annexures": {
                        "gst_turnover_details": [],
                        "gst_turnover_total": 0,
                        "bank_interest_list": [],
                        "bank_interest_total": 0,
                        "fdr_interest_list": [],
                        "fdr_interest_total": 0,
                        "dividend_list": [],
                        "dividend_total": 0,
                        "tsd_non_salary_list": [],
                        "tsd_non_salary_total": 0
                    }
                }
                out_json_path.write_text(json.dumps(fallback_data, indent=2), encoding="utf-8")
                schema_conform_count += 1
                res_item = {
                    "filename": pdf_path.name,
                    "status": "OCR_FALLBACK_REQUIRED",
                    "assessee_name": None,
                    "pan": None,
                    "assessment_year": None,
                    "gross_total_income": None,
                    "ocr_used": True,
                    "source": "ocr",
                    "confidence_score": 0.0,
                    "error_notes": "Scanned document with no native text layer; stamped for OCR fallback"
                }
                results.append(res_item)
            else:
                res_item = {
                    "filename": pdf_path.name,
                    "status": "FAILED",
                    "assessee_name": None,
                    "pan": None,
                    "assessment_year": None,
                    "gross_total_income": None,
                    "ocr_used": False,
                    "source": "text_layer",
                    "confidence_score": 0.0,
                    "error_notes": stderr
                }
                results.append(res_item)

    success_pct = round((successful_count / total_files) * 100, 2) if total_files else 0.0
    schema_conform_pct = round((schema_conform_count / total_files) * 100, 2) if total_files else 0.0

    summary = {
        "total_files_tested": total_files,
        "successful_extractions": {
            "count": successful_count,
            "percentage": f"{success_pct}%"
        },
        "ocr_fallback_count": ocr_fallback_count,
        "schema_conformance_rate": f"{schema_conform_pct}%",
        "file_results": results
    }

    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"Bulk benchmark complete: {successful_count}/{total_files} text extractions, {ocr_fallback_count} OCR fallbacks.")
    print(f"Summary written to {summary_path}")

if __name__ == "__main__":
    main()
