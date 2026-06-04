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
import { ShieldCheck, MapPin, Users, AlertTriangle, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getRiskColor } from '@/lib/scoringEngine';

export default function BenefitsAccess() {
  const [stateFilter, setStateFilter] = useState('all');

  const { data: counties = [] } = useQuery({
    queryKey: ['counties'],
    queryFn: () => base44.entities.County.list('-created_date', 200),
  });

  const { data: riskScores = [] } = useQuery({
    queryKey: ['riskScores'],
    queryFn: () => base44.entities.RuralAccessRiskScore.list('-benefits_access_score', 200),
  });

  const { data: resources = [] } = useQuery({
    queryKey: ['resources'],
    queryFn: () => base44.entities.CountyResourceProfile.list('-created_date', 200),
  });

  const { data: opsData = [] } = useQuery({
    queryKey: ['operationalData'],
    queryFn: () => base44.entities.OperationalServiceData.list('-reporting_period_end', 200),
  });

  const countyMap = {};
  counties.forEach(c => { countyMap[c.id] = c; });
  const resourceMap = {};
  resources.forEach(r => { resourceMap[r.county_id] = r; });
  const opsMap = {};
  opsData.forEach(o => { opsMap[o.county_id] = o; });

  const states = [...new Set(counties.map(c => c.state))].sort();

  const filtered = riskScores.filter(s => {
    const county = countyMap[s.county_id];
    if (!county) return false;
    if (stateFilter !== 'all' && county.state !== stateFilter) return false;
    return true;
  });

  const desertCount = filtered.filter(s => s.benefits_access_desert_flag).length;
  const avgScore = filtered.filter(s => s.benefits_access_score != null).length
    ? Math.round(filtered.filter(s => s.benefits_access_score != null).reduce((a, s) => a + s.benefits_access_score, 0) / filtered.filter(s => s.benefits_access_score != null).length)
    : 0;

  const totalBenefitsNavNeed = opsData
    .filter(o => stateFilter === 'all' || countyMap[o.county_id]?.state === stateFilter)
    .reduce((s, o) => s + (o.benefits_navigation_need_count || 0), 0);

  const avgSSMiles = resources.filter(r => r.nearest_social_security_office_miles_avg != null && (stateFilter === 'all' || countyMap[r.county_id]?.state === stateFilter));
  const avgMiles = avgSSMiles.length
    ? (avgSSMiles.reduce((s, r) => s + r.nearest_social_security_office_miles_avg, 0) / avgSSMiles.length).toFixed(1)
    : null;

  const topRisk = [...filtered]
    .sort((a, b) => (b.benefits_access_score || 0) - (a.benefits_access_score || 0))
    .slice(0, 10)
    .map(s => ({
      name: countyMap[s.county_id]?.county_name || 'Unknown',
      score: s.benefits_access_score || 0,
    }));

  return (
    <div>
      <PageHeader
        title="Benefits Access"
        description="Social Security, Medicaid, Area Agency on Aging access and benefits navigation gaps."
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
          <StatCard title="Benefits Deserts" value={desertCount} icon={AlertTriangle} subtitle="Benefits access desert flag" />
          <StatCard title="Avg Benefits Access Score" value={avgScore} icon={ShieldCheck} subtitle="Higher = greater gap" />
          <StatCard title="Avg Miles to SS Office" value={avgMiles != null ? `${avgMiles} mi` : '—'} icon={MapPin} subtitle="Avg distance to nearest SS office" />
          <StatCard title="Benefits Nav Need" value={totalBenefitsNavNeed.toLocaleString()} icon={FileText} subtitle="Identified across cohort" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Top 10 Benefits Access Gap Counties</CardTitle>
            </CardHeader>
            <CardContent>
              {topRisk.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={topRisk} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [`${v}/100`, 'Benefits Access Score']} />
                    <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={18}>
                      {topRisk.map((e, i) => <Cell key={i} fill={getRiskColor(e.score)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">No data available</div>
              )}
            </CardContent>
          </Card>

          <Card className="p-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Enrollment Benchmarks (Cohort Totals)</h3>
            <div className="space-y-3">
              {[
                { label: '🏥 Medicare Enrollees', field: 'medicare_enrollees' },
                { label: '🩺 Medicaid Enrollees', field: 'medicaid_enrollees' },
                { label: '⚕️ Dual-Eligible', field: 'dual_eligible_enrollees' },
                { label: '🛡️ Social Security Recipients', field: 'social_security_recipients' },
                { label: '💰 SSI Recipients', field: 'ssi_recipients' },
                { label: '🥗 SNAP Recipients', field: 'snap_recipients' },
              ].map(item => {
                const total = counties
                  .filter(c => stateFilter === 'all' || c.state === stateFilter)
                  .reduce((s, c) => s + (c[item.field] || 0), 0);
                return (
                  <div key={item.label} className="flex items-center justify-between py-1 border-b border-border last:border-0">
                    <span className="text-sm">{item.label}</span>
                    <span className="font-semibold text-sm">{total > 0 ? total.toLocaleString() : '—'}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">County Benefits Access Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>County</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Access Score</TableHead>
                  <TableHead>SS Offices</TableHead>
                  <TableHead>Miles to SS</TableHead>
                  <TableHead>AAA Count</TableHead>
                  <TableHead>Benefits Nav Need</TableHead>
                  <TableHead>Auth Delay (days)</TableHead>
                  <TableHead>Desert Flag</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered
                  .sort((a, b) => (b.benefits_access_score || 0) - (a.benefits_access_score || 0))
                  .map(s => {
                    const county = countyMap[s.county_id];
                    const res = resourceMap[s.county_id];
                    const ops = opsMap[s.county_id];
                    return (
                      <TableRow key={s.id}>
                        <TableCell>
                          <Link to={`/county-profiles/${s.county_id}`} className="font-medium text-primary hover:underline">{county.county_name}</Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">{county.state_abbreviation}</TableCell>
                        <TableCell>
                          <span className={`font-medium ${(s.benefits_access_score || 0) >= 70 ? 'text-red-600' : (s.benefits_access_score || 0) >= 40 ? 'text-amber-600' : 'text-green-600'}`}>
                            {s.benefits_access_score ?? '—'}
                          </span>
                        </TableCell>
                        <TableCell>{res?.number_of_social_security_offices ?? '—'}</TableCell>
                        <TableCell>{res?.nearest_social_security_office_miles_avg != null ? `${res.nearest_social_security_office_miles_avg} mi` : '—'}</TableCell>
                        <TableCell>{res?.number_of_area_agencies_on_aging ?? '—'}</TableCell>
                        <TableCell>{ops?.benefits_navigation_need_count ?? '—'}</TableCell>
                        <TableCell>{ops?.average_authorization_delay_days != null ? `${ops.average_authorization_delay_days}d` : '—'}</TableCell>
                        <TableCell>
                          {s.benefits_access_desert_flag
                            ? <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-xs">Desert</Badge>
                            : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}