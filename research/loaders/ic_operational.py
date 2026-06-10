"""Independence Care operational aggregator (HHAX + ApplicantStack).

Pulls record-level operational data from Independence Care's Base44 tenant
via the Base44 REST API, applies the consent gate + HIPAA Safe Harbor
§164.514(b)(2) field-allowlist stripping + n>=11 small-cell suppression in
Python, and persists ONLY county-level aggregates to the research database.

The four output tables (ic_caregivers_county, ic_visits_county_year,
ic_auths_county_year, ic_applicant_funnel_county_year) are defined in
research/db/schema.sql. Raw operational records never touch disk and are
never persisted; they are held only in memory inside this loader's run.

Required environment:
  BASE44_APP_ID     Your Base44 app ID (e.g. 697e9e64e77fa584081cc486).
  BASE44_API_KEY    Service-account api_key with read access to:
                      HHAXPatient, HHAXVisit, HHAXAuthorization,
                      HHAXCaregiver, Applicant, ResearchConsent.
                    Generate this in the Base44 console; recommend a
                    read-only token scoped to those six entities.

Optional environment:
  BASE44_API_URL                 Base URL — defaults to https://app.base44.com.
                                  Override if your tenant uses a custom domain.
  BASE44_ENTITY_PATH_TEMPLATE    REST path template, default
                                  "/api/apps/{app_id}/entities/{entity}".
                                  Adjust if a tenant returns 404s.
  IC_OPERATIONAL_FROM_YEAR       Default 2022.
  IC_OPERATIONAL_TO_YEAR         Default current year.

Auth follows the @base44/sdk JS client convention:
    headers = { "api_key": BASE44_API_KEY }
    appId appears in the URL path.

See codebook v1.1 §1, §7, and §4.10–4.13 for the architectural posture and
column dictionary.
"""

from __future__ import annotations

import logging
import os
from collections import defaultdict
from typing import Iterable

import requests
from sqlalchemy import text
from tenacity import retry, stop_after_attempt, wait_exponential

from ..db.connection import engine
from .base import Loader, LoadResult

log = logging.getLogger("loader.ic_operational")

BASE44_API_URL = os.environ.get("BASE44_API_URL", "https://app.base44.com").rstrip("/")
BASE44_APP_ID = os.environ.get("BASE44_APP_ID", "")
BASE44_API_KEY = os.environ.get("BASE44_API_KEY", "")
ENTITY_PATH_TEMPLATE = os.environ.get(
    "BASE44_ENTITY_PATH_TEMPLATE",
    "/api/apps/{app_id}/entities/{entity}",
)
PAGE_SIZE = 1000
MAX_PAGES = 2000  # 2M records ceiling per entity per run
REQUEST_TIMEOUT = 60

# Compliance constants — mirrors queryOperationalResearch (Deno).
SUPPRESSION_THRESHOLD = 11
COMPLETED_VISIT_STATUSES = {
    "completed", "verified", "confirmed", "billed", "closed", "visit complete",
}
APPLICANT_INTERVIEW_STAGES = {"initial_applicant", "pending_approval"}
APPLICANT_HIRED_STAGES = {"approved"}

# HIPAA Safe Harbor §164.514(b)(2) — categories stripped at the function
# layer. Recorded for compliance receipts in load_runs.notes.
SAFE_HARBOR_IDENTIFIERS_REMOVED = [
    "names", "geographic_subdivisions_smaller_than_state",
    "dates_other_than_year", "phone_numbers", "fax_numbers", "email_addresses",
    "social_security_numbers", "medical_record_numbers",
    "health_plan_beneficiary_numbers", "account_numbers",
    "certificate_license_numbers", "vehicle_identifiers", "device_identifiers",
    "urls", "ip_addresses", "biometric_identifiers", "full_face_photos",
    "any_other_unique_identifying_codes",
]

CENSUS_GEOCODER_URL = (
    "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress"
    "?benchmark=Public_AR_Current&vintage=Current_Current&format=json"
)


# ──────────────────────────────────────────────────────────────────────────────
# Base44 REST client (list-entity-with-pagination only)
# ──────────────────────────────────────────────────────────────────────────────

