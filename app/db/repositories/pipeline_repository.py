from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.pipeline import PipelineLeadModel
from app.db.repositories.base_repository import BaseRepository

# Repository for sales pipeline leads and origination stage tracking
class PipelineRepository(BaseRepository[PipelineLeadModel]):
    def __init__(self, db: AsyncSession):
        super().__init__(PipelineLeadModel, db)

    # Retrieves pipeline leads filtered by tenant and optional workflow stage
    async def get_by_stage(self, tenant_id: str, stage: Optional[str] = None) -> List[PipelineLeadModel]:
        stmt = select(PipelineLeadModel).where(PipelineLeadModel.tenant_id == tenant_id)
        if stage:
            stmt = stmt.where(PipelineLeadModel.stage == stage)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
