import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Scoring engine - duplicated since backend functions cannot import local files
function clamp(val, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(val)));
}
function safeDiv(n, d, f = 0) { return d ? n / d : f; }

function calcWorkforce(ops) {
  if (!ops) return 50;
  let s = 0;
  s += Math.min(safeDiv(ops.active_client_count, ops.caregiver_count_active, 10) * 5, 25);
  s += Math.min(safeDiv(ops.authorized_hours_total, ops.caregiver_count_active, 200) / 10, 25);
  s += Math.min(safeDiv(ops.unstaffed_hours_total, ops.authorized_hours_total, 0) * 150, 25);
  s += Math.min((100 - safeDiv(ops.caregiver_count_within_10_miles, ops.caregiver_count_available, 0) * 100) * 0.15, 15);
  s += Math.min(safeDiv(ops.missed_visit_count, ops.active_client_count, 0) * 200, 10);
  return clamp(s);
}

function calcProvider(res, county) {
  if (!res) return 50;
  const t = ((county?.population_65_plus || 1000) + (county?.population_disabled_estimate || 500)) / 1000;
  let s = 0;
  s += Math.min((5 - safeDiv(res.number_of_hcbs_providers, t, 0)) * 8, 35);
  s += Math.min((3 - safeDiv(res.number_of_personal_care_providers, t, 0)) * 10, 35);
  s += Math.min((2 - safeDiv(res.number_of_home_health_agencies, t, 0)) * 15, 30);
  return clamp(s);
}

function calcTransport(res, ops) {
  if (!res) return 50;
  let s = 0;
  s += Math.min((res.nearest_hospital_miles_avg || 0) * 1.2, 25);
  s += Math.min((res.nearest_pharmacy_miles_avg || 0) * 1.5, 25);
  s += Math.min((res.nearest_behavioral_health_provider_miles_avg || 0) * 1.0, 20);
  if (ops) s += Math.min(safeDiv(ops.transportation_barrier_count, ops.active_client_count, 0) * 300, 20);
  s += Math.min((5 - (res.number_of_transportation_resources || 0)) * 2, 10);
  return clamp(s);
}

function calcDischarge(ops, res) {
  if (!ops) return 50;
  let s = 0;
  s += Math.min(safeDiv(ops.hospital_discharge_referral_count, ops.referral_count, 0) * 200, 25);
  s += Math.min((ops.hospital_discharge_to_start_avg_days || 0) * 4, 30);
  s += Math.min(safeDiv(res?.number_of_hospitals || 0, res?.number_of_hcbs_providers || 1, 0) * 15, 25);
  s += Math.min(safeDiv(ops.unstaffed_hours_total, ops.authorized_hours_total, 0) * 50, 20);
  return clamp(s);
}

function calcBenefits(res, county) {
  if (!res) return 50;
  const pk = (county?.population_total || 10000) / 1000;
  let s = 0;
  s += Math.min((0.5 - safeDiv(res.number_of_social_security_offices, pk, 0)) * 60, 30);
  s += Math.min((res.nearest_social_security_office_miles_avg || 0) * 1.0, 30);
  s += Math.min((0.3 - safeDiv(res.number_of_area_agencies_on_aging, pk, 0)) * 50, 20);
  return clamp(Math.max(s, 0));
}

function calcBH(res, ops, county) {
  if (!res) return 50;
  const pk = ((county?.population_65_plus || 1000) + (county?.population_disabled_estimate || 500)) / 1000;
  let s = 0;
  s += Math.min((3 - safeDiv(res.number_of_behavioral_health_providers, pk, 0)) * 12, 35);
  s += Math.min((res.nearest_behavioral_health_provider_miles_avg || 0) * 1.2, 25);
  if (ops) s += Math.min(safeDiv(ops.behavioral_health_flagged_client_count, ops.active_client_count, 0) * 200, 25);
  s += Math.min((2 - (res.number_of_substance_use_providers || 0)) * 7, 15);
  return clamp(s);
}

function calcPharmacy(res, county) {
  if (!res) return 50;
  const pk = (county?.population_total || 10000) / 1000;
  let s = 0;
  s += Math.min((1 - safeDiv(res.number_of_pharmacies, pk, 0)) * 40, 50);
  s += Math.min((res.nearest_pharmacy_miles_avg || 0) * 2.5, 50);
  return clamp(s);
}

