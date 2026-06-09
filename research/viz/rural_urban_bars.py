"""Figure: rural-vs-metro headline gaps as a paired bar chart.

For each measure (workers per 1k 65+, facilities per 1k 65+, self-care
disability rate), compute the population-weighted county mean in rural and
metro counties and plot side-by-side.
"""

from __future__ import annotations

import logging
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from ..db.connection import engine
from . import common

log = logging.getLogger("viz.bars")


def render() -> Path:
    df = common.workforce_per_1k_65()
    facilities = common.matched_facilities()

    fac_counts = facilities.groupby("county_fips").size().rename("facility_count")
    df = df.merge(fac_counts, on="county_fips", how="left").fillna({"facility_count": 0})
    df["facilities_per_1k_65"] = (
        df["facility_count"] * 1000.0 / df["pop_65_plus"].where(df["pop_65_plus"] > 0)
    )

    # Self-care difficulty rate (per 1k 65+, as a need-side measure).
    need = pd.read_sql(
        "SELECT county_fips, pop_with_self_care_disability "
        "FROM population_need_county "
        "WHERE data_year = (SELECT MAX(data_year) FROM population_need_county)",
        engine(),
    )
    df = df.merge(need, on="county_fips", how="left")
    df["self_care_per_1k_65"] = (
        df["pop_with_self_care_disability"] * 1000.0 / df["pop_65_plus"].where(df["pop_65_plus"] > 0)
    )

    def weighted_mean(sub: pd.DataFrame, col: str) -> float:
        w = sub["pop_65_plus"].fillna(0)
        v = sub[col]
        mask = v.notna() & (w > 0)
        if not mask.any():
            return float("nan")
        return float(np.average(v[mask], weights=w[mask]))

    rural = df[df["is_rural"] == True]   # noqa: E712
    metro = df[df["is_rural"] == False]  # noqa: E712

    measures = [
        ("Direct-care workers\nper 1k 65+", "workers_per_1k_65"),
        ("Geocoded facilities\nper 1k 65+", "facilities_per_1k_65"),
        ("Self-care difficulty\nper 1k 65+", "self_care_per_1k_65"),
    ]
    summary = pd.DataFrame(
        [
            {
                "measure": label,
                "rural": weighted_mean(rural, col),
                "metro": weighted_mean(metro, col),
            }
            for label, col in measures
        ]
    )

    fig, ax = plt.subplots(figsize=(9, 5.5))
    x = np.arange(len(summary))
    width = 0.38
    ax.bar(x - width/2, summary["rural"], width, label="Rural (RUCC 4–9)", color=common.RURAL_COLOR)
    ax.bar(x + width/2, summary["metro"], width, label="Metro (RUCC 1–3)", color=common.URBAN_COLOR)

    for i, row in summary.iterrows():
        ax.text(i - width/2, row["rural"], f"{row['rural']:.1f}", ha="center", va="bottom", fontsize=9)
        ax.text(i + width/2, row["metro"], f"{row['metro']:.1f}", ha="center", va="bottom", fontsize=9)

    ax.set_xticks(x)
    ax.set_xticklabels(summary["measure"])
    ax.set_ylabel("Population-weighted county mean")
    ax.set_title("Rural vs Metro Headline Gaps (per 1,000 aged 65+)")
    ax.legend(loc="upper right")
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    fig.tight_layout()

    out_png = common.OUTPUT_DIR / "rural_urban_bars.png"
    out_csv = common.OUTPUT_DIR / "rural_urban_bars.csv"
    fig.savefig(out_png, dpi=180, bbox_inches="tight")
    summary.to_csv(out_csv, index=False)
    plt.close(fig)
    log.info("wrote %s and %s", out_png.name, out_csv.name)
    return out_png
