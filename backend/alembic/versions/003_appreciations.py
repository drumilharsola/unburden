"""appreciations table and profile appreciation_count

Revision ID: 003
Revises: 002
Create Date: 2026-03-15
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("profiles", sa.Column("appreciation_count", sa.Integer, nullable=False, server_default="0"))

    op.create_table(
        "appreciations",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("from_session_id", sa.String(64), sa.ForeignKey("users.session_id", ondelete="CASCADE"), nullable=False),
        sa.Column("to_session_id", sa.String(64), sa.ForeignKey("users.session_id", ondelete="CASCADE"), nullable=False),
        sa.Column("room_id", sa.String(64), nullable=False),
        sa.Column("from_username", sa.String(64), nullable=False),
        sa.Column("from_role", sa.String(16), nullable=False),
        sa.Column("message", sa.String(500), nullable=False),
        sa.Column("created_at", sa.BigInteger, nullable=False),
        sa.UniqueConstraint("from_session_id", "room_id", name="uq_appreciation_per_room"),
    )
    op.create_index("ix_appreciation_to", "appreciations", ["to_session_id"])


def downgrade() -> None:
    op.drop_table("appreciations")
    op.drop_column("profiles", "appreciation_count")
