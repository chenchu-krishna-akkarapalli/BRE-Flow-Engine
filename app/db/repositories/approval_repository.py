from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.pipeline import ApprovalQueueModel
from app.db.repositories.base_repository import BaseRepository

# Repository for underwriting review queue and exception sign-offs
class ApprovalRepository(BaseRepository[ApprovalQueueModel]):
    def __init__(self, db: AsyncSession):
        super().__init__(ApprovalQueueModel, db)

    # Retrieves pending approval queue records for tenant
    async def get_pending_queue(self, tenant_id: str) -> List[ApprovalQueueModel]:
        stmt = select(ApprovalQueueModel).where(
            ApprovalQueueModel.tenant_id == tenant_id,
            ApprovalQueueModel.status == "PENDING_REVIEW",
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
