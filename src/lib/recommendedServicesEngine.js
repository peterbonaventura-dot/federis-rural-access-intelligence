/**
 * Federis Rural Access Intelligence — Recommended Services Engine
 * Ranks interventions based on county risk scores, population needs, and gaps.
 */

const INTERVENTIONS = [
  { id: 'personal_care_expansion', label: 'Personal Care Expansion', description: 'Expand personal care capacity to meet unmet HCBS need.', triggers: ['provider_capacity', 'workforce_shortage'] },
  { id: 'caregiver_recruitment', label: 'Caregiver Recruitment Campaign', description: 'Targeted recruitment for direct care workers in underserved areas.', triggers: ['workforce_shortage'] },
  { id: 'dsp_recruitment', label: 'DSP Recruitment Campaign', description: 'Recruit Direct Support Professionals for IDD/disability services.', triggers: ['workforce_shortage', 'provider_capacity'] },
  { id: 'hospital_discharge_coordination', label: 'Hospital Discharge Coordination Program', description: 'Dedicated program to bridge hospital discharge gaps with HCBS placement.', triggers: ['hospital_discharge_risk'] },
  { id: 'rural_transportation_partnership', label: 'Rural Transportation Partnership', description: 'Partner with local transit or volunteer driver networks.', triggers: ['transportation_burden'] },
  { id: 'telehealth_access_hub', label: 'Telehealth Access Hub', description: 'Establish community telehealth hub at library or community center.', triggers: ['telehealth_gap', 'transportation_burden'] },
  { id: 'tele_behavioral_health', label: 'Tele-Behavioral Health Partnership', description: 'Contract with behavioral health providers for remote access.', triggers: ['behavioral_health_access'] },
  { id: 'pharmacy_delivery', label: 'Pharmacy Delivery Partnership', description: 'Partner with pharmacy for home medication delivery.', triggers: ['pharmacy_access', 'transportation_burden'] },
  { id: 'mobile_intake_enrollment', label: 'Mobile Intake / Enrollment Support', description: 'Mobile outreach for Medicaid, Medicare, and HCBS enrollment.', triggers: ['benefits_access', 'transportation_burden'] },
  { id: 'ss_benefits_navigation', label: 'Social Security / Benefits Navigation', description: 'Dedicated navigator for SSI, SSDI, and Medicaid enrollment.', triggers: ['benefits_access'] },
  { id: 'medicaid_auth_support', label: 'Medicaid Authorization Support', description: 'Streamline prior authorization to reduce referral-to-start delays.', triggers: ['service_continuity', 'hospital_discharge_risk'] },
  { id: 'dementia_fall_risk_support', label: 'Dementia / Fall-Risk Home Support', description: 'Home safety and dementia care program for older adults.', triggers: ['provider_capacity', 'hospital_discharge_risk'] },
  { id: 'chronic_disease_monitoring', label: 'Chronic Disease Remote Monitoring', description: 'Remote patient monitoring for diabetes, hypertension, COPD.', triggers: ['telehealth_gap', 'hospital_discharge_risk'] },
  { id: 'substance_use_recovery', label: 'Substance Use Recovery Support', description: 'Recovery coaching and MOUD access partnership.', triggers: ['behavioral_health_access'] },
  { id: 'veteran_home_care_outreach', label: 'Veteran Home-Care Outreach', description: 'Outreach to veterans for VA Aid & Attendance and HCBS enrollment.', triggers: ['benefits_access', 'provider_capacity'] },
  { id: 'high_need_care_coordination', label: 'High-Need Consumer Care Coordination', description: 'Intensive case management for consumers with multiple barriers.', triggers: ['service_continuity', 'workforce_shortage'] },
  { id: 'community_health_worker', label: 'Community Health Worker Program', description: 'Community health workers to bridge clinical and social services.', triggers: ['benefits_access', 'transportation_burden', 'behavioral_health_access'] },
  { id: 'workforce_training_partnership', label: 'Workforce Training Partnership', description: 'Partner with community colleges or CTE programs for caregiver training.', triggers: ['workforce_shortage'] },
];

/**
 * Maps score keys to trigger identifiers
 */
const SCORE_TO_TRIGGER = {
  workforce_shortage_score: 'workforce_shortage',
  provider_capacity_score: 'provider_capacity',
  transportation_burden_score: 'transportation_burden',
  hospital_discharge_risk_score: 'hospital_discharge_risk',
  benefits_access_score: 'benefits_access',
  behavioral_health_access_score: 'behavioral_health_access',
  pharmacy_access_score: 'pharmacy_access',
  service_continuity_score: 'service_continuity',
  telehealth_gap_score: 'telehealth_gap',
};

/**
 * Returns ranked list of recommended interventions for a county.
 * @param {object} score - RuralAccessRiskScore record
 * @param {object} telehealthProfile - TelehealthResourceProfile record (optional)
 * @returns {Array} sorted intervention recommendations with scores
 */
export function getRecommendedInterventions(score, telehealthProfile = null) {
  if (!score) return [];

  // Build active high-risk trigger set (score >= 60)
  const activeTriggersMap = {};
  Object.entries(SCORE_TO_TRIGGER).forEach(([scoreKey, trigger]) => {
    const val = score[scoreKey] || 0;
    activeTriggersMap[trigger] = val;
  });

  // Include telehealth gap from profile if available
  if (telehealthProfile?.telehealth_gap_score) {
    activeTriggersMap['telehealth_gap'] = telehealthProfile.telehealth_gap_score;
  }

  // Rank each intervention
  const ranked = INTERVENTIONS.map(intervention => {
    let relevanceScore = 0;
    let matchCount = 0;

    intervention.triggers.forEach(trigger => {
      const triggerScore = activeTriggersMap[trigger] || 0;
      if (triggerScore >= 40) {
        relevanceScore += triggerScore;
        matchCount++;
      }
    });

    // Bonus for flags
    if (intervention.triggers.includes('provider_capacity') && score.care_desert_flag) relevanceScore += 20;
    if (intervention.triggers.includes('benefits_access') && score.benefits_access_desert_flag) relevanceScore += 20;
    if (intervention.triggers.includes('hospital_discharge_risk') && score.hospital_discharge_risk_flag) relevanceScore += 20;
    if (intervention.triggers.includes('workforce_shortage') && score.workforce_crisis_flag) relevanceScore += 20;

    return {
      ...intervention,
      relevanceScore: Math.round(relevanceScore / Math.max(intervention.triggers.length, 1)),
      matchCount,
      priority: relevanceScore >= 120 ? 'critical' : relevanceScore >= 80 ? 'high' : relevanceScore >= 40 ? 'moderate' : 'low',
    };
  });

  return ranked
    .filter(i => i.matchCount > 0 || i.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}

export const PRIORITY_COLORS = {
  critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700' },
  high: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700' },
  moderate: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
  low: { bg: 'bg-muted/30', border: 'border-border', text: 'text-muted-foreground', badge: 'bg-muted text-muted-foreground' },
};

export { INTERVENTIONS };