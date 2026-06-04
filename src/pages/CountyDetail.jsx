import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import RiskScoreBadge from '@/components/shared/RiskScoreBadge';
import ScoreBar from '@/components/shared/ScoreBar';
import StatCard from '@/components/shared/StatCard';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, Users, Building2, Car, Hospital, ShieldCheck,
  Brain, Pill, Activity, FileCheck, MapPin, AlertTriangle, Shield
} from 'lucide-react';
import { SCORE_CATEGORIES } from '@/lib/scoringEngine';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts';
import FacilityList from '@/components/county/FacilityList';

export default function CountyDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const countyId = window.location.pathname.split('/').pop();

  const { data: counties = [] } = useQuery({
    queryKey: ['counties'],
    queryFn: () => base44.entities.County.list('-created_date', 200),
  });

  const { data: riskScores = [] } = useQuery({
    queryKey: ['riskScores'],
    queryFn: () => base44.entities.RuralAccessRiskScore.list('-overall_rural_access_risk_score', 200),
  });

  const { data: resources = [] } = useQuery({
    queryKey: ['resources'],
    queryFn: () => base44.entities.CountyResourceProfile.list('-created_date', 200),
  });

  const { data: opsData = [] } = useQuery({
    queryKey: ['operationalData'],
    queryFn: () => base44.entities.OperationalServiceData.list('-reporting_period_end', 200),
  });

  const county = counties.find(c => c.id === countyId);
  const score = riskScores.find(s => s.county_id === countyId);
  const resource = resources.find(r => r.county_id === countyId);
  const ops = opsData.find(o => o.county_id === countyId);

  if (!county) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>County not found.</p>
        <Link to="/county-profiles"><Button variant="outline" className="mt-4"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button></Link>
      </div>
    );
  }

  const radarData = score ? SCORE_CATEGORIES.map(cat => ({
    category: cat.label.split(' ').slice(0, 2).join(' '),
    score: score[cat.key] || 0,
  })) : [];

  const iconMap = { Users, Building2, Car, Hospital, ShieldCheck, Brain, Pill, Activity, FileCheck };

  return (
    <div>
      <PageHeader
        title={`${county.county_name}, ${county.state_abbreviation}`}
        description={`FIPS ${county.fips_code} • ${county.state}`}
        actions={
          <Link to="/county-profiles">
            <Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> All Counties</Button>
          </Link>
        }
      />

      <div className="p-8 space-y-6">
        {/* Top: Score + Radar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="p-6">
            <div className="flex flex-col items-center text-center space-y-3">
              {score ? (
                <>
                  <RiskScoreBadge score={score.overall_rural_access_risk_score} size="xl" />
                  <p className="text-xs text-muted-foreground">Overall Rural Access Risk Score</p>
                  <div className="flex flex-wrap gap-1 justify-center mt-2">
                    {score.care_desert_flag && <Badge variant="destructive">Care Desert</Badge>}
                    {score.benefits_access_desert_flag && <Badge className="bg-orange-500">Benefits Desert</Badge>}
                    {score.hospital_discharge_risk_flag && <Badge className="bg-amber-500">Discharge Risk</Badge>}
                    {score.workforce_crisis_flag && <Badge className="bg-purple-500">Workforce Crisis</Badge>}
                    {score.high_priority_research_flag && <Badge className="bg-primary">Research Priority</Badge>}
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground text-sm">No risk score calculated</p>
              )}
            </div>
          </Card>

          <Card className="lg:col-span-2 p-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Risk Profile</h3>
            {radarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="category" tick={{ fontSize: 10 }} />
                  <Radar dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">No scores available</div>
            )}
          </Card>
        </div>

        {/* Score Breakdown */}
        {score && (
          <Card className="p-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Score Breakdown</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {SCORE_CATEGORIES.map(cat => (
                <ScoreBar key={cat.key} label={cat.label} score={score[cat.key] || 0} weight={cat.weight} />
              ))}
            </div>
          </Card>
        )}

        {/* Demographics */}
        <Card className="p-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Demographics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[
              { label: 'Population', value: county.population_total?.toLocaleString() },
              { label: 'Age 65+', value: county.population_65_plus?.toLocaleString() },
              { label: 'Disabled Est.', value: county.population_disabled_estimate?.toLocaleString() },
              { label: 'Poverty Rate', value: county.poverty_rate ? `${county.poverty_rate}%` : '—' },
              { label: 'Unemployment', value: county.unemployment_rate ? `${county.unemployment_rate}%` : '—' },
              { label: 'Median Income', value: county.median_income ? `$${county.median_income.toLocaleString()}` : '—' },
            ].map(item => (
              <div key={item.label}>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-sm font-semibold">{item.value || '—'}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-4">
            {county.appalachian_flag && <Badge variant="outline">Appalachian</Badge>}
            {county.tribal_connected_flag && <Badge variant="outline">Tribal-Connected</Badge>}
            {county.frontier_flag && <Badge variant="outline">Frontier</Badge>}
            {county.delta_region_flag && <Badge variant="outline">Delta Region</Badge>}
            {county.persistent_poverty_flag && <Badge variant="outline">Persistent Poverty</Badge>}
          </div>
        </Card>

        {/* Resource Availability */}
        {resource && (
          <Card className="p-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Resource Availability</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 text-sm">
              {[
                { label: 'HCBS Providers', value: resource.number_of_hcbs_providers },
                { label: 'Personal Care', value: resource.number_of_personal_care_providers },
                { label: 'Home Health', value: resource.number_of_home_health_agencies },
                { label: 'Hospitals', value: resource.number_of_hospitals },
                { label: 'Critical Access', value: resource.number_of_critical_access_hospitals },
                { label: 'Rural Clinics', value: resource.number_of_rural_health_clinics },
                { label: 'FQHCs', value: resource.number_of_fqhcs },
                { label: 'Pharmacies', value: resource.number_of_pharmacies },
                { label: 'BH Providers', value: resource.number_of_behavioral_health_providers },
                { label: 'SS Offices', value: resource.number_of_social_security_offices },
              ].map(item => (
                <div key={item.label}>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="font-semibold">{item.value ?? '—'}</p>
                </div>
              ))}
            </div>
            <Separator className="my-4" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {[
                { label: 'Avg to Hospital', value: resource.nearest_hospital_miles_avg, unit: ' mi' },
                { label: 'Avg to Pharmacy', value: resource.nearest_pharmacy_miles_avg, unit: ' mi' },
                { label: 'Avg to SS Office', value: resource.nearest_social_security_office_miles_avg, unit: ' mi' },
                { label: 'Avg to BH Provider', value: resource.nearest_behavioral_health_provider_miles_avg, unit: ' mi' },
              ].map(item => (
                <div key={item.label}>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="font-semibold">{item.value != null ? `${item.value}${item.unit}` : '—'}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Benefits Enrollment */}
        <Card className="p-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Benefits Enrollment</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
            {[
              { label: 'Medicare', value: county.medicare_enrollees, icon: '🏥' },
              { label: 'Medicaid', value: county.medicaid_enrollees, icon: '🩺' },
              { label: 'Dual-Eligible', value: county.dual_eligible_enrollees, icon: '⚕️' },
              { label: 'Social Security', value: county.social_security_recipients, icon: '🛡️' },
              { label: 'SSI', value: county.ssi_recipients, icon: '💰' },
              { label: 'SNAP', value: county.snap_recipients, icon: '🥗' },
            ].map(item => (
              <div key={item.label} className="bg-muted/40 rounded-lg p-3">
                <p className="text-lg mb-1">{item.icon}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="font-semibold text-base">{item.value != null ? item.value.toLocaleString() : '—'}</p>
                {item.value != null && county.population_total ? (
                  <p className="text-xs text-muted-foreground mt-0.5">{((item.value / county.population_total) * 100).toFixed(1)}% of pop.</p>
                ) : null}
              </div>
            ))}
          </div>
        </Card>

        {/* Veterans */}
        {(county.veterans_population != null || county.nearest_va_facility_miles != null) && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Veterans</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {[
                { label: 'Veteran Population', value: county.veterans_population, icon: '🎖️' },
                { label: 'Veterans 65+', value: county.veterans_65_plus, icon: '👴' },
                { label: 'Service-Connected Disability', value: county.veterans_with_disability, icon: '♿' },
                { label: 'Enrolled in VA Healthcare', value: county.veterans_enrolled_va_healthcare, icon: '🏥' },
                { label: 'VA Disability Recipients', value: county.veterans_va_disability_recipients, icon: '💊' },
                { label: 'VA Pension Recipients', value: county.veterans_pension_recipients, icon: '💰' },
                { label: 'VA Facilities in County', value: county.number_of_va_facilities, icon: '🏛️' },
                { label: 'Miles to Nearest VA', value: county.nearest_va_facility_miles != null ? `${county.nearest_va_facility_miles} mi` : null, icon: '📍', raw: true },
              ].map(item => (
                <div key={item.label} className="bg-muted/40 rounded-lg p-3">
                  <p className="text-lg mb-1">{item.icon}</p>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="font-semibold text-base">
                    {item.raw ? (item.value ?? '—') : (item.value != null ? item.value.toLocaleString() : '—')}
                  </p>
                  {!item.raw && item.value != null && county.population_total ? (
                    <p className="text-xs text-muted-foreground mt-0.5">{((item.value / county.population_total) * 100).toFixed(1)}% of pop.</p>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Facilities & Businesses */}
        <FacilityList countyId={countyId} countyState={county.state_abbreviation} />

        {/* Operational Data */}
        {ops && (
          <Card className="p-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Operational Service Data</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 text-sm">
              {[
                { label: 'Active Clients', value: ops.active_client_count },
                { label: 'High-Need Clients', value: ops.high_need_client_count },
                { label: 'Active Caregivers', value: ops.caregiver_count_active },
                { label: 'Auth Hours', value: ops.authorized_hours_total?.toLocaleString() },
                { label: 'Staffed Hours', value: ops.staffed_hours_total?.toLocaleString() },
                { label: 'Unstaffed Hours', value: ops.unstaffed_hours_total?.toLocaleString() },
                { label: 'Missed Visits', value: ops.missed_visit_count },
                { label: 'Referral-to-Start', value: ops.average_referral_to_start_days ? `${ops.average_referral_to_start_days}d` : '—' },
                { label: 'Transport Barriers', value: ops.transportation_barrier_count },
                { label: 'BH Flagged', value: ops.behavioral_health_flagged_client_count },
              ].map(item => (
                <div key={item.label}>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="font-semibold">{item.value ?? '—'}</p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}