"""Baseline database schema

Revision ID: 001_baseline
Revises: 
Create Date: 2026-09-28 16:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '001_baseline'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Department table
    op.create_table(
        'department',
        sa.Column('Dept_ID', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('Dept_Name', sa.String(length=50), nullable=False),
        sa.Column('Budget', sa.Numeric(precision=18, scale=2), nullable=True),
        sa.PrimaryKeyConstraint('Dept_ID'),
        sa.UniqueConstraint('Dept_Name')
    )

    # 2. Employee table
    op.create_table(
        'employee',
        sa.Column('Emp_ID', sa.Integer(), nullable=False),
        sa.Column('F_Name', sa.String(length=50), nullable=False),
        sa.Column('L_Name', sa.String(length=50), nullable=False),
        sa.Column('Salary', sa.Numeric(precision=20, scale=2), nullable=False),
        sa.Column('Dept_ID', sa.Integer(), nullable=False),
        sa.Column('Address', sa.String(length=500), nullable=False),
        sa.Column('Email', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(),
                  server_default=sa.text('1'), nullable=False),
        sa.Column('created_at', sa.DateTime(),
                  server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(
        ), onupdate=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['Dept_ID'], ['department.Dept_ID'], ),
        sa.PrimaryKeyConstraint('Emp_ID'),
        sa.UniqueConstraint('Email')
    )

    # 3. Salary history table
    op.create_table(
        'salary_history',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('Emp_ID', sa.Integer(), nullable=False),
        sa.Column('old_salary', sa.Numeric(
            precision=20, scale=2), nullable=False),
        sa.Column('new_salary', sa.Numeric(
            precision=20, scale=2), nullable=False),
        sa.Column('changed_by', sa.String(length=50), nullable=True),
        sa.Column('changed_at', sa.DateTime(),
                  server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['Emp_ID'], ['employee.Emp_ID'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # 4. User table
    op.create_table(
        'user',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('username', sa.String(length=50), nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=20),
                  server_default='user', nullable=False),
        sa.Column('is_active', sa.Boolean(),
                  server_default=sa.text('1'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('username')
    )


def downgrade() -> None:
    op.drop_table('salary_history')
    op.drop_table('employee')
    op.drop_table('department')
    op.drop_table('user')
