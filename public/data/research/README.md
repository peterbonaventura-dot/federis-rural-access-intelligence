# Research data fixtures

Static JSON snapshots that power the **Rural Access Research** page
(`/rural-access-research`). They are the read-only output of the Python
research repo at `/research/` — see its README for ETL details.

## How to regenerate

These fixtures are produced by a small export script (not yet wired) that
runs the same queries as the `research/viz/` figures:

  - `rural_urban_bars.json`  — population-weighted rural-vs-metro means for
    workers per 1k 65+, facilities per 1k 65+, and self-care difficulty
    per 1k 65+. Shape: `{ measures: [{ label, rural, metro }] }`.
  - `county_workforce.json`  — per-county direct-care workers per 1k 65+
    plus rurality flag, county centroid lat/lng, and state postal code.
    Shape: `{ counties: [{ fips, name, state, is_rural, value, lat, lng }] }`.
  - `facilities.geojson`     — geocoded facility points (matched only).
    GeoJSON FeatureCollection with properties
    `{ source, name, county_fips, is_rural }`.
  - `meta.json`              — vintage + downloaded_at per source from
    `load_runs`, so the page can show data currency.

Drop refreshed files at this path; the React page picks them up via fetch.
