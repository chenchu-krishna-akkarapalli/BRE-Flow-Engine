from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

# Telemetry log filtering query parameter schema
class TelemetrySearchRequest(BaseModel):
    tenant_id: Optional[str] = Field(None, description="Filter by tenant UUID")
    endpoint: Optional[str] = Field(None, description="Filter by API endpoint path")
    method: Optional[str] = Field(None, description="Filter by HTTP method")
    sla_breach_only: bool = Field(default=False, description="Restrict to SLA breaches >400ms")
    min_latency_ms: Optional[float] = Field(None, description="Minimum latency threshold")
    start_time: Optional[datetime] = Field(None, description="Filter window start timestamp")
    end_time: Optional[datetime] = Field(None, description="Filter window end timestamp")
    limit: int = Field(default=50, le=500, description="Max records to return")
    offset: int = Field(default=0, ge=0, description="Pagination offset")

# Telemetry log single record response
class TelemetryLogResponse(BaseModel):
    id: str = Field(..., description="Telemetry event unique ID")
    trace_id: str = Field(..., description="Distributed trace identifier")
    tenant_id: Optional[str] = Field(None, description="Tenant UUID")
    user_id: Optional[str] = Field(None, description="Invoking user ID")
    username: Optional[str] = Field(None, description="Invoking username")
    endpoint: str = Field(..., description="Endpoint path invoked")
    method: str = Field(..., description="HTTP Method")
    status_code: int = Field(..., description="HTTP status response")
    latency_ms: float = Field(..., description="Total round-trip latency in ms")
    sla_threshold_ms: float = Field(..., description="Target SLA threshold in ms")
    sla_breach: bool = Field(..., description="SLA violation flag")
    action: Optional[str] = Field(None, description="High-level action name")
    created_at: datetime = Field(..., description="Event timestamp")

# SLA breach alert notification record response
class SlaAlertResponse(BaseModel):
    id: str = Field(..., description="SLA alert unique ID")
    trace_id: str = Field(..., description="Associated trace ID")
    tenant_id: Optional[str] = Field(None, description="Associated tenant UUID")
    endpoint: str = Field(..., description="Slow API endpoint")
    latency_ms: float = Field(..., description="Recorded latency in ms")
    threshold_ms: float = Field(..., description="Breached SLA ceiling in ms")
    alert_channel: str = Field(..., description="Dispatch target: SSE, EMAIL, or BOTH")
    resolved: bool = Field(default=False, description="Resolution status")
    created_at: datetime = Field(..., description="Alert generation timestamp")

# Aggregate platform SLA metrics response
class SlaMetricsSummaryResponse(BaseModel):
    p50_latency_ms: float = Field(default=0.0, description="50th percentile latency in ms")
    p95_latency_ms: float = Field(default=0.0, description="95th percentile latency in ms")
    p99_latency_ms: float = Field(default=0.0, description="99th percentile latency in ms")
    total_invocations: int = Field(default=0, description="Total API requests in period")
    sla_breach_count: int = Field(default=0, description="Total requests exceeding SLA ceiling")
    sla_adherence_rate: float = Field(default=100.0, description="Percentage of requests within SLA")
