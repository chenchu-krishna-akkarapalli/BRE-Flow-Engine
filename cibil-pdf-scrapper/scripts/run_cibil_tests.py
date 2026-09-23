#!/usr/bin/env python3
"""Bulk testing script for CIBIL PDF reports in cibil-test/.

Runs each PDF through the CIBIL engine (cibil-cli), extracts target schema bureau
metrics, performs BRE credit decisioning, and saves individual JSON files into cibil-output/.
"""

import argparse
import json
import os
import shutil
import struct
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


def evaluate_bre(report: Dict[str, Any]) -> Dict[str, Any]:
    """Business Rules Engine evaluation matching service/bre.py."""
    score = int(report.get("CIBIL_Score") or 0)
    write_offs = report.get("Write_Off_Details") or {}
    write_off_total = sum(v for v in write_offs.values() if isinstance(v, (int, float)))
    overdue_total = int((report.get("Currently_Outstanding") or {}).get("Total_Overdue") or 0)

    # Worst numeric DPD across the two most recent reported years
    max_recent_dpd = 0
    dpd_map = report.get("DPD") or {}
    for entry in dpd_map.values():
        if not isinstance(entry, dict):
            continue
        years = sorted((k for k in entry if k.isdigit()), reverse=True)[:2]
        for y in years:
            for v in (entry.get(y) or {}).values():
                if isinstance(v, int):
                    max_recent_dpd = max(max_recent_dpd, v)

    enquiries_30d = int((report.get("Loan_Enquiry") or {}).get("Past_30_Days") or 0)

    rules = [
        ("WO_PRESENT", "Written-off balance reported", "DECLINE", write_off_total > 0),
        ("DPD_SEVERE", "DPD above 90 days in the last two years", "DECLINE", max_recent_dpd > 90),
        ("SCORE_LOW", "CIBIL score below 650", "DECLINE", 0 < score < 650),
        ("OVERDUE_OPEN", "Outstanding overdue balance", "REFER", overdue_total > 0),
        ("DPD_MILD", "DPD between 30 and 90 days", "REFER", 30 <= max_recent_dpd <= 90),
        ("SCORE_THIN", "No usable score reported", "REFER", score == 0),
        ("ENQUIRY_BURST", "4 or more credit enquiries in 30 days", "REFER", enquiries_30d >= 4),
    ]

    severity = {"APPROVE": 0, "REFER": 1, "DECLINE": 2}
    triggered = []
    final_decision = "APPROVE"

    for code, desc, dec, fired in rules:
        if fired:
            triggered.append({"code": code, "description": desc, "decision": dec})
            if severity[dec] > severity[final_decision]:
                final_decision = dec

    return {
        "decision": final_decision,
        "ruleset_version": "bre-2026.02.1",
        "triggered": triggered,
        "signals": {
            "cibil_score": score,
            "max_recent_dpd": max_recent_dpd,
            "write_off_total": write_off_total,
            "total_overdue": overdue_total,
            "enquiries_past_30_days": enquiries_30d,
        },
    }


