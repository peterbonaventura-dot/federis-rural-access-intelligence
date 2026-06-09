"""USDA ERS Rural-Urban Commuting Area Codes (ZIP-level secondary file)."""

from __future__ import annotations

import pandas as pd

from ..db.upsert import upsert_dataframe
from .base import Loader, LoadResult


# ERS publishes RUCA at the tract level plus a ZIP-RUCA crosswalk. We load
# the ZIP file here (it feeds geo_rurality_zip). Tract-level RUCA can be added
# as a separate table when a tract-level need measure is wired in.
RUCA_ZIP_URL = "https://www.ers.usda.gov/sites/default/files/_laserfiche/DataFiles/53241/RUCA2010zipcode.xlsx"
RUCA_VINTAGE = "2010"  # last ERS release; revised after each Decennial Census

# Rural rule per RHRC/ERS conventions: secondary RUCA >= 4 is non-urban.
RURAL_RUCA_THRESHOLD = 4.0


class ErsRucaLoader(Loader):
    source_key = "ers_ruca"

    def _run(self) -> LoadResult:
        path = self.download(RUCA_ZIP_URL, f"ruca_zip_{RUCA_VINTAGE}.xlsx")
        raw = pd.read_excel(path, sheet_name=0, dtype=str)

        cols = {c.lower().strip(): c for c in raw.columns}
        zip_col = next(
            (cols[k] for k in cols if "zip" in k and "code" in k),
            cols.get("zip_code") or cols.get("zip"),
        )
        ruca_col = next(
            (cols[k] for k in cols if "ruca" in k and "2" in k),  # RUCA2 / secondary
            None,
        ) or next((cols[k] for k in cols if "ruca" in k), None)
        if not zip_col or not ruca_col:
            raise ValueError(f"Unexpected RUCA columns: {list(raw.columns)}")

        df = pd.DataFrame({
            "zcta": raw[zip_col].astype(str).str.zfill(5),
            "ruca_code": pd.to_numeric(raw[ruca_col], errors="coerce"),
        }).dropna(subset=["ruca_code"]).drop_duplicates(subset=["zcta"])
        df["is_rural"] = df["ruca_code"] >= RURAL_RUCA_THRESHOLD
        df["far_level"] = None  # populated by ers_far loader

        # Insert into geo_rurality_zip but only touch RUCA columns on conflict.
        rows = upsert_dataframe(
            "geo_rurality_zip",
            df,
            conflict_cols=["zcta"],
            update_cols=["ruca_code", "is_rural"],
        )
        return LoadResult(
            data_vintage=RUCA_VINTAGE,
            row_count=rows,
            notes=f"rural rule: secondary RUCA >= {RURAL_RUCA_THRESHOLD}",
        )
