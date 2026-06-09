from typing import Iterable, Sequence

import pandas as pd
from sqlalchemy import text

from .connection import engine


def upsert_dataframe(
    table: str,
    df: pd.DataFrame,
    conflict_cols: Sequence[str],
    update_cols: Sequence[str] | None = None,
) -> int:
    """Bulk upsert a DataFrame into a Postgres table by ON CONFLICT.

    Returns the row count actually written (len(df)).
    """
    if df.empty:
        return 0

    cols = list(df.columns)
    if update_cols is None:
        update_cols = [c for c in cols if c not in conflict_cols]

    placeholders = ", ".join(f":{c}" for c in cols)
    col_list = ", ".join(cols)
    conflict_list = ", ".join(conflict_cols)
    if update_cols:
        update_clause = ", ".join(f"{c} = EXCLUDED.{c}" for c in update_cols)
        on_conflict = f"ON CONFLICT ({conflict_list}) DO UPDATE SET {update_clause}"
    else:
        on_conflict = f"ON CONFLICT ({conflict_list}) DO NOTHING"

    sql = text(f"INSERT INTO {table} ({col_list}) VALUES ({placeholders}) {on_conflict}")
    rows: Iterable[dict] = df.where(pd.notnull(df), None).to_dict(orient="records")
    with engine().begin() as conn:
        conn.execute(sql, list(rows))
    return len(df)
