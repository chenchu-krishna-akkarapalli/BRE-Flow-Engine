"""Diagnose the document-OCR stack. Run it with the SAME interpreter that serves the API.

    .venv/Scripts/python.exe scripts/check_ocr_stack.py     # Windows
    .venv/bin/python scripts/check_ocr_stack.py             # Linux / macOS

Standalone by design: it never imports the FastAPI app, so it cannot be dragged
into the server lifespan or the request path. Exit code 0 = real OCR works,
1 = the API will fall back to simulated extraction.
"""

import importlib
import platform
import shutil
import sys
from typing import List, Optional, Tuple

# Checked by name so the output points at the package that is actually absent;
# openbharatocr under-declares its imports, so a missing dateutil looks like a
# missing openbharatocr unless each is probed separately.
REQUIRED_MODULES = [
    ("openbharatocr", "openbharatocr"),
    ("dateutil", "python-dateutil"),
    ("cv2", "opencv-python"),
    ("pytesseract", "pytesseract"),
    ("PIL", "Pillow"),
    ("numpy", "numpy"),
]


WINDOWS_TESSERACT = "winget install --id UB-Mannheim.TesseractOCR"
LINUX_TESSERACT = "sudo apt-get install -y tesseract-ocr"
MACOS_TESSERACT = "brew install tesseract"


def _ok(label: str, detail: str = "") -> None:
    print(f"  [ OK ]  {label}{f' - {detail}' if detail else ''}")


def _fail(label: str, detail: str = "") -> None:
    print(f"  [FAIL]  {label}{f' - {detail}' if detail else ''}")


def check_python_packages() -> List[str]:
    """Import each requirement, returning the pip names of those that failed."""
    print("\nPython packages")
    missing: List[str] = []
    for module_name, pip_name in REQUIRED_MODULES:
        try:
            module = importlib.import_module(module_name)
            _ok(module_name, getattr(module, "__version__", "") or "installed")
        except ImportError as exc:
            _fail(module_name, f"{exc.__class__.__name__}: {exc}")
            missing.append(pip_name)
    return missing


def check_tesseract_binary() -> Tuple[bool, bool]:
    """Resolve the engine the way pytesseract will at request time.

    Returns (usable, binary_on_path). The two differ when the binary is present
    but pytesseract is not - a Python-side gap that reinstalling Tesseract
    cannot fix, and the commonest way to misread this output.
    """
    print("\nTesseract OCR engine (OS-level binary)")

    on_path = shutil.which("tesseract")
    if on_path:
        _ok("tesseract on PATH", on_path)
    else:
        _fail("tesseract on PATH", "not found by shutil.which('tesseract')")

    try:
        import pytesseract
    except ImportError:
        _fail("pytesseract cannot resolve the binary", "pytesseract is not installed")
        return False, bool(on_path)

    # pytesseract shells out to `tesseract_cmd`; PATH is only consulted when
    # that is left as the bare name, which is why both are reported.
    print(f"  [ .. ]  pytesseract.tesseract_cmd = {pytesseract.pytesseract.tesseract_cmd!r}")
    try:
        version = str(pytesseract.get_tesseract_version())
        _ok("tesseract executes", f"v{version}")
        return True, True
    except Exception as exc:
        _fail("tesseract executes", f"{exc.__class__.__name__}: {exc}")
        return False, bool(on_path)


def check_end_to_end(sample: str = "test-pan.jpeg") -> Optional[bool]:
    """Read a real card if one is to hand. Returns None when there is no sample."""
    print(f"\nEnd-to-end extraction ({sample})")
    try:
        import openbharatocr
    except ImportError:
        _fail("skipped", "openbharatocr is not importable")
        return False

    try:
        with open(sample, "rb"):
            pass
    except OSError:
        print(f"  [ .. ]  no {sample} in the working directory; skipping")
        return None

    try:
        result = openbharatocr.pan(sample) or {}
    except Exception as exc:
        _fail("openbharatocr.pan()", f"{exc.__class__.__name__}: {exc}")
        return False

    # The card is real PII: report which fields were read, never their values.
    read = sorted(k for k, v in result.items() if v)
    empty = sorted(k for k, v in result.items() if not v)
    if read:
        _ok("fields read", ", ".join(read))
    if empty:
        print(f"  [ .. ]  fields the engine could not read: {', '.join(empty)}")
    return bool(read)


def print_instructions(missing_packages: List[str], tesseract_ok: bool,
                       binary_on_path: bool) -> None:
    print("\n" + "=" * 72)
    print("HOW TO FIX")
    print("=" * 72)

    if missing_packages:
        print(
            "\nPython packages are missing FROM THIS INTERPRETER:\n"
            f"  {sys.executable}\n\n"
            "  Installing them into a different interpreter will not help - the API\n"
            "  must be started with the one that has them.\n\n"
            f"  python -m pip install {' '.join(missing_packages)}\n"
            "  # or, for the whole project:\n"
            "  uv pip install -r requirements.txt"
        )

    if not tesseract_ok and binary_on_path:
        print(
            "\nThe Tesseract binary is installed and on PATH, but this interpreter\n"
            "  cannot drive it. That is a Python-side gap, not an OS one - installing\n"
            "  Tesseract again will change nothing. Install pytesseract above."
        )

    if not tesseract_ok and not binary_on_path:
        system = platform.system()
        command = {"Windows": WINDOWS_TESSERACT, "Linux": LINUX_TESSERACT, "Darwin": MACOS_TESSERACT}.get(
            system, LINUX_TESSERACT
        )
        print(
            f"\nThe Tesseract OCR engine is not usable on this host ({system}):\n"
            f"  {command}\n\n"
            "  It is an OS-level binary, NOT a Python package - pip cannot install it.\n"
            "  On Windows, reopen the shell afterwards so the new PATH is picked up, or\n"
            "  point pytesseract at it directly:\n"
            "      pytesseract.pytesseract.tesseract_cmd = r'C:\\Program Files\\Tesseract-OCR\\tesseract.exe'"
        )

    if not missing_packages and tesseract_ok:
        print(
            "\nNothing to fix - this interpreter can perform real OCR.\n"
            "  If the API still reports \"simulated\": true, it is running under a\n"
            "  DIFFERENT interpreter. Start it with this one:\n"
            f"      {sys.executable} -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
        )


def main() -> int:
    print("=" * 72)
    print("FlowBRE - document OCR stack check")
    print("=" * 72)
    print(f"\nInterpreter\n  [ .. ]  {sys.executable}")
    print(f"  [ .. ]  Python {platform.python_version()} on {platform.system()} {platform.release()}")

    missing = check_python_packages()
    tesseract_ok, binary_on_path = check_tesseract_binary()
    extracted = check_end_to_end()

    real_ocr = not missing and tesseract_ok
    print("\n" + "=" * 72)
    if real_ocr and extracted is not False:
        print("VERDICT: real OCR is available on this interpreter.")
    else:
        print("VERDICT: the API will fall back to SIMULATED extraction on this interpreter.")
    print_instructions(missing, tesseract_ok, binary_on_path)
    return 0 if real_ocr else 1


if __name__ == "__main__":
    sys.exit(main())
