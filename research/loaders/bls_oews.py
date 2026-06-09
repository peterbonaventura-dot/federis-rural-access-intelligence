"""BLS OEWS — employment/wage by area, for direct-care SOC codes.

OEWS has no clean REST API. The annual research files publish national,
state, MSA, and nonmetropolitan-area cuts. We:

  1. Download the annual all-data XLSX (oesm{YY}all.zip → oesm{YY}all.xlsx).
  2. Filter to SOC 31-1121 (HHA), 31-1122 (PCA), 31-1131 (Nursing Assistant).
  3. For each area row, expand to county_fips using `bls_area_county_xwalk`.
  4. Aggregate employment up (sum) and weight wage by area employment.

The area→county crosswalk is the only fiddly part: BLS publishes area
definitions separately as XLSX. We persist them into bls_area_county_xwalk
and FLAG any unmapped areas in load_runs.notes so analysts see coverage.
"""

from __future__ import annotations

import logging

import pandas as pd
from sqlalchemy import text

from ..db.connection import engine
from ..db.upsert import upsert_dataframe
from .base import Loader, LoadResult

log = logging.getLogger("loader.oews")


OEWS_YEAR = 2023
# Annual all-data file (BLS publishes ~April for prior May reference period).
OEWS_URL = f"https://www.bls.gov/oes/special-requests/oesm{OEWS_YEAR % 100}all.zip"
# Area definitions file: pinned to the matching vintage when BLS publishes a
# new MSA definition release. The crosswalk loader is left as a manual seed
# (`research/data/bls_area_county_xwalk_<year>.csv`) when this URL goes stale.
AREA_DEFS_URL = (
    f"https://www.bls.gov/oes/{OEWS_YEAR}/may/area_definitions_m{OEWS_YEAR}.xlsx"
)

DIRECT_CARE_SOCS = {"31-1121", "31-1122", "31-1131"}