@retry(stop=stop_after_attempt(4), wait=wait_exponential(multiplier=2, min=2, max=16))
def _fetch_entity_page(entity: str, page: int) -> list[dict]:
    if not BASE44_APP_ID or not BASE44_API_KEY:
        raise RuntimeError(
            "BASE44_APP_ID and BASE44_API_KEY env vars are required for the "
            "ic_operational loader. Set them in your shell or .env."
        )
    path = ENTITY_PATH_TEMPLATE.format(app_id=BASE44_APP_ID, entity=entity)
    url = f"{BASE44_API_URL}{path}"
    headers = {
        "api_key": BASE44_API_KEY,
        "Accept": "application/json",
    }
    # Try the SDK convention (_page / _page_size); plain page/page_size also
    # accepted by most Base44 tenants.
    params = {
        "_page": page, "_page_size": PAGE_SIZE,
        "page": page, "page_size": PAGE_SIZE,
    }
    resp = requests.get(url, headers=headers, params=params, timeout=REQUEST_TIMEOUT)
    if resp.status_code == 401:
        raise RuntimeError(
            "Base44 returned 401 Unauthorized. Verify BASE44_API_KEY is valid "
            "and the service account has read access to the requested entity."
        )
    if resp.status_code == 404 and entity != "":
        raise RuntimeError(
            f"Base44 returned 404 for {url}. The path template may be wrong "
            f"for your tenant — try setting BASE44_ENTITY_PATH_TEMPLATE."
        )
    resp.raise_for_status()
    payload = resp.json()
    # Tenants return either a bare list or {items: [...]} / {data: [...]}.
    if isinstance(payload, list):
        return payload
    for key in ("items", "data", "results", "records"):
        if isinstance(payload.get(key), list):
            return payload[key]
    return []


def _fetch_all(entity: str) -> list[dict]:
    out: list[dict] = []
    for page in range(MAX_PAGES):
        batch = _fetch_entity_page(entity, page)
        if not batch:
            break
        out.extend(batch)
        if len(batch) < PAGE_SIZE:
            break
    log.info("fetched %d %s records", len(out), entity)
    return out


# ──────────────────────────────────────────────────────────────────────────────
# Geocode helper — Census one-line endpoint (key-less, free)
# ──────────────────────────────────────────────────────────────────────────────

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=2, max=10))
def _geocode_address(address_line: str) -> str | None:
    if not address_line.strip():
        return None
    resp = requests.get(
        CENSUS_GEOCODER_URL, params={"address": address_line}, timeout=REQUEST_TIMEOUT,
    )
    if not resp.ok:
        return None
    payload = resp.json()
    match = (payload.get("result", {}).get("addressMatches") or [None])[0]
    if not match:
        return None
    counties = match.get("geographies", {}).get("Counties") or []
    if not counties:
        return None
    state = str(counties[0].get("STATE", "")).zfill(2)
    county = str(counties[0].get("COUNTY", "")).zfill(3)
    if not (state.isdigit() and len(state) == 2 and county.isdigit() and len(county) == 3):
        return None
    return state + county


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _parse_year(value) -> int | None:
    if not value:
        return None
    s = str(value)
    if len(s) < 4 or not s[:4].isdigit():
        return None
    y = int(s[:4])
    return y if 1900 <= y <= 3000 else None


def _norm_fips(value) -> str | None:
    s = str(value or "").strip().zfill(5)
    return s if len(s) == 5 and s.isdigit() else None


def _county_for(record: dict, addr_fields: list[str]) -> str | None:
    """Returns 5-digit county FIPS for a record. Uses cached field if present
    and valid; otherwise geocodes from the listed address fields."""
    existing = _norm_fips(record.get("county_fips"))
    if existing:
        return existing
    parts = [str(record.get(f) or "").strip() for f in addr_fields]
    parts = [p for p in parts if p]
    if not parts:
        return None
    return _geocode_address(", ".join(parts))


def _visit_is_completed(v: dict) -> bool:
    if v.get("actual_start"):
        return True
    status = str(v.get("status") or "").strip().lower()
    return bool(status) and status in COMPLETED_VISIT_STATUSES


