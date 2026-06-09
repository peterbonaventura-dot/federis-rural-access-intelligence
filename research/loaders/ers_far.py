"""USDA ERS Frontier and Remote Area Codes (ZIP level)."""

from __future__ import annotations

import pandas as pd
from sqlalchemy import text

from ..db.connection import engine
from .base import Loader, LoadResult


FAR_URL = "https://www.ers.usda.gov/sites/default/files/_laserfiche/DataFiles/51020/FARcodesZIPdata2010WithAKandHI.xlsx"
FAR_VINTAGE = "2010"


class ErsFarLoader(Loader):
    source_key = "ers_far"

    def _run(self) -> LoadResult:
        path = self.download(FAR_URL, f"far_zip_{FAR_VINTAGE}.xlsx")
        raw = pd.read_excel(path, sheet_name=0, dtype=str)

        cols = {c.lower().strip(): c for c in raw.columns}
        zip_col = cols.get("zip") or cols.get("zip_code") or next(
            (cols[k] for k in cols if "zip" in k), None
        )
        # FAR has four levels (FAR1..FAR4); take the highest non-zero as the
        # composite far_level so analysts can threshold on it.
        far_cols = [cols[k] for k in cols if k.startswith("far") and k[3:].isdigit()]
        if not zip_col or not far_cols:
            raise ValueError(f"Unexpected FAR columns: {list(raw.columns)}")

        df = raw[[zip_col, *far_cols]].copy()
        df[zip_col] = df[zip_col].astype(str).str.zfill(5)
        for c in far_cols:
            df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0).astype(int)
        # Highest level set (1..4); 0 if all zero (non-frontier).
        levels = df[far_cols].to_numpy()
        far_level = []
        for row in levels:
            nonzero = [i + 1 for i, v in enumerate(row) if v]
            far_level.append(max(nonzero) if nonzero else 0)
        out = pd.DataFrame({"zcta": df[zip_col], "far_level": far_level})
        out = out.drop_duplicates(subset=["zcta"])

        # Update only far_level on the existing geo_rurality_zip rows;
        # insert a row with far_level only if RUCA hasn't been loaded yet.
        with engine().begin() as conn:
            conn.execute(
                text(
                    """
                    INSERT INTO geo_rurality_zip (zcta, far_level)
                    VALUES (:zcta, :far_level)
                    ON CONFLICT (zcta) DO UPDATE SET far_level = EXCLUDED.far_level
                    """
                ),
                out.to_dict(orient="records"),
            )

        return LoadResult(
            data_vintage=FAR_VINTAGE,
            row_count=len(out),
            notes="far_level = highest FAR1..FAR4 flag set (0 = non-frontier)",
        )
