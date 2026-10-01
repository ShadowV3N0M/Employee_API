"""Add email to user table and create password_reset_token table

Revision ID: 002_password_reset
Revises: 001_baseline
Create Date: 2026-09-28 16:35:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '002_password_reset'
down_revision: Union[str, Sequence[str], None] = '001_baseline'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add email column to user table
    op.add_column('user', sa.Column(
        'email', sa.String(length=100), nullable=True))
    op.create_unique_constraint('uq_user_email', 'user', ['email'])

    # 2. Create password_reset_token table
    op.create_table(
        'password_reset_token',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('token_hash', sa.String(length=255), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('used', sa.Boolean(),
                  server_default=sa.text('0'), nullable=False),
        sa.Column('created_at', sa.DateTime(),
                  server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_password_reset_token_token_hash',
                    'password_reset_token', ['token_hash'])


def downgrade() -> None:
    op.drop_index('ix_password_reset_token_token_hash',
                  table_name='password_reset_token')
    op.drop_table('password_reset_token')
    op.drop_constraint('uq_user_email', 'user', type_='unique')
    op.drop_column('user', 'email')