function calcContinuity(ops) {
  if (!ops) return 50;
  let s = 0;
  s += Math.min(safeDiv(ops.missed_visit_count, ops.active_client_count, 0) * 300, 20);
  s += Math.min(safeDiv(ops.late_visit_count, ops.active_client_count, 0) * 200, 15);
  s += Math.min(safeDiv(ops.unstaffed_hours_total, ops.authorized_hours_total, 0) * 100, 25);
  s += Math.min((ops.average_referral_to_start_days || 0) * 3, 25);
  s += Math.min(safeDiv(ops.high_need_client_count, ops.active_client_count, 0) * 30, 15);
  return clamp(s);
}

function calcEVV(ops) {
  if (!ops) return 30;
  let s = 0;
  s += Math.min(safeDiv(ops.evv_exception_count, ops.active_client_count, 0) * 300, 25);
  s += Math.min(safeDiv(ops.evv_gps_exception_count, ops.active_client_count, 0) * 400, 25);
  s += Math.min(safeDiv(ops.evv_offline_mode_count, ops.active_client_count, 0) * 300, 25);
  s += Math.min(safeDiv(ops.poc_documentation_issue_count, ops.active_client_count, 0) * 500, 25);
  return clamp(s);
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const countyIds = body.county_ids; // optional: array of county IDs to recalculate

  const counties = await base44.asServiceRole.entities.County.filter({});
  const resources = await base44.asServiceRole.entities.CountyResourceProfile.filter({});
  const opsDataAll = await base44.asServiceRole.entities.OperationalServiceData.filter({});
  const existingScores = await base44.asServiceRole.entities.RuralAccessRiskScore.filter({});

  const resMap = {};
  resources.forEach(r => { resMap[r.county_id] = r; });
  const opsMap = {};
  opsDataAll.forEach(o => { opsMap[o.county_id] = o; });
  const scoreMap = {};
  existingScores.forEach(s => { scoreMap[s.county_id] = s; });

  const targetCounties = countyIds
    ? counties.filter(c => countyIds.includes(c.id))
    : counties;

  const results = [];

  for (const county of targetCounties) {
    const res = resMap[county.id];
    const ops = opsMap[county.id];

    const workforce = calcWorkforce(ops);
    const provider = calcProvider(res, county);
    const transport = calcTransport(res, ops);
    const discharge = calcDischarge(ops, res);
    const benefits = calcBenefits(res, county);
    const bh = calcBH(res, ops, county);
    const pharmacy = calcPharmacy(res, county);
    const continuity = calcContinuity(ops);
    const evv = calcEVV(ops);

    const overall = clamp(
      workforce * 0.20 + provider * 0.15 + transport * 0.15 +
      discharge * 0.10 + benefits * 0.10 + bh * 0.10 +
      pharmacy * 0.05 + continuity * 0.10 + evv * 0.05
    );

    const scoreData = {
      county_id: county.id,
      reporting_period_start: body.period_start || '2026-01-01',
      reporting_period_end: body.period_end || '2026-03-31',
      overall_rural_access_risk_score: overall,
      workforce_shortage_score: workforce,
      provider_capacity_score: provider,
      transportation_burden_score: transport,
      hospital_discharge_risk_score: discharge,
      benefits_access_score: benefits,
      behavioral_health_access_score: bh,
      pharmacy_access_score: pharmacy,
      service_continuity_score: continuity,
      evv_documentation_burden_score: evv,
      care_desert_flag: overall >= 70 && provider >= 65,
      benefits_access_desert_flag: benefits >= 70,
      hospital_discharge_risk_flag: discharge >= 65,
      workforce_crisis_flag: workforce >= 75,
      high_priority_research_flag: overall >= 60 || (overall >= 70 && provider >= 65) || workforce >= 75,
      score_explanation: `Overall ${overall}: WF=${workforce}, PC=${provider}, TR=${transport}, HD=${discharge}, BA=${benefits}, BH=${bh}, PH=${pharmacy}, SC=${continuity}, EV=${evv}`,
    };

    if (scoreMap[county.id]) {
      await base44.asServiceRole.entities.RuralAccessRiskScore.update(scoreMap[county.id].id, scoreData);
    } else {
      await base44.asServiceRole.entities.RuralAccessRiskScore.create(scoreData);
    }

    results.push({ county: county.county_name, state: county.state_abbreviation, overall });
  }

  await base44.asServiceRole.entities.AuditLog.create({
    action: 'score_calculation',
    description: `Calculated risk scores for ${results.length} counties`,
    user_email: user.email,
  });

  return Response.json({ success: true, count: results.length, results });
});