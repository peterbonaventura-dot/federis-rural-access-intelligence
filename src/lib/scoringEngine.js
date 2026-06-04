/**
 * Federis Rural Access Intelligence - Scoring Engine
 * 
 * Calculates Rural Access Risk Scores (0-100) using transparent weighted scoring.
 * Higher score = higher risk.
 * 
 * Weights:
 *   Workforce shortage: 20%
 *   Provider capacity: 15%
 *   Transportation burden: 15%
 *   Hospital discharge risk: 10%
 *   Benefits access: 10%
 *   Behavioral health: 10%
 *   Pharmacy access: 5%
 *   Service continuity: 10%
 *   EVV/documentation burden: 5%
 */

const WEIGHTS = {
  workforce_shortage: 0.20,
  provider_capacity: 0.15,
  transportation_burden: 0.15,
  hospital_discharge_risk: 0.10,
  benefits_access: 0.10,
  behavioral_health_access: 0.10,
  pharmacy_access: 0.05,
  service_continuity: 0.10,
  evv_documentation_burden: 0.05,
};

function clamp(val, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(val)));
}

function safeDiv(numerator, denominator, fallback = 0) {
  if (!denominator || denominator === 0) return fallback;
  return numerator / denominator;
}

export function calculateWorkforceShortageScore(ops) {
  if (!ops) return 50;
  const clientsPerCaregiver = safeDiv(ops.active_client_count, ops.caregiver_count_active, 10);
  const hoursPerCaregiver = safeDiv(ops.authorized_hours_total, ops.caregiver_count_active, 200);
  const unstaffedPct = safeDiv(ops.unstaffed_hours_total, ops.authorized_hours_total, 0) * 100;
  const within10Pct = safeDiv(ops.caregiver_count_within_10_miles, ops.caregiver_count_available, 0) * 100;
  const missedVisitRate = safeDiv(ops.missed_visit_count, ops.active_client_count, 0) * 100;

  let score = 0;
  score += Math.min(clientsPerCaregiver * 5, 25);
  score += Math.min(hoursPerCaregiver / 10, 25);
  score += Math.min(unstaffedPct * 1.5, 25);
  score += Math.min((100 - within10Pct) * 0.15, 15);
  score += Math.min(missedVisitRate * 2, 10);

  return clamp(score);
}

export function calculateProviderCapacityScore(resources, county) {
  if (!resources) return 50;
  const pop65 = county?.population_65_plus || 1000;
  const popDisabled = county?.population_disabled_estimate || 500;
  const targetPop = (pop65 + popDisabled) / 1000;

  const hcbsPerK = safeDiv(resources.number_of_hcbs_providers, targetPop, 0);
  const pcPerK = safeDiv(resources.number_of_personal_care_providers, targetPop, 0);
  const hhPerK = safeDiv(resources.number_of_home_health_agencies, targetPop, 0);

  let score = 0;
  score += Math.min((5 - hcbsPerK) * 8, 35);
  score += Math.min((3 - pcPerK) * 10, 35);
  score += Math.min((2 - hhPerK) * 15, 30);

  return clamp(score);
}

export function calculateTransportationBurdenScore(resources, ops) {
  if (!resources) return 50;
  let score = 0;
  score += Math.min((resources.nearest_hospital_miles_avg || 0) * 1.2, 25);
  score += Math.min((resources.nearest_pharmacy_miles_avg || 0) * 1.5, 25);
  score += Math.min((resources.nearest_behavioral_health_provider_miles_avg || 0) * 1.0, 20);
  if (ops) {
    const transportRate = safeDiv(ops.transportation_barrier_count, ops.active_client_count, 0) * 100;
    score += Math.min(transportRate * 3, 20);
  }
  score += Math.min((5 - (resources.number_of_transportation_resources || 0)) * 2, 10);
  return clamp(score);
}

export function calculateHospitalDischargeRiskScore(ops, resources) {
  if (!ops) return 50;
  let score = 0;
  const dischargeRate = safeDiv(ops.hospital_discharge_referral_count, ops.referral_count, 0) * 100;
  score += Math.min(dischargeRate * 2, 25);
  score += Math.min((ops.hospital_discharge_to_start_avg_days || 0) * 4, 30);
  const hospitalToHcbs = safeDiv(resources?.number_of_hospitals || 0, resources?.number_of_hcbs_providers || 1, 0);
  score += Math.min(hospitalToHcbs * 15, 25);
  const unstaffedPct = safeDiv(ops.unstaffed_hours_total, ops.authorized_hours_total, 0) * 100;
  score += Math.min(unstaffedPct * 0.5, 20);
  return clamp(score);
}

