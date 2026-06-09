"""CLI for the rural-health research data repository.

Usage:
  python -m research.run init                   # create schema + seed sources
  python -m research.run load <source_key>      # run one loader
  python -m research.run refresh-all            # run every loader, idempotent
  python -m research.run geocode <facility_src> # alias for load <facility_key>
  python -m research.run profile <county_fips>  # Study-1 acceptance query

All loaders are idempotent: a second run upserts and does not duplicate.
"""

from __future__ import annotations

import argparse
import sys

from .db.connection import init_schema
from .geo.rurality import AREA_TABLES, county_profile, orphan_county_fips
from .loaders import REGISTRY


def cmd_init(_args) -> int:
    init_schema()
    print("schema initialized; source_registry seeded")
    return 0


def cmd_load(args) -> int:
    key = args.source_key
    if key not in REGISTRY:
        print(f"unknown source: {key}. Known: {sorted(REGISTRY)}", file=sys.stderr)
        return 2
    REGISTRY[key].run()
    return 0


def cmd_refresh_all(_args) -> int:
    init_schema()
    failures: list[str] = []
    # Order matters: rurality lookups first, then area facts, then facilities.
    order = [
        "ers_rucc", "ers_ruca", "ers_far",
        "acs_age_disability", "bls_oews", "hrsa_ahrf",
        "facility_cms_home_health",
    ]
    for key in order:
        try:
            REGISTRY[key].run()
        except Exception as exc:  # noqa: BLE001
            print(f"FAILED {key}: {exc}", file=sys.stderr)
            failures.append(key)
    if failures:
        print(f"\nrefresh-all completed with {len(failures)} failure(s): {failures}", file=sys.stderr)
        return 1
    print("\nrefresh-all completed; no failures")
    return 0


def cmd_geocode(args) -> int:
    key = args.facility_source
    if not key.startswith("facility_"):
        key = f"facility_{key}"
    if key not in REGISTRY:
        print(f"unknown facility source: {key}", file=sys.stderr)
        return 2
    REGISTRY[key].run()
    return 0


def cmd_profile(args) -> int:
    df = county_profile(args.county_fips)
    if df.empty:
        print(f"no data for {args.county_fips}", file=sys.stderr)
        return 1
    print(df.to_string(index=False))
    return 0


def cmd_check_orphans(_args) -> int:
    failed = False
    for tbl in AREA_TABLES:
        orphans = orphan_county_fips(tbl)
        if not orphans.empty:
            failed = True
            print(f"ORPHAN FIPS in {tbl}: {orphans['county_fips'].tolist()[:20]} "
                  f"(total {len(orphans)})")
    if not failed:
        print("no orphan county_fips across area tables")
    return 1 if failed else 0


def main() -> int:
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("init").set_defaults(fn=cmd_init)
    sl = sub.add_parser("load"); sl.add_argument("source_key"); sl.set_defaults(fn=cmd_load)
    sub.add_parser("refresh-all").set_defaults(fn=cmd_refresh_all)
    sg = sub.add_parser("geocode"); sg.add_argument("facility_source"); sg.set_defaults(fn=cmd_geocode)
    sp = sub.add_parser("profile"); sp.add_argument("county_fips"); sp.set_defaults(fn=cmd_profile)
    sub.add_parser("check-orphans").set_defaults(fn=cmd_check_orphans)
    args = p.parse_args()
    return args.fn(args)


if __name__ == "__main__":
    raise SystemExit(main())
