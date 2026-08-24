from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.application import ApplicationModel
from app.db.models.audit_log import AuditLogModel
from app.db.models.rule_execution import RuleExecutionModel
from app.db.repositories.base_repository import BaseRepository

# Repository for atomic application persistence and evaluation audit
class ApplicationRepository(BaseRepository[ApplicationModel]):
    def __init__(self, db: AsyncSession):
        super().__init__(ApplicationModel, db)

    # Retrieves applications scoped by tenant ID
    async def get_by_tenant(self, tenant_id: str, skip: int = 0, limit: int = 50) -> List[ApplicationModel]:
        stmt = select(ApplicationModel).where(ApplicationModel.tenant_id == tenant_id).offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    # Atomically persists application along with rule execution and audit log records
    async def persist_evaluation_atomic(
        self,
        application: ApplicationModel,
        rule_execution: RuleExecutionModel,
        audit_log: AuditLogModel,
    ) -> ApplicationModel:
        self.db.add(application)
        self.db.add(rule_execution)
        self.db.add(audit_log)
        await self.db.flush()
        return application
