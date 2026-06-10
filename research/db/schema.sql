-- Rural Health Research Data Repository — schema.
-- Non-PHI public datasets only. Run against a Postgres+PostGIS database
-- that is isolated from any PHI-bearing system.

CREATE EXTENSION IF NOT EXISTS postgis;

-- ---------------------------------------------------------------------------
-- Provenance / freshness
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS source_registry (
    source_key      text PRIMARY KEY,
    display_name    text NOT NULL,
    source_url      text NOT NULL,
    citation        text NOT NULL,
    license_note    text,
    geography_level text NOT NULL,
    update_cadence  text
);

CREATE TABLE IF NOT EXISTS load_runs (
    id              bigserial PRIMARY KEY,
    source_key      text REFERENCES source_registry(source_key),
    data_vintage    text,
    downloaded_at   timestamptz NOT NULL DEFAULT now(),
    row_count       integer,
    status          text NOT NULL,
    notes           text
);
CREATE INDEX IF NOT EXISTS load_runs_source_idx ON load_runs(source_key, downloaded_at DESC);

-- ---------------------------------------------------------------------------
-- Rurality classification lookups (USDA ERS)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS geo_rurality_county (
    county_fips     text PRIMARY KEY,
    rucc_code       integer,
    rucc_year       integer,
    is_rural        boolean,
    metro_status    text
);

CREATE TABLE IF NOT EXISTS geo_rurality_zip (
    zcta            text PRIMARY KEY,
    ruca_code       numeric,
    far_level       integer,
    is_rural        boolean
);

-- ---------------------------------------------------------------------------
-- Area facts — Study 1 (workforce adequacy)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workforce_county (
    county_fips     text NOT NULL,
    data_year       integer NOT NULL,
    soc_code        text NOT NULL,
    employment      numeric,
    mean_wage       numeric,
    PRIMARY KEY (county_fips, data_year, soc_code)
);

CREATE TABLE IF NOT EXISTS population_need_county (
    county_fips     text NOT NULL,
    data_year       integer NOT NULL,
    pop_65_plus     integer,
    pop_with_self_care_disability integer,
    PRIMARY KEY (county_fips, data_year)
);

-- BLS OEWS area definitions — nonmetropolitan area to county crosswalk.
-- One area can map to many counties; one county to many areas (rare).
CREATE TABLE IF NOT EXISTS bls_area_county_xwalk (
    area_code       text NOT NULL,
    area_name       text,
    county_fips     text NOT NULL,
    vintage_year    integer NOT NULL,
    PRIMARY KEY (area_code, county_fips, vintage_year)
);

-- ---------------------------------------------------------------------------
-- HRSA AHRF — wide table; persist a slim subset of fields plus a JSONB blob
-- for everything else so analysts can pull any column without re-ingesting.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hrsa_ahrf_county (
    county_fips     text NOT NULL,
    data_year       integer NOT NULL,
    attributes      jsonb NOT NULL,
    PRIMARY KEY (county_fips, data_year)
);

-- ---------------------------------------------------------------------------
-- Geocoded facilities (Study 2 / source-agnostic)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS facilities (
    id              bigserial PRIMARY KEY,
    facility_source text NOT NULL,
    external_id     text,
    name            text,
    raw_address     text NOT NULL,
    geocode_status  text NOT NULL,
    match_quality   text,
    county_fips     text,
    geom            geometry(Point, 4326),
    loaded_at       timestamptz DEFAULT now(),
    UNIQUE (facility_source, external_id)
);
CREATE INDEX IF NOT EXISTS facilities_geom_idx ON facilities USING GIST (geom);
CREATE INDEX IF NOT EXISTS facilities_county_idx ON facilities(county_fips);

-- ---------------------------------------------------------------------------
-- Independence Care operational aggregates (HHAX + ApplicantStack).
-- COMPLIANCE POSTURE:
--   * Raw operational records NEVER enter this database. They are pulled
--     in-memory by research/loaders/ic_operational.py from the Base44 tenant
--     and aggregated before persistence.
--   * Every row represents at least 11 distinct consented individuals
--     (n >= 11 suppression). Cells below the threshold are stored with
--     suppressed=true and NULL metric values.
--   * Consent gate: only individuals whose ResearchConsent.status='granted'
--     and revoked_at IS NULL contribute. Signed by self or POA.
--   * HIPAA Safe Harbor §164.514(b)(2): all 18 identifier categories are
--     stripped at the loader layer. No names, addresses below state, dates
--     beyond year, identifiers, IPs, or biometrics. Geographic detail
--     stops at county_fips.
--   * See codebook v1.1 §4.10–4.13 for the column dictionary.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ic_caregivers_county (
    county_fips     text NOT NULL,
    data_year       integer NOT NULL,
    n_consented     integer,
    caregivers      integer,
    suppressed      boolean NOT NULL DEFAULT false,
    loaded_at       timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (county_fips, data_year)
);
CREATE INDEX IF NOT EXISTS ic_caregivers_county_state_idx
    ON ic_caregivers_county(left(county_fips, 2));

CREATE TABLE IF NOT EXISTS ic_visits_county_year (
    county_fips     text NOT NULL,
    data_year       integer NOT NULL,
    n_consented     integer,
    visits          integer,
    service_hours   numeric,
    suppressed      boolean NOT NULL DEFAULT false,
    loaded_at       timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (county_fips, data_year)
);
CREATE INDEX IF NOT EXISTS ic_visits_county_year_year_idx
    ON ic_visits_county_year(data_year);

CREATE TABLE IF NOT EXISTS ic_auths_county_year (
    county_fips         text NOT NULL,
    data_year           integer NOT NULL,
    n_consented         integer,
    authorizations      integer,
    authorized_hours    numeric,
    used_hours          numeric,
    unused_hours        numeric,
    utilization_pct     numeric,
    suppressed          boolean NOT NULL DEFAULT false,
    loaded_at           timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (county_fips, data_year)
);
CREATE INDEX IF NOT EXISTS ic_auths_county_year_year_idx
    ON ic_auths_county_year(data_year);

CREATE TABLE IF NOT EXISTS ic_applicant_funnel_county_year (
    county_fips                 text NOT NULL,
    data_year                   integer NOT NULL,
    n_consented                 integer,
    applicants_total            integer,
    interviews                  integer,
    hires                       integer,
    applicant_to_interview_pct  numeric,
    interview_to_hire_pct       numeric,
    applicant_to_hire_pct       numeric,
    suppressed                  boolean NOT NULL DEFAULT false,
    loaded_at                   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (county_fips, data_year)
);
CREATE INDEX IF NOT EXISTS ic_applicant_funnel_county_year_year_idx
    ON ic_applicant_funnel_county_year(data_year);
