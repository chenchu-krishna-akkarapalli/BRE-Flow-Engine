"""Add navigation_schema to role table and create navigation_node table.

Revision ID: 0006
Revises: 0005
Create Date: 2026-08-18
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Upgrades schema with navigation_schema column on role and navigation_node table
def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    # 1. Add navigation_schema JSON column to role table if not already added
    role_cols = [c["name"] for c in insp.get_columns("role")]
    if "navigation_schema" not in role_cols:
        op.add_column("role", sa.Column("navigation_schema", sa.JSON(), nullable=True))

    # 2. Create navigation_node table if not already present
    tables = insp.get_table_names()
    if "navigation_node" not in tables:
        op.create_table(
            "navigation_node",
            sa.Column("id", sa.String(64), primary_key=True),
            sa.Column("role_name", sa.String(64), nullable=False, index=True),
            sa.Column("section_title", sa.String(128), nullable=False),
            sa.Column("item_name", sa.String(128), nullable=False),
            sa.Column("path", sa.String(256), nullable=False),
            sa.Column("icon", sa.String(64), nullable=False),
            sa.Column("badge", sa.String(64), nullable=True),
            sa.Column("badge_type", sa.String(32), nullable=True),
            sa.Column("is_global", sa.Boolean(), server_default=sa.false(), nullable=False),
            sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )


# Reverts schema changes
def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    tables = insp.get_table_names()
    if "navigation_node" in tables:
        op.drop_table("navigation_node")

    role_cols = [c["name"] for c in insp.get_columns("role")]
    if "navigation_schema" in role_cols:
        op.drop_column("role", "navigation_schema")
