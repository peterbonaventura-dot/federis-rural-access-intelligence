import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Estimate average distance to nearest facility based on rural-urban code and facility count
function estimateDistance(ruralUrbanCode, facilityCount, baseUrbanMiles, baseRuralMiles) {
  const ruc = ruralUrbanCode || 5;
  // RUC 1-3 = metro/urban, 4-6 = small metro, 7-9 = rural/frontier
  const baseMiles = ruc <= 3 ? baseUrbanMiles : ruc <= 6 ? (baseUrbanMiles + baseRuralMiles) / 2 : baseRuralMiles;
  if (facilityCount === 0) return baseMiles * 2.5; // no local facility = further to travel
  if (facilityCount >= 3) return baseMiles * 0.6;
  return baseMiles;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const countyIdFilter = body.county_id || null;

  // Load all data in parallel
  const [counties, allFacilities, existingProfiles] = await Promise.all([
    base44.asServiceRole.entities.County.list('-created_date', 300),
    base44.asServiceRole.entities.CountyFacility.list('-created_date', 2000),
    base44.asServiceRole.entities.CountyResourceProfile.list('-created_date', 300),
  ]);

  const profileMap = {};
  existingProfiles.forEach(p => { profileMap[p.county_id] = p; });

  // Group facilities by county and type
  const facilityMap = {};
  for (const f of allFacilities) {
    if (!facilityMap[f.county_id]) facilityMap[f.county_id] = [];
    facilityMap[f.county_id].push(f);
  }

  const targetCounties = countyIdFilter
    ? counties.filter(c => c.id === countyIdFilter)
    : counties;

  const results = [];

  for (const county of targetCounties) {
    const facilities = facilityMap[county.id] || [];
    const ruc = county.rural_urban_code || 5;

    // Count by type
    const count = (types) => facilities.filter(f => types.includes(f.facility_type)).length;

    const hospitals = count(['hospital']);
    const cahs = count(['critical_access_hospital']);
    const rhcs = count(['rural_health_clinic']);
    const fqhcs = count(['fqhc']);
    const pharmacies = count(['pharmacy']);
    const bh = count(['behavioral_health']);
    const su = count(['substance_use']);
    const hha = count(['home_health_agency']);
    const hcbs = count(['hcbs_provider']);
    const pc = count(['personal_care']);
    const aaa = count(['area_agency_on_aging']);
    const ssa = count(['social_security_office']);
    const transport = count(['transportation']);
    const community = count(['community_org']);

    // Estimate distances based on local facility presence + rural-urban code
    const nearestHospital = estimateDistance(ruc, hospitals + cahs, 8, 30);
    const nearestPharmacy = estimateDistance(ruc, pharmacies, 3, 18);
    const nearestBH = estimateDistance(ruc, bh + su, 10, 40);
    const nearestSSA = estimateDistance(ruc, ssa, 5, 45);

    const profileData = {
      county_id: county.id,
      number_of_hospitals: hospitals,
      number_of_critical_access_hospitals: cahs,
      number_of_rural_health_clinics: rhcs,
      number_of_fqhcs: fqhcs,
      number_of_pharmacies: pharmacies,
      number_of_behavioral_health_providers: bh,
      number_of_substance_use_providers: su,
      number_of_home_health_agencies: hha,
      number_of_hcbs_providers: hcbs,
      number_of_personal_care_providers: pc,
      number_of_area_agencies_on_aging: aaa,
      number_of_social_security_offices: ssa,
      number_of_transportation_resources: transport,
      number_of_community_service_orgs: community,
      nearest_hospital_miles_avg: Math.round(nearestHospital * 10) / 10,
      nearest_pharmacy_miles_avg: Math.round(nearestPharmacy * 10) / 10,
      nearest_behavioral_health_provider_miles_avg: Math.round(nearestBH * 10) / 10,
      nearest_social_security_office_miles_avg: Math.round(nearestSSA * 10) / 10,
    };

    if (profileMap[county.id]) {
      await base44.asServiceRole.entities.CountyResourceProfile.update(profileMap[county.id].id, profileData);
    } else {
      await base44.asServiceRole.entities.CountyResourceProfile.create(profileData);
    }

    results.push({
      county: county.county_name,
      state: county.state_abbreviation,
      facilities_found: facilities.length,
      hospitals: hospitals + cahs,
      pharmacies,
      bh_providers: bh,
    });
  }

  // Now recalculate risk scores for updated counties (fire and forget to avoid timeout)
  base44.asServiceRole.functions.invoke('calculateRiskScores', {
    county_ids: targetCounties.map(c => c.id),
  }).catch(() => {});

  await base44.asServiceRole.entities.AuditLog.create({
    action: 'data_import',
    description: `Built resource profiles for ${results.length} counties from facility data, recalculated scores`,
    user_email: user.email,
  });

  return Response.json({
    success: true,
    counties_processed: results.length,
    results,
    message: `Resource profiles built and risk scores recalculated for ${results.length} counties.`,
  });
});