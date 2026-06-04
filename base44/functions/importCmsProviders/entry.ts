import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ─── CMS Provider Data Catalog (provider-data) ────────────────────────────
const PDC_BASE = 'https://data.cms.gov/provider-data/api/1/datastore/query';
const HOSPITAL_DATASET        = 'xubh-q36u'; // Hospital General Information
const HOME_HEALTH_DATASET     = '4j6d-yzce'; // Home Health Agencies
const IPF_DATASET             = 'q9vs-r7wp'; // Inpatient Psychiatric Facility (behavioral health)
const DIALYSIS_DATASET        = '23ew-n7w9'; // Dialysis Facility - Listing by Facility

// ─── CMS Main Data API (data.cms.gov) ─────────────────────────────────────
const CMS_MAIN_BASE = 'https://data.cms.gov/data-api/v1/dataset';
const FQHC_DATASET_ID   = '0632de4d-6a8c-4d53-819d-1f4ab4e51f25'; // FQHC Enrollments (Q2 2026)
const OTP_DATASET_ID    = '1e903ef7-ec53-44df-9284-6b285ec51b69'; // Opioid Treatment Program Providers

// ─── Helper: paginated fetch from PDC ─────────────────────────────────────
async function fetchPdcPages(datasetId, conditions = [], limit = 500) {
  const results = [];
  let offset = 0;
  while (true) {
    const res = await fetch(`${PDC_BASE}/${datasetId}/0`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conditions, limit, offset, results_format: 'objects' }),
    });
    const json = await res.json();
    const rows = json.results || [];
    results.push(...rows);
    if (rows.length < limit) break;
    offset += limit;
    if (offset > 10000) break;
  }
  return results;
}

// ─── Helper: paginated fetch from main CMS data API ───────────────────────
async function fetchCmsMainPages(datasetId, filters = {}, limit = 1000) {
  const results = [];
  let offset = 0;
  while (true) {
    const params = new URLSearchParams({ limit, offset, ...filters });
    const res = await fetch(`${CMS_MAIN_BASE}/${datasetId}/data?${params}`);
    if (!res.ok) break;
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) break;
    results.push(...rows);
    if (rows.length < limit) break;
    offset += limit;
    if (offset > 20000) break;
  }
  return results;
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function mapHospitalType(hospitalType) {
  if (!hospitalType) return 'hospital';
  const lower = hospitalType.toLowerCase();
  if (lower.includes('critical access')) return 'critical_access_hospital';
  if (lower.includes('psychiatric')) return 'behavioral_health';
  return 'hospital';
}

function normalizeCounty(raw) {
  return (raw || '').toUpperCase()
    .replace(/ COUNTY$/i, '')
    .replace(/ PARISH$/i, '')
    .trim();
}

