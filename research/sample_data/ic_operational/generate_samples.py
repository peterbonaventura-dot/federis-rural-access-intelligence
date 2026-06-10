"""Generate the illustrative sample CSVs for the IC operational loader.

This script reproduces the values committed in research/sample_data/ic_operational/
*.csv so reviewers can regenerate them deterministically (random seed is fixed).

The values are synthetic — scaled to IC's ~115k visits/year volume but
random per cell within the rural/urban gradient bands. They illustrate the
shape and methodology of the loader output, not real operational numbers.

When the real loader runs against IC's Base44 tenant, the four ic_* tables
fill with real values via:

  python -m research.run load ic_operational
  python -m research.scripts.snapshot_csv

Schema is identical between this script's output and the real loader output.
"""

from __future__ import annotations

import csv
import os
import random

random.seed(20260610)
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".")

ILLUSTRATIVE = "ILLUSTRATIVE — structure-correct preview, synthetic operational values."

# (office_id, office_name, county_fips, state, county, rucc, metro_status,
#  bucket, base_visits_2024)
COUNTIES = [
    ("5632",  "Independence Care of Philadelphia", "42101","PA","Philadelphia",1,"metro","active",22100),
    ("6837",  "Independence Care of Pittsburgh",   "42003","PA","Allegheny (Pittsburgh)",1,"metro","active",14940),
    ("6835",  "Independence Care of Scranton",     "42069","PA","Lackawanna (Scranton)",2,"metro","active",6950),
    ("6836",  "Independence Care of Pennsylvania", "42077","PA","Lehigh (Allentown)",2,"metro","active",6470),
    ("6836",  "Independence Care of Pennsylvania", "42079","PA","Luzerne (Wilkes-Barre)",2,"metro","active",4980),
    ("6895",  "Independence Care of Erie",         "42049","PA","Erie",3,"metro","active",4510),
    ("6836",  "Independence Care of Pennsylvania", "42053","PA","Forest",8,"nonmetro","active",210),
    ("6836",  "Independence Care of Pennsylvania", "42059","PA","Greene",7,"nonmetro","active",380),
    ("6836",  "Independence Care of Pennsylvania", "42123","PA","Warren",7,"nonmetro","active",420),
    ("6836",  "Independence Care of Pennsylvania", "42031","PA","Clarion",7,"nonmetro","active",460),
    ("6836",  "Independence Care of Pennsylvania", "42025","PA","Carbon",6,"nonmetro","active",620),
    ("6836",  "Independence Care of Pennsylvania", "42121","PA","Venango",7,"nonmetro","active",510),
    ("6836",  "Independence Care of Pennsylvania", "42051","PA","Fayette",7,"nonmetro","active",870),
    ("6836",  "Independence Care of Pennsylvania", "42107","PA","Schuylkill",6,"nonmetro","active",950),
    ("9871",  "Independence Care of Florida",      "12086","FL","Miami-Dade",1,"metro","active",17850),
    ("9871",  "Independence Care of Florida",      "12021","FL","Collier (Naples)",2,"metro","active",3940),
    ("9871",  "Independence Care of Florida",      "12043","FL","Glades",8,"nonmetro","active",140),
    ("9871",  "Independence Care of Florida",      "12029","FL","Dixie",7,"nonmetro","active",180),
    ("9871",  "Independence Care of Florida",      "12047","FL","Hamilton",7,"nonmetro","active",210),
    ("9871",  "Independence Care of Florida",      "12051","FL","Hendry",7,"nonmetro","active",320),
    ("9871",  "Independence Care of Florida",      "12027","FL","DeSoto",4,"nonmetro","active",380),
    ("7269",  "Independence Care of Chicago",      "17031","IL","Cook (Chicago)",1,"metro","active",15920),
    ("16690", "Independence Care of Michigan",     "26163","MI","Wayne (Detroit)",1,"metro","active",2810),
    ("16690", "Independence Care of Michigan",     "26125","MI","Oakland",1,"metro","active",412),
    ("16690", "Independence Care of Michigan",     "26099","MI","Macomb",1,"metro","active",285),
    ("16690", "Independence Care of Michigan",     "26103","MI","Marquette (UP)",4,"nonmetro","active",84),
    ("16690", "Independence Care of Michigan",     "26061","MI","Houghton (UP)",6,"nonmetro","active",26),
    ("16690", "Independence Care of Michigan",     "26085","MI","Lake (UP)",8,"nonmetro","active",38),
    ("16690", "Independence Care of Michigan",     "26033","MI","Chippewa (UP)",6,"nonmetro","active",32),
    ("16690", "Independence Care of Michigan",     "26041","MI","Delta (UP)",6,"nonmetro","active",40),
    ("6955",  "Independence Care of New Hampshire","33011","NH","Hillsborough (Manchester)",2,"metro","active",1985),
    ("6955",  "Independence Care of New Hampshire","33007","NH","Coös",6,"nonmetro","active",320),
    ("6955",  "Independence Care of New Hampshire","33019","NH","Sullivan",5,"nonmetro","active",280),
    ("6955",  "Independence Care of New Hampshire","33003","NH","Carroll",6,"nonmetro","active",260),
    ("6955",  "Independence Care of New Hampshire","33009","NH","Grafton",5,"nonmetro","active",340),
    ("16521", "Independence Care of Kentucky",     "21111","KY","Jefferson (Louisville)",1,"metro","active",5100),
    ("16521", "Independence Care of Kentucky",     "21067","KY","Fayette (Lexington)",2,"metro","active",1340),
    ("16521", "Independence Care of Kentucky",     "21013","KY","Bell",7,"nonmetro","active",220),
    ("16521", "Independence Care of Kentucky",     "21237","KY","Wolfe",9,"nonmetro","active",70),
    ("14519", "Independence Care of Arkansas",     "05119","AR","Pulaski (Little Rock)",3,"metro","active",2470),
    ("14519", "Independence Care of Arkansas",     "05103","AR","Ouachita",7,"nonmetro","active",180),
    ("17133", "Independence Care of Arizona",      "04013","AZ","Maricopa (Phoenix)",1,"metro","active",4490),
    ("17312", "Independence Care of Idaho",        "16001","ID","Ada (Boise)",1,"metro","active",1460),
]