export function calculateBenefitsAccessScore(resources, county) {
  if (!resources) return 50;
  const popK = (county?.population_total || 10000) / 1000;
  let score = 0;
  const ssPerK = safeDiv(resources.number_of_social_security_offices, popK, 0);
  score += Math.min((0.5 - ssPerK) * 60, 30);
  score += Math.min((resources.nearest_social_security_office_miles_avg || 0) * 1.0, 30);
  const aaaPerK = safeDiv(resources.number_of_area_agencies_on_aging, popK, 0);
  score += Math.min((0.3 - aaaPerK) * 50, 20);
  return clamp(Math.max(score, 0));
}

export function calculateBehavioralHealthScore(resources, ops, county) {
  if (!resources) return 50;
  const popK = ((county?.population_65_plus || 1000) + (county?.population_disabled_estimate || 500)) / 1000;
  let score = 0;
  const bhPerK = safeDiv(resources.number_of_behavioral_health_providers, popK, 0);
  score += Math.min((3 - bhPerK) * 12, 35);
  score += Math.min((resources.nearest_behavioral_health_provider_miles_avg || 0) * 1.2, 25);
  if (ops) {
    const bhRate = safeDiv(ops.behavioral_health_flagged_client_count, ops.active_client_count, 0) * 100;
    score += Math.min(bhRate * 2, 25);
  }
  score += Math.min((2 - (resources.number_of_substance_use_providers || 0)) * 7, 15);
  return clamp(score);
}

export function calculatePharmacyAccessScore(resources, county) {
  if (!resources) return 50;
  const popK = (county?.population_total || 10000) / 1000;
  let score = 0;
  const pharmPerK = safeDiv(resources.number_of_pharmacies, popK, 0);
  score += Math.min((1 - pharmPerK) * 40, 50);
  score += Math.min((resources.nearest_pharmacy_miles_avg || 0) * 2.5, 50);
  return clamp(score);
}

export function calculateServiceContinuityScore(ops) {
  if (!ops) return 50;
  let score = 0;
  const missedRate = safeDiv(ops.missed_visit_count, ops.active_client_count, 0) * 100;
  score += Math.min(missedRate * 3, 20);
  const lateRate = safeDiv(ops.late_visit_count, ops.active_client_count, 0) * 100;
  score += Math.min(lateRate * 2, 15);
  const unstaffedPct = safeDiv(ops.unstaffed_hours_total, ops.authorized_hours_total, 0) * 100;
  score += Math.min(unstaffedPct * 1.0, 25);
  score += Math.min((ops.average_referral_to_start_days || 0) * 3, 25);
  const highNeedRate = safeDiv(ops.high_need_client_count, ops.active_client_count, 0) * 100;
  score += Math.min(highNeedRate * 0.3, 15);
  return clamp(score);
}

export function calculateEvvDocumentationBurdenScore(ops) {
  if (!ops) return 30;
  let score = 0;
  const evvRate = safeDiv(ops.evv_exception_count, ops.active_client_count, 0) * 100;
  score += Math.min(evvRate * 3, 25);
  const gpsRate = safeDiv(ops.evv_gps_exception_count, ops.active_client_count, 0) * 100;
  score += Math.min(gpsRate * 4, 25);
  const offlineRate = safeDiv(ops.evv_offline_mode_count, ops.active_client_count, 0) * 100;
  score += Math.min(offlineRate * 3, 25);
  const pocRate = safeDiv(ops.poc_documentation_issue_count, ops.active_client_count, 0) * 100;
  score += Math.min(pocRate * 5, 25);
  return clamp(score);
}

