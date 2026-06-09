"""Figure: home-care access deserts.

Counties shaded by count of geocoded facilities per 1,000 people 65+
(low = potential desert), with the underlying facility points overlaid.
Rural counties get a hatched outline so the rural pattern is visible
without depending on color alone.
"""

from __future__ import annotations

import logging
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd

from . import common

log = logging.getLogger("viz.deserts")


def render() -> Path:
    counties = common.load_counties()
    facilities = common.matched_facilities()
    if facilities.empty:
        raise RuntimeError("no geocoded facilities — run a facility_* loader first")

    need = common.workforce_per_1k_65()[["county_fips", "pop_65_plus", "is_rural"]]

    fac_counts = (
        facilities.groupby("county_fips", as_index=False)
        .size()
        .rename(columns={"size": "facility_count"})
    )
    desert = need.merge(fac_counts, on="county_fips", how="left").fillna({"facility_count": 0})
    desert["facilities_per_1k_65"] = (
        desert["facility_count"] * 1000.0 / desert["pop_65_plus"].where(desert["pop_65_plus"] > 0)
    )
    gdf = counties.merge(desert, on="county_fips", how="left")

    fig, ax = plt.subplots(figsize=(14, 8))

    # Choropleth: facilities per 1k 65+.
    gdf.plot(
        ax=ax,
        column="facilities_per_1k_65",
        cmap="RdYlGn",
        vmin=0,
        vmax=float(gdf["facilities_per_1k_65"].quantile(0.9) or 1.0),
        edgecolor="white",
        linewidth=0.05,
        missing_kwds={"color": common.NO_DATA_COLOR},
        legend=True,
        legend_kwds={"shrink": 0.5, "label": "Facilities per 1,000 aged 65+"},
    )

    # Hatch the rural counties so the rural pattern reads in B&W too.
    rural = gdf[gdf["is_rural"] == True]  # noqa: E712
    if not rural.empty:
        rural.plot(
            ax=ax,
            facecolor="none",
            edgecolor="#555555",
            hatch="///",
            linewidth=0.15,
        )

    # Facility points (small, semi-transparent so density patterns show through).
    ax.scatter(
        facilities["lon"], facilities["lat"],
        s=2, c="#08306b", alpha=0.35, linewidths=0,
    )

    ax.set_xlim(common.CONUS_BBOX[0], common.CONUS_BBOX[2])
    ax.set_ylim(common.CONUS_BBOX[1], common.CONUS_BBOX[3])
    ax.set_axis_off()
    ax.set_title(
        "Home-Care Access Deserts\n"
        "Geocoded facility points + facilities-per-1k-65+ choropleth; "
        "hatched = rural (RUCC 4–9)",
        fontsize=13,
    )

    out_png = common.OUTPUT_DIR / "access_deserts.png"
    out_csv = common.OUTPUT_DIR / "access_deserts.csv"
    fig.savefig(out_png, dpi=180, bbox_inches="tight")
    desert.to_csv(out_csv, index=False)
    plt.close(fig)
    log.info("wrote %s and %s", out_png.name, out_csv.name)
    return out_png
