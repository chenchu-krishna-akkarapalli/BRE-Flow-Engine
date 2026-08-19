from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.document_record import DocumentRecordModel
from app.db.repositories.base_repository import BaseRepository

# Repository for document metadata and extraction deduplication cache
class DocumentRepository(BaseRepository[DocumentRecordModel]):
    def __init__(self, db: AsyncSession):
        super().__init__(DocumentRecordModel, db)

    # Looks up cached document extraction by SHA-256 payload hash
    async def get_by_hash(self, file_hash: str) -> Optional[DocumentRecordModel]:
        stmt = select(DocumentRecordModel).where(DocumentRecordModel.file_hash == file_hash)
        result = await self.db.execute(stmt)
        return result.scalars().first()
