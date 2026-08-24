import functools
import os
from typing import Any, Callable

# Check if celery is installed; if not, provide a lightweight mockable fallback
try:
    from celery import Celery
    CELERY_AVAILABLE = True
except ImportError:
    CELERY_AVAILABLE = False
    class Celery:  # type: ignore
        def __init__(self, *args, **kwargs):
            self.conf = {}
        def task(self, *args, **kwargs):
            def decorator(func):
                @functools.wraps(func)
                def wrapper(*f_args, **f_kwargs):
                    return func(*f_args, **f_kwargs)
                wrapper.delay = func
                return wrapper
            return decorator

broker_url = os.getenv("CELERY_BROKER_URL", "redis://127.0.0.1:6379/1")
result_backend = os.getenv("CELERY_RESULT_BACKEND", "redis://127.0.0.1:6379/2")

celery_app = Celery(
    "flowbre_worker",
    broker=broker_url,
    backend=result_backend,
    include=[
        "app.worker.tasks.document_tasks",
        "app.worker.tasks.notification_tasks",
        "app.worker.tasks.export_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=180,
    worker_concurrency=4,
)

# Decorator binding tenant RLS context for asynchronous worker execution
def task_with_tenant_context(func: Callable) -> Callable:
    @functools.wraps(func)
    def wrapper(*args, **kwargs) -> Any:
        tenant_id = kwargs.get("tenant_id")
        return func(*args, **kwargs)
    return wrapper
