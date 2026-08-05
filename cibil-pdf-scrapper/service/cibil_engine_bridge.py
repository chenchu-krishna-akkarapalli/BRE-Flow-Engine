"""Bridge from FastAPI to the Rust CIBIL engine.

Integration choice: an isolated async subprocess worker, not PyO3/FFI.

  * Containment — a panic, OOM or runaway allocation in the engine kills one
    short-lived child, not the ASGI worker. In-process bindings share the
    address space and take the whole server down.
  * Enforceable limits — wall-clock timeout and OS memory caps apply per call.
  * Zero-disk — the request is framed over stdin and the reply read from
    stdout, so an uploaded PDF never lands on the filesystem.
  * No ABI coupling — no maturin build step or per-Python-version rebuild.

Cost is process spawn (~5-15 ms), amortised by a bounded concurrency pool.
Swap to PyO3 only if profiling shows spawn latency dominating.

stdin frame: [8-byte little-endian blocks-JSON length][blocks JSON][raw PDF]
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import struct
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Final

import fitz  # PyMuPDF

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT_S: Final[float] = 25.0
DEFAULT_MAX_CONCURRENCY: Final[int] = max(2, (os.cpu_count() or 4))
MAX_ENGINE_MEMORY_BYTES: Final[int] = 1024 * 1024 * 1024  # 1 GB per child


class EngineError(RuntimeError):
    """The engine failed, timed out, or returned an unusable payload."""


@dataclass(slots=True)
class EngineResult:
    status: str                       # SUCCESS | DUPLICATE_DOCUMENT | UNKNOWN_CONSUMER
    message: str
    duplicate_of: str | None = None
    data: dict[str, Any] | None = None


def extract_blocks(pdf_bytes: bytes) -> list[dict[str, Any]]:
    """Line-level text extraction, in memory.

    Line granularity is deliberate: block level lumps a whole DPD table into one
    element with no per-cell geometry, while word level splits multi-word labels
    such as "DATE OPENED :".
    """
    blocks: list[dict[str, Any]] = []
    with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
        for page_index, page in enumerate(doc):
            page_height = page.rect.height
            for block in page.get_text("dict")["blocks"]:
                for line in block.get("lines", []):
                    text = "".join(s["text"] for s in line["spans"]).strip()
                    if not text:
                        continue
                    blocks.append({
                        "raw_text": text,
                        "bounding_box": list(line["bbox"]),
                        "page_number": page_index + 1,
                        "page_height": page_height,
                    })
    return blocks


def _apply_child_limits() -> None:
    """Cap child address space. POSIX only; a no-op on Windows."""
    try:
        import resource  # noqa: PLC0415 - unavailable on Windows

        resource.setrlimit(
            resource.RLIMIT_AS, (MAX_ENGINE_MEMORY_BYTES, MAX_ENGINE_MEMORY_BYTES)
        )
    except Exception:  # noqa: BLE001 - best effort; the timeout still applies
        pass


class CibilEngine:
    """Bounded pool of short-lived engine subprocesses."""

    def __init__(
        self,
        binary: str | Path,
        *,
        dedupe_state: str | Path | None = None,
        timeout_s: float = DEFAULT_TIMEOUT_S,
        max_concurrency: int = DEFAULT_MAX_CONCURRENCY,
    ) -> None:
        self._binary = str(binary)
        if not Path(self._binary).exists():
            raise FileNotFoundError(f"CIBIL engine binary not found: {self._binary}")
        self._dedupe_state = str(dedupe_state) if dedupe_state else None
        self._timeout_s = timeout_s
        self._sem = asyncio.Semaphore(max_concurrency)

    async def parse(self, pdf_bytes: bytes, *, doc_id: str) -> EngineResult:
        blocks = await asyncio.to_thread(extract_blocks, pdf_bytes)
        payload = json.dumps(blocks, ensure_ascii=False).encode("utf-8")
        frame = struct.pack("<Q", len(payload)) + payload + pdf_bytes

        argv = [self._binary, "-", "--schema", "target", "--pipeline", "--doc-id", doc_id]
        if self._dedupe_state:
            argv += ["--seen", self._dedupe_state]

        async with self._sem:
            stdout = await self._run(argv, frame)

        try:
            envelope = json.loads(stdout)
        except json.JSONDecodeError as exc:
            raise EngineError("Engine returned malformed JSON.") from exc

        return EngineResult(
            status=envelope.get("status", "SUCCESS"),
            message=envelope.get("message", ""),
            duplicate_of=envelope.get("duplicate_of"),
            data=envelope.get("data"),
        )

    async def _run(self, argv: list[str], frame: bytes) -> bytes:
        proc = await asyncio.create_subprocess_exec(
            *argv,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            preexec_fn=_apply_child_limits if os.name == "posix" else None,
        )
        try:
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(frame), timeout=self._timeout_s
            )
        except asyncio.TimeoutError as exc:
            proc.kill()
            await proc.wait()
            raise EngineError(
                f"Engine exceeded the {self._timeout_s:.0f}s budget and was terminated."
            ) from exc

        if proc.returncode != 0:
            # stderr may quote document text; never surface it to the client.
            logger.error("engine exit=%s stderr=%s", proc.returncode, stderr[:512])
            raise EngineError("Engine failed to process the document.")
        return stdout
