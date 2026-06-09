"""Figure: direct-care workforce per 1,000 people aged 65+, by county.

Two-panel output:
  - left:  national choropleth (CONUS), workforce per 1k 65+
  - right: rural counties only, same scale, to make the gap visible
"""

from __future__ import annotations

import logging
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

from . import common

log = logging.getLogger("viz.workforce")


def render() -> Path:
    counties = common.load_counties()
    df = common.workforce_per_1k_65()
    gdf = counties.merge(df, on="county_fips", how="left")

    # Cap the scale at the 95th percentile so rural lows are still readable.
    vals = gdf["workers_per_1k_65"].dropna()
    if vals.empty:
        raise RuntimeError("no workforce data — load bls_oews + acs_age_disability first")
    vmax = float(np.percentile(vals, 95))

    fig, axes = plt.subplots(1, 2, figsize=(16, 7))
    for ax, subset, title in (
        (axes[0], gdf, "All counties (CONUS)"),
        (axes[1], gdf[gdf["is_rural"] == True], "Rural counties only (RUCC 4–9)"),  # noqa: E712
    ):
        subset.plot(
            ax=ax,
            column="workers_per_1k_65",
            cmap="YlGnBu",
            vmin=0,
            vmax=vmax,
            edgecolor="white",
            linewidth=0.05,
            missing_kwds={"color": common.NO_DATA_COLOR, "label": "no data"},
            legend=True,
            legend_kwds={"shrink": 0.5, "label": "Direct-care workers per 1,000 aged 65+"},
        )
        ax.set_title(title)
        ax.set_axis_off()

    fig.suptitle(
        "Direct-Care Workforce Adequacy by County\n"
        "BLS OEWS SOC 31-1121/1122/1131 ÷ ACS 65+ population (×1,000)",
        fontsize=13, y=1.02,
    )
    fig.tight_layout()

    out_png = common.OUTPUT_DIR / "workforce_choropleth.png"
    out_csv = common.OUTPUT_DIR / "workforce_choropleth.csv"
    fig.savefig(out_png, dpi=180, bbox_inches="tight")
    df.to_csv(out_csv, index=False)
    plt.close(fig)
    log.info("wrote %s and %s", out_png.name, out_csv.name)
    return out_png