def _visit_hours(v: dict) -> float:
    a = v.get("duration_actual_hours")
    if isinstance(a, (int, float)) and a > 0:
        return float(a)
    s = v.get("duration_scheduled_hours")
    if isinstance(s, (int, float)) and s > 0:
        return float(s)
    return 0.0


# ──────────────────────────────────────────────────────────────────────────────
# Suppression
# ──────────────────────────────────────────────────────────────────────────────

def _apply_suppression(cells: list[dict]) -> None:
    """Mutates cells in place. Sets suppressed=True and nullifies metrics on
    any cell with n_consented < threshold. Adds complementary suppression per
    state if exactly one cell in that state was suppressed, to block
    back-calculation from row totals."""
    metric_keys: set[str] = set()
    for c in cells:
        for k in c.keys():
            if k not in ("county_fips", "state_fips", "data_year", "n_consented", "suppressed"):
                metric_keys.add(k)

    by_state: dict[str, list[dict]] = defaultdict(list)
    for c in cells:
        by_state[c.get("state_fips", "")].append(c)
        n = c.get("n_consented") or 0
        if n < SUPPRESSION_THRESHOLD:
            c["suppressed"] = True

    # Complementary suppression: if exactly one cell in a state was suppressed,
    # also suppress the next-smallest non-suppressed cell.
    for state, arr in by_state.items():
        low = [c for c in arr if c.get("suppressed")]
        if len(low) == 1:
            non_low = sorted(
                (c for c in arr if not c.get("suppressed")),
                key=lambda c: c.get("n_consented") or 0,
            )
            if non_low:
                non_low[0]["suppressed"] = True

    # Null out metric values on suppressed rows.
    for c in cells:
        if c.get("suppressed"):
            for k in metric_keys:
                c[k] = None


# ──────────────────────────────────────────────────────────────────────────────
# Aggregators
# ──────────────────────────────────────────────────────────────────────────────

def _agg_caregivers(caregivers: list[dict], consented: set[str],
                    county_for_caregiver: dict[str, str], data_year: int) -> list[dict]:
    by_county: dict[str, set[str]] = defaultdict(set)
    for c in caregivers:
        cid = str(c.get("caregiver_id") or c.get("id") or "").strip()
        if not cid or cid not in consented:
            continue
        county = county_for_caregiver.get(cid)
        if not county:
            continue
        by_county[county].add(cid)
    cells = []
    for county, subjects in by_county.items():
        cells.append({
            "county_fips": county,
            "state_fips": county[:2],
            "data_year": data_year,
            "n_consented": len(subjects),
            "caregivers": len(subjects),
            "suppressed": False,
        })
    return cells


def _agg_visits(visits: list[dict], county_for_patient: dict[str, str],
                consented_patients: set[str], from_year: int, to_year: int) -> list[dict]:
    bucket: dict[tuple[str, int], dict] = {}
    for v in visits:
        pid = str(v.get("patient_id") or "").strip()
        if not pid or pid not in consented_patients:
            continue
        county = county_for_patient.get(pid)
        if not county:
            continue
        if not _visit_is_completed(v):
            continue
        year = _parse_year(v.get("actual_start") or v.get("scheduled_start"))
        if year is None or year < from_year or year > to_year:
            continue
        key = (county, year)
        b = bucket.setdefault(key, {"subjects": set(), "visits": 0, "hours": 0.0})
        b["subjects"].add(pid)
        b["visits"] += 1
        b["hours"] += _visit_hours(v)
    return [{
        "county_fips": county,
        "state_fips": county[:2],
        "data_year": year,
        "n_consented": len(b["subjects"]),
        "visits": b["visits"],
        "service_hours": round(b["hours"], 1),
        "suppressed": False,
    } for (county, year), b in bucket.items()]


