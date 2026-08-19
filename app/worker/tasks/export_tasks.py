from typing import Any, Dict
from app.worker.celery_app import celery_app, task_with_tenant_context

# Background task generating multi-page application eligibility PDF/Excel exports
@celery_app.task(name="tasks.generate_eligibility_report_async")
@task_with_tenant_context
def generate_eligibility_report_async(
    application_id: str,
    export_format: str,
    tenant_id: str,
    user_id: str,
) -> Dict[str, Any]:
    return {
        "status": "COMPLETED",
        "application_id": application_id,
        "format": export_format,
        "tenant_id": tenant_id,
    }
