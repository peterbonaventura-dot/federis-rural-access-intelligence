"""Rurality classification join helpers.

Area fact tables (workforce_county, population_need_county, hrsa_ahrf_county)
are joined to geo_rurality_county on county_fips. ZIP-keyed sources join to
geo_rurality_zip on zcta. This module exposes SQL fragments and an orphan-
check used by both the CLI and tests.
"""

from __future__ import annotations

import pandas as pd
from sqlalchemy import text

from ..db.connection import engine


AREA_TABLES = ["workforce_county", "population_need_county", "hrsa_ahrf_county"]


def orphan_county_fips(table: str) -> pd.DataFrame:
    """Rows in `table` whose county_fips has no match in geo_rurality_county."""
    sql = text(
        f"""
        SELECT DISTINCT t.county_fips
        FROM {table} t
        LEFT JOIN geo_rurality_county r USING (county_fips)
        WHERE r.county_fips IS NULL
        """
    )
    with engine().connect() as conn:
        return pd.read_sql(sql, conn)


def county_profile(county_fips: str) -> pd.DataFrame:
    """Single-county dump combining rurality + workforce + need.

    Used as the Study-1-queryable acceptance check.
    """
    sql = text(
        """
        SELECT
            r.county_fips,
            r.rucc_code,
            r.is_rural,
            r.metro_status,
            n.data_year                    AS need_year,
            n.pop_65_plus,
            n.pop_with_self_care_disability,
            w.soc_code,
            w.data_year                    AS workforce_year,
            w.employment,
            w.mean_wage
        FROM geo_rurality_county r
        LEFT JOIN population_need_county n ON n.county_fips = r.county_fips
        LEFT JOIN workforce_county w ON w.county_fips = r.county_fips
        WHERE r.county_fips = :fips
        ORDER BY w.soc_code
        """
    )
    with engine().connect() as conn:
        return pd.read_sql(sql, conn, params={"fips": county_fips})