export function calculateOverallScore(subscores) {
  let total = 0;
  total += (subscores.workforce_shortage || 0) * WEIGHTS.workforce_shortage;
  total += (subscores.provider_capacity || 0) * WEIGHTS.provider_capacity;
  total += (subscores.transportation_burden || 0) * WEIGHTS.transportation_burden;
  total += (subscores.hospital_discharge_risk || 0) * WEIGHTS.hospital_discharge_risk;
  total += (subscores.benefits_access || 0) * WEIGHTS.benefits_access;
  total += (subscores.behavioral_health_access || 0) * WEIGHTS.behavioral_health_access;
  total += (subscores.pharmacy_access || 0) * WEIGHTS.pharmacy_access;
  total += (subscores.service_continuity || 0) * WEIGHTS.service_continuity;
  total += (subscores.evv_documentation_burden || 0) * WEIGHTS.evv_documentation_burden;
  return clamp(total);
}

export function calculateFullRiskScore(county, resources, ops) {
  const subscores = {
    workforce_shortage: calculateWorkforceShortageScore(ops),
    provider_capacity: calculateProviderCapacityScore(resources, county),
    transportation_burden: calculateTransportationBurdenScore(resources, ops),
    hospital_discharge_risk: calculateHospitalDischargeRiskScore(ops, resources),
    benefits_access: calculateBenefitsAccessScore(resources, county),
    behavioral_health_access: calculateBehavioralHealthScore(resources, ops, county),
    pharmacy_access: calculatePharmacyAccessScore(resources, county),
    service_continuity: calculateServiceContinuityScore(ops),
    evv_documentation_burden: calculateEvvDocumentationBurdenScore(ops),
  };

  const overall = calculateOverallScore(subscores);

  const care_desert_flag = overall >= 70 && subscores.provider_capacity >= 65;
  const benefits_access_desert_flag = subscores.benefits_access >= 70;
  const hospital_discharge_risk_flag = subscores.hospital_discharge_risk >= 65;
  const workforce_crisis_flag = subscores.workforce_shortage >= 75;
  const high_priority_research_flag = overall >= 60 || care_desert_flag || workforce_crisis_flag;

  return {
    overall_rural_access_risk_score: overall,
    workforce_shortage_score: subscores.workforce_shortage,
    provider_capacity_score: subscores.provider_capacity,
    transportation_burden_score: subscores.transportation_burden,
    hospital_discharge_risk_score: subscores.hospital_discharge_risk,
    benefits_access_score: subscores.benefits_access,
    behavioral_health_access_score: subscores.behavioral_health_access,
    pharmacy_access_score: subscores.pharmacy_access,
    service_continuity_score: subscores.service_continuity,
    evv_documentation_burden_score: subscores.evv_documentation_burden,
    care_desert_flag,
    benefits_access_desert_flag,
    hospital_discharge_risk_flag,
    workforce_crisis_flag,
    high_priority_research_flag,
  };
}

export function getRiskLevel(score) {
  if (score >= 75) return { label: 'Critical', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' };
  if (score >= 60) return { label: 'High', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' };
  if (score >= 40) return { label: 'Moderate', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' };
  if (score >= 20) return { label: 'Low', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' };
  return { label: 'Minimal', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' };
}

export function getRiskColor(score) {
  if (score >= 75) return '#dc2626';
  if (score >= 60) return '#ea580c';
  if (score >= 40) return '#d97706';
  if (score >= 20) return '#059669';
  return '#2563eb';
}

export const SCORE_CATEGORIES = [
  { key: 'workforce_shortage_score', label: 'Workforce Shortage', weight: '20%', icon: 'Users' },
  { key: 'provider_capacity_score', label: 'Provider Capacity', weight: '15%', icon: 'Building2' },
  { key: 'transportation_burden_score', label: 'Transportation Burden', weight: '15%', icon: 'Car' },
  { key: 'hospital_discharge_risk_score', label: 'Hospital Discharge Risk', weight: '10%', icon: 'Hospital' },
  { key: 'benefits_access_score', label: 'Benefits Access', weight: '10%', icon: 'ShieldCheck' },
  { key: 'behavioral_health_access_score', label: 'Behavioral Health', weight: '10%', icon: 'Brain' },
  { key: 'pharmacy_access_score', label: 'Pharmacy Access', weight: '5%', icon: 'Pill' },
  { key: 'service_continuity_score', label: 'Service Continuity', weight: '10%', icon: 'Activity' },
  { key: 'evv_documentation_burden_score', label: 'EVV/Documentation', weight: '5%', icon: 'FileCheck' },
];

export { WEIGHTS };