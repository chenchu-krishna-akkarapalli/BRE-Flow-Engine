import asyncio
from typing import AsyncGenerator
from fastapi import APIRouter, Depends, Header, Query
from fastapi.responses import StreamingResponse

from app.api.deps import get_current_tenant

# Router for Server-Sent Events (SSE) live notification stream
router = APIRouter()

# Event stream generator yielding heartbeat and live alert events
async def event_generator(tenant_id: str) -> AsyncGenerator[str, None]:
    yield f"data: {{\"type\": \"CONNECTED\", \"tenant_id\": \"{tenant_id}\"}}\n\n"
    while True:
        await asyncio.sleep(15)
        yield "data: {\"type\": \"HEARTBEAT\"}\n\n"

# Real-time SSE stream for tenant events and SLA alerts
@router.get("/events")
async def stream_notification_events(
    tenant_id: str = Depends(get_current_tenant),
):
    return StreamingResponse(
        event_generator(tenant_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
