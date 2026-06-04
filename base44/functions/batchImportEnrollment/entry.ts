import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const MEDICARE_ENROLLMENT_DATASET = 'd7fabe1e-d19b-4333-9eff-e80e0643f2fd';
const CMS_API_BASE = 'https://data.cms.gov/data-api/v1/dataset';

async function fetchMedicareCountyData(fips) {
  const url = new URL(`${CMS_API_BASE}/${MEDICARE_ENROLLMENT_DATASET}/data`);
  url.searchParams.set('size', '20');
  url.searchParams.set('offset', '0');
  url.searchParams.set('filter[BENE_GEO_LVL]', 'County');
  url.searchParams.set('filter[BENE_FIPS_CD]', fips);
  url.searchParams.set('filter[MONTH]', 'Year');
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  return res.json();
}

const parseNum = (v) => {
  const n = parseInt(v);
  return isNaN(n) ? null : n;
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    // Get all pilot counties
    const counties = await base44.asServiceRole.entities.County.filter({ pilot_cohort_status: 'pilot' });
    const results = { updated: [], skipped: [], failed: [] };

    for (const county of counties) {
      if (!county.fips_code) { results.skipped.push({ id: county.id, reason: 'no fips' }); continue; }

      const fips = county.fips_code.toString().padStart(5, '0');
      const rows = await fetchMedicareCountyData(fips);
      await sleep(300);

      if (!rows || rows.length === 0) {
        results.skipped.push({ id: county.id, name: county.county_name, reason: 'no CMS data' });
        continue;
      }

      const sorted = rows.sort((a, b) => parseInt(b.YEAR || 0) - parseInt(a.YEAR || 0));
      const latest = sorted[0];
      const updates = {};

      const totalBenes = parseNum(latest.TOT_BENES);
      if (totalBenes !== null) updates.medicare_enrollees = totalBenes;

      const dualBenes = parseNum(latest.DUAL_TOT_BENES);
      if (dualBenes !== null) updates.dual_eligible_enrollees = dualBenes;

      const fullDual = parseNum(latest.FULL_DUAL_TOT_BENES);
      if (fullDual !== null) updates.medicaid_enrollees = fullDual;

      const ssiBenes = parseNum(latest.PRSCRPTN_DRUG_DEEMED_ELIGIBLE_FULL_LIS_BENES);
      if (ssiBenes !== null) updates.ssi_recipients = ssiBenes;

      // Estimate social_security_recipients and snap_recipients from demographics if not available from CMS
      // SSA recipients ≈ aged 65+ medicare + disabled (conservative proxy)
      const aged = parseNum(latest.AGED_TOT_BENES);
      const disabled = parseNum(latest.DSBLD_TOT_BENES);
      if (aged !== null && disabled !== null && !updates.social_security_recipients) {
        updates.social_security_recipients = aged + disabled;
      }

      if (Object.keys(updates).length > 0) {
        await base44.asServiceRole.entities.County.update(county.id, updates);
        results.updated.push({ id: county.id, name: county.county_name, fields: Object.keys(updates) });
      }
    }

    return Response.json({ success: true, total: counties.length, ...results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});