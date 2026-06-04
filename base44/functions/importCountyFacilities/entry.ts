import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Maps HRSA/CMS data to our CountyFacility entity facility_type enum
function mapFacilityType(raw) {
  const t = (raw || '').toLowerCase();
  if (t.includes('fqhc') || t.includes('federally qualified')) return 'fqhc';
  if (t.includes('rural health clinic') || t.includes('rhc')) return 'rural_health_clinic';
  if (t.includes('critical access')) return 'critical_access_hospital';
  if (t.includes('hospital')) return 'hospital';
  if (t.includes('pharmacy')) return 'pharmacy';
  if (t.includes('home health')) return 'home_health_agency';
  if (t.includes('behavioral') || t.includes('mental health')) return 'behavioral_health';
  if (t.includes('substance') || t.includes('opioid')) return 'substance_use';
  if (t.includes('personal care')) return 'personal_care';
  if (t.includes('aging') || t.includes('aaa')) return 'area_agency_on_aging';
  if (t.includes('social security')) return 'social_security_office';
  if (t.includes('transport')) return 'transportation';
  if (t.includes('community')) return 'community_org';
  if (t.includes('hud') || t.includes('housing')) return 'hud_housing';
  return 'other';
}

// Fetch FQHCs and Rural Health Clinics from HRSA Find-a-Health-Center API
async function fetchHRSAFacilities(countyName, stateAbbr) {
  const results = [];
  try {
    const url = `https://findahealthcenter.hrsa.gov/api/GetHealthCenters?sState=${stateAbbr}&sCity=&sZipCode=&nDistance=100&sSearchTerm=&nPageNum=1&nPageSize=100`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) return results;
    const json = await res.json();
    const items = json?.HealthCenters || json?.healthCenters || json?.results || json?.data || [];
    for (const item of items) {
      const itemCounty = (item.County || item.county || '').toLowerCase();
      const searchCounty = countyName.toLowerCase().replace(' county', '');
      if (!itemCounty.includes(searchCounty) && !searchCounty.includes(itemCounty)) continue;
      results.push({
        facility_name: item.SiteName || item.siteName || item.Name || item.name || 'Unknown FQHC',
        facility_type: 'fqhc',
        address_street: item.Address || item.address || item.Street || '',
        address_city: item.City || item.city || '',
        address_state: item.State || item.state || stateAbbr,
        address_zip: item.ZipCode || item.zipCode || item.Zip || '',
        phone: item.Phone || item.phone || '',
        website: item.Website || item.website || '',
        accepts_medicaid: true,
        accepts_medicare: true,
        accepts_uninsured: true,
        notes: 'Imported from HRSA Find-a-Health-Center',
        is_active: true,
      });
    }
  } catch (_e) {
    // HRSA API unavailable, continue
  }
  return results;
}

// Fetch hospitals from CMS Care Compare
async function fetchCMSHospitals(fipsCode, stateAbbr) {
  const results = [];
  try {
    const url = `https://data.cms.gov/provider-data/api/1/datastore/query/xubh-q36u/0?filter[0][property]=state&filter[0][value]=${stateAbbr}&limit=200&offset=0`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) return results;
    const json = await res.json();
    const items = json?.results || json?.data || [];
    for (const item of items) {
      // Filter by county FIPS if available, otherwise by state only
      const countyFips = (item.county_fips_code || item.CountyFipsCode || '');
      if (countyFips && !countyFips.startsWith(fipsCode.substring(0, 5))) continue;
      const type = item.hospital_type || item.HospitalType || '';
      results.push({
        facility_name: item.facility_name || item.FacilityName || 'Unknown Hospital',
        facility_type: mapFacilityType(type),
        address_street: item.address || item.Address || '',
        address_city: item.city || item.City || '',
        address_state: item.state || item.State || stateAbbr,
        address_zip: item.zip_code || item.ZipCode || '',
        phone: item.phone_number || item.PhoneNumber || '',
        website: '',
        accepts_medicaid: true,
        accepts_medicare: true,
        accepts_uninsured: false,
        notes: `CMS Hospital Type: ${type}`,
        is_active: true,
      });
    }
  } catch (_e) {
    // CMS API unavailable, continue
  }
  return results;
}

// Fetch home health agencies from CMS
async function fetchCMSHomeHealth(stateAbbr) {
  const results = [];
  try {
    const url = `https://data.cms.gov/provider-data/api/1/datastore/query/6jpm-sxkc/0?filter[0][property]=state&filter[0][value]=${stateAbbr}&limit=200`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) return results;
    const json = await res.json();
    const items = json?.results || json?.data || [];
    for (const item of items) {
      results.push({
        facility_name: item.agency_name || item.AgencyName || 'Unknown Home Health Agency',
        facility_type: 'home_health_agency',
        address_street: item.address || item.Address || '',
        address_city: item.city || item.City || '',
        address_state: item.state || item.State || stateAbbr,
        address_zip: item.zip || item.Zip || '',
        phone: item.phone || item.Phone || '',
        website: '',
        accepts_medicaid: true,
        accepts_medicare: true,
        accepts_uninsured: false,
        notes: 'Imported from CMS Home Health Compare',
        is_active: true,
      });
    }
  } catch (_e) {
    // CMS Home Health API unavailable
  }
  return results;
}

