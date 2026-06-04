import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// CMS Medicare Monthly Enrollment dataset (county level, annual data)
// https://data.cms.gov/summary-statistics-on-beneficiary-enrollment/medicare-and-medicaid-reports/medicare-monthly-enrollment
// Fields: TOT_BENES, DUAL_TOT_BENES, DSBLD_TOT_BENES, AGED_TOT_BENES, BENE_FIPS_CD, YEAR, MONTH
const MEDICARE_ENROLLMENT_DATASET = 'd7fabe1e-d19b-4333-9eff-e80e0643f2fd';
const CMS_API_BASE = 'https://data.cms.gov/data-api/v1/dataset';

async function fetchMedicareCountyData(fips) {
  // Filter: county level, specific FIPS, yearly summary rows only (MONTH=Year), get all years
  const url = new URL(`${CMS_API_BASE}/${MEDICARE_ENROLLMENT_DATASET}/data`);
  url.searchParams.set('size', '20');
  url.searchParams.set('offset', '0');
  url.searchParams.set('filter[BENE_GEO_LVL]', 'County');
  url.searchParams.set('filter[BENE_FIPS_CD]', fips);
  url.searchParams.set('filter[MONTH]', 'Year');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`CMS API error ${res.status}`);
  return res.json();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json();
    const { county_id, fips_code } = body;

    if (!county_id || !fips_code) {
      return Response.json({ error: 'county_id and fips_code are required' }, { status: 400 });
    }

    // Normalize FIPS to 5 chars
    const fips = fips_code.toString().padStart(5, '0');

    // Fetch Medicare enrollment data
    const rows = await fetchMedicareCountyData(fips);

    if (!rows || rows.length === 0) {
      return Response.json({
        success: true,
        county_id,
        fips_code: fips,
        fields_updated: [],
        message: 'No CMS enrollment data found for this FIPS code.',
        dataset: 'Medicare Monthly Enrollment',
        dataset_url: `https://data.cms.gov/data-api/v1/dataset/${MEDICARE_ENROLLMENT_DATASET}/data`,
      });
    }

    // Pick the most recent year row
    const sorted = rows.sort((a, b) => parseInt(b.YEAR || 0) - parseInt(a.YEAR || 0));
    const latest = sorted[0];
    const year = latest.YEAR;

    const parseNum = (v) => {
      const n = parseInt(v);
      return isNaN(n) ? null : n;
    };

    const updates = {};
    const raw = {};

    // Medicare total enrollees
    const totalBenes = parseNum(latest.TOT_BENES);
    if (totalBenes !== null) {
      updates.medicare_enrollees = totalBenes;
      raw.medicare_enrollees = totalBenes;
    }

    // Dual eligible (Medicare + Medicaid)
    const dualBenes = parseNum(latest.DUAL_TOT_BENES);
    if (dualBenes !== null) {
      updates.dual_eligible_enrollees = dualBenes;
      raw.dual_eligible_enrollees = dualBenes;
    }

    // Medicaid proxy: Full dual eligible (enrolled in full Medicaid)
    const fullDual = parseNum(latest.FULL_DUAL_TOT_BENES);
    if (fullDual !== null) {
      updates.medicaid_enrollees = fullDual;
      raw.medicaid_enrollees_full_dual = fullDual;
    }

    // SSI proxy: Part D Low-Income Subsidy (deemed eligible = SSI/Medicaid automatically enrolled)
    const ssiBenes = parseNum(latest.PRSCRPTN_DRUG_DEEMED_ELIGIBLE_FULL_LIS_BENES);
    if (ssiBenes !== null) {
      updates.ssi_recipients = ssiBenes;
      raw.ssi_proxy_part_d_lis = ssiBenes;
    }

    // Disabled beneficiaries
    const disabled = parseNum(latest.DSBLD_TOT_BENES);
    raw.disabled_medicare_benes = disabled;

    // Aged 65+
    const aged = parseNum(latest.AGED_TOT_BENES);
    raw.aged_medicare_benes = aged;

    // Demographic breakdown (informational only, not stored)
    raw.year = year;
    raw.white_benes = parseNum(latest.WHITE_TOT_BENES);
    raw.black_benes = parseNum(latest.BLACK_TOT_BENES);
    raw.hispanic_benes = parseNum(latest.HSPNC_TOT_BENES);
    raw.male_benes = parseNum(latest.MALE_TOT_BENES);
    raw.female_benes = parseNum(latest.FEMALE_TOT_BENES);

    // Apply updates to county
    if (Object.keys(updates).length > 0) {
      await base44.asServiceRole.entities.County.update(county_id, updates);
    }

    return Response.json({
      success: true,
      county_id,
      fips_code: fips,
      year,
      fields_updated: Object.keys(updates),
      updates,
      raw_results: raw,
      dataset: 'CMS Medicare Monthly Enrollment (county-level annual)',
      dataset_url: `https://data.cms.gov/data-api/v1/dataset/${MEDICARE_ENROLLMENT_DATASET}/data`,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});