def _agg_auths(auths: list[dict], county_for_patient: dict[str, str],
               consented_patients: set[str], from_year: int, to_year: int) -> list[dict]:
    bucket: dict[tuple[str, int], dict] = {}
    for a in auths:
        pid = str(a.get("patient_id") or "").strip()
        if not pid or pid not in consented_patients:
            continue
        county = county_for_patient.get(pid)
        if not county:
            continue
        year = _parse_year(a.get("from_date"))
        if year is None or year < from_year or year > to_year:
            continue
        authorized = a.get("authorized_hours") or a.get("hours_per_auth_period") or 0
        if not isinstance(authorized, (int, float)) or authorized <= 0:
            continue
        used = a.get("used_hours") or 0
        if not isinstance(used, (int, float)):
            used = 0
        key = (county, year)
        b = bucket.setdefault(key, {
            "subjects": set(), "auths": 0, "authorized": 0.0, "used": 0.0,
        })
        b["subjects"].add(pid)
        b["auths"] += 1
        b["authorized"] += float(authorized)
        b["used"] += float(used)

    cells = []
    for (county, year), b in bucket.items():
        unused = max(0.0, b["authorized"] - b["used"])
        utilization = (b["used"] / b["authorized"] * 100.0) if b["authorized"] > 0 else None
        cells.append({
            "county_fips": county,
            "state_fips": county[:2],
            "data_year": year,
            "n_consented": len(b["subjects"]),
            "authorizations": b["auths"],
            "authorized_hours": round(b["authorized"], 1),
            "used_hours": round(b["used"], 1),
            "unused_hours": round(unused, 1),
            "utilization_pct": round(utilization, 1) if utilization is not None else None,
            "suppressed": False,
        })
    return cells


def _agg_applicant_funnel(applicants: list[dict], county_for_applicant: dict[str, str],
                          consented: set[str], from_year: int, to_year: int) -> list[dict]:
    bucket: dict[tuple[str, int], dict] = {}
    for a in applicants:
        aid = str(a.get("id") or "").strip()
        if not aid or aid not in consented:
            continue
        county = county_for_applicant.get(aid)
        if not county:
            continue
        year = _parse_year(a.get("submitted_at") or a.get("initial_application_completed_at"))
        if year is None or year < from_year or year > to_year:
            continue
        status = str(a.get("status") or "").strip().lower()
        key = (county, year)
        b = bucket.setdefault(key, {
            "applied": set(), "interviewed": set(), "hired": set(),
        })
        b["applied"].add(aid)
        if status in APPLICANT_INTERVIEW_STAGES:
            b["interviewed"].add(aid)
        if status in APPLICANT_HIRED_STAGES:
            b["hired"].add(aid)

    cells = []
    for (county, year), b in bucket.items():
        A = len(b["applied"]); I = len(b["interviewed"]); H = len(b["hired"])
        cells.append({
            "county_fips": county,
            "state_fips": county[:2],
            "data_year": year,
            "n_consented": A,
            "applicants_total": A,
            "interviews": I,
            "hires": H,
            "applicant_to_interview_pct": round(I / A * 100, 1) if A else None,
            "interview_to_hire_pct": round(H / I * 100, 1) if I else None,
            "applicant_to_hire_pct": round(H / A * 100, 1) if A else None,
            "suppressed": False,
        })
    return cells


# ──────────────────────────────────────────────────────────────────────────────
# Upsert helpers — overwrite the four IC tables idempotently
# ──────────────────────────────────────────────────────────────────────────────

def _upsert(table: str, rows: list[dict], conflict_cols: list[str]) -> int:
    if not rows:
        # Always clear the table so a downstream consumer sees fresh state.
        with engine().begin() as conn:
            conn.execute(text(f"DELETE FROM {table}"))
        return 0
    cols = list(rows[0].keys())
    col_list = ", ".join(cols)
    placeholders = ", ".join(f":{c}" for c in cols)
    update_clause = ", ".join(
        f"{c}=EXCLUDED.{c}" for c in cols if c not in conflict_cols
    )
    sql = f"""
        INSERT INTO {table} ({col_list})
        VALUES ({placeholders})
        ON CONFLICT ({", ".join(conflict_cols)})
        DO UPDATE SET {update_clause}, loaded_at = now()
    """
    with engine().begin() as conn:
        conn.execute(text(sql), rows)
    return len(rows)


# ──────────────────────────────────────────────────────────────────────────────
# Loader
# ──────────────────────────────────────────────────────────────────────────────

