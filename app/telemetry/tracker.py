import time
import uuid
from typing import Optional

# Distributed trace context and high-resolution latency tracking timer
class TelemetryTracker:
    def __init__(self, trace_id: Optional[str] = None):
        self.trace_id = trace_id or f"req-{uuid.uuid4()}"
        self._start_time: float = 0.0
        self._end_time: float = 0.0

    # Starts latency recording timer
    def start(self) -> "TelemetryTracker":
        self._start_time = time.perf_counter()
        return self

    # Stops latency timer and returns elapsed duration in milliseconds
    def stop(self) -> float:
        self._end_time = time.perf_counter()
        return (self._end_time - self._start_time) * 1000.0
