import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import RiskScoreBadge from '@/components/shared/RiskScoreBadge';
import ScoreBar from '@/components/shared/ScoreBar';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getRiskColor, SCORE_CATEGORIES } from '@/lib/scoringEngine';

export default function StateAnalysis() {
  const [selectedState, setSelectedState] = useState('');

  const { data: counties = [] } = useQuery({
    queryKey: ['counties'],
    queryFn: () => base44.entities.County.list('-created_date', 200),
  });

  const { data: riskScores = [] } = useQuery({
    queryKey: ['riskScores'],
    queryFn: () => base44.entities.RuralAccessRiskScore.list('-overall_rural_access_risk_score', 200),
  });

  const scoreMap = {};
  riskScores.forEach(s => { scoreMap[s.county_id] = s; });

  const states = [...new Set(counties.map(c => c.state))].sort();
  const effectiveState = selectedState || states[0] || '';

  const stateCounties = useMemo(() => {
    return counties
      .filter(c => c.state === effectiveState)
      .map(c => ({ ...c, riskScore: scoreMap[c.id] }))
      .sort((a, b) => (b.riskScore?.overall_rural_access_risk_score || 0) - (a.riskScore?.overall_rural_access_risk_score || 0));
  }, [counties, effectiveState, scoreMap]);

  const chartData = stateCounties.map(c => ({
    name: c.county_name,
    score: c.riskScore?.overall_rural_access_risk_score || 0,
  }));

  const stateAvgs = useMemo(() => {
    const scores = stateCounties.filter(c => c.riskScore);
    if (!scores.length) return null;
    const avg = (key) => Math.round(scores.reduce((a, c) => a + (c.riskScore[key] || 0), 0) / scores.length);
    return {
      overall: avg('overall_rural_access_risk_score'),
      categories: SCORE_CATEGORIES.map(cat => ({
        ...cat,
        avg: avg(cat.key),
      })),
    };
  }, [stateCounties]);

  return (
    <div>
      <PageHeader
        title="State Analysis"
        description="Compare counties within a state, track risk trends, and analyze provider capacity vs. consumer need."
        actions={
          <Select value={effectiveState} onValueChange={setSelectedState}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Select State" />
            </SelectTrigger>
            <SelectContent>
              {states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />

      <div className="p-8 space-y-6">
        {!effectiveState ? (
          <div className="text-center py-20 text-muted-foreground">Select a state to begin analysis</div>
        ) : (
          <>
            {/* State Summary */}
            {stateAvgs && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="p-6 flex items-center gap-4">
                  <RiskScoreBadge score={stateAvgs.overall} size="xl" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">State Average Risk</p>
                    <p className="text-lg font-bold">{effectiveState}</p>
                    <p className="text-xs text-muted-foreground">{stateCounties.length} counties in cohort</p>
                  </div>
                </Card>
                <Card className="lg:col-span-2 p-6">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Risk Breakdown
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {stateAvgs.categories.map(cat => (
                      <ScoreBar key={cat.key} label={cat.label} score={cat.avg} weight={cat.weight} />
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {/* County Ranking Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  County Risk Rankings — {effectiveState}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 40)}>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [`${v}/100`, 'Risk Score']} />
                    <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={22}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={getRiskColor(entry.score)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* County Table */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  County Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>County</TableHead>
                      <TableHead>Risk Score</TableHead>
                      <TableHead>Population</TableHead>
                      <TableHead>Poverty Rate</TableHead>
                      <TableHead>Flags</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stateCounties.map(c => (
                      <TableRow key={c.id} className="hover:bg-muted/50">
                        <TableCell>
                          <Link to={`/county-profiles/${c.id}`} className="font-medium text-primary hover:underline">
                            {c.county_name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {c.riskScore ? (
                            <RiskScoreBadge score={c.riskScore.overall_rural_access_risk_score} size="sm" />
                          ) : (
                            <span className="text-xs text-muted-foreground">No score</span>
                          )}
                        </TableCell>
                        <TableCell>{c.population_total?.toLocaleString() || '—'}</TableCell>
                        <TableCell>{c.poverty_rate ? `${c.poverty_rate}%` : '—'}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {c.riskScore?.care_desert_flag && <Badge variant="destructive" className="text-[10px]">Care Desert</Badge>}
                            {c.riskScore?.workforce_crisis_flag && <Badge className="bg-purple-500 text-[10px]">Workforce Crisis</Badge>}
                            {c.appalachian_flag && <Badge variant="outline" className="text-[10px]">Appalachian</Badge>}
                            {c.tribal_connected_flag && <Badge variant="outline" className="text-[10px]">Tribal</Badge>}
                            {c.frontier_flag && <Badge variant="outline" className="text-[10px]">Frontier</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px]">{c.pilot_cohort_status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}