class CibilRunner:
    def __init__(self, binary_path: Optional[str] = None, container: str = "flowbre_fastapi_app"):
        self.container = container
        self.binary_path = binary_path
        self.use_docker = False
        self._init_runner()

    def _init_runner(self):
        # 1. Try local binary if provided or in default paths
        candidates = [self.binary_path] if self.binary_path else [
            Path("target/release/cibil-cli"),
            Path("target/debug/cibil-cli"),
            Path("cibil-pdf-scrapper/target/release/cibil-cli"),
            Path("cibil-pdf-scrapper/target/debug/cibil-cli"),
        ]
        for c in candidates:
            if c and Path(c).exists() and os.access(c, os.X_OK):
                # Verify it can execute natively
                try:
                    res = subprocess.run([str(c)], capture_output=True)
                    if res.returncode in (0, 1):
                        self.binary_path = str(c)
                        self.use_docker = False
                        return
                except Exception:
                    pass

        # 2. Check if Docker container is available
        try:
            res = subprocess.run(
                ["docker", "exec", "-i", self.container, "/usr/local/bin/cibil-cli"],
                capture_output=True,
            )
            if res.returncode in (0, 1):
                self.use_docker = True
                return
        except Exception:
            pass

        raise RuntimeError(
            "CIBIL engine binary not found locally or in Docker container. "
            "Please ensure flowbre_fastapi_app container is running or cibil-cli is built."
        )

    def run_engine(self, pdf_bytes: bytes, filename: str, schema: str = "target") -> Tuple[int, Dict[str, Any], str]:
        frame = struct.pack("<Q", 2) + b"[]" + pdf_bytes
        if self.use_docker:
            cmd = [
                "docker", "exec", "-i", self.container,
                "/usr/local/bin/cibil-cli", "-", "--schema", schema, "--pipeline", "--from-pdf", "--doc-id", filename
            ]
        else:
            cmd = [
                self.binary_path, "-", "--schema", schema, "--pipeline", "--from-pdf", "--doc-id", filename
            ]

        proc = subprocess.run(cmd, input=frame, capture_output=True)
        stdout_str = proc.stdout.decode("utf-8", errors="replace")
        stderr_str = proc.stderr.decode("utf-8", errors="replace")

        try:
            parsed = json.loads(stdout_str)
        except Exception:
            parsed = None

        return proc.returncode, parsed, stderr_str


