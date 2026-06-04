import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import StatCard from '@/components/shared/StatCard';
import { Users, TrendingDown, DollarSign, GraduationCap, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getRiskColor } from '@/lib/scoringEngine';

export default function WorkforceCapacity() {
  const [stateFilter, setStateFilter] = useState('all');

  const { data: counties = [] } = useQuery({
    queryKey: ['counties'],
    queryFn: () => base44.entities.County.list('-created_date', 200),
  });

  const { data: workforceProfiles = [] } = useQuery({
    queryKey: ['workforceProfiles'],
    queryFn: () => base44.entities.WorkforceProfile.list('-workforce_shortage_score', 200),
  });

  const { data: riskScores = [] } = useQuery({
    queryKey: ['riskScores'],
    queryFn: () => base44.entities.RuralAccessRiskScore.list('-overall_rural_access_risk_score', 200),
  });

  const { data: opsData = [] } = useQuery({
    queryKey: ['operationalData'],
    queryFn: () => base44.entities.OperationalServiceData.list('-reporting_period_end', 200),
  });

  const countyMap = {};
  counties.forEach(c => { countyMap[c.id] = c; });
  const riskMap = {};
  riskScores.forEach(s => { riskMap[s.county_id] = s; });
  const opsMap = {};
  opsData.forEach(o => { opsMap[o.county_id] = o; });

  const states = [...new Set(counties.map(c => c.state))].sort();

  const filteredProfiles = workforceProfiles.filter(p => {
    const county = countyMap[p.county_id];
    if (!county) return false;
    if (stateFilter !== 'all' && county.state !== stateFilter) return false;
    return true;
  });

  // Stats
  const crisis = riskScores.filter(s => s.workforce_crisis_flag).length;
  const avgTurnover = filteredProfiles.filter(p => p.caregiver_turnover_rate != null).length
    ? Math.round(filteredProfiles.filter(p => p.caregiver_turnover_rate != null).reduce((s, p) => s + p.caregiver_turnover_rate, 0) / filteredProfiles.filter(p => p.caregiver_turnover_rate != null).length)
    : null;
  const totalActiveCaregiver = filteredProfiles.reduce((s, p) => s + (p.active_caregiver_count || 0), 0);
  const totalTrainingPrograms = filteredProfiles.reduce((s, p) =>
    s + (p.number_of_cna_training_programs || 0) + (p.number_of_hha_training_programs || 0) + (p.number_of_dsp_training_programs || 0), 0);

  // Bar chart top shortage counties
  const topShortage = [...riskScores]
    .filter(s => countyMap[s.county_id] && (stateFilter === 'all' || countyMap[s.county_id]?.state === stateFilter))
    .sort((a, b) => (b.workforce_shortage_score || 0) - (a.workforce_shortage_score || 0))
    .slice(0, 10)
    .map(s => ({
      name: countyMap[s.county_id]?.county_name || 'Unknown',
      score: s.workforce_shortage_score || 0,
    }));

  return (
    <div>
      <PageHeader
        title="Workforce Capacity"
        description="Caregiver supply, turnover, wage gaps, and training infrastructure across the research cohort."
        actions={
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All States" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              {states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Workforce Crisis Counties" value={crisis} icon={AlertTriangle} subtitle="Score ≥ 75 on shortage" />
          <StatCard title="Avg Caregiver Turnover" value={avgTurnover != null ? `${avgTurnover}%` : '—'} icon={TrendingDown} subtitle="Annual rate across cohort" />
          <StatCard title="Total Active Caregivers" value={totalActiveCaregiver.toLocaleString()} icon={Users} subtitle="Across workforce profiles" />
          <StatCard title="Training Programs" value={totalTrainingPrograms} icon={GraduationCap} subtitle="CNA, HHA, DSP combined" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Top 10 Workforce Shortage Counties
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topShortage.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={topShortage} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [`${v}/100`, 'Shortage Score']} />
                    <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={18}>
                      {topShortage.map((e, i) => <Cell key={i} fill={getRiskColor(e.score)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">No risk scores available</div>
              )}
            </CardContent>
          </Card>

          <Card className="p-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Operational Workforce Metrics</h3>
            <div className="space-y-3">
              {opsData.filter(o => stateFilter === 'all' || countyMap[o.county_id]?.state === stateFilter).slice(0, 8).map(o => {
                const county = countyMap[o.county_id];
                if (!county) return null;
                const unstaffedPct = o.authorized_hours_total
                  ? Math.round((o.unstaffed_hours_total / o.authorized_hours_total) * 100)
                  : 0;
                const clientsPerCaregiver = o.caregiver_count_active
                  ? (o.active_client_count / o.caregiver_count_active).toFixed(1)
                  : '—';
                return (
                  <div key={o.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <Link to={`/county-profiles/${o.county_id}`} className="text-sm font-medium text-primary hover:underline">{county.county_name}</Link>
                      <p className="text-xs text-muted-foreground">{county.state_abbreviation}</p>
                    </div>
                    <div className="flex gap-4 text-xs">
                      <div className="text-right">
                        <p className="text-muted-foreground">Clients/Caregiver</p>
                        <p className="font-semibold">{clientsPerCaregiver}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground">Unstaffed %</p>
                        <p className={`font-semibold ${unstaffedPct >= 20 ? 'text-red-600' : unstaffedPct >= 10 ? 'text-amber-600' : 'text-green-600'}`}>
                          {unstaffedPct}%
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground">Missed Visits</p>
                        <p className="font-semibold">{o.missed_visit_count ?? '—'}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Workforce Profiles Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Workforce Profile Details</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredProfiles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No workforce profiles found. Add data via County Profiles.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>County</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Active Caregivers</TableHead>
                    <TableHead>Turnover %</TableHead>
                    <TableHead>Avg Wage</TableHead>
                    <TableHead>Wage Gap</TableHead>
                    <TableHead>Training Programs</TableHead>
                    <TableHead>Shortage Score</TableHead>
                    <TableHead>Recruit. Opportunity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProfiles.map(p => {
                    const county = countyMap[p.county_id];
                    if (!county) return null;
                    const training = (p.number_of_cna_training_programs || 0) + (p.number_of_hha_training_programs || 0) + (p.number_of_dsp_training_programs || 0);
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <Link to={`/county-profiles/${p.county_id}`} className="font-medium text-primary hover:underline">{county.county_name}</Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">{county.state_abbreviation}</TableCell>
                        <TableCell>{p.active_caregiver_count ?? '—'}</TableCell>
                        <TableCell>{p.caregiver_turnover_rate != null ? `${p.caregiver_turnover_rate}%` : '—'}</TableCell>
                        <TableCell>{p.average_caregiver_wage != null ? `$${p.average_caregiver_wage}/hr` : '—'}</TableCell>
                        <TableCell>
                          {p.wage_benchmark_gap != null ? (
                            <span className={p.wage_benchmark_gap > 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
                              {p.wage_benchmark_gap > 0 ? '-' : '+'}${Math.abs(p.wage_benchmark_gap)}/hr
                            </span>
                          ) : '—'}
                        </TableCell>
                        <TableCell>{training || '—'}</TableCell>
                        <TableCell>
                          {p.workforce_shortage_score != null ? (
                            <span className={`font-medium ${p.workforce_shortage_score >= 75 ? 'text-red-600' : p.workforce_shortage_score >= 50 ? 'text-amber-600' : 'text-green-600'}`}>
                              {p.workforce_shortage_score}
                            </span>
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          {p.recruitment_opportunity_score != null ? (
                            <span className={`font-medium ${p.recruitment_opportunity_score >= 60 ? 'text-green-600' : 'text-muted-foreground'}`}>
                              {p.recruitment_opportunity_score}
                            </span>
                          ) : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}