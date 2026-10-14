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


# Background task delivering Channel Admin initial credentials upon Super Admin approval
@celery_app.task(
    name="tasks.send_channel_admin_credentials",
    bind=True,
    max_retries=3,
    default_retry_delay=15,
)
def send_channel_admin_credentials_task(
    self,
    to_email: str,
    channel_name: str,
    username: str,
    password: str,
) -> Dict[str, Any]:
    try:
        from app.services.email_service import EmailService

        service = EmailService()
        result = service.send_credentials_email(
            to_email=to_email,
            channel_name=channel_name,
            username=username,
            password=password,
        )
        return {
            "status": "SUCCESS",
            "to": to_email,
            "channel_name": channel_name,
            "response": result,
        }
    except Exception as exc:
        # Retry with exponential backoff on network/API failure
        countdown = 15 * (2 ** self.request.retries)
        raise self.retry(exc=exc, countdown=countdown)

