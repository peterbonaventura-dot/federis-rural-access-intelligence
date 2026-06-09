"""USDA ERS Rural-Urban Continuum Codes (county level)."""

from __future__ import annotations

import pandas as pd

from ..db.upsert import upsert_dataframe
from .base import Loader, LoadResult


# Rural cutoff rule: RUCC codes 4-9 are non-metro/rural per ERS guidance.
# Documented here and in README so analysts and reviewers can audit.
RURAL_RUCC_CODES = {4, 5, 6, 7, 8, 9}

# The ERS file URL/format changes by vintage. The 2023 release is the most
# current as of the last hand-curated check. Update RUCC_URL when ERS publishes
# a new vintage; the loader is idempotent across vintages.
RUCC_URL = "https://www.ers.usda.gov/sites/default/files/_laserfiche/DataFiles/53251/Ruralurbancontinuumcodes2023.xlsx"
RUCC_VINTAGE = "2023"


class ErsRuccLoader(Loader):
    source_key = "ers_rucc"

    def _run(self) -> LoadResult:
        path = self.download(RUCC_URL, f"rucc_{RUCC_VINTAGE}.xlsx")
        raw = pd.read_excel(path, dtype={"FIPS": str})

        # ERS column names have shifted across vintages (FIPS / FIPS_code, etc.).
        # Normalize defensively.
        cols = {c.lower(): c for c in raw.columns}
        fips_col = cols.get("fips") or cols.get("fips_code") or cols.get("fipstxt")
        rucc_col = cols.get("rucc_2023") or cols.get("rucc_2013") or cols.get("rucc")
        desc_col = cols.get("description") or cols.get("attribute")
        if not fips_col or not rucc_col:
            raise ValueError(f"Unexpected RUCC columns: {list(raw.columns)}")

        df = pd.DataFrame({
            "county_fips": raw[fips_col].astype(str).str.zfill(5),
            "rucc_code": pd.to_numeric(raw[rucc_col], errors="coerce").astype("Int64"),
            "rucc_year": int(RUCC_VINTAGE),
            "metro_status": raw[desc_col] if desc_col else None,
        })
        df = df.dropna(subset=["rucc_code"]).drop_duplicates(subset=["county_fips"])
        df["is_rural"] = df["rucc_code"].isin(RURAL_RUCC_CODES)
        # Cast Int64 -> int for psycopg
        df["rucc_code"] = df["rucc_code"].astype(int)

        rows = upsert_dataframe(
            "geo_rurality_county",
            df,
            conflict_cols=["county_fips"],
        )
        return LoadResult(
            data_vintage=RUCC_VINTAGE,
            row_count=rows,
            notes=f"rural rule: RUCC in {sorted(RURAL_RUCC_CODES)}",
        )