DEFAULT_FROM_YEAR = int(os.environ.get("IC_OPERATIONAL_FROM_YEAR", "2022"))
DEFAULT_TO_YEAR = int(os.environ.get("IC_OPERATIONAL_TO_YEAR", "0")) or None  # 0 means "current year"


class ICOperationalLoader(Loader):
    source_key = "ic_operational"

    def _run(self) -> LoadResult:
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        from_year = DEFAULT_FROM_YEAR
        to_year = DEFAULT_TO_YEAR or now.year

        # 1) Consent allowlist — split into per-subject-type sets.
        consents = _fetch_all("ResearchConsent")
        consented_by_type: dict[str, set[str]] = {
            "patient": set(), "caregiver": set(), "applicant": set(),
        }
        for c in consents:
            if str(c.get("status") or "").lower() != "granted":
                continue
            if c.get("revoked_at"):
                continue
            stype = str(c.get("subject_type") or "").lower()
            sid = str(c.get("subject_id") or "").strip()
            if stype in consented_by_type and sid:
                consented_by_type[stype].add(sid)
        log.info(
            "consented universe — patients=%d caregivers=%d applicants=%d",
            len(consented_by_type["patient"]),
            len(consented_by_type["caregiver"]),
            len(consented_by_type["applicant"]),
        )

        # 2) Build patient/caregiver/applicant → county_fips maps, geocoding
        # on the fly when the entity field is missing.
        patients = _fetch_all("HHAXPatient")
        county_for_patient = {}
        for p in patients:
            pid = str(p.get("patient_id") or p.get("id") or "").strip()
            if not pid:
                continue
            county = _county_for(p, ["city", "state", "zip"])
            if county:
                county_for_patient[pid] = county

        caregivers = _fetch_all("HHAXCaregiver")
        county_for_caregiver = {}
        for c in caregivers:
            cid = str(c.get("caregiver_id") or c.get("id") or "").strip()
            if not cid:
                continue
            county = _county_for(c, ["city", "state", "zip"])
            if county:
                county_for_caregiver[cid] = county

        applicants = _fetch_all("Applicant")
        county_for_applicant = {}
        for a in applicants:
            aid = str(a.get("id") or "").strip()
            if not aid:
                continue
            # Applicant has a single freeform address field; fall back to state.
            county = _county_for(a, ["address", "state"])
            if county:
                county_for_applicant[aid] = county

        # 3) Aggregate
        visits = _fetch_all("HHAXVisit")
        auths = _fetch_all("HHAXAuthorization")

        cg_cells = _agg_caregivers(caregivers, consented_by_type["caregiver"],
                                    county_for_caregiver, data_year=to_year)
        v_cells = _agg_visits(visits, county_for_patient,
                              consented_by_type["patient"], from_year, to_year)
        au_cells = _agg_auths(auths, county_for_patient,
                              consented_by_type["patient"], from_year, to_year)
        ap_cells = _agg_applicant_funnel(applicants, county_for_applicant,
                                          consented_by_type["applicant"],
                                          from_year, to_year)

        # 4) Suppress
        for cells in (cg_cells, v_cells, au_cells, ap_cells):
            _apply_suppression(cells)

        # 5) Persist (county_fips, data_year) keyed.
        rows_cg = _upsert("ic_caregivers_county", cg_cells,
                          ["county_fips", "data_year"])
        rows_v = _upsert("ic_visits_county_year", v_cells,
                         ["county_fips", "data_year"])
        rows_au = _upsert("ic_auths_county_year", au_cells,
                          ["county_fips", "data_year"])
        rows_ap = _upsert("ic_applicant_funnel_county_year", ap_cells,
                          ["county_fips", "data_year"])

        total = rows_cg + rows_v + rows_au + rows_ap
        notes = (
            f"caregivers={rows_cg}; visits={rows_v}; auths={rows_au}; "
            f"applicant_funnel={rows_ap}; consent_threshold=n>={SUPPRESSION_THRESHOLD}; "
            f"safe_harbor_identifiers_removed=18; "
            f"from_year={from_year}; to_year={to_year}"
        )
        return LoadResult(
            data_vintage=f"{from_year}-{to_year}",
            row_count=total,
            notes=notes,
        )
