"""Export every table in the research repository to per-table CSV files.

Produces a self-contained snapshot directory suitable for sharing with
external collaborators (Project Director, partner researchers) who do not
need live database access.

Usage:
    python -m research.scripts.snapshot_csv [--out-dir DIR]

Defaults to research/snapshots/<UTC-timestamp>/.

All sources are public, non-PHI U.S. Government datasets; no suppression
required. The facilities table writes geom as WKT for portability.
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import logging
import pathlib
import sys

import pandas as pd
from sqlalchemy import text

from ..db.connection import get_engine

log = logging.getLogger("snapshot")

# Order matters only for readability — lookups first, facts after, point data last.
TABLES = [
    "source_registry",
    "load_runs",
    "geo_rurality_county",
    "geo_rurality_zip",
    "bls_area_county_xwalk",
    "workforce_county",
    "population_need_county",
    "hrsa_ahrf_county",
    "facilities",
]

# facilities.geom is PostGIS — export as WKT for portability.
GEOM_TABLES = {"facilities": "geom"}


def export_table(engine, table: str, out_path: pathlib.Path) -> int:
    if table in GEOM_TABLES:
        geom_col = GEOM_TABLES[table]
        sql = text(
            f"SELECT * EXCEPT, ST_AsText({geom_col}) AS {geom_col}_wkt FROM {table}"
        )
        # Postgres has no SELECT * EXCEPT; expand columns instead.
        with engine.connect() as conn:
            cols = [
                row[0]
                for row in conn.execute(
                    text(
                        "SELECT column_name FROM information_schema.columns "
                        "WHERE table_name = :t ORDER BY ordinal_position"
                    ),
                    {"t": table},
                )
            ]
        select_cols = [
            f"ST_AsText({c}) AS {c}_wkt" if c == geom_col else c for c in cols
        ]
        sql = text(f"SELECT {', '.join(select_cols)} FROM {table}")
    else:
        sql = text(f"SELECT * FROM {table}")

    df = pd.read_sql(sql, engine)
    df.to_csv(out_path, index=False, quoting=csv.QUOTE_MINIMAL)
    return len(df)


def write_manifest(engine, out_dir: pathlib.Path, counts: dict[str, int]) -> None:
    with engine.connect() as conn:
        latest = conn.execute(
            text(
                "SELECT source_key, MAX(downloaded_at) AS last_loaded, "
                "       MAX(data_vintage) AS data_vintage "
                "FROM load_runs WHERE status = 'success' GROUP BY source_key"
            )
        ).mappings().all()

    manifest = out_dir / "MANIFEST.txt"
    with manifest.open("w") as f:
        f.write("Rural Health Research Data Repository — CSV snapshot\n")
        f.write(f"Generated (UTC): {dt.datetime.utcnow().isoformat(timespec='seconds')}Z\n")
        f.write("Source: public, non-PHI U.S. Government datasets.\n\n")
        f.write("Tables (rows exported):\n")
        for t in TABLES:
            f.write(f"  {t:32s} {counts.get(t, 0):>10,}\n")
        f.write("\nLast successful load per source:\n")
        for row in latest:
            f.write(
                f"  {row['source_key']:24s} vintage={row['data_vintage']}  "
                f"loaded_at={row['last_loaded']}\n"
            )
        f.write(
            "\nfacilities.geom is exported as WKT (geom_wkt column); "
            "SRID is 4326 (WGS-84).\n"
        )
        f.write(
            "Cite sources using source_registry.citation. See research/README.md "
            "and the codebook (Rural_Health_Data_Repository_Codebook_v1.0.docx).\n"
        )
    log.info("wrote %s", manifest)


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--out-dir",
        type=pathlib.Path,
        default=None,
        help="Output directory (default: research/snapshots/<UTC-timestamp>/)",
    )
    args = parser.parse_args(argv)

    if args.out_dir is None:
        ts = dt.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
        args.out_dir = pathlib.Path("research/snapshots") / ts
    args.out_dir.mkdir(parents=True, exist_ok=True)

    engine = get_engine()
    counts: dict[str, int] = {}
    for table in TABLES:
        out_path = args.out_dir / f"{table}.csv"
        try:
            n = export_table(engine, table, out_path)
            counts[table] = n
            log.info("  %-32s %10d rows  → %s", table, n, out_path.name)
        except Exception as exc:  # noqa: BLE001 — log and continue per-table
            log.error("  %-32s FAILED: %s", table, exc)
            counts[table] = -1

    write_manifest(engine, args.out_dir, counts)
    log.info("\nSnapshot written to %s", args.out_dir)
    return 0


if __name__ == "__main__":
    sys.exit(main())