YEARS = [2022, 2023, 2024, 2025, 2026]
YEAR_SCALE = {2022: 0.92, 2023: 0.97, 2024: 1.00, 2025: 1.03, 2026: 0.50}
SUPPRESSION_THRESHOLD = 11


def utilization_for(rucc: int) -> float:
    if rucc <= 3:
        return random.uniform(0.88, 0.93)
    if rucc <= 5:
        return random.uniform(0.78, 0.86)
    return random.uniform(0.60, 0.68)


def is_suppressed(n) -> bool:
    return n is None or n < SUPPRESSION_THRESHOLD


def mask(value, n):
    return "<11" if is_suppressed(n) else value


def write_csv(name: str, header: list[str], rows: list[list]) -> None:
    path = os.path.join(OUT_DIR, name)
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        for r in rows:
            w.writerow(r)
    print(f"  wrote {path} ({len(rows)} rows)")


def build_caregivers():
    header = ["office_id","office_name","county_fips","state","county",
              "rucc_code","metro_status","bucket","data_year",
              "n_consented","caregivers","suppressed","notes"]
    rows = []
    for oid, oname, fips, st, name, rucc, metro, bucket, base in COUNTIES:
        cg = max(0, round(base / 75) + random.randint(-5, 5))
        rows.append([oid, oname, fips, st, name, rucc, metro, bucket, 2026,
                     mask(cg, cg), mask(cg, cg),
                     "true" if is_suppressed(cg) else "false", ILLUSTRATIVE])
    return header, rows


def build_visits():
    header = ["office_id","office_name","county_fips","state","county",
              "rucc_code","metro_status","bucket","data_year",
              "n_consented","visits","service_hours","suppressed","notes"]
    rows = []
    for oid, oname, fips, st, name, rucc, metro, bucket, base in COUNTIES:
        for year in YEARS:
            scale = YEAR_SCALE[year]
            v = max(0, int(base * scale + random.randint(-int(base*0.02), int(base*0.02))))
            avg = round(random.uniform(2.6, 3.8), 2)
            hrs = round(v * avg, 1)
            n = max(0, round(v / 70) + random.randint(-3, 3))
            rows.append([oid, oname, fips, st, name, rucc, metro, bucket, year,
                         mask(n, n), mask(v, n), mask(hrs, n),
                         "true" if is_suppressed(n) else "false", ILLUSTRATIVE])
    return header, rows


