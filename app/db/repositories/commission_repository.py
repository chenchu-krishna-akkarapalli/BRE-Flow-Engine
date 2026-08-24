from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.commission import CommissionLedgerModel
from app.db.repositories.base_repository import BaseRepository

# Repository for partner commission ledgers and disbursement accounting
class CommissionRepository(BaseRepository[CommissionLedgerModel]):
    def __init__(self, db: AsyncSession):
        super().__init__(CommissionLedgerModel, db)

    # Retrieves commission records by beneficiary tenant and optional payout status
    async def get_by_tenant_and_status(
        self,
        tenant_id: str,
        status: Optional[str] = None,
    ) -> List[CommissionLedgerModel]:
        stmt = select(CommissionLedgerModel).where(CommissionLedgerModel.tenant_id == tenant_id)
        if status:
            stmt = stmt.where(CommissionLedgerModel.status == status)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
