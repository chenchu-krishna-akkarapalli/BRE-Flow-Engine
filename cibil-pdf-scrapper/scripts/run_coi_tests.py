import argparse
import json
import subprocess
from pathlib import Path


CONTRACT_KEYS = {
    "_meta",
    "assessee_info",
    "bank_details",
    "return_details",
    "computation_of_total_income",
    "tax_computation",
    "financial_particulars",
}


def run(binary: Path, sample: Path) -> dict:
    process = subprocess.run([str(binary), str(sample)], capture_output=True, text=True)
    if process.returncode != 0:
        return {"source": sample.name, "status": "FAILED", "error": process.stderr.strip()}
    try:
        data = json.loads(process.stdout)
        if "data" in data and isinstance(data["data"], dict):
            data = data["data"]
    except json.JSONDecodeError as error:
        return {"source": sample.name, "status": "FAILED", "error": f"invalid JSON: {error}"}
    missing = sorted(CONTRACT_KEYS - set(data))
    if missing:
        return {"source": sample.name, "status": "CONTRACT_ERROR", "missing_keys": missing}
    meta = data["_meta"]
    return {
        "source": sample.name,
        "status": "OK",
        "confidence_score": meta.get("confidence_score", 0.0),
        "confidence_breakdown": meta.get("confidence_breakdown", {}),
        "low_confidence_fields": meta.get("low_confidence_fields", []),
        "bugs": bugs(data),
        "_output": data,
    }


def bugs(data: dict) -> list[str]:
    found = []
    assessee = data["assessee_info"]
    computation = data["computation_of_total_income"]
    if not assessee.get("name"):
        found.append("missing assessee name")
    if not assessee.get("pan"):
        found.append("missing PAN")
    if not assessee.get("assessment_year"):
        found.append("missing assessment year")
    if computation.get("total_income") is None:
        found.append("missing total income")
    if data["_meta"].get("confidence_score", 0.0) < 0.8:
        found.append("confidence below 0.80")
    return found


def main() -> int:
    # Resolve cibil-pdf-scrapper root directory
    project_root = Path(__file__).resolve().parent.parent
    default_samples = project_root / "computation-of-income-copies-test"
    default_binary = project_root / "target" / "release" / "coi-cli.exe"
    default_output_dir = project_root / "target" / "coi-output"

    parser = argparse.ArgumentParser(description="Evaluate the offline COI CLI against the sample corpus")
    parser.add_argument("--samples", type=Path, default=default_samples)
    parser.add_argument("--binary", type=Path, default=default_binary)
    parser.add_argument("--report", type=Path)
    parser.add_argument("--output-dir", type=Path, default=default_output_dir)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    samples = sorted(path for path in args.samples.iterdir() if path.is_file() and path.suffix.lower() == ".pdf")
    results = []
    for sample in samples:
        result = run(args.binary, sample)
        output_path = args.output_dir / f"{sample.stem}.json"
        output = result.pop("_output", result)
        output_path.write_text(json.dumps(output, indent=2), encoding="utf-8")
        results.append(result)
    readable = [item for item in results if item["status"] == "OK"]
    scans = [item for item in results if item["status"] == "FAILED" and "No extractable text" in item.get("error", "")]
    failures = [item for item in results if item["status"] not in {"OK", "FAILED"}]
    low_confidence = [item for item in readable if item.get("confidence_score", 0.0) < 0.8]
    summary = {
        "total_pdf_samples": len(results),
        "readable_text_layer": len(readable),
        "scan_or_decode_failures": len(scans),
        "contract_failures": len(failures),
        "low_confidence_readable": len(low_confidence),
        "average_confidence_readable": round(sum(item.get("confidence_score", 0.0) for item in readable) / len(readable), 3) if readable else 0.0,
        "results": results,
    }
    for item in results:
        print(f"{item['source']}: {item['status']} confidence={item.get('confidence_score', 0.0):.2f} bugs={len(item.get('bugs', []))}")
    print(json.dumps({key: value for key, value in summary.items() if key != "results"}, indent=2))
    if args.report:
        args.report.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
