from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.telemetry import SlaAlertModel, TelemetryLogModel
from app.db.repositories.base_repository import BaseRepository

# Repository for high-throughput telemetry logs and SLA alert records
class TelemetryRepository(BaseRepository[TelemetryLogModel]):
    def __init__(self, db: AsyncSession):
        super().__init__(TelemetryLogModel, db)

    # Records an SLA breach alert record
    async def create_alert(self, alert: SlaAlertModel) -> SlaAlertModel:
        self.db.add(alert)
        await self.db.flush()
        return alert

    # Retrieves recorded SLA breaches
    async def get_breaches(self, tenant_id: Optional[str] = None, limit: int = 50) -> List[TelemetryLogModel]:
        stmt = select(TelemetryLogModel).where(TelemetryLogModel.sla_breach.is_(True))
        if tenant_id:
            stmt = stmt.where(TelemetryLogModel.tenant_id == tenant_id)
        stmt = stmt.order_by(TelemetryLogModel.created_at.desc()).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
