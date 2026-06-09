"""Census Geocoder — free batch endpoint, no key.

Submits up to 10,000 addresses per batch and returns coordinates + 2020
census geographies (state FIPS + county FIPS available directly). Records
that come back `Tie` or `No_Match` are written to `facilities` with that
status so the analyst sees coverage rather than silent drops.
"""

from __future__ import annotations

import csv
import io
import logging
from typing import TypedDict

import pandas as pd
import requests
from sqlalchemy import text
from tenacity import retry, stop_after_attempt, wait_exponential

from ..db.connection import engine

log = logging.getLogger("geocoder")


BATCH_URL = (
    "https://geocoding.geo.census.gov/geocoder/geographies/addressbatch"
)
BATCH_SIZE = 5000  # well under the 10k cap; smaller batches recover faster on errors.
BENCHMARK = "Public_AR_Current"
VINTAGE = "Census2020_Current"


class GeocodeStats(TypedDict):
    total: int
    matched: int
    tie: int
    no_match: int


def geocode_addresses(facility_source: str, df: pd.DataFrame) -> GeocodeStats:
    """Geocode a DataFrame of [external_id, name, street, city, state, zip]
    and upsert the results into `facilities`.
    """
    required = {"external_id", "street", "city", "state", "zip"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"geocode_addresses: missing columns {missing}")

    stats: GeocodeStats = {"total": 0, "matched": 0, "tie": 0, "no_match": 0}
    for batch_start in range(0, len(df), BATCH_SIZE):
        batch = df.iloc[batch_start : batch_start + BATCH_SIZE]
        log.info(
            "geocoding batch %d-%d / %d",
            batch_start, batch_start + len(batch), len(df),
        )
        results = _submit_batch(batch)
        _write_results(facility_source, batch, results, stats)
    return stats


@retry(stop=stop_after_attempt(4), wait=wait_exponential(multiplier=2, min=2, max=16))
def _submit_batch(batch: pd.DataFrame) -> pd.DataFrame:
    buf = io.StringIO()
    writer = csv.writer(buf)
    # Census batch input columns (no header): id, street, city, state, zip
    for _, row in batch.iterrows():
        writer.writerow([
            row["external_id"],
            row.get("street", ""),
            row.get("city", ""),
            row.get("state", ""),
            row.get("zip", ""),
        ])
    files = {"addressFile": ("addresses.csv", buf.getvalue().encode("utf-8"))}
    data = {"benchmark": BENCHMARK, "vintage": VINTAGE}
    resp = requests.post(BATCH_URL, files=files, data=data, timeout=600)
    resp.raise_for_status()

    # Output columns (positional, no header):
    # id, input_address, match, exact, matched_address, coords, tigerline_id,
    # side, state_fips, county_fips, tract, block
    cols = [
        "id", "input_address", "match", "exact", "matched_address", "coords",
        "tigerline_id", "side", "state_fips", "county_fips", "tract", "block",
    ]
    out = pd.read_csv(
        io.StringIO(resp.text),
        header=None,
        names=cols,
        dtype=str,
        quoting=csv.QUOTE_ALL,
        on_bad_lines="skip",
    )
    return out


def _write_results(
    facility_source: str,
    batch: pd.DataFrame,
    results: pd.DataFrame,
    stats: GeocodeStats,
) -> None:
    by_id = results.set_index("id")
    rows: list[dict] = []
    for _, src in batch.iterrows():
        ext_id = src["external_id"]
        raw_address = ", ".join(
            str(src.get(c, "") or "") for c in ("street", "city", "state", "zip")
        )
        r = by_id.loc[ext_id] if ext_id in by_id.index else None
        if r is None:
            status, quality, lon, lat, fips = "no_match", None, None, None, None
        else:
            if isinstance(r, pd.DataFrame):  # duplicate id, take first
                r = r.iloc[0]
            match = (r.get("match") or "").strip()
            quality = (r.get("exact") or "").strip() or None
            coords = (r.get("coords") or "").strip()
            fips_state = (r.get("state_fips") or "").strip()
            fips_county = (r.get("county_fips") or "").strip()
            fips = (fips_state.zfill(2) + fips_county.zfill(3)) if fips_state and fips_county else None
            if match == "Match" and coords:
                lon_s, lat_s = coords.split(",")
                lon, lat = float(lon_s), float(lat_s)
                status = "matched"
            elif match == "Tie":
                status, lon, lat = "tie", None, None
            else:
                status, lon, lat = "no_match", None, None

        stats["total"] += 1
        stats[status if status in stats else "no_match"] += 1
        rows.append({
            "facility_source": facility_source,
            "external_id": ext_id,
            "name": src.get("name"),
            "raw_address": raw_address,
            "geocode_status": status,
            "match_quality": quality,
            "county_fips": fips,
            "lon": lon,
            "lat": lat,
        })

    sql = text(
        """
        INSERT INTO facilities
            (facility_source, external_id, name, raw_address, geocode_status,
             match_quality, county_fips, geom)
        VALUES (
            :facility_source, :external_id, :name, :raw_address, :geocode_status,
            :match_quality, :county_fips,
            CASE WHEN :lon IS NOT NULL AND :lat IS NOT NULL
                 THEN ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)
                 ELSE NULL END
        )
        ON CONFLICT (facility_source, external_id) DO UPDATE SET
            name = EXCLUDED.name,
            raw_address = EXCLUDED.raw_address,
            geocode_status = EXCLUDED.geocode_status,
            match_quality = EXCLUDED.match_quality,
            county_fips = EXCLUDED.county_fips,
            geom = EXCLUDED.geom,
            loaded_at = now()
        """
    )
    with engine().begin() as conn:
        conn.execute(sql, rows)


# ---------------------------------------------------------------------------
# Travel distance — straight-line default; OSRM integration point.
# ---------------------------------------------------------------------------
def straight_line_distance_query(point_table: str = "facilities") -> str:
    """Return SQL that computes meters between each facility and a county
    centroid table. Analysts can wrap this for the access-desert study.

    Replace with an OSRM-backed road-network distance once a self-hosted
    OSRM instance is available — do NOT call a paid geocoder/routing API.
    """
    return f"""
    SELECT f.id, f.county_fips,
           ST_Distance(f.geom::geography, c.centroid::geography) AS meters
    FROM {point_table} f
    JOIN county_centroids c ON c.county_fips = f.county_fips
    WHERE f.geom IS NOT NULL
    """
