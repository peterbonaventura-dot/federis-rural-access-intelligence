"""HRSA Area Health Resources File (county level).

AHRF is distributed as a large fixed-width ASCII file with a separate codebook.
HRSA does not publish a stable bulk URL; the file is fetched via a download
form at data.hrsa.gov. This loader expects the user to drop the unzipped
county-level ASCII file plus its layout XLSX into DATA_DIR:

  data/ahrf_county_<YEAR>.asc
  data/ahrf_county_<YEAR>_layout.xlsx

It parses the layout to slice the fixed-width fields, and stores a slim
(county_fips, data_year) primary key plus all attributes as JSONB so any
column is queryable without re-ingest.
"""

from __future__ import annotations

import logging

import pandas as pd

from ..config.settings import settings
from ..db.upsert import upsert_dataframe
from .base import Loader, LoadResult

log = logging.getLogger("loader.ahrf")


AHRF_YEAR = 2023


class HrsaAhrfLoader(Loader):
    source_key = "hrsa_ahrf"

    def _run(self) -> LoadResult:
        asc = settings.data_dir / f"ahrf_county_{AHRF_YEAR}.asc"
        layout = settings.data_dir / f"ahrf_county_{AHRF_YEAR}_layout.xlsx"
        if not asc.exists() or not layout.exists():
            raise FileNotFoundError(
                f"AHRF requires a manual download. Place the county ASCII file at "
                f"{asc} and its layout XLSX at {layout}. Source: "
                f"https://data.hrsa.gov/topics/health-workforce/ahrf"
            )

        spec = pd.read_excel(layout, dtype=str)
        cols = {c.lower().strip(): c for c in spec.columns}
        name_col = cols.get("field name") or cols.get("variable") or cols.get("col name")
        start_col = cols.get("col start") or cols.get("start")
        end_col = cols.get("col end") or cols.get("end")
        if not all([name_col, start_col, end_col]):
            raise ValueError(f"Unexpected AHRF layout columns: {list(spec.columns)}")

        # FIPS is conventionally in the first 5 cols of AHRF.
        widths = [(int(s) - 1, int(e)) for s, e in zip(spec[start_col], spec[end_col])]
        names = spec[name_col].astype(str).tolist()

        df = pd.read_fwf(asc, colspecs=widths, names=names, dtype=str)
        fips_field = next(
            (n for n in names if "fips" in n.lower() and "county" in n.lower()),
            None,
        ) or next((n for n in names if "fips" in n.lower()), None)
        if not fips_field:
            raise ValueError("No FIPS field found in AHRF layout")

        df["county_fips"] = df[fips_field].astype(str).str.zfill(5)
        df["data_year"] = AHRF_YEAR
        df["attributes"] = df.drop(columns=["county_fips", "data_year"]).to_dict(orient="records")

        out = df[["county_fips", "data_year", "attributes"]].drop_duplicates(
            subset=["county_fips", "data_year"]
        )
        # JSONB write: SQLAlchemy will serialize dicts when the column type is JSONB.
        # Use psycopg's json adapter via to_json string to be safe.
        import json
        out = out.copy()
        out["attributes"] = out["attributes"].apply(json.dumps)

        rows = upsert_dataframe(
            "hrsa_ahrf_county",
            out,
            conflict_cols=["county_fips", "data_year"],
        )
        return LoadResult(
            data_vintage=str(AHRF_YEAR),
            row_count=rows,
            notes="full AHRF row stored as JSONB attributes",
        )
