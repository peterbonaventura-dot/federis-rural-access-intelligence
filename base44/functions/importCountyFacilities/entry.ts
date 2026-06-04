import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Use AI to generate realistic facilities for a batch of counties in one call
async function generateFacilitiesBatch(base44, counties) {
  const countyList = counties.map(c =>
    `- ${c.county_name}, ${c.state} (FIPS: ${c.fips_code}, rural-urban: ${c.rural_urban_code || 'rural'}, ID: ${c.id})`
  ).join('\n');

  const response = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `Generate realistic healthcare facility and community organization data for these rural US counties:\n${countyList}\n\nFor each county generate 8-12 realistic facilities with a mix of: critical access hospitals, rural health clinics, FQHCs, pharmacies, behavioral health providers, home health agencies, HCBS/personal care providers, community organizations, and area agencies on aging.\n\nUse realistic local names (e.g. "[County Name] Community Health Center", "[Town] Pharmacy"). Use real-ish city names and zip codes from that county. Set county_id to the ID shown in parentheses above for each facility.`,
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
    const countyIdFilter = body.county_id || null;
    const skipExisting = body.skip_existing !== false; // default true

    // Load pilot counties
    const allCounties = await base44.asServiceRole.entities.County.list('-created_date', 200);
    let counties = allCounties.filter(c => c.pilot_cohort_status === 'pilot');
    if (countyIdFilter) counties = counties.filter(c => c.id === countyIdFilter);

    if (counties.length === 0) {
      return Response.json({ error: 'No pilot counties found' }, { status: 404 });
    }

    // Load existing facilities once to avoid per-county queries
    const allExisting = await base44.asServiceRole.entities.CountyFacility.list('-created_date', 1000);
    const existingByCounty = {};
    for (const f of allExisting) {
      existingByCounty[f.county_id] = (existingByCounty[f.county_id] || 0) + 1;
    }

    const summary = { processed: 0, skipped: 0, total_created: 0, counties: [] };

    // Separate counties into skip vs process
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

    // Generate all facilities in one AI call (batch up to 10 counties at a time)
    const BATCH_SIZE = 10;
    const facilitiesByCounty = {};
    for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
      const batch = toProcess.slice(i, i + BATCH_SIZE);
      const generated = await generateFacilitiesBatch(base44, batch);
      for (const f of generated) {
        if (f.county_id) {
          if (!facilitiesByCounty[f.county_id]) facilitiesByCounty[f.county_id] = [];
          facilitiesByCounty[f.county_id].push(f);
        }
      }
    }

    // Insert all facilities with a small delay between writes
    for (const county of toProcess) {
      const facilities = facilitiesByCounty[county.id] || [];
      let created = 0;
      for (const f of facilities) {
        await base44.asServiceRole.entities.CountyFacility.create({ ...f, county_id: county.id });
        created++;
        await new Promise(r => setTimeout(r, 200));
      }
      summary.processed++;
      summary.total_created += created;
      summary.counties.push({ county: county.county_name, state: county.state_abbreviation, status: 'imported', created });
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