def build_auths():
    header = ["office_id","office_name","county_fips","state","county",
              "rucc_code","metro_status","bucket","data_year",
              "n_consented","authorizations","authorized_hours",
              "used_hours","unused_hours","utilization_pct",
              "suppressed","notes"]
    rows = []
    for oid, oname, fips, st, name, rucc, metro, bucket, base in COUNTIES:
        for year in YEARS:
            scale = YEAR_SCALE[year]
            n_auths = max(0, int(base / 25 * scale) + random.randint(-3, 3))
            auth_per = random.randint(1800, 2300)
            authorized = n_auths * auth_per
            util = utilization_for(rucc)
            used = int(authorized * util)
            unused = authorized - used
            n = max(0, n_auths + random.randint(-5, 5))
            rows.append([oid, oname, fips, st, name, rucc, metro, bucket, year,
                         mask(n, n), mask(n_auths, n), mask(authorized, n),
                         mask(used, n), mask(unused, n),
                         mask(round(util * 100, 1), n),
                         "true" if is_suppressed(n) else "false", ILLUSTRATIVE])
    return header, rows


def build_applicant_funnel():
    header = ["office_id","office_name","county_fips","state","county",
              "rucc_code","metro_status","bucket","data_year",
              "n_consented","applicants_total","interviews","hires",
              "applicant_to_interview_pct","interview_to_hire_pct",
              "applicant_to_hire_pct","suppressed","notes"]
    rows = []
    for oid, oname, fips, st, name, rucc, metro, bucket, base in COUNTIES:
        for year in YEARS:
            scale = YEAR_SCALE[year]
            applicants = max(0, int(base / 6.5 * scale) + random.randint(-10, 10))
            if rucc <= 3:
                ir = random.uniform(0.38, 0.48); hr = random.uniform(0.20, 0.28)
            else:
                ir = random.uniform(0.60, 0.75); hr = random.uniform(0.40, 0.55)
            interviews = int(applicants * ir)
            hires = int(interviews * hr)
            n = applicants
            ath = round(hires/applicants*100, 1) if applicants else 0
            rows.append([oid, oname, fips, st, name, rucc, metro, bucket, year,
                         mask(n, n), mask(applicants, n), mask(interviews, n),
                         mask(hires, n),
                         mask(round(ir*100, 1), n),
                         mask(round(hr*100, 1) if interviews else 0, n),
                         mask(ath, n),
                         "true" if is_suppressed(n) else "false", ILLUSTRATIVE])
    return header, rows


def build_workforce_pipeline():
    header = ["office_id","office_name","county_fips","state","county",
              "rucc_code","metro_status","bucket","cohort_year",
              "applicants","offers","hires_onboarded","first_visit_within_30d",
              "active_90d","retained_180d","applicant_to_active_pct",
              "median_days_to_first_visit","suppressed","notes"]
    rows = []
    for oid, oname, fips, st, name, rucc, metro, bucket, base in COUNTIES:
        for year in YEARS:
            scale = YEAR_SCALE[year]
            applicants = max(0, int(base / 6.5 * scale) + random.randint(-10, 10))
            if rucc <= 3:
                offer_rate = random.uniform(0.15, 0.18)
                onb_rate = random.uniform(0.80, 0.85)
                fv30_rate = random.uniform(0.82, 0.88)
                a90_rate = random.uniform(0.85, 0.92)
                r180_rate = random.uniform(0.78, 0.86)
                d2v = random.randint(10, 16)
            else:
                offer_rate = random.uniform(0.55, 0.70)
                onb_rate = random.uniform(0.72, 0.82)
                fv30_rate = random.uniform(0.62, 0.75)
                a90_rate = random.uniform(0.78, 0.88)
                r180_rate = random.uniform(0.70, 0.80)
                d2v = random.randint(26, 38)
            offers = int(applicants * offer_rate)
            onb = int(offers * onb_rate)
            fv30 = int(onb * fv30_rate)
            a90 = int(fv30 * a90_rate)
            r180 = int(a90 * r180_rate)
            ata = round(r180/applicants*100, 1) if applicants else 0
            n = applicants
            rows.append([oid, oname, fips, st, name, rucc, metro, bucket, year,
                         mask(applicants, n), mask(offers, n), mask(onb, n),
                         mask(fv30, n), mask(a90, n), mask(r180, n),
                         mask(ata, n), mask(d2v, n) if n else d2v,
                         "true" if is_suppressed(n) else "false", ILLUSTRATIVE])
    return header, rows


if __name__ == "__main__":
    print("Generating illustrative sample CSVs...")
    write_csv("ic_caregivers_county.csv", *build_caregivers())
    write_csv("ic_visits_county_year.csv", *build_visits())
    write_csv("ic_auths_county_year.csv", *build_auths())
    write_csv("ic_applicant_funnel_county_year.csv", *build_applicant_funnel())
    write_csv("ic_workforce_pipeline_county_year.csv", *build_workforce_pipeline())
    print("Done. ic_coverage_status.csv is hand-maintained (joins to IC risk file).")
