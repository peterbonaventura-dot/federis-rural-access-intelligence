import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useParams, Link } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import RiskScoreBadge from '@/components/shared/RiskScoreBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, Sparkles, RefreshCw, CheckCircle2, Clock,
  Users, Building2, Car, Hospital, ShieldCheck, Brain, Pill,
  Activity, Wifi, AlertTriangle, Target, Zap, FileText
} from 'lucide-react';
import { getRecommendedInterventions, PRIORITY_COLORS } from '@/lib/recommendedServicesEngine';
import { SCORE_CATEGORIES } from '@/lib/scoringEngine';
import ScoreBar from '@/components/shared/ScoreBar';
import { toast } from 'sonner';

function SectionCard({ icon: Icon, title, color = 'text-primary', children }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${color}`} />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      </div>
      {children}
    </Card>
  );
}

export default function CountyNeedsProfilePage() {
  const { id: countyId } = useParams();
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);

  const { data: counties = [] } = useQuery({ queryKey: ['counties'], queryFn: () => base44.entities.County.list('-created_date', 200) });
  const { data: riskScores = [] } = useQuery({ queryKey: ['riskScores'], queryFn: () => base44.entities.RuralAccessRiskScore.list('-overall_rural_access_risk_score', 200) });
  const { data: resources = [] } = useQuery({ queryKey: ['resources'], queryFn: () => base44.entities.CountyResourceProfile.list('-created_date', 200) });
  const { data: opsData = [] } = useQuery({ queryKey: ['operationalData'], queryFn: () => base44.entities.OperationalServiceData.list('-reporting_period_end', 200) });
  const { data: telehealthProfiles = [] } = useQuery({ queryKey: ['telehealthProfiles'], queryFn: () => base44.entities.TelehealthResourceProfile.list('-telehealth_gap_score', 200) });
  const { data: healthBurdens = [] } = useQuery({ queryKey: ['healthBurdens'], queryFn: () => base44.entities.CountyHealthBurden.list('-created_date', 200) });
  const { data: needsProfiles = [], refetch: refetchNeeds } = useQuery({ queryKey: ['needsProfiles'], queryFn: () => base44.entities.CountyNeedsProfile.list('-created_date', 200) });

  const county = counties.find(c => c.id === countyId);
  const score = riskScores.find(s => s.county_id === countyId);
  const resource = resources.find(r => r.county_id === countyId);
  const ops = opsData.find(o => o.county_id === countyId);
  const telehealth = telehealthProfiles.find(t => t.county_id === countyId);
  const healthBurden = healthBurdens.find(h => h.county_id === countyId);
  const existingProfile = needsProfiles.find(p => p.county_id === countyId);

  const interventions = getRecommendedInterventions(score, telehealth);

  const generateProfile = async () => {
    if (!county || !score) {
      toast.error('County data and risk score are required before generating a profile.');
      return;
    }
    setGenerating(true);
    try {
      const prompt = `
You are a rural health research analyst for Federis Rural Access Intelligence.
Generate a comprehensive County Rural Health Needs Profile for ${county.county_name}, ${county.state}.

County data:
- Population: ${county.population_total?.toLocaleString() || 'unknown'}
- Age 65+: ${county.population_65_plus?.toLocaleString() || 'unknown'}
- Poverty rate: ${county.poverty_rate || 'unknown'}%
- Rural-Urban Code: ${county.rural_urban_code || 'unknown'}
- Medicare enrollees: ${county.medicare_enrollees?.toLocaleString() || 'unknown'}
- Medicaid enrollees: ${county.medicaid_enrollees?.toLocaleString() || 'unknown'}

Risk scores (0-100, higher = greater risk):
- Overall: ${score.overall_rural_access_risk_score}
- Workforce shortage: ${score.workforce_shortage_score || 0}
- Provider capacity: ${score.provider_capacity_score || 0}
- Transportation burden: ${score.transportation_burden_score || 0}
- Hospital discharge risk: ${score.hospital_discharge_risk_score || 0}
- Benefits access: ${score.benefits_access_score || 0}
- Behavioral health: ${score.behavioral_health_access_score || 0}
- Pharmacy access: ${score.pharmacy_access_score || 0}
- Service continuity: ${score.service_continuity_score || 0}

Flags: ${[score.care_desert_flag && 'Care Desert', score.benefits_access_desert_flag && 'Benefits Desert', score.hospital_discharge_risk_flag && 'Discharge Risk', score.workforce_crisis_flag && 'Workforce Crisis'].filter(Boolean).join(', ') || 'None'}

Generate the following sections as a JSON object with these exact keys:
- county_snapshot_summary: 3-4 sentence overview of the county's rural health situation
- population_need_summary: Who lives here, what are their health and support needs?
- health_burden_summary: Key health conditions and chronic disease burden
- provider_capacity_summary: What providers and facilities are available or missing?
- hcbs_personal_care_access_summary: HCBS and personal care access situation
- workforce_capacity_summary: Caregiver and workforce supply situation
- hospital_discharge_risk_summary: Post-acute transition and discharge risk
- transportation_burden_summary: Transportation and distance barriers
- benefits_access_summary: Benefits navigation and enrollment access gaps
- telehealth_readiness_summary: Telehealth readiness and gap
- behavioral_health_access_summary: Behavioral health and substance use access
- pharmacy_access_summary: Pharmacy access and medication adherence risk
- care_desert_summary: Care desert and service desert status
- priority_service_recommendations: Top 3-5 priority interventions with rationale
- top_5_needs: List 5 most critical needs (comma-separated)
- top_5_service_gaps: List 5 most critical service gaps (comma-separated)
- recommended_interventions: Specific recommended interventions with priority levels
`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            county_snapshot_summary: { type: 'string' },
            population_need_summary: { type: 'string' },
            health_burden_summary: { type: 'string' },
            provider_capacity_summary: { type: 'string' },
            hcbs_personal_care_access_summary: { type: 'string' },
            workforce_capacity_summary: { type: 'string' },
            hospital_discharge_risk_summary: { type: 'string' },
            transportation_burden_summary: { type: 'string' },
            benefits_access_summary: { type: 'string' },
            telehealth_readiness_summary: { type: 'string' },
            behavioral_health_access_summary: { type: 'string' },
            pharmacy_access_summary: { type: 'string' },
            care_desert_summary: { type: 'string' },
            priority_service_recommendations: { type: 'string' },
            top_5_needs: { type: 'string' },
            top_5_service_gaps: { type: 'string' },
            recommended_interventions: { type: 'string' },
          }
        }
      });

      if (existingProfile) {
        await base44.entities.CountyNeedsProfile.update(existingProfile.id, {
          ...result, county_id: countyId, generated_by: 'ai', status: 'draft',
          reporting_period_start: new Date().toISOString().slice(0, 10),
          reporting_period_end: new Date().toISOString().slice(0, 10),
        });
      } else {
        await base44.entities.CountyNeedsProfile.create({
          ...result, county_id: countyId, generated_by: 'ai', status: 'draft',
          reporting_period_start: new Date().toISOString().slice(0, 10),
          reporting_period_end: new Date().toISOString().slice(0, 10),
        });
      }

      await refetchNeeds();
      toast.success('County Needs Profile generated successfully.');
    } catch (err) {
      toast.error('Failed to generate profile: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  if (!county) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>County not found.</p>
        <Link to="/county-profiles"><Button variant="outline" className="mt-4"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button></Link>
      </div>
    );
  }

  const profile = existingProfile;

  return (
    <div>
      <PageHeader
        title={`County Rural Health Needs Profile`}
        description={`${county.county_name}, ${county.state} — FIPS ${county.fips_code}`}
        actions={
          <div className="flex gap-2">
            <Link to={`/county-profiles/${countyId}`}>
              <Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> County Detail</Button>
            </Link>
            <Button size="sm" onClick={generateProfile} disabled={generating || !score}>
              {generating ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
              {generating ? 'Generating…' : profile ? 'Regenerate Profile' : 'Generate AI Profile'}
            </Button>
          </div>
        }
      />

      <div className="p-8 space-y-6">
        {/* Header: Score + Status */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <Card className="p-5 flex flex-col items-center text-center">
            {score ? (
              <>
                <RiskScoreBadge score={score.overall_rural_access_risk_score} size="xl" />
                <p className="text-xs text-muted-foreground mt-2">Overall Rural Access Risk</p>
                <div className="flex flex-wrap gap-1 justify-center mt-2">
                  {score.care_desert_flag && <Badge variant="destructive" className="text-xs">Care Desert</Badge>}
                  {score.benefits_access_desert_flag && <Badge className="bg-orange-500 text-xs">Benefits Desert</Badge>}
                  {score.hospital_discharge_risk_flag && <Badge className="bg-amber-500 text-xs">Discharge Risk</Badge>}
                  {score.workforce_crisis_flag && <Badge className="bg-purple-500 text-xs">Workforce Crisis</Badge>}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">No risk score</p>
            )}
          </Card>
          <Card className="lg:col-span-3 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Score Breakdown</h3>
              {profile && (
                <Badge variant="outline" className="text-xs">
                  {profile.status === 'approved' ? '✓ Approved' : profile.status === 'draft' ? '⏳ Draft' : profile.status}
                </Badge>
              )}
            </div>
            {score ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {SCORE_CATEGORIES.map(cat => (
                  <ScoreBar key={cat.key} label={cat.label} score={score[cat.key] || 0} weight={cat.weight} />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Run risk scoring to see breakdown.</p>
            )}
          </Card>
        </div>

        {!profile && !generating && (
          <Card className="p-8 text-center border-dashed">
            <Sparkles className="w-8 h-8 text-primary mx-auto mb-3 opacity-50" />
            <h3 className="font-semibold mb-1">No Profile Generated Yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              Click "Generate AI Profile" to create a comprehensive County Rural Health Needs Profile using AI analysis of available data.
            </p>
            <Button onClick={generateProfile} disabled={!score}>
              <Sparkles className="w-4 h-4 mr-1" /> Generate AI Profile
            </Button>
            {!score && <p className="text-xs text-muted-foreground mt-2">Requires a calculated risk score first.</p>}
          </Card>
        )}

        {generating && (
          <Card className="p-8 text-center">
            <RefreshCw className="w-8 h-8 text-primary mx-auto mb-3 animate-spin" />
            <p className="font-medium">Generating County Rural Health Needs Profile…</p>
            <p className="text-sm text-muted-foreground mt-1">Analyzing population needs, provider gaps, and service recommendations.</p>
          </Card>
        )}

        {profile && (
          <>
            {/* County Snapshot */}
            <SectionCard icon={Target} title="County Snapshot" color="text-primary">
              <p className="text-sm leading-relaxed text-foreground">{profile.county_snapshot_summary}</p>
            </SectionCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SectionCard icon={Users} title="Population Need">
                <p className="text-sm leading-relaxed">{profile.population_need_summary}</p>
              </SectionCard>
              <SectionCard icon={Activity} title="Health Condition Burden" color="text-red-500">
                <p className="text-sm leading-relaxed">{profile.health_burden_summary}</p>
                {healthBurden && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {[
                      { label: 'Diabetes', value: healthBurden.diabetes_rate, unit: '%' },
                      { label: 'Hypertension', value: healthBurden.hypertension_rate, unit: '%' },
                      { label: 'Obesity', value: healthBurden.obesity_rate, unit: '%' },
                      { label: 'Depression', value: healthBurden.depression_rate, unit: '%' },
                      { label: 'COPD', value: healthBurden.copd_rate, unit: '%' },
                      { label: 'Life Expectancy', value: healthBurden.life_expectancy, unit: ' yrs' },
                    ].filter(i => i.value != null).map(i => (
                      <div key={i.label} className="bg-muted/40 rounded p-2 text-center">
                        <p className="text-xs text-muted-foreground">{i.label}</p>
                        <p className="font-semibold text-sm">{i.value}{i.unit}</p>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
              <SectionCard icon={Building2} title="Provider & Facility Access" color="text-blue-600">
                <p className="text-sm leading-relaxed">{profile.provider_capacity_summary}</p>
              </SectionCard>
              <SectionCard icon={Users} title="HCBS & Personal Care Access" color="text-secondary">
                <p className="text-sm leading-relaxed">{profile.hcbs_personal_care_access_summary}</p>
              </SectionCard>
              <SectionCard icon={Users} title="Workforce Capacity" color="text-purple-600">
                <p className="text-sm leading-relaxed">{profile.workforce_capacity_summary}</p>
              </SectionCard>
              <SectionCard icon={Hospital} title="Hospital Discharge Risk" color="text-amber-600">
                <p className="text-sm leading-relaxed">{profile.hospital_discharge_risk_summary}</p>
              </SectionCard>
              <SectionCard icon={Car} title="Transportation Burden" color="text-orange-500">
                <p className="text-sm leading-relaxed">{profile.transportation_burden_summary}</p>
              </SectionCard>
              <SectionCard icon={ShieldCheck} title="Benefits & Enrollment Access" color="text-emerald-600">
                <p className="text-sm leading-relaxed">{profile.benefits_access_summary}</p>
              </SectionCard>
              <SectionCard icon={Wifi} title="Telehealth Readiness" color="text-blue-500">
                <p className="text-sm leading-relaxed">{profile.telehealth_readiness_summary}</p>
              </SectionCard>
              <SectionCard icon={Brain} title="Behavioral Health Access" color="text-indigo-600">
                <p className="text-sm leading-relaxed">{profile.behavioral_health_access_summary}</p>
              </SectionCard>
              <SectionCard icon={Pill} title="Pharmacy Access" color="text-violet-600">
                <p className="text-sm leading-relaxed">{profile.pharmacy_access_summary}</p>
              </SectionCard>
              <SectionCard icon={AlertTriangle} title="Care Desert Status" color="text-red-600">
                <p className="text-sm leading-relaxed">{profile.care_desert_summary}</p>
              </SectionCard>
            </div>

            {/* Top 5 Needs & Gaps */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Top 5 Needs</h3>
                <ol className="space-y-2">
                  {(profile.top_5_needs || '').split(',').filter(Boolean).map((need, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                      <span>{need.trim()}</span>
                    </li>
                  ))}
                </ol>
              </Card>
              <Card className="p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Top 5 Service Gaps</h3>
                <ol className="space-y-2">
                  {(profile.top_5_service_gaps || '').split(',').filter(Boolean).map((gap, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="w-5 h-5 rounded-full bg-destructive/10 text-destructive text-xs flex items-center justify-center font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                      <span>{gap.trim()}</span>
                    </li>
                  ))}
                </ol>
              </Card>
            </div>

            {/* AI Priority Recommendations */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">AI-Generated Priority Recommendations</h3>
              </div>
              <p className="text-sm leading-relaxed text-foreground whitespace-pre-line">{profile.priority_service_recommendations}</p>
            </Card>
          </>
        )}

        {/* Recommended Interventions Engine */}
        {score && (
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-accent" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recommended Services Engine</h3>
              <Badge variant="outline" className="text-xs ml-auto">Scoring-Based</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {interventions.slice(0, 9).map(intervention => {
                const colors = PRIORITY_COLORS[intervention.priority];
                return (
                  <div key={intervention.id} className={`p-3 rounded-lg border ${colors.bg} ${colors.border}`}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className={`text-sm font-medium ${colors.text}`}>{intervention.label}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${colors.badge}`}>
                        {intervention.priority}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{intervention.description}</p>
                    <p className="text-xs mt-1 font-medium">Relevance: {intervention.relevanceScore}/100</p>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}