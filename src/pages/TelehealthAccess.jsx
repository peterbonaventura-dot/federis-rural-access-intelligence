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
import { Wifi, WifiOff, Monitor, Radio, BookOpen, AlertTriangle, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ScatterChart, Scatter, CartesianGrid } from 'recharts';

function ScorePill({ score, inverse = false }) {
  if (score == null) return <span className="text-muted-foreground text-xs">—</span>;
  const s = Number(score);
  let cls = 'bg-blue-100 text-blue-700';
  if (!inverse) {
    if (s >= 75) cls = 'bg-green-100 text-green-700';
    else if (s >= 50) cls = 'bg-amber-100 text-amber-700';
    else cls = 'bg-red-100 text-red-700';
  } else {
    if (s >= 75) cls = 'bg-red-100 text-red-700';
    else if (s >= 50) cls = 'bg-amber-100 text-amber-700';
    else cls = 'bg-green-100 text-green-700';
  }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{s}</span>;
}

export default function TelehealthAccess() {
  const [stateFilter, setStateFilter] = useState('all');

  const { data: counties = [] } = useQuery({
    queryKey: ['counties'],
    queryFn: () => base44.entities.County.list('-created_date', 200),
  });

  const { data: telehealthProfiles = [] } = useQuery({
    queryKey: ['telehealthProfiles'],
    queryFn: () => base44.entities.TelehealthResourceProfile.list('-telehealth_gap_score', 200),
  });

  const { data: riskScores = [] } = useQuery({
    queryKey: ['riskScores'],
    queryFn: () => base44.entities.RuralAccessRiskScore.list('-overall_rural_access_risk_score', 200),
  });

  const countyMap = {};
  counties.forEach(c => { countyMap[c.id] = c; });
  const riskMap = {};
  riskScores.forEach(s => { riskMap[s.county_id] = s; });

  const states = [...new Set(counties.map(c => c.state))].sort();

  const filteredProfiles = telehealthProfiles.filter(p => {
    const county = countyMap[p.county_id];
    if (!county) return false;
    if (stateFilter !== 'all' && county.state !== stateFilter) return false;
    return true;
  });

  // Summary stats
  const withBroadband = filteredProfiles.filter(p => p.broadband_availability_rate != null);
  const avgBroadband = withBroadband.length
    ? Math.round(withBroadband.reduce((s, p) => s + p.broadband_availability_rate, 0) / withBroadband.length)
    : null;
  const priorityCounties = filteredProfiles.filter(p => p.telehealth_priority_county_flag).length;
  const avgReadiness = filteredProfiles.filter(p => p.telehealth_readiness_score != null).length
    ? Math.round(filteredProfiles.filter(p => p.telehealth_readiness_score != null).reduce((s, p) => s + p.telehealth_readiness_score, 0) / filteredProfiles.filter(p => p.telehealth_readiness_score != null).length)
    : null;
  const avgGap = filteredProfiles.filter(p => p.telehealth_gap_score != null).length
    ? Math.round(filteredProfiles.filter(p => p.telehealth_gap_score != null).reduce((s, p) => s + p.telehealth_gap_score, 0) / filteredProfiles.filter(p => p.telehealth_gap_score != null).length)
    : null;

  // Bar chart: top 10 highest gap counties
  const topGapCounties = [...filteredProfiles]
    .filter(p => p.telehealth_gap_score != null && countyMap[p.county_id])
    .sort((a, b) => b.telehealth_gap_score - a.telehealth_gap_score)
    .slice(0, 10)
    .map(p => ({
      name: countyMap[p.county_id]?.county_name || 'Unknown',
      gap: p.telehealth_gap_score,
      readiness: p.telehealth_readiness_score || 0,
    }));

  // Scatter: readiness vs gap
  const scatterData = filteredProfiles
    .filter(p => p.telehealth_readiness_score != null && p.telehealth_gap_score != null)
    .map(p => ({
      x: p.telehealth_readiness_score,
      y: p.telehealth_gap_score,
      name: countyMap[p.county_id]?.county_name,
    }));

  return (
    <div>
      <PageHeader
        title="Telehealth Access"
        description="Telehealth readiness, gap analysis, and digital access across the research cohort."
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
          <StatCard title="Avg Broadband Access" value={avgBroadband != null ? `${avgBroadband}%` : '—'} icon={Wifi} subtitle="Of county population" />
          <StatCard title="Avg Readiness Score" value={avgReadiness ?? '—'} icon={Monitor} subtitle="Higher = more ready (0-100)" />
          <StatCard title="Avg Gap Score" value={avgGap ?? '—'} icon={WifiOff} subtitle="Higher = greater unmet need" />
          <StatCard title="Priority Counties" value={priorityCounties} icon={AlertTriangle} subtitle="Flagged for telehealth priority" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Top 10 Highest Telehealth Gap Counties
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topGapCounties.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={topGapCounties} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v, n) => [`${v}`, n === 'gap' ? 'Gap Score' : 'Readiness Score']} />
                    <Bar dataKey="gap" fill="#ea580c" radius={[0, 4, 4, 0]} barSize={16} name="gap" />
                    <Bar dataKey="readiness" fill="#2563eb" radius={[0, 4, 4, 0]} barSize={16} name="readiness" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">No telehealth data available</div>
              )}
              <div className="flex gap-4 mt-2 text-xs">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-500 inline-block" /> Gap Score (higher = greater need)</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-600 inline-block" /> Readiness Score (higher = more ready)</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Readiness vs. Gap (Quadrant View)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {scatterData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" dataKey="x" name="Readiness" domain={[0, 100]} tick={{ fontSize: 11 }} label={{ value: 'Readiness →', position: 'insideBottom', offset: -5, fontSize: 11 }} />
                    <YAxis type="number" dataKey="y" name="Gap" domain={[0, 100]} tick={{ fontSize: 11 }} label={{ value: '← Gap', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ payload }) => {
                      if (!payload?.length) return null;
                      const d = payload[0]?.payload;
                      return (
                        <div className="bg-white border border-border rounded p-2 text-xs shadow">
                          <p className="font-semibold">{d?.name}</p>
                          <p>Readiness: {d?.x}</p>
                          <p>Gap: {d?.y}</p>
                        </div>
                      );
                    }} />
                    <Scatter data={scatterData} fill="#ea580c" fillOpacity={0.7} />
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">No data available</div>
              )}
              <p className="text-xs text-muted-foreground mt-2">Upper-left = High need, Low readiness (priority intervention zone)</p>
            </CardContent>
          </Card>
        </div>

        {/* Rankings Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              County Telehealth Rankings
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredProfiles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No telehealth profiles found. Add data via County Profiles or Data Sources.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>County</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Broadband %</TableHead>
                    <TableHead>No Internet %</TableHead>
                    <TableHead>Readiness</TableHead>
                    <TableHead>Gap Score</TableHead>
                    <TableHead>BH Telehealth</TableHead>
                    <TableHead>Libraries</TableHead>
                    <TableHead>RPM Programs</TableHead>
                    <TableHead>Priority</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProfiles
                    .filter(p => countyMap[p.county_id])
                    .sort((a, b) => (b.telehealth_gap_score || 0) - (a.telehealth_gap_score || 0))
                    .map(p => {
                      const county = countyMap[p.county_id];
                      return (
                        <TableRow key={p.id}>
                          <TableCell>
                            <Link to={`/county-profiles/${p.county_id}`} className="font-medium text-primary hover:underline">
                              {county.county_name}
                            </Link>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">{county.state_abbreviation}</TableCell>
                          <TableCell>{p.broadband_availability_rate != null ? `${p.broadband_availability_rate}%` : '—'}</TableCell>
                          <TableCell>{p.household_no_internet_rate != null ? `${p.household_no_internet_rate}%` : '—'}</TableCell>
                          <TableCell><ScorePill score={p.telehealth_readiness_score} /></TableCell>
                          <TableCell><ScorePill score={p.telehealth_gap_score} inverse /></TableCell>
                          <TableCell>{p.number_of_behavioral_health_telehealth_providers ?? '—'}</TableCell>
                          <TableCell>{p.number_of_libraries_with_public_internet ?? '—'}</TableCell>
                          <TableCell>{p.number_of_remote_patient_monitoring_programs ?? '—'}</TableCell>
                          <TableCell>
                            {p.telehealth_priority_county_flag
                              ? <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-xs">Priority</Badge>
                              : <span className="text-muted-foreground text-xs">—</span>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Digital Access Cards */}
        {filteredProfiles.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Radio className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold">Connectivity Summary</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg broadband availability</span>
                  <span className="font-medium">{avgBroadband != null ? `${avgBroadband}%` : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Counties below 60% broadband</span>
                  <span className="font-medium text-red-600">{filteredProfiles.filter(p => p.broadband_availability_rate != null && p.broadband_availability_rate < 60).length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Counties w/ transport flag</span>
                  <span className="font-medium">{filteredProfiles.filter(p => p.telehealth_can_reduce_transportation_burden_flag).length}</span>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Monitor className="w-4 h-4 text-secondary" />
                <h3 className="text-sm font-semibold">Telehealth Provider Access</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total BH telehealth providers</span>
                  <span className="font-medium">{filteredProfiles.reduce((s, p) => s + (p.number_of_behavioral_health_telehealth_providers || 0), 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total FQHC telehealth</span>
                  <span className="font-medium">{filteredProfiles.reduce((s, p) => s + (p.number_of_fqhcs_offering_telehealth || 0), 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total RPM programs</span>
                  <span className="font-medium">{filteredProfiles.reduce((s, p) => s + (p.number_of_remote_patient_monitoring_programs || 0), 0)}</span>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-semibold">Community Access Points</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Libraries w/ public internet</span>
                  <span className="font-medium">{filteredProfiles.reduce((s, p) => s + (p.number_of_libraries_with_public_internet || 0), 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Community centers w/ internet</span>
                  <span className="font-medium">{filteredProfiles.reduce((s, p) => s + (p.number_of_community_centers_with_internet || 0), 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Digital literacy need (avg %)</span>
                  <span className="font-medium">
                    {filteredProfiles.filter(p => p.estimated_digital_literacy_need_rate).length
                      ? `${Math.round(filteredProfiles.filter(p => p.estimated_digital_literacy_need_rate).reduce((s, p) => s + p.estimated_digital_literacy_need_rate, 0) / filteredProfiles.filter(p => p.estimated_digital_literacy_need_rate).length)}%`
                      : '—'}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}