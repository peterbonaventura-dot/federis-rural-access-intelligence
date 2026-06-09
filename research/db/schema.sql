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
