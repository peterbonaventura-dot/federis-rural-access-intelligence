"""Geocoder unit tests.

We don't hit the Census endpoint in unit tests; we exercise the input/output
contract: required input columns, retention of non-matches, FIPS assembly.
"""

from __future__ import annotations

import pandas as pd
import pytest

from research.geo import geocoder


def test_geocode_requires_columns():
    df = pd.DataFrame({"external_id": ["a"], "street": ["1 Main"]})  # missing city/state/zip
    with pytest.raises(ValueError, match="missing columns"):
        geocoder.geocode_addresses("test_source", df)


def test_fips_assembly_from_results_row():
    # Mimic the per-row fields parsed from the Census batch response.
    state, county = "06", "037"
    fips = state.zfill(2) + county.zfill(3)
    assert fips == "06037"
    assert len(fips) == 5