async function alreadyExists(base44, countyId, facilityName) {
  const existing = await base44.asServiceRole.entities.CountyFacility.filter({
    county_id: countyId,
    facility_name: facilityName,
  });
  return existing && existing.length > 0;
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Main handler ─────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json();
    const {
      county_id,
      county_name,
      state_abbreviation,
      provider_types = ['hospitals', 'home_health'],
    } = body;

    if (!county_id || !county_name || !state_abbreviation) {
      return Response.json({ error: 'county_id, county_name, and state_abbreviation are required' }, { status: 400 });
    }

    const countyParish = normalizeCounty(county_name);
    let importedCount = 0;

    const matchesCounty = (rawCounty) => {
      const norm = normalizeCounty(rawCounty);
      return norm === countyParish;
    };

    // ── Hospitals ────────────────────────────────────────────────────────
    if (provider_types.includes('hospitals')) {
      const rows = await fetchPdcPages(HOSPITAL_DATASET, [
        { property: 'state', value: state_abbreviation, operator: '=' },
      ]);
      const matched = rows.filter(h => matchesCounty(h.countyparish));
      for (const h of matched) {
        const name = h.facility_name || 'Unknown Hospital';
        if (await alreadyExists(base44, county_id, name)) continue;
        await base44.asServiceRole.entities.CountyFacility.create({
          county_id,
          facility_name: name,
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
        await sleep(120);
      }
    }

    // ── Home Health Agencies ─────────────────────────────────────────────
    if (provider_types.includes('home_health')) {
      const rows = await fetchPdcPages(HOME_HEALTH_DATASET, [
        { property: 'state', value: state_abbreviation, operator: '=' },
      ]);
      const matched = rows.filter(a => matchesCounty(a.county_name || a.countyparish));
      for (const a of matched) {
        const name = a.provider_name || a.agency_name || a.facility_name;
        if (!name) continue;
        if (await alreadyExists(base44, county_id, name)) continue;
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
          notes: 'Source: CMS Home Health Data',
        });
        importedCount++;
        await sleep(120);
      }
    }

    // ── Behavioral Health / Inpatient Psychiatric Facilities ─────────────
    if (provider_types.includes('behavioral_health')) {
      const rows = await fetchPdcPages(IPF_DATASET, [
        { property: 'state', value: state_abbreviation, operator: '=' },
      ]);
      const matched = rows.filter(f => matchesCounty(f.countyparish));
      for (const f of matched) {
        const name = f.facility_name;
        if (!name) continue;
        if (await alreadyExists(base44, county_id, name)) continue;
        await base44.asServiceRole.entities.CountyFacility.create({
          county_id,
          facility_name: name,
          facility_type: 'behavioral_health',
          address_street: f.address || '',
          address_city: f.citytown || '',
          address_state: f.state || state_abbreviation,
          address_zip: f.zip_code || '',
          phone: '',
          accepts_medicaid: true,
          accepts_medicare: true,
          is_active: true,
          notes: 'Source: CMS Inpatient Psychiatric Facility Quality Reporting (IPFQR)',
        });
        importedCount++;
        await sleep(120);
      }
    }

    // ── Dialysis Facilities ──────────────────────────────────────────────
    if (provider_types.includes('dialysis')) {
      const rows = await fetchPdcPages(DIALYSIS_DATASET, [
        { property: 'state', value: state_abbreviation, operator: '=' },
      ]);
      const matched = rows.filter(f => matchesCounty(f.county_name || f.countyparish));
      for (const f of matched) {
        const name = f.facility_name || f.provider_name;
        if (!name) continue;
        if (await alreadyExists(base44, county_id, name)) continue;
        await base44.asServiceRole.entities.CountyFacility.create({
          county_id,
          facility_name: name,
          facility_type: 'other', // dialysis isn't in enum, use 'other' with note
          address_street: f.address || '',
          address_city: f.city_town || f.citytown || '',
          address_state: f.state || state_abbreviation,
          address_zip: f.zip_code || '',
          phone: f.telephone_number || f.phone || '',
          accepts_medicaid: true,
          accepts_medicare: true,
          is_active: true,
          notes: [
            'Source: CMS Dialysis Facility Data',
            f.network && `Network: ${f.network}`,
            f.ownership_type && `Ownership: ${f.ownership_type}`,
          ].filter(Boolean).join(' | '),
        });
        importedCount++;
        await sleep(120);
      }
    }

    // ── FQHCs ────────────────────────────────────────────────────────────
    if (provider_types.includes('fqhc')) {
      // FQHC dataset uses state filter via query param; filter by state abbreviation field
      const rows = await fetchCmsMainPages(FQHC_DATASET_ID, { 'filter[STATE_CD]': state_abbreviation });
      for (const f of rows) {
        // Match by zip prefix or city — FQHC data doesn't have county, match by state only + deduplicate
        const name = f.DBA_NAME || f.LEGAL_BUSINESS_NAME;
        if (!name) continue;
        if (await alreadyExists(base44, county_id, name)) continue;
        // Only import if in the right state (already filtered)
        await base44.asServiceRole.entities.CountyFacility.create({
          county_id,
          facility_name: name,
          facility_type: 'fqhc',
          address_street: f.PROV_ADR1 || '',
          address_city: f.CITY_NAME || '',
          address_state: f.STATE_CD || state_abbreviation,
          address_zip: f.ZIP_CD ? String(f.ZIP_CD).substring(0, 5) : '',
          phone: f.PHONE_NBR || '',
          accepts_medicaid: true,
          accepts_medicare: true,
          accepts_uninsured: true,
          is_active: true,
          notes: 'Source: CMS FQHC Enrollments (Medicare Enrolled)',
        });
        importedCount++;
        await sleep(120);
      }
    }

    // ── Opioid Treatment Program (Substance Use) ─────────────────────────
    if (provider_types.includes('substance_use')) {
      const rows = await fetchCmsMainPages(OTP_DATASET_ID, { 'filter[State]': state_abbreviation });
      for (const f of rows) {
        const name = f['Provider Name'] || f.provider_name || f.NAME;
        if (!name) continue;
        if (await alreadyExists(base44, county_id, name)) continue;
        await base44.asServiceRole.entities.CountyFacility.create({
          county_id,
          facility_name: name,
          facility_type: 'substance_use',
          address_street: f.Address || f.address || '',
          address_city: f.City || f.city || '',
          address_state: f.State || state_abbreviation,
          address_zip: f['Zip Code'] || f.zip_code || '',
          phone: f['Phone Number'] || f.phone || '',
          accepts_medicaid: true,
          accepts_medicare: true,
          is_active: true,
          notes: 'Source: CMS Opioid Treatment Program Providers',
        });
        importedCount++;
        await sleep(120);
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