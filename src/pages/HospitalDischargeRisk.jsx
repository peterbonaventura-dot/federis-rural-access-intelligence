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
import { Hospital, Clock, AlertTriangle, TrendingUp, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getRiskColor } from '@/lib/scoringEngine';

export default function HospitalDischargeRisk() {
  const [stateFilter, setStateFilter] = useState('all');

  const { data: counties = [] } = useQuery({
    queryKey: ['counties'],
    queryFn: () => base44.entities.County.list('-created_date', 200),
  });

  const { data: riskScores = [] } = useQuery({
    queryKey: ['riskScores'],
    queryFn: () => base44.entities.RuralAccessRiskScore.list('-hospital_discharge_risk_score', 200),
  });

  const { data: opsData = [] } = useQuery({
    queryKey: ['operationalData'],
    queryFn: () => base44.entities.OperationalServiceData.list('-reporting_period_end', 200),
  });

  const { data: resources = [] } = useQuery({
    queryKey: ['resources'],
    queryFn: () => base44.entities.CountyResourceProfile.list('-created_date', 200),
  });

  const countyMap = {};
  counties.forEach(c => { countyMap[c.id] = c; });
  const opsMap = {};
  opsData.forEach(o => { opsMap[o.county_id] = o; });
  const resourceMap = {};
  resources.forEach(r => { resourceMap[r.county_id] = r; });

  const states = [...new Set(counties.map(c => c.state))].sort();

  const filtered = riskScores.filter(s => {
    const county = countyMap[s.county_id];
    if (!county) return false;
    if (stateFilter !== 'all' && county.state !== stateFilter) return false;
    return true;
  });

  const flaggedCount = filtered.filter(s => s.hospital_discharge_risk_flag).length;
  const avgDischargeScore = filtered.filter(s => s.hospital_discharge_risk_score != null).length
    ? Math.round(filtered.filter(s => s.hospital_discharge_risk_score != null).reduce((a, s) => a + s.hospital_discharge_risk_score, 0) / filtered.filter(s => s.hospital_discharge_risk_score != null).length)
    : 0;

  const avgDaysToStart = opsData.filter(o => o.hospital_discharge_to_start_avg_days != null && (stateFilter === 'all' || countyMap[o.county_id]?.state === stateFilter));
  const avgDays = avgDaysToStart.length
    ? (avgDaysToStart.reduce((s, o) => s + o.hospital_discharge_to_start_avg_days, 0) / avgDaysToStart.length).toFixed(1)
    : null;

  const totalDischargeReferrals = opsData
    .filter(o => stateFilter === 'all' || countyMap[o.county_id]?.state === stateFilter)
    .reduce((s, o) => s + (o.hospital_discharge_referral_count || 0), 0);

  const topRisk = [...filtered]
    .sort((a, b) => (b.hospital_discharge_risk_score || 0) - (a.hospital_discharge_risk_score || 0))
    .slice(0, 10)
    .map(s => ({
      name: countyMap[s.county_id]?.county_name || 'Unknown',
      score: s.hospital_discharge_risk_score || 0,
    }));

  return (
    <div>
      <PageHeader
        title="Hospital Discharge Risk"
        description="Post-acute transition gaps, referral-to-start delays, and HCBS discharge coordination risk."
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
          <StatCard title="Flagged Counties" value={flaggedCount} icon={AlertTriangle} subtitle="Discharge risk flag active" />
          <StatCard title="Avg Discharge Risk Score" value={avgDischargeScore} icon={Hospital} subtitle="Out of 100" />
          <StatCard title="Avg Days: Discharge → Start" value={avgDays ?? '—'} icon={Clock} subtitle="Days from discharge to HCBS start" />
          <StatCard title="Total Discharge Referrals" value={totalDischargeReferrals.toLocaleString()} icon={Users} subtitle="Across filtered counties" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Top 10 Discharge Risk Counties</CardTitle>
            </CardHeader>
            <CardContent>
              {topRisk.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={topRisk} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [`${v}/100`, 'Discharge Risk Score']} />
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
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Discharge-to-HCBS Delay by County</h3>
            <div className="space-y-2">
              {opsData
                .filter(o => o.hospital_discharge_to_start_avg_days != null && countyMap[o.county_id] && (stateFilter === 'all' || countyMap[o.county_id]?.state === stateFilter))
                .sort((a, b) => b.hospital_discharge_to_start_avg_days - a.hospital_discharge_to_start_avg_days)
                .slice(0, 10)
                .map(o => {
                  const county = countyMap[o.county_id];
                  const days = o.hospital_discharge_to_start_avg_days;
                  const urgency = days >= 14 ? 'text-red-600 bg-red-50' : days >= 7 ? 'text-amber-600 bg-amber-50' : 'text-green-600 bg-green-50';
                  return (
                    <div key={o.id} className="flex items-center justify-between py-1.5">
                      <Link to={`/county-profiles/${o.county_id}`} className="text-sm font-medium text-primary hover:underline">
                        {county.county_name}, {county.state_abbreviation}
                      </Link>
                      <div className="flex gap-3 items-center text-xs">
                        <span className={`px-2 py-0.5 rounded font-medium ${urgency}`}>{days} days</span>
                        <span className="text-muted-foreground">{o.hospital_discharge_referral_count || 0} referrals</span>
                      </div>
                    </div>
                  );
                })}
              {opsData.filter(o => o.hospital_discharge_to_start_avg_days != null).length === 0 && (
                <p className="text-muted-foreground text-sm text-center py-4">No discharge delay data available</p>
              )}
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">County Discharge Risk Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>County</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Discharge Risk Score</TableHead>
                  <TableHead>Discharge Referrals</TableHead>
                  <TableHead>Avg Days to Start</TableHead>
                  <TableHead>ER Referrals</TableHead>
                  <TableHead>Unstaffed Hrs</TableHead>
                  <TableHead>Hospitals</TableHead>
                  <TableHead>HCBS Providers</TableHead>
                  <TableHead>Flag</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered
                  .sort((a, b) => (b.hospital_discharge_risk_score || 0) - (a.hospital_discharge_risk_score || 0))
                  .map(s => {
                    const county = countyMap[s.county_id];
                    const ops = opsMap[s.county_id];
                    const res = resourceMap[s.county_id];
                    return (
                      <TableRow key={s.id}>
                        <TableCell>
                          <Link to={`/county-profiles/${s.county_id}`} className="font-medium text-primary hover:underline">{county.county_name}</Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">{county.state_abbreviation}</TableCell>
                        <TableCell>
                          <span className={`font-medium ${(s.hospital_discharge_risk_score || 0) >= 65 ? 'text-red-600' : (s.hospital_discharge_risk_score || 0) >= 40 ? 'text-amber-600' : 'text-green-600'}`}>
                            {s.hospital_discharge_risk_score ?? '—'}
                          </span>
                        </TableCell>
                        <TableCell>{ops?.hospital_discharge_referral_count ?? '—'}</TableCell>
                        <TableCell>{ops?.hospital_discharge_to_start_avg_days != null ? `${ops.hospital_discharge_to_start_avg_days}d` : '—'}</TableCell>
                        <TableCell>{ops?.emergency_room_referral_count ?? '—'}</TableCell>
                        <TableCell>{ops?.unstaffed_hours_total?.toLocaleString() ?? '—'}</TableCell>
                        <TableCell>{res?.number_of_hospitals ?? '—'}</TableCell>
                        <TableCell>{res?.number_of_hcbs_providers ?? '—'}</TableCell>
                        <TableCell>
                          {s.hospital_discharge_risk_flag
                            ? <Badge variant="destructive" className="text-xs">Risk</Badge>
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