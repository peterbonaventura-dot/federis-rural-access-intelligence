# Rural Health Research Data Repository

A **research data repository** that ingests public, non-PHI national datasets,
attaches USDA ERS rurality classifications, geocodes facility/provider address
files to coordinates via the free U.S. Census batch geocoder, and stores
everything in PostgreSQL + PostGIS for rapid rural-vs-urban comparison.

This repository is the analytic substrate for two studies underway against
HRSA-26-050:

- **Study 1 — Direct-care workforce adequacy gap.** Area-level (county/ZIP)
  comparison of direct-care employment (BLS OEWS SOC 31-1121, 31-1122,
  31-1131) against demand signals (ACS 65+ population, self-care difficulty)
  by rurality.
- **Study 2 — Home-care access deserts.** Facility points geocoded from any
  provider address list, with travel-distance analysis to populated places.

> **Hard scope.** This repo contains **no PHI, no Federis HCBS-ops machinery,
> no tenant isolation, no PHI connection strings.** Provision the database in
> a separate Supabase project (or a dedicated `research` schema in its own
> Postgres instance) with credentials that no PHI system shares.

---

## Quick start

```bash
cd research
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env       # fill in DATABASE_URL and CENSUS_API_KEY

# Create schema + seed source_registry
python -m research.run init

# Load everything end-to-end (idempotent; safe to re-run)
python -m research.run refresh-all

# Or run one source at a time
python -m research.run load ers_rucc
python -m research.run load acs_age_disability

# Geocode a facility source (alias)
python -m research.run geocode cms_home_health

# Study-1 acceptance query (e.g. Los Angeles County, CA)
python -m research.run profile 06037

# FIPS join integrity check
python -m research.run check-orphans
```

