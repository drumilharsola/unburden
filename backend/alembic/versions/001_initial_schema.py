"""initial schema - users profiles blocked_users

Revision ID: 001
Revises:
Create Date: 2026-03-14
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("session_id", sa.String(64), primary_key=True),
        sa.Column("email_hash", sa.String(128), unique=True, nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("password_hash", sa.String(128), nullable=False),
        sa.Column("created_at", sa.BigInteger, nullable=False),
    )
    op.create_index("ix_users_email_hash", "users", ["email_hash"])

    op.create_table(
        "profiles",
        sa.Column("session_id", sa.String(64), sa.ForeignKey("users.session_id", ondelete="CASCADE"), primary_key=True),
        sa.Column("username", sa.String(64), unique=True, nullable=False),
        sa.Column("avatar_id", sa.Integer, default=0, nullable=False),
        sa.Column("age_verified", sa.Boolean, default=True, nullable=False),
        sa.Column("email_verified", sa.Boolean, default=False, nullable=False),
        sa.Column("speak_count", sa.Integer, default=0, nullable=False),
        sa.Column("listen_count", sa.Integer, default=0, nullable=False),
        sa.Column("created_at", sa.BigInteger, nullable=False),
    )
    op.create_index("ix_profiles_username", "profiles", ["username"])

    op.create_table(
        "blocked_users",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("blocker_session_id", sa.String(64), sa.ForeignKey("users.session_id", ondelete="CASCADE"), nullable=False),
        sa.Column("blocked_session_id", sa.String(64), nullable=False),
        sa.Column("username", sa.String(64), default="", nullable=False),
        sa.Column("avatar_id", sa.Integer, default=0, nullable=False),
        sa.Column("blocked_at", sa.BigInteger, nullable=False),
        sa.UniqueConstraint("blocker_session_id", "blocked_session_id", name="uq_block_pair"),
    )
    op.create_index("ix_blocker", "blocked_users", ["blocker_session_id"])


def downgrade() -> None:
    op.drop_table("blocked_users")
    op.drop_table("profiles")
    op.drop_table("users")