// Use AI to generate realistic sample facilities for multiple counties in one call
async function generateSampleFacilitiesBatch(base44, counties) {
  const countyList = counties.map(c =>
    `- ${c.county_name}, ${c.state} (FIPS: ${c.fips_code}, rural-urban code: ${c.rural_urban_code || 'rural'}, ID: ${c.id})`
  ).join('\n');

  const response = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `Generate realistic healthcare facility and community organization data for these rural counties:\n${countyList}\n\nFor each county generate 6-10 realistic facilities including a mix of: critical access hospitals or rural health clinics, FQHCs, pharmacies, behavioral health providers, home health agencies, HCBS providers, community organizations, and area agencies on aging.\n\nUse realistic local facility names (not generic ones). Include accurate-ish zip codes and city names for each county. Note which county_id each facility belongs to using the ID in parentheses above.`,
    response_json_schema: {
      type: "object",
      properties: {
        facilities: {
          type: "array",
          items: {
            type: "object",
            properties: {
              county_id: { type: "string" },
              facility_name: { type: "string" },
              facility_type: {
                type: "string",
                enum: ["hospital", "critical_access_hospital", "rural_health_clinic", "fqhc", "pharmacy", "behavioral_health", "substance_use", "home_health_agency", "hcbs_provider", "personal_care", "area_agency_on_aging", "social_security_office", "transportation", "community_org", "hud_housing", "other"]
              },
              address_street: { type: "string" },
              address_city: { type: "string" },
              address_state: { type: "string" },
              address_zip: { type: "string" },
              phone: { type: "string" },
              accepts_medicaid: { type: "boolean" },
              accepts_medicare: { type: "boolean" },
              accepts_uninsured: { type: "boolean" },
              notes: { type: "string" }
            },
            required: ["county_id", "facility_name", "facility_type"]
          }
        }
      }
    }
  });
  return (response?.facilities || []).map(f => ({ ...f, is_active: true }));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const countyIdFilter = body.county_id || null; // optional: run for specific county only
    const useAIFallback = body.use_ai_fallback !== false; // default true
    const skipExisting = body.skip_existing !== false; // default true

    // Load pilot counties
    const allCounties = await base44.asServiceRole.entities.County.list('-created_date', 200);
    let counties = allCounties.filter(c => c.pilot_cohort_status === 'pilot');
    if (countyIdFilter) counties = counties.filter(c => c.id === countyIdFilter);

    if (counties.length === 0) {
      return Response.json({ error: 'No pilot counties found' }, { status: 404 });
    }

    // Load all existing facilities once to avoid per-county filter calls
    const allExisting = await base44.asServiceRole.entities.CountyFacility.list('-created_date', 500);
    const existingByCounty = {};
    for (const f of allExisting) {
      if (!existingByCounty[f.county_id]) existingByCounty[f.county_id] = 0;
      existingByCounty[f.county_id]++;
    }

    const summary = { processed: 0, skipped: 0, total_created: 0, counties: [] };

    // Separate counties that already have data vs need import
    const toProcess = [];
    for (const county of counties) {
      if (skipExisting && (existingByCounty[county.id] || 0) > 0) {
        summary.skipped++;
        summary.counties.push({ county: county.county_name, status: 'skipped', existing: existingByCounty[county.id] });
      } else {
        toProcess.push(county);
      }
    }

    if (toProcess.length === 0) {
      return Response.json({ success: true, summary, message: 'All counties already have facility data.' });
    }

    // Try real public APIs for each county
    const facilitiesByCounty = {};
    for (const county of toProcess) {
      const [hrsa, hospitals, homeHealth] = await Promise.all([
        fetchHRSAFacilities(county.county_name, county.state_abbreviation),
        fetchCMSHospitals(county.fips_code, county.state_abbreviation),
        fetchCMSHomeHealth(county.state_abbreviation),
      ]);
      let facilities = [...hrsa, ...hospitals, ...homeHealth];
      // Deduplicate by name
      const seen = new Set();
      facilities = facilities.filter(f => {
        const key = f.facility_name.toLowerCase().trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      facilitiesByCounty[county.id] = facilities;
    }

    // For counties that got no API results, use a single batch AI call
    if (useAIFallback) {
      const needsAI = toProcess.filter(c => facilitiesByCounty[c.id].length === 0);
      if (needsAI.length > 0) {
        const aiFacilities = await generateSampleFacilitiesBatch(base44, needsAI);
        for (const f of aiFacilities) {
          if (f.county_id && facilitiesByCounty[f.county_id] !== undefined) {
            facilitiesByCounty[f.county_id].push(f);
          }
        }
      }
    }

    // Insert all facilities with rate-limit-friendly delays
    for (const county of toProcess) {
      const facilities = facilitiesByCounty[county.id] || [];
      let created = 0;
      for (const f of facilities) {
        await base44.asServiceRole.entities.CountyFacility.create({ ...f, county_id: county.id });
        created++;
        await new Promise(r => setTimeout(r, 300));
      }
      summary.processed++;
      summary.total_created += created;
      summary.counties.push({
        county: county.county_name,
        state: county.state_abbreviation,
        status: 'imported',
        created,
      });
      await new Promise(r => setTimeout(r, 300));
    }

    return Response.json({
      success: true,
      summary,
      message: `Processed ${summary.processed} counties, created ${summary.total_created} facility records.`
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});