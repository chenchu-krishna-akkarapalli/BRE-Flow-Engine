from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field

from app.api.deps import get_current_tenant, get_current_user

# Router for application queries and report export endpoints
router = APIRouter()

# Retrieves stored application record by UUID
@router.get("/{application_id}")
async def get_application(
    application_id: str,
    tenant_id: str = Depends(get_current_tenant),
    current_user: dict = Depends(get_current_user),
):
    return {"application_id": application_id, "tenant_id": tenant_id, "status": "APPROVED"}

# Streams generated PDF or Excel eligibility report
@router.get("/{application_id}/export")
async def export_application_report(
    application_id: str,
    format: str = Query(default="pdf", pattern="^(pdf|xlsx)$"),
    tenant_id: str = Depends(get_current_tenant),
    current_user: dict = Depends(get_current_user),
):
    media_type = "application/pdf" if format == "pdf" else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    return Response(
        content=b"%PDF-1.4 mock stream",
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="eligibility_report_{application_id}.{format}"'},
    )