class BlsOewsLoader(Loader):
    source_key = "bls_oews"

    def _run(self) -> LoadResult:
        self._ensure_xwalk()

        archive = self.download(OEWS_URL, f"oesm{OEWS_YEAR % 100}all.zip")
        import zipfile
        with zipfile.ZipFile(archive) as zf:
            inner = next(n for n in zf.namelist() if n.lower().endswith(".xlsx"))
            extract_path = archive.parent / inner.replace("/", "_")
            with zf.open(inner) as src, open(extract_path, "wb") as dst:
                dst.write(src.read())

        raw = pd.read_excel(extract_path, dtype=str)
        cols = {c.lower(): c for c in raw.columns}
        soc_col = cols.get("occ_code") or cols.get("soc_code")
        area_col = cols.get("area") or cols.get("area_code")
        emp_col = cols.get("tot_emp")
        wage_col = cols.get("a_mean") or cols.get("annual_mean_wage")
        if not all([soc_col, area_col, emp_col, wage_col]):
            raise ValueError(f"Unexpected OEWS columns: {list(raw.columns)[:30]}")

        df = raw[[soc_col, area_col, emp_col, wage_col]].copy()
        df.columns = ["soc_code", "area_code", "employment", "mean_wage"]
        df = df[df["soc_code"].isin(DIRECT_CARE_SOCS)].copy()

        # OEWS uses "*" / "#" sentinels for suppressed cells.
        df["employment"] = pd.to_numeric(df["employment"], errors="coerce")
        df["mean_wage"] = pd.to_numeric(df["mean_wage"], errors="coerce")

        # Join to crosswalk → county.
        xwalk = pd.read_sql(
            text(
                "SELECT area_code, county_fips FROM bls_area_county_xwalk WHERE vintage_year = :y"
            ),
            engine(),
            params={"y": OEWS_YEAR},
        )
        joined = df.merge(xwalk, on="area_code", how="left")
        unmapped = joined[joined["county_fips"].isna()]["area_code"].nunique()
        joined = joined.dropna(subset=["county_fips"])

        # County-level aggregate: sum employment, employment-weighted wage.
        def _agg(group: pd.DataFrame) -> pd.Series:
            emp = group["employment"].fillna(0).sum()
            w = group["mean_wage"] * group["employment"].fillna(0)
            mean_wage = (w.sum() / emp) if emp > 0 else None
            return pd.Series({"employment": emp, "mean_wage": mean_wage})

        agg = (
            joined.groupby(["county_fips", "soc_code"], as_index=False)
            .apply(_agg, include_groups=False)
            .reset_index(drop=True)
        )
        agg["data_year"] = OEWS_YEAR

        rows = upsert_dataframe(
            "workforce_county",
            agg[["county_fips", "data_year", "soc_code", "employment", "mean_wage"]],
            conflict_cols=["county_fips", "data_year", "soc_code"],
        )
        return LoadResult(
            data_vintage=str(OEWS_YEAR),
            row_count=rows,
            notes=(
                f"SOC filter {sorted(DIRECT_CARE_SOCS)}; "
                f"{unmapped} OEWS areas unmapped to county"
            ),
        )

    def _ensure_xwalk(self) -> None:
        """Populate bls_area_county_xwalk if empty for this vintage.

        Strategy:
          1. If a seed CSV exists in DATA_DIR (bls_area_county_xwalk_<year>.csv),
             load it. Columns: area_code,area_name,county_fips
          2. Otherwise attempt to download the BLS area_definitions XLSX and
             parse the nonmetro/MSA → county sheets.
        """
        with engine().begin() as conn:
            count = conn.execute(
                text(
                    "SELECT count(*) FROM bls_area_county_xwalk WHERE vintage_year = :y"
                ),
                {"y": OEWS_YEAR},
            ).scalar_one()
        if count > 0:
            return

        seed = self._seed_csv_path()
        if seed.exists():
            log.info("loading BLS area xwalk from seed CSV: %s", seed)
            xwalk = pd.read_csv(seed, dtype=str)
        else:
            xwalk = self._parse_area_definitions()

        xwalk["vintage_year"] = OEWS_YEAR
        xwalk["county_fips"] = xwalk["county_fips"].astype(str).str.zfill(5)
        upsert_dataframe(
            "bls_area_county_xwalk",
            xwalk[["area_code", "area_name", "county_fips", "vintage_year"]],
            conflict_cols=["area_code", "county_fips", "vintage_year"],
        )

    def _seed_csv_path(self):
        from ..config.settings import settings as _s
        return _s.data_dir / f"bls_area_county_xwalk_{OEWS_YEAR}.csv"

    def _parse_area_definitions(self) -> pd.DataFrame:
        path = self.download(AREA_DEFS_URL, f"bls_area_defs_{OEWS_YEAR}.xlsx")
        # The XLSX has multiple sheets; the relevant ones have columns like
        # ['MSA Code','MSA Name','FIPS State Code','FIPS County Code','County Name']
        # plus a nonmetropolitan area sheet with ['BOS Code','BOS Name',...].
        all_sheets = pd.read_excel(path, sheet_name=None, dtype=str)
        frames: list[pd.DataFrame] = []
        for name, sheet in all_sheets.items():
            cols = {c.lower().strip(): c for c in sheet.columns}
            area_code_col = next(
                (cols[k] for k in cols if "msa code" in k or "bos code" in k or "area code" in k),
                None,
            )
            area_name_col = next(
                (cols[k] for k in cols if "msa name" in k or "bos name" in k or "area name" in k),
                None,
            )
            state_col = next((cols[k] for k in cols if "state" in k and "code" in k), None)
            county_col = next((cols[k] for k in cols if "county" in k and "code" in k), None)
            if not (area_code_col and state_col and county_col):
                continue
            f = pd.DataFrame({
                "area_code": sheet[area_code_col].astype(str).str.strip(),
                "area_name": sheet[area_name_col] if area_name_col else None,
                "county_fips": (
                    sheet[state_col].astype(str).str.zfill(2)
                    + sheet[county_col].astype(str).str.zfill(3)
                ),
            })
            frames.append(f)
        if not frames:
            raise RuntimeError(
                "Could not parse BLS area definitions. Provide a seed CSV at "
                f"{self._seed_csv_path()} (cols: area_code,area_name,county_fips)."
            )
        return pd.concat(frames, ignore_index=True).dropna(subset=["area_code", "county_fips"])