def main():
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent

    default_samples = project_root / "cibil-test"
    default_output_dir = project_root / "cibil-output"
    default_report = project_root / "cibil-output" / "cibil_bulk_benchmark_summary.json"

    parser = argparse.ArgumentParser(description="Bulk CIBIL PDF testing runner")
    parser.add_argument("--samples", type=Path, default=default_samples, help="Path to cibil test folder")
    parser.add_argument("--output-dir", type=Path, default=default_output_dir, help="Path to cibil output folder")
    parser.add_argument("--report", type=Path, default=default_report, help="Path to summary benchmark report")
    parser.add_argument("--container", type=str, default="flowbre_fastapi_app", help="Docker container name")
    parser.add_argument("--binary", type=str, default=None, help="Path to local cibil-cli binary")
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)

    runner = CibilRunner(binary_path=args.binary, container=args.container)
    print(f"Runner initialized: {'Docker (' + runner.container + ')' if runner.use_docker else runner.binary_path}")

    # Gather PDFs
    all_files = sorted(list(args.samples.glob("*.[pP][dD][fF]")))
    pdf_files = sorted(list(set(all_files)), key=lambda p: p.name.lower())

    print(f"Found {len(pdf_files)} PDF files in {args.samples}")
    print(f"Outputs will be written to {args.output_dir}\n" + "-" * 70)

    results = []
    success_count = 0
    scanned_count = 0
    error_count = 0
    scores = []
    bre_decisions = {"APPROVE": 0, "REFER": 0, "DECLINE": 0}

    for idx, pdf_path in enumerate(pdf_files, 1):
        filename = pdf_path.name
        stem = pdf_path.stem
        out_file = args.output_dir / f"{stem}.json"
        pdf_bytes = pdf_path.read_bytes()

        # Run with target schema
        retcode, target_resp, stderr = runner.run_engine(pdf_bytes, filename, schema="target")

        if retcode == 0 and target_resp and isinstance(target_resp, dict):
            status = target_resp.get("status", "SUCCESS")
            message = target_resp.get("message", "")
            target_data = target_resp.get("data")

            if status == "SUCCESS" and target_data:
                success_count += 1
                score = target_data.get("CIBIL_Score")
                if score is not None and score > 0:
                    scores.append(score)

                # Fetch internal schema for rich consumer details and raw report
                _, internal_resp, _ = runner.run_engine(pdf_bytes, filename, schema="internal")
                raw_report = None
                consumer_info = None
                if internal_resp and isinstance(internal_resp, dict):
                    raw_report = internal_resp.get("data")
                    if raw_report and isinstance(raw_report, dict):
                        c_info = raw_report.get("consumer_info", {})
                        meta = raw_report.get("report_metadata", {})
                        consumer_info = {
                            "name": c_info.get("consumer_name"),
                            "pan": c_info.get("pan"),
                            "date_of_birth": c_info.get("date_of_birth"),
                            "gender": c_info.get("gender"),
                            "control_number": meta.get("control_number"),
                            "report_date": meta.get("report_date"),
                        }

                # Evaluate BRE
                bre_res = evaluate_bre(target_data)
                bre_decisions[bre_res["decision"]] = bre_decisions.get(bre_res["decision"], 0) + 1

                account_count = len(target_data.get("DPD") or {})
                enquiries_count = (target_data.get("Loan_Enquiry") or {}).get("Total_Enquiries", 0)

                output_doc = {
                    "source": filename,
                    "status": "SUCCESS",
                    "message": message,
                    "consumer_info": consumer_info,
                    "bre": bre_res,
                    "data": target_data,
                    "raw_report": raw_report,
                }
                out_file.write_text(json.dumps(output_doc, indent=2, ensure_ascii=False), encoding="utf-8")

                pan_str = (consumer_info or {}).get("pan") or "N/A"
                name_str = (consumer_info or {}).get("name") or "N/A"
                print(
                    f"[{idx:2}/{len(pdf_files)}] SUCCESS: {filename}\n"
                    f"       Score: {score} | Accounts: {account_count} | Enquiries: {enquiries_count} | "
                    f"BRE: {bre_res['decision']} | Consumer: {name_str} ({pan_str})"
                )

                results.append({
                    "filename": filename,
                    "status": "SUCCESS",
                    "cibil_score": score,
                    "consumer_name": name_str,
                    "pan": pan_str,
                    "account_count": account_count,
                    "bre_decision": bre_res["decision"],
                    "output_file": out_file.name,
                })
            else:
                # UNKNOWN_CONSUMER / Scanned document requiring OCR
                scanned_count += 1
                output_doc = {
                    "source": filename,
                    "status": status,
                    "message": message,
                    "consumer_info": None,
                    "bre": None,
                    "data": None,
                    "raw_report": None,
                }
                out_file.write_text(json.dumps(output_doc, indent=2, ensure_ascii=False), encoding="utf-8")

                print(f"[{idx:2}/{len(pdf_files)}] {status}: {filename} (Scanned/Image-only -> Requires OCR)")

                results.append({
                    "filename": filename,
                    "status": status,
                    "message": message,
                    "cibil_score": None,
                    "output_file": out_file.name,
                })
        else:
            error_count += 1
            err_msg = stderr.strip() or "Failed to parse document"
            output_doc = {
                "source": filename,
                "status": "FAILED",
                "message": err_msg,
                "consumer_info": None,
                "bre": None,
                "data": None,
                "raw_report": None,
            }
            out_file.write_text(json.dumps(output_doc, indent=2, ensure_ascii=False), encoding="utf-8")

            print(f"[{idx:2}/{len(pdf_files)}] FAILED: {filename} -> {err_msg[:80]}")

            results.append({
                "filename": filename,
                "status": "FAILED",
                "error": err_msg,
                "cibil_score": None,
                "output_file": out_file.name,
            })

    # Summary report
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0
    summary = {
        "total_pdf_samples": len(pdf_files),
        "digital_text_layer_success": success_count,
        "scanned_image_only_requires_ocr": scanned_count,
        "fatal_errors": error_count,
        "average_score_readable": avg_score,
        "bre_decisions": bre_decisions,
        "results": results,
    }

    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    print("\n" + "=" * 70)
    print("BULK TESTING COMPLETE SUMMARY:")
    print(f"  Total PDF Samples Processed : {len(pdf_files)}")
    print(f"  Successfully Extracted      : {success_count} ({success_count / len(pdf_files) * 100:.1f}%)")
    print(f"  Scanned / Requires OCR      : {scanned_count} ({scanned_count / len(pdf_files) * 100:.1f}%)")
    print(f"  Execution Failures          : {error_count}")
    print(f"  Average CIBIL Score         : {avg_score}")
    print(f"  BRE Decisions (Readable)    : APPROVE={bre_decisions.get('APPROVE', 0)}, "
          f"REFER={bre_decisions.get('REFER', 0)}, DECLINE={bre_decisions.get('DECLINE', 0)}")
    print(f"  Outputs saved in            : {args.output_dir}")
    print("=" * 70)

    return 0 if error_count == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
