"""FIPS-format invariants.

County FIPS must be a 5-character zero-padded string everywhere in this
repo — the join spine breaks silently if any source stores it as an integer
or strips leading zeros. This test imports each loader and asserts that the
zero-pad step is present, and exercises a handful of edge cases.
"""

from __future__ import annotations

import inspect

import pandas as pd

from research.loaders import (
    acs_age_disability, bls_oews, ers_rucc, ers_ruca, ers_far, facility, hrsa_ahrf,
)


LOADER_MODULES = [
    ers_rucc, ers_ruca, ers_far, acs_age_disability, bls_oews, hrsa_ahrf, facility,
]


def test_loaders_zero_pad_fips():
    """Every loader that touches a FIPS column must call .zfill(5) or .zfill(2/3)."""
    for mod in LOADER_MODULES:
        src = inspect.getsource(mod)
        if "county_fips" not in src and "zcta" not in src:
            continue
        assert ".zfill(" in src, f"{mod.__name__} touches FIPS but never zero-pads"


def test_state_county_fips_concat_pads():
    """Concatenating state + county FIPS must produce 5 chars even for leading zeros."""
    df = pd.DataFrame({"state": ["1", "06", "48"], "county": ["1", "037", "201"]})
    out = df["state"].str.zfill(2) + df["county"].str.zfill(3)
    assert out.tolist() == ["01001", "06037", "48201"]
    assert all(len(s) == 5 for s in out)


def test_rural_rucc_rule():
    from research.loaders.ers_rucc import RURAL_RUCC_CODES
    assert RURAL_RUCC_CODES == {4, 5, 6, 7, 8, 9}
    assert 3 not in RURAL_RUCC_CODES  # 3 is metro per ERS
    assert 9 in RURAL_RUCC_CODES
