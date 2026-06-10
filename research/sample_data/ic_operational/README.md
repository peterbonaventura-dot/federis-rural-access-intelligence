# IC Operational Sample Data

This directory contains an **illustrative preview** of the output that the
`ic_operational` loader (`research/loaders/ic_operational.py`) produces when
run against IC's Base44 tenant. It is shipped here so reviewers can see what
the dataset looks like — its schema, column names, suppression behavior, and
methodology — without needing the live credentials to run the loader.

## Compliance posture (applied to every row in every CSV)

These are the same three gates the production loader applies:

1. **Consent gate** — only `ResearchConsent.status='granted'` individuals
   (signed by self or POA, unrevoked) contribute to any cell.
2. **HIPAA Safe Harbor §164.514(b)(2)** — all 18 identifier categories
   stripped at the loader layer; geography stops at county, dates collapse
   to year, and the response field allowlist is hard-coded.
3. **Small-cell suppression** — cells with fewer than 11 distinct
   individuals are masked as `<11`, with complementary suppression per
   state to block back-calculation from row totals.

## Coverage scope

13 active IC offices serving 43 counties across 9 states (PA, NH, FL, AR,
AZ, IL, KY, ID, MI). Office attribution columns (`office_id`,
`office_name`) match IC's HHAExchange office IDs from the operational
system of record.

## What is real and what is illustrative

REAL in these files:
- Schema (column names, types, primary keys)
- All 43 county FIPS codes, RUCC codes, state assignments
- All 13 active office IDs and office names from IC's HHAExchange system
- County-to-office attribution mapping
- County-level IC risk-ranking variables (in `ic_coverage_status.csv`)
- Compliance posture and suppression behavior

ILLUSTRATIVE (synthetic, scaled to IC's actual ~2,200 visits/week):
- Visit counts, service hours
- Authorization hours, used hours, utilization percentages
- Applicant counts, interviews, hires
- Workforce pipeline cohort yields, time-to-first-visit
- Caregiver counts

Each row of each file carries the `notes` column with the
"ILLUSTRATIVE — structure-correct preview, synthetic operational values"
marker. When the loader is run against real data, that marker drops
automatically.

## Files

| File | Rows | What |
|---|---|---|
| `ic_caregivers_county.csv` | 43 | Direct-care workforce per county + office |
| `ic_visits_county_year.csv` | 215 | Visits + service hours per county × year (2022–2026) |
| `ic_auths_county_year.csv` | 215 | **Headline:** authorized vs used hours, utilization % |
| `ic_applicant_funnel_county_year.csv` | 215 | Application stages |
| `ic_workforce_pipeline_county_year.csv` | 215 | Full applicant → 180-day-active cohort yield |
| `ic_coverage_status.csv` | 43 | County-level coverage + IC risk variables |

## Cutover to real numbers

```bash
python -m research.run init                      # idempotent
python -m research.run load ic_operational       # pulls real data, applies gates, persists
python -m research.scripts.snapshot_csv          # exports CSVs identical in schema
```

After cutover, the snapshot script overwrites these sample files with the
real-data output. Schema, column dictionary, and methodology are
identical — only the numeric values change and the ILLUSTRATIVE marker
drops.

## Confidentiality

This sample data carries the same confidentiality posture as the
production output: shared for HRSA-26-050 research only, not for
redistribution beyond the named research collaboration.
