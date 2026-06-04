import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// CMS Medicare Monthly Enrollment dataset
const MEDICARE_ENROLLMENT_DATASET = 'd7fabe1e-d19b-4333-9eff-e80e0643f2fd';
const CMS_API_BASE = 'https://data.cms.gov/data-api/v1/dataset';

async function fetchMedicareCountyData(fips) {
  const url = new URL(`${CMS_API_BASE}/${MEDICARE_ENROLLMENT_DATASET}/data`);
  url.searchParams.set('size', '10');
  url.searchParams.set('filter[BENE_GEO_LVL]', 'County');
  url.searchParams.set('filter[BENE_FIPS_CD]', fips);
  url.searchParams.set('filter[MONTH]', 'Year');
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`CMS API error ${res.status} for FIPS ${fips}`);
  return res.json();
}

const parseNum = (v) => {
  const n = parseInt(v);
  return isNaN(n) ? null : n;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // This function is called by an automation (scheduled), so no user auth required.
    // We still allow manual admin invocation.
    let isScheduled = false;
    const authHeader = req.headers.get('authorization') || '';
    if (!authHeader) {
      isScheduled = true; // Automation call
    } else {
      const user = await base44.auth.me();
      if (user && user.role !== 'admin') {
        return Response.json({ error: 'Admin only' }, { status: 403 });
      }
    }

    // Fetch all counties that have a FIPS code
    const allCounties = await base44.asServiceRole.entities.County.list('-created_date', 500);
    const countiesWithFips = allCounties.filter(c => c.fips_code && c.fips_code.trim().length >= 5);

    const results = { updated: 0, skipped: 0, errors: [], counties_processed: [] };

    for (const county of countiesWithFips) {
      const fips = county.fips_code.toString().padStart(5, '0');
      try {
        const rows = await fetchMedicareCountyData(fips);
        if (!rows || rows.length === 0) {
          results.skipped++;
          continue;
        }

        // Most recent year
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

        if (Object.keys(updates).length > 0) {
          await base44.asServiceRole.entities.County.update(county.id, updates);
          results.updated++;
          results.counties_processed.push({ county: county.county_name, state: county.state_abbreviation, fips, fields: Object.keys(updates), year: latest.YEAR });
        } else {
          results.skipped++;
        }

        // Small delay to be polite to the CMS API
        await new Promise(r => setTimeout(r, 150));
      } catch (err) {
        results.errors.push({ county: county.county_name, fips, error: err.message });
      }
    }

    // Log the run to AuditLog
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'data_import',
      entity_type: 'County',
      description: `Auto-import CMS enrollment data: ${results.updated} counties updated, ${results.skipped} skipped, ${results.errors.length} errors`,
      user_email: isScheduled ? 'system@scheduled' : 'admin',
      metadata: JSON.stringify({ updated: results.updated, skipped: results.skipped, error_count: results.errors.length }),
    });

    return Response.json({
      success: true,
      total_counties_with_fips: countiesWithFips.length,
      ...results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});