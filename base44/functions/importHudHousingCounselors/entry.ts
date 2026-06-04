import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const HUD_ALL_URL = 'https://data.hud.gov/Housing_Counselor/search?AgencyName=&City=&State=';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Haversine distance in miles between two lat/lon points
function distanceMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const countyIdFilter = body.county_id || null;
    const skipExisting = body.skip_existing !== false;
    const maxDistanceMiles = body.distance || 75;

    // Fetch all HUD counseling agencies once
    const hudRes = await fetch(HUD_ALL_URL, { headers: { 'Accept': 'application/json' } });
    if (!hudRes.ok) return Response.json({ error: `HUD API returned ${hudRes.status}` }, { status: 502 });
    const allAgencies = await hudRes.json();

    // Only keep active agencies with valid coordinates
    const activeAgencies = allAgencies.filter(a =>
      a.agc_STATUS === 'A' &&
      a.agc_ADDR_LATITUDE && a.agc_ADDR_LONGITUDE &&
      !isNaN(parseFloat(a.agc_ADDR_LATITUDE))
    );

    // Load pilot counties with coordinates
    const allCounties = await base44.asServiceRole.entities.County.filter({ pilot_cohort_status: 'pilot' });
    let counties = allCounties.filter(c => c.latitude && c.longitude);
    if (countyIdFilter) counties = counties.filter(c => c.id === countyIdFilter);

    if (counties.length === 0) {
      return Response.json({ error: 'No pilot counties with coordinates found' }, { status: 404 });
    }

    // Load existing HUD facilities to avoid duplication
    const existingFacilities = await base44.asServiceRole.entities.CountyFacility.filter({ facility_type: 'hud_housing' });
    const existingByCounty = new Set(existingFacilities.map(f => f.county_id));

    const summary = { processed: 0, skipped: 0, total_created: 0, counties: [] };

    for (const county of counties) {
      if (skipExisting && existingByCounty.has(county.id)) {
        summary.skipped++;
        summary.counties.push({ county: county.county_name, status: 'skipped' });
        continue;
      }

      // Find all agencies within maxDistanceMiles of this county centroid
      const nearby = activeAgencies
        .map(a => ({
          ...a,
          _miles: distanceMiles(
            county.latitude, county.longitude,
            parseFloat(a.agc_ADDR_LATITUDE), parseFloat(a.agc_ADDR_LONGITUDE)
          )
        }))
        .filter(a => a._miles <= maxDistanceMiles)
        .sort((a, b) => a._miles - b._miles);

      let created = 0;
      for (const agency of nearby) {
        const servicesList = [agency.services, agency.counslg_METHOD].filter(Boolean).join(' | ');
        const langList = agency.languages || '';

        const facility = {
          county_id: county.id,
          facility_type: 'hud_housing',
          facility_name: agency.nme || 'HUD Housing Counseling Agency',
          address_street: agency.adr1 || '',
          address_city: agency.city || '',
          address_state: agency.statecd || county.state_abbreviation,
          address_zip: agency.zipcd || '',
          phone: agency.phone1 && agency.phone1 !== '000-000-0000' ? agency.phone1 : '',
          website: agency.weburl || '',
          latitude: parseFloat(agency.agc_ADDR_LATITUDE),
          longitude: parseFloat(agency.agc_ADDR_LONGITUDE),
          accepts_medicaid: false,
          accepts_medicare: false,
          accepts_uninsured: true,
          notes: [
            servicesList ? `Services: ${servicesList}` : null,
            langList ? `Languages: ${langList}` : null,
            agency.email ? `Email: ${agency.email}` : null,
            `HUD Agency ID: ${agency.agcid}`,
            `~${Math.round(agency._miles)} miles from county center`,
          ].filter(Boolean).join(' | '),
          is_active: true,
        };

        await base44.asServiceRole.entities.CountyFacility.create(facility);
        created++;
        await sleep(350);
      }

      summary.processed++;
      summary.total_created += created;
      summary.counties.push({
        county: county.county_name,
        state: county.state_abbreviation,
        status: 'imported',
        hud_agencies_found: nearby.length,
        created,
      });

      await sleep(500);
    }

    return Response.json({
      success: true,
      total_hud_agencies_in_db: activeAgencies.length,
      summary,
      message: `Processed ${summary.processed} counties, created ${summary.total_created} HUD housing counselor records.`
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});