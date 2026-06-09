"""Census ACS 5-Year: 65+ population (B01001) and self-care disability (B18101).

Uses the Census Data API. Free key required (CENSUS_API_KEY).
Pulls one row per US county for the configured vintage year.
"""

from __future__ import annotations

import logging
from typing import Iterable

import pandas as pd
import requests
from tenacity import retry, stop_after_attempt, wait_exponential

from ..config.settings import settings
from ..db.upsert import upsert_dataframe
from .base import Loader, LoadResult

log = logging.getLogger("loader.acs")


ACS_YEAR = 2022  # latest released 5-yr at time of writing; bump when newer is published.
BASE = f"https://api.census.gov/data/{ACS_YEAR}/acs/acs5"

# B01001 sex-by-age, 65+ summed: male 65-66 (020) .. 85+ (025) + female 044..049.
AGE_65_PLUS_VARS = [
    "B01001_020E", "B01001_021E", "B01001_022E", "B01001_023E", "B01001_024E", "B01001_025E",
    "B01001_044E", "B01001_045E", "B01001_046E", "B01001_047E", "B01001_048E", "B01001_049E",
]

# B18105: self-care difficulty by age and sex — `_001E` is total with self-care difficulty.
# (B18101 in older vintages is sex-by-age-by-disability; B18105 is the direct
# self-care difficulty table. We use B18105 because it's a single-cell pull.)
SELF_CARE_VAR = "B18105_001E"


class AcsAgeDisabilityLoader(Loader):
    source_key = "acs_age_disability"

    def _run(self) -> LoadResult:
        if not settings.census_api_key:
            raise RuntimeError("CENSUS_API_KEY is required for ACS loader")

        age_df = self._fetch(AGE_65_PLUS_VARS)
        sc_df = self._fetch([SELF_CARE_VAR])

        age_df["pop_65_plus"] = (
            age_df[AGE_65_PLUS_VARS].apply(pd.to_numeric, errors="coerce").sum(axis=1).astype("Int64")
        )
        sc_df["pop_with_self_care_disability"] = (
            pd.to_numeric(sc_df[SELF_CARE_VAR], errors="coerce").astype("Int64")
        )

        merged = age_df[["county_fips", "pop_65_plus"]].merge(
            sc_df[["county_fips", "pop_with_self_care_disability"]],
            on="county_fips",
            how="outer",
        )
        merged["data_year"] = ACS_YEAR
        merged = merged.dropna(subset=["county_fips"])
        # Cast for psycopg
        for c in ("pop_65_plus", "pop_with_self_care_disability"):
            merged[c] = merged[c].astype("Int64")

        rows = upsert_dataframe(
            "population_need_county",
            merged[["county_fips", "data_year", "pop_65_plus", "pop_with_self_care_disability"]],
            conflict_cols=["county_fips", "data_year"],
        )
        return LoadResult(
            data_vintage=str(ACS_YEAR),
            row_count=rows,
            notes=f"B01001 65+ aggregated; B18105 self-care difficulty total",
        )

    @retry(stop=stop_after_attempt(4), wait=wait_exponential(multiplier=2, min=2, max=16))
    def _fetch(self, variables: Iterable[str]) -> pd.DataFrame:
        params = {
            "get": ",".join(variables),
            "for": "county:*",
            "in": "state:*",
            "key": settings.census_api_key,
        }
        resp = requests.get(BASE, params=params, timeout=120)
        resp.raise_for_status()
        payload = resp.json()
        header, *rows = payload
        df = pd.DataFrame(rows, columns=header)
        df["county_fips"] = df["state"].str.zfill(2) + df["county"].str.zfill(3)
        return df