A free [Census Data API key](https://api.census.gov/data/key_signup.html)
is required for the ACS loader. The Census batch geocoder needs no key.

---

## What's in each source

| `source_key` | Geography | What it loads | Cadence |
|---|---|---|---|
| `ers_rucc` | county | Rural-Urban Continuum Codes → `geo_rurality_county` | minor annual |
| `ers_ruca` | ZIP | Rural-Urban Commuting Area secondary code → `geo_rurality_zip.ruca_code` | decennial |
| `ers_far` | ZIP | Frontier and Remote level (highest of FAR1..FAR4) → `geo_rurality_zip.far_level` | decennial |
| `bls_oews` | county (via area xwalk) | Employment + mean wage for SOC 31-1121/31-1122/31-1131 → `workforce_county` | annual |
| `acs_age_disability` | county | 65+ pop (B01001), self-care difficulty (B18105) → `population_need_county` | annual |
| `hrsa_ahrf` | county | Area Health Resources File → `hrsa_ahrf_county` (full row as JSONB) | annual |
| `facility_cms_home_health` | point | CMS Home Health Agency list → geocoded `facilities` | monthly |

Every load writes one row to `load_runs` with `data_vintage` (the data's own
year), `downloaded_at`, `row_count`, `status`, and `notes`. The application
can read currency directly out of SQL — there is no separate "freshness"
state to maintain.

### Citations and licensing

Citations live in `source_registry`. All sources here are U.S. Government
works (public domain). Cite the agency (BLS, Census, USDA ERS, HRSA, CMS) by
name as shown in `source_registry.citation`.

---

## Geography is the join spine

- **`county_fips`** is the 5-character zero-padded primary key for area data.
  Never store it as an integer; leading zeros (Alabama `01001`, California
  `06037`) matter and silently break joins if dropped.
- **`zcta`** is the 5-character ZIP-equivalent.
- **State FIPS** is 2 chars; **county FIPS** in standalone columns is 3 chars.
  Combined FIPS = `state.zfill(2) + county.zfill(3)`.

`research/tests/test_fips_format.py` guards this invariant; `python -m
research.run check-orphans` validates that every area fact joins to
`geo_rurality_county`.

---

## Rural cutoff rule (RUCC 4–9)

Following USDA ERS guidance, **RUCC codes 4 through 9 are treated as rural**
in `geo_rurality_county.is_rural`. Codes 1–3 are metropolitan. This rule is
encoded in `research/loaders/ers_rucc.py::RURAL_RUCC_CODES`. RUCA-based ZIP
rurality uses **secondary RUCA ≥ 4** as the rural threshold (RHRC/ERS
convention), encoded in `research/loaders/ers_ruca.py`.

If you change the threshold, change it in one place and re-run the loader —
the column will refresh in place.

---

## BLS OEWS area → county crosswalk

OEWS publishes data at the national/state/MSA/nonmetropolitan-area level —
not directly at county. The loader expands every area row to its constituent
counties via `bls_area_county_xwalk`, then aggregates (sum employment,
employment-weighted mean wage) up to county_fips.

The crosswalk is populated in one of two ways:

1. **Seed CSV (preferred when BLS URLs are stale).** Drop a file at
   `research/data/bls_area_county_xwalk_<YEAR>.csv` with columns
   `area_code,area_name,county_fips`. The loader picks it up automatically.
2. **Parsed from BLS area-definitions XLSX.** If no seed exists, the loader
   downloads `area_definitions_m<YEAR>.xlsx` and parses every sheet that
   looks like an MSA/nonmetro definition table.

Any OEWS area row whose `area_code` does not resolve to at least one county
is dropped and counted in `load_runs.notes` (`N OEWS areas unmapped to
county`) so the analyst sees coverage.

---

## Facility geocoding (source-agnostic)

The geocoding path is intentionally generic. A facility loader's job:

1. Pull (or accept locally) a CSV of providers.
2. Normalize to `external_id, name, street, city, state, zip`.
3. Call `research.geo.geocoder.geocode_addresses(facility_source, df)`.

`geocode_addresses` submits batches of up to 5,000 addresses to the **free
U.S. Census batch geocoder** (`geocoding.geo.census.gov`). Each address comes
back as `Match`, `Tie`, or `No_Match`; the loader writes **all three** to
`facilities` with the appropriate `geocode_status` rather than dropping
non-matches. The return payload also includes 2020 Census state+county FIPS,
which we store directly in `facilities.county_fips`.

`CmsHomeHealthLoader` is the reference implementation. To add a new source
(HRSA black-lung clinics, state DDD provider rosters, etc.), copy
`research/loaders/facility.py::CmsHomeHealthLoader` and adjust the column
mapping.

### Travel distance

`research.geo.geocoder.straight_line_distance_query()` returns SQL that
computes straight-line `ST_Distance(geography)` between facility points and
county centroids — sufficient for first-pass access-desert work.

For road-network distance (e.g. drive-time isochrones in the Study 2
analysis), the integration point is a **self-hosted OSRM instance**, not a
paid routing API. Wire that in when the analyst needs it.

---

## Schema overview

See `research/db/schema.sql`. The key tables:

- `source_registry` — citation, license, geography level, update cadence
- `load_runs` — provenance: vintage, downloaded_at, row_count, status
- `geo_rurality_county`, `geo_rurality_zip` — ERS lookups
- `workforce_county` — long form: `(county_fips, data_year, soc_code)`
- `population_need_county` — `(county_fips, data_year)`
- `hrsa_ahrf_county` — `(county_fips, data_year)` + JSONB attributes
- `bls_area_county_xwalk` — OEWS area → county mapping
- `facilities` — geocoded points with PostGIS `geometry(Point, 4326)` + GIST
  index

---

## Acceptance criteria (mapped)

| Criterion | Where |
|---|---|
| `refresh-all` runs every loader, idempotent on second run | `research/run.py::cmd_refresh_all` + `ON CONFLICT` upserts in every loader |
| Every area table joins cleanly to `geo_rurality_county` | `research/geo/rurality.py::orphan_county_fips` + `tests/test_orphans.py` + `tests/test_fips_format.py` |
| Sample facility CSV geocodes; unmatched rows retained | `research/geo/geocoder.py` writes `tie`/`no_match` rows with status |
| Study 1 is queryable from one county_fips | `python -m research.run profile <fips>` → see `research/geo/rurality.py::county_profile` |
| `load_runs` records vintage + timestamp per source | `research/loaders/base.py::Loader._record` |
| Citations, license, RUCC rule, OEWS crosswalk, re-run docs | This README + `research/config/sources.py` |

---

## What's intentionally **not** in this repo

- Any analysis, regression, or charting (analyst layer).
- Any UI/dashboard.
- Any PHI handling, auth/tenancy, or Federis HCBS-platform integration.
- Any paid geocoder or routing API call.
- Medicaid HCBS enrollment at sub-state geography — not cleanly available
  publicly. ACS self-care difficulty is the primary need measure; HCBS
  enrollment is left as a documented future supplement.

---

## Re-running with a new vintage

1. Update the year/URL constants in the relevant loader (`ACS_YEAR` in
   `acs_age_disability.py`, `OEWS_YEAR` in `bls_oews.py`, `RUCC_VINTAGE` in
   `ers_rucc.py`, etc.).
2. `python -m research.run load <source_key>`.
3. The new vintage upserts into the existing table (newest values win on
   conflict) and writes a fresh row to `load_runs`. The application reads
   the latest `load_runs` per `source_key` to display data currency.
