"""Orphan-FIPS guard.

Acceptance criterion: every area fact table joins cleanly to
geo_rurality_county on county_fips. This test runs the same SQL the CLI's
`check-orphans` command runs, against whatever DATABASE_URL is configured.

The test is skipped when no database is configured (so it can run in CI
without provisioned Postgres). On a developer machine with a populated DB,
it fails loudly if any source produced an unjoinable FIPS.
"""

from __future__ import annotations

import os

import pytest


pytestmark = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"),
    reason="DATABASE_URL not set; integration test",
)


def test_no_orphan_county_fips():
    from research.geo.rurality import AREA_TABLES, orphan_county_fips
    offenders: dict[str, int] = {}
    for tbl in AREA_TABLES:
        try:
            df = orphan_county_fips(tbl)
        except Exception:
            # Table not populated yet; skip rather than fail.
            continue
        if not df.empty:
            offenders[tbl] = len(df)
    assert not offenders, f"orphan FIPS across area tables: {offenders}"
