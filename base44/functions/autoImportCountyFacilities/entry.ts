import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Auto-triggered when a County is added/updated with pilot_cohort_status = 'pilot'.
 * 1. Checks if county already has facilities — skips if so.
 * 2. Tries CMS Provider Data import (real data).
 * 3. If CMS returns 0, falls back to AI-generated facilities.
 * 4. Logs result to AuditLog.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Support both direct admin calls and entity automation payloads
    const body = await req.json().catch(() => ({}));

    // Entity automation payload shape: { event, data, old_data }
    const countyData = body.data || body;
    const countyId = body.event?.entity_id || countyData.id || body.county_id;

    if (!countyId) {
      return Response.json({ error: 'county_id or automation payload required' }, { status: 400 });
    }

    // Fetch the county record
    const county = await base44.asServiceRole.entities.County.get(countyId);
    if (!county) {
      return Response.json({ error: 'County not found' }, { status: 404 });
    }

    // Only process pilot counties
    if (county.pilot_cohort_status !== 'pilot') {
      return Response.json({ skipped: true, reason: 'Not a pilot county' });
    }

    // Check if facilities already exist
    const existing = await base44.asServiceRole.entities.CountyFacility.filter({ county_id: countyId });
    if (existing && existing.length > 0) {
      return Response.json({
        skipped: true,
        reason: `Already has ${existing.length} facilities`,
        county: county.county_name,
      });
    }

    let cmsImported = 0;
    let source = 'none';

    // ── Step 1: Try CMS real data ──────────────────────────────────────────
    if (county.state_abbreviation && county.county_name) {
      const cmsRes = await base44.asServiceRole.functions.invoke('importCmsProviders', {
        county_id: countyId,
        county_name: county.county_name.replace(/ County$/i, '').trim(),
        state_abbreviation: county.state_abbreviation,
        provider_types: ['hospitals', 'home_health', 'behavioral_health', 'fqhc', 'substance_use'],
      });
      cmsImported = cmsRes?.imported || 0;
      if (cmsImported > 0) source = 'cms';
    }

    // ── Step 2: AI fallback if CMS returned nothing ────────────────────────
    let aiCreated = 0;
    if (cmsImported === 0) {
      const countyList = [{
        id: county.id,
        county_name: county.county_name,
        state: county.state || county.state_abbreviation,
        fips_code: county.fips_code,
        rural_urban_code: county.rural_urban_code || 9,
      }];

      const aiRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Generate realistic healthcare facility and community organization data for this rural US county:\n- ${county.county_name}, ${county.state || county.state_abbreviation} (FIPS: ${county.fips_code}, rural-urban: ${county.rural_urban_code || 'rural'}, ID: ${county.id})\n\nGenerate 8-12 realistic facilities with a mix of: critical access hospitals, rural health clinics, FQHCs, pharmacies, behavioral health providers, home health agencies, HCBS/personal care providers, community organizations, area agencies on aging. Use realistic local names and city names from that county. Set county_id to the ID shown above.`,
        response_json_schema: {
          type: 'object',
          properties: {
            facilities: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  county_id: { type: 'string' },
                  facility_name: { type: 'string' },
                  facility_type: {
                    type: 'string',
                    enum: ['hospital', 'critical_access_hospital', 'rural_health_clinic', 'fqhc', 'pharmacy', 'behavioral_health', 'substance_use', 'home_health_agency', 'hcbs_provider', 'personal_care', 'area_agency_on_aging', 'social_security_office', 'transportation', 'community_org', 'hud_housing', 'other'],
                  },
                  address_street: { type: 'string' },
                  address_city: { type: 'string' },
                  address_state: { type: 'string' },
                  address_zip: { type: 'string' },
                  phone: { type: 'string' },
                  accepts_medicaid: { type: 'boolean' },
                  accepts_medicare: { type: 'boolean' },
                  accepts_uninsured: { type: 'boolean' },
                  notes: { type: 'string' },
                },
                required: ['county_id', 'facility_name', 'facility_type'],
              },
            },
          },
        },
      });

      const facilities = (aiRes?.facilities || []).map(f => ({ ...f, is_active: true, county_id: countyId }));
      for (const f of facilities) {
        await base44.asServiceRole.entities.CountyFacility.create(f);
        aiCreated++;
        await new Promise(r => setTimeout(r, 150));
      }
      if (aiCreated > 0) source = 'ai_generated';
    }

    const totalCreated = cmsImported + aiCreated;

    // ── Step 3: Log to AuditLog ────────────────────────────────────────────
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'data_import',
      entity_type: 'CountyFacility',
      entity_id: countyId,
      description: `Auto-imported ${totalCreated} facilities for ${county.county_name}, ${county.state_abbreviation} via ${source}`,
      metadata: JSON.stringify({ county_id: countyId, cms_imported: cmsImported, ai_created: aiCreated, source }),
    });

    return Response.json({
      success: true,
      county: county.county_name,
      state: county.state_abbreviation,
      total_created: totalCreated,
      cms_imported: cmsImported,
      ai_created: aiCreated,
      source,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});