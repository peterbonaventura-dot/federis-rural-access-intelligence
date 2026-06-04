import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// CMS Provider Data Catalog dataset IDs
// xubh-q36u = Hospital General Information (name, address, county, phone, type)
// 4j6d-yzce = Home Health Agencies
// mj5m-pzi6 = Hospice providers (we'll skip, not in scope)

const CMS_BASE = 'https://data.cms.gov/provider-data/api/1/datastore/query';
const HOSPITAL_DATASET = 'xubh-q36u';
const HOME_HEALTH_DATASET = '4j6d-yzce';

async function fetchAllPages(datasetId, conditions = [], limit = 500) {
  const results = [];
  let offset = 0;

  while (true) {
    const body = {
      conditions,
      limit,
      offset,
      results_format: 'objects',
    };

    const res = await fetch(`${CMS_BASE}/${datasetId}/0`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const json = await res.json();
    const rows = json.results || [];
    results.push(...rows);

    if (rows.length < limit) break;
    offset += limit;
    if (offset > 5000) break; // safety cap
  }

  return results;
}

function mapHospitalType(hospitalType) {
  if (!hospitalType) return 'hospital';
  const lower = hospitalType.toLowerCase();
  if (lower.includes('critical access')) return 'critical_access_hospital';
  if (lower.includes('psychiatric')) return 'behavioral_health';
  if (lower.includes('children')) return 'hospital';
  return 'hospital';
}

function mapHomeHealthType() {
  return 'home_health_agency';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json();
    const { county_id, county_name, state_abbreviation, provider_types = ['hospitals', 'home_health'] } = body;

    if (!county_id || !county_name || !state_abbreviation) {
      return Response.json({ error: 'county_id, county_name, and state_abbreviation are required' }, { status: 400 });
    }

    const countyParish = county_name.replace(/ County$/i, '').replace(/ Parish$/i, '').toUpperCase();
    let importedCount = 0;
    const errors = [];

    // --- Hospitals ---
    if (provider_types.includes('hospitals')) {
      const hospitals = await fetchAllPages(HOSPITAL_DATASET, [
        { property: 'state', value: state_abbreviation, operator: '=' },
      ]);

      // Filter to matching county
      const countyHospitals = hospitals.filter(h => {
        const hCounty = (h.countyparish || '').toUpperCase().replace(/ COUNTY$/i, '').replace(/ PARISH$/i, '').trim();
        return hCounty === countyParish || hCounty === county_name.toUpperCase().replace(/ COUNTY$/i, '').trim();
      });

      for (const h of countyHospitals) {
        // Check for existing facility by name + county to avoid duplicates
        const existing = await base44.asServiceRole.entities.CountyFacility.filter({
          county_id,
          facility_name: h.facility_name,
        });
        if (existing && existing.length > 0) continue;

        await base44.asServiceRole.entities.CountyFacility.create({
          county_id,
          facility_name: h.facility_name || 'Unknown Hospital',
          facility_type: mapHospitalType(h.hospital_type),
          address_street: h.address || '',
          address_city: h.citytown || '',
          address_state: h.state || state_abbreviation,
          address_zip: h.zip_code || '',
          phone: h.telephone_number || '',
          accepts_medicaid: true,
          accepts_medicare: true,
          is_active: true,
          notes: [
            h.hospital_type && `Type: ${h.hospital_type}`,
            h.hospital_ownership && `Ownership: ${h.hospital_ownership}`,
            h.emergency_services === 'Yes' && 'Emergency Services: Yes',
            h.hospital_overall_rating && h.hospital_overall_rating !== 'Not Available' && `CMS Rating: ${h.hospital_overall_rating}/5`,
          ].filter(Boolean).join(' | '),
        });
        importedCount++;
      }
    }

    // --- Home Health Agencies ---
    if (provider_types.includes('home_health')) {
      const agencies = await fetchAllPages(HOME_HEALTH_DATASET, [
        { property: 'state', value: state_abbreviation, operator: '=' },
      ]);

      const countyAgencies = agencies.filter(a => {
        const aCounty = (a.county_name || a.countyparish || '').toUpperCase().replace(/ COUNTY$/i, '').replace(/ PARISH$/i, '').trim();
        return aCounty === countyParish || aCounty === county_name.toUpperCase().replace(/ COUNTY$/i, '').trim();
      });

      for (const a of countyAgencies) {
        const name = a.provider_name || a.agency_name || a.facility_name;
        if (!name) continue;

        const existing = await base44.asServiceRole.entities.CountyFacility.filter({
          county_id,
          facility_name: name,
        });
        if (existing && existing.length > 0) continue;

        await base44.asServiceRole.entities.CountyFacility.create({
          county_id,
          facility_name: name,
          facility_type: 'home_health_agency',
          address_street: a.address || a.street_address || '',
          address_city: a.city || a.citytown || '',
          address_state: a.state || state_abbreviation,
          address_zip: a.zip_code || a.zip || '',
          phone: a.phone || a.telephone_number || '',
          accepts_medicaid: true,
          accepts_medicare: true,
          is_active: true,
          notes: 'Source: CMS Provider Data Catalog',
        });
        importedCount++;
      }
    }

    return Response.json({
      success: true,
      imported: importedCount,
      county: `${county_name}, ${state_abbreviation}`,
      provider_types,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});