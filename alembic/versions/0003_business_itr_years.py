"""Business ITR captured as years of filed returns, not a rupee amount.

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-28
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("application", sa.Column("business_itr_years", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("application", "business_itr_years")
