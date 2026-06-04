import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// USDA FNS SNAP County-Level Data via InvokeLLM (estimated from ACS/USDA public data)
// We use the base44 LLM integration to estimate SNAP recipients based on county demographics

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const counties = await base44.asServiceRole.entities.County.filter({ pilot_cohort_status: 'pilot' });
    const results = { updated: [], skipped: [], failed: [] };

    // Process in batches of 10 for LLM efficiency
    const batchSize = 10;
    for (let i = 0; i < counties.length; i += batchSize) {
      const batch = counties.slice(i, i + batchSize);

      const countyList = batch.map(c => ({
        id: c.id,
        name: c.county_name,
        state: c.state,
        fips: c.fips_code,
        population: c.population_total,
        poverty_rate: c.poverty_rate,
        unemployment_rate: c.unemployment_rate,
        median_income: c.median_income,
      }));

      const prompt = `You are a data analyst with expertise in USDA SNAP program enrollment statistics.

For each of the following rural US counties, estimate the number of SNAP (food stamps) recipients based on:
- County population
- Poverty rate
- Unemployment rate
- Median income
- Known SNAP participation rates for rural counties (typically 12-25% of population in high-poverty areas, 5-12% in moderate-poverty areas)
- State-specific SNAP participation rates

Use realistic estimates consistent with USDA FNS published county-level data. High-poverty (>20%) rural counties typically have 15-30% SNAP participation. Persistent poverty counties can exceed 30%.

Counties to estimate:
${JSON.stringify(countyList, null, 2)}

Return a JSON object with county id as key and snap_recipients as integer value.`;

      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            estimates: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  snap_recipients: { type: 'number' }
                }
              }
            }
          }
        }
      });

      if (result?.estimates) {
        for (const est of result.estimates) {
          if (est.id && est.snap_recipients != null) {
            await base44.asServiceRole.entities.County.update(est.id, {
              snap_recipients: Math.round(est.snap_recipients)
            });
            const county = batch.find(c => c.id === est.id);
            results.updated.push({ id: est.id, name: county?.county_name, snap_recipients: Math.round(est.snap_recipients) });
          }
        }
      }

      await sleep(500);
    }

    return Response.json({ success: true, total: counties.length, ...results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});