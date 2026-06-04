import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ─── USDA SNAP County-Level Data ──────────────────────────────────────────
// USDA Economic Research Service (ERS) publishes county-level SNAP participation
// via the Atlas of Rural and Small-Town America API.
// Dataset: https://www.ers.usda.gov/data-products/atlas-of-rural-and-small-town-america/
// Alternative: Census Bureau SAIPE (Small Area Income and Poverty Estimates) which
// correlates with SNAP participation. For official SNAP counts we use the
// Census ACS 5-year estimates via the Census API.
//
// Census ACS variable B22001_002E = households receiving food stamps/SNAP in past 12 months
// We multiply by average household size proxy to get individuals, or use B22003_002E directly.
// B22003_002E = households with SNAP benefits
// S2201_C04_001E = total persons in households receiving SNAP/food stamps

const CENSUS_API_BASE = 'https://api.census.gov/data';
const ACS_YEAR = '2022';
// S2201_C04_001E: total persons in households that received SNAP/food stamps in past 12 months
// B22001_002E: households receiving SNAP (backup)
const SNAP_PERSONS_VAR = 'S2201_C04_001E';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchSnapForState(stateCode, countyCode) {
  // stateCode = 2-digit FIPS (e.g. "05" for AR), countyCode = 3-digit FIPS or "*"
  const url = new URL(`${CENSUS_API_BASE}/${ACS_YEAR}/acs/acs5/subject`);
  url.searchParams.set('get', `${SNAP_PERSONS_VAR},NAME`);
  url.searchParams.set('for', `county:${countyCode}`);
  url.searchParams.set('in', `state:${stateCode}`);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Census API error ${res.status} for state ${stateCode}`);
  }
  const json = await res.json();
  return json; // array: [header_row, ...data_rows]
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow both scheduled (no auth header) and manual admin invocation
    const authHeader = req.headers.get('authorization') || '';
    let isScheduled = false;
    if (!authHeader) {
      isScheduled = true;
    } else {
      const user = await base44.auth.me();
      if (user && user.role !== 'admin') {
        return Response.json({ error: 'Admin only' }, { status: 403 });
      }
    }

    // Fetch all pilot counties with FIPS codes
    const allCounties = await base44.asServiceRole.entities.County.filter({ pilot_cohort_status: 'pilot' });
    const counties = allCounties.filter(c => c.fips_code && c.fips_code.trim().length >= 5);

    if (counties.length === 0) {
      return Response.json({ success: true, message: 'No pilot counties with FIPS codes found', updated: 0 });
    }

    // Group counties by state FIPS to minimize API calls (fetch whole state at once)
    const byState = {};
    for (const county of counties) {
      const fips = county.fips_code.toString().padStart(5, '0');
      const stateFips = fips.substring(0, 2);
      if (!byState[stateFips]) byState[stateFips] = [];
      byState[stateFips].push({ ...county, padded_fips: fips, county_fips: fips.substring(2, 5) });
    }

    const results = { updated: 0, skipped: 0, errors: [], counties_processed: [] };

    for (const [stateFips, stateCounties] of Object.entries(byState)) {
      try {
        // Fetch all counties in this state at once (wildcard), then filter
        const rows = await fetchSnapForState(stateFips, '*');
        if (!rows || rows.length < 2) {
          stateCounties.forEach(c => results.skipped++);
          continue;
        }

        // rows[0] is the header: [SNAP_VAR, NAME, state, county]
        const header = rows[0];
        const snapIdx = header.indexOf(SNAP_PERSONS_VAR);
        const stateIdx = header.indexOf('state');
        const countyIdx = header.indexOf('county');

        if (snapIdx === -1 || stateIdx === -1 || countyIdx === -1) {
          stateCounties.forEach(c => results.errors.push({ county: c.county_name, error: 'Header mismatch in Census response' }));
          continue;
        }

        // Build lookup: county_fips (3-digit) -> snap_count
        const snapLookup = {};
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const countyFips = row[countyIdx];
          const snapVal = parseInt(row[snapIdx]);
          if (!isNaN(snapVal) && snapVal > 0) {
            snapLookup[countyFips] = snapVal;
          }
        }

        for (const county of stateCounties) {
          const snapCount = snapLookup[county.county_fips];
          if (snapCount != null) {
            await base44.asServiceRole.entities.County.update(county.id, {
              snap_recipients: snapCount,
            });
            results.updated++;
            results.counties_processed.push({
              county: county.county_name,
              state: county.state_abbreviation,
              fips: county.padded_fips,
              snap_recipients: snapCount,
              source: `ACS ${ACS_YEAR} S2201`,
            });
          } else {
            results.skipped++;
          }
        }

        await sleep(300); // polite delay between state requests
      } catch (err) {
        stateCounties.forEach(c =>
          results.errors.push({ county: c.county_name, state_fips: stateFips, error: err.message })
        );
      }
    }

    // Log to AuditLog
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'data_import',
      entity_type: 'County',
      description: `SNAP import (Census ACS ${ACS_YEAR}): ${results.updated} pilot counties updated, ${results.skipped} skipped, ${results.errors.length} errors`,
      user_email: isScheduled ? 'system@scheduled' : 'admin',
      metadata: JSON.stringify({
        updated: results.updated,
        skipped: results.skipped,
        error_count: results.errors.length,
        source: `Census ACS ${ACS_YEAR} S2201`,
      }),
    });

    return Response.json({
      success: true,
      source: `U.S. Census ACS ${ACS_YEAR} Subject Table S2201 (SNAP/Food Stamps)`,
      pilot_counties_found: counties.length,
      ...results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});