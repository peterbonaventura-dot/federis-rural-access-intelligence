"""Facility loaders — source-agnostic ingestion of provider address files.

A facility loader's job is narrow:
  1. Pull the source CSV (or accept a local file).
  2. Normalize to (external_id, name, street, city, state, zip).
  3. Hand off to geo.geocoder.geocode_addresses, which talks to the free
     Census batch geocoder and writes rows to `facilities` with status.

CmsHomeHealthLoader is the reference implementation. To add a new source
(e.g. HRSA black lung clinics), copy and adjust the column mapping.
"""

from __future__ import annotations

import logging
from pathlib import Path

import pandas as pd

from ..config.settings import settings
from ..geo.geocoder import geocode_addresses
from .base import Loader, LoadResult

log = logging.getLogger("loader.facility")


CMS_HHA_URL = (
    "https://data.cms.gov/provider-data/sites/default/files/resources/"
    "fb5e3ce7e6a59b59d36ed5da34cf0a8a_1717545600/HHCAHPS_PROVIDER.csv"
)
CMS_HHA_VINTAGE = "2024"


class CmsHomeHealthLoader(Loader):
    source_key = "facility_cms_home_health"
    facility_source = "cms_home_health"

    def _run(self) -> LoadResult:
        # Allow analyst to drop a fresh CSV locally; otherwise download.
        local = settings.data_dir / "cms_home_health.csv"
        if local.exists():
            log.info("using local CMS HHA CSV: %s", local)
            path: Path = local
        else:
            path = self.download(CMS_HHA_URL, "cms_home_health.csv")

        raw = pd.read_csv(path, dtype=str)
        # CMS column names are stable enough; normalize defensively.
        cols = {c.lower().strip(): c for c in raw.columns}
        get = lambda *opts: next((cols[o] for o in opts if o in cols), None)  # noqa: E731
        id_col = get("ccn", "cms certification number (ccn)", "federal provider number")
        name_col = get("provider name", "facility name")
        street_col = get("provider address", "address line 1", "address")
        city_col = get("citytown", "city/town", "city")
        state_col = get("state")
        zip_col = get("zip code", "zip")
        if not all([id_col, street_col, city_col, state_col, zip_col]):
            raise ValueError(
                f"Unexpected CMS HHA columns; got {list(raw.columns)[:30]}"
            )

        df = pd.DataFrame({
            "external_id": raw[id_col].astype(str).str.strip(),
            "name": raw[name_col] if name_col else None,
            "street": raw[street_col].astype(str).str.strip(),
            "city": raw[city_col].astype(str).str.strip(),
            "state": raw[state_col].astype(str).str.strip(),
            "zip": raw[zip_col].astype(str).str.strip().str.zfill(5),
        }).drop_duplicates(subset=["external_id"])

        stats = geocode_addresses(self.facility_source, df)
        return LoadResult(
            data_vintage=CMS_HHA_VINTAGE,
            row_count=stats["total"],
            notes=(
                f"matched={stats['matched']} tie={stats['tie']} no_match={stats['no_match']}"
            ),
        )
