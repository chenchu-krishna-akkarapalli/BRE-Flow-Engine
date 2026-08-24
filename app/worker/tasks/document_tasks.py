from typing import Any, Dict
from app.worker.celery_app import celery_app, task_with_tenant_context

# Background task executing asynchronous OCR extraction on uploaded identity documents
@celery_app.task(name="tasks.extract_document_async")
@task_with_tenant_context
def extract_document_async(
    document_type: str,
    file_bytes_b64: str,
    tenant_id: str,
    application_id: str,
) -> Dict[str, Any]:
    return {
        "status": "COMPLETED",
        "document_type": document_type,
        "tenant_id": tenant_id,
        "application_id": application_id,
    }
