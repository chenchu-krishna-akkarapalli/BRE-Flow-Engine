"""Add token_version column to user_account table for instant session revocation.

Revision ID: 0007
Revises: 0006
Create Date: 2026-08-18
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Upgrades schema with token_version on user_account table
def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    user_cols = [c["name"] for c in insp.get_columns("user_account")]
    if "token_version" not in user_cols:
        op.add_column(
            "user_account",
            sa.Column("token_version", sa.Integer(), server_default="1", nullable=False),
        )


# Reverts schema changes
def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    user_cols = [c["name"] for c in insp.get_columns("user_account")]
    if "token_version" in user_cols:
        op.drop_column("user_account", "token_version")
