"""Shared helpers for figure scripts: county geometry, palette, output paths."""

from __future__ import annotations

import logging
import zipfile
from pathlib import Path

import geopandas as gpd
import pandas as pd
import requests
from tenacity import retry, stop_after_attempt, wait_exponential

from ..config.settings import settings
from ..db.connection import engine

log = logging.getLogger("viz")


# Census cartographic boundary file (20m generalization) — small + good enough
# for national choropleths. Pinned to 2022 vintage; bump when newer is current.
COUNTY_SHP_URL = "https://www2.census.gov/geo/tiger/GENZ2022/shp/cb_2022_us_county_20m.zip"
COUNTY_SHP_NAME = "cb_2022_us_county_20m"

# Continental-US bbox in 4326. Excludes AK / HI / PR for the headline figures;
# individual scripts can override.
CONUS_BBOX = (-125.0, 24.0, -66.0, 49.5)

OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=2, max=10))
def load_counties(conus_only: bool = True) -> gpd.GeoDataFrame:
    """Load the Census 20m county shapefile, cached in DATA_DIR."""
    zip_path = settings.data_dir / f"{COUNTY_SHP_NAME}.zip"
    shp_dir = settings.data_dir / COUNTY_SHP_NAME
    if not shp_dir.exists():
        if not zip_path.exists():
            log.info("downloading county shapefile: %s", COUNTY_SHP_URL)
            resp = requests.get(COUNTY_SHP_URL, timeout=120)
            resp.raise_for_status()
            zip_path.write_bytes(resp.content)
        with zipfile.ZipFile(zip_path) as zf:
            zf.extractall(shp_dir)

    shp = next(shp_dir.glob("*.shp"))
    gdf = gpd.read_file(shp)
    gdf["county_fips"] = gdf["GEOID"].astype(str).str.zfill(5)
    if conus_only:
        # State FIPS for AK=02, HI=15, PR=72, plus VI/GU/AS/MP territories.
        gdf = gdf[~gdf["STATEFP"].isin(["02", "15", "60", "66", "69", "72", "78"])]
    return gdf[["county_fips", "STATEFP", "geometry"]]


def workforce_per_1k_65(soc_codes: tuple[str, ...] = ("31-1121", "31-1122", "31-1131")) -> pd.DataFrame:
    """County-level workforce per 1,000 people 65+ for the latest vintages of
    each source, joined to rurality.
    """
    soc_list = ",".join(f"'{s}'" for s in soc_codes)
    sql = f"""
        WITH latest_w AS (
            SELECT county_fips, SUM(employment) AS employment
            FROM workforce_county
            WHERE soc_code IN ({soc_list})
              AND data_year = (SELECT MAX(data_year) FROM workforce_county)
            GROUP BY county_fips
        ),
        latest_n AS (
            SELECT county_fips, pop_65_plus
            FROM population_need_county
            WHERE data_year = (SELECT MAX(data_year) FROM population_need_county)
        )
        SELECT
            r.county_fips,
            r.is_rural,
            r.rucc_code,
            COALESCE(w.employment, 0)        AS employment,
            n.pop_65_plus,
            CASE WHEN n.pop_65_plus > 0
                 THEN (COALESCE(w.employment, 0) * 1000.0 / n.pop_65_plus)
                 END                          AS workers_per_1k_65
        FROM geo_rurality_county r
        LEFT JOIN latest_w w ON w.county_fips = r.county_fips
        LEFT JOIN latest_n n ON n.county_fips = r.county_fips
    """
    return pd.read_sql(sql, engine())


def matched_facilities() -> pd.DataFrame:
    """All successfully geocoded facility points with county + rurality."""
    sql = """
        SELECT f.facility_source, f.external_id, f.name,
               f.county_fips, r.is_rural,
               ST_X(f.geom) AS lon, ST_Y(f.geom) AS lat
        FROM facilities f
        LEFT JOIN geo_rurality_county r ON r.county_fips = f.county_fips
        WHERE f.geocode_status = 'matched' AND f.geom IS NOT NULL
    """
    return pd.read_sql(sql, engine())


# Color palette — colorblind-friendly, prints OK in B&W.
RURAL_COLOR = "#1f6fb4"
URBAN_COLOR = "#bdbdbd"
ACCENT_COLOR = "#d7301f"
NO_DATA_COLOR = "#f0f0f0"
