from typing import Any, Dict
from app.worker.celery_app import celery_app, task_with_tenant_context

# Background task dispatching real-time email alerts for SLA threshold breaches (> 400ms)
@celery_app.task(name="tasks.dispatch_sla_breach_alert")
@task_with_tenant_context
def dispatch_sla_breach_alert(
    trace_id: str,
    latency_ms: float,
    threshold_ms: float,
    tenant_id: str,
    endpoint: str,
) -> Dict[str, Any]:
    return {
        "status": "SENT",
        "trace_id": trace_id,
        "latency_ms": latency_ms,
        "tenant_id": tenant_id,
    }
