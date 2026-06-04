import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/shared/StatCard';
import RiskScoreBadge from '@/components/shared/RiskScoreBadge';
import ScoreBar from '@/components/shared/ScoreBar';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  MapPin, Users, AlertTriangle, Activity, TrendingUp,
  Building, ArrowRight, Shield, Globe, BarChart3, RefreshCw
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getRiskColor, SCORE_CATEGORIES } from '@/lib/scoringEngine';

export default function Overview() {
  const { data: counties = [] } = useQuery({
    queryKey: ['counties'],
    queryFn: () => base44.entities.County.list('-created_date', 100),
  });

  const { data: riskScores = [] } = useQuery({
    queryKey: ['riskScores'],
    queryFn: () => base44.entities.RuralAccessRiskScore.list('-overall_rural_access_risk_score', 100),
  });

  const pilotCounties = counties.filter(c => c.pilot_cohort_status === 'pilot');
  const careDeserts = riskScores.filter(s => s.care_desert_flag);
  const criticalCounties = riskScores.filter(s => s.overall_rural_access_risk_score >= 75);
  const avgScore = riskScores.length
    ? Math.round(riskScores.reduce((a, s) => a + (s.overall_rural_access_risk_score || 0), 0) / riskScores.length)
    : 0;

  const countyMap = {};
  counties.forEach(c => { countyMap[c.id] = c; });

  const topRiskCounties = riskScores
    .filter(s => countyMap[s.county_id])
    .sort((a, b) => (b.overall_rural_access_risk_score || 0) - (a.overall_rural_access_risk_score || 0))
    .slice(0, 10);

  const chartData = topRiskCounties.map(s => ({
    name: countyMap[s.county_id]?.county_name || 'Unknown',
    score: s.overall_rural_access_risk_score || 0,
  }));

  const avgSubscores = SCORE_CATEGORIES.map(cat => {
    const vals = riskScores.map(s => s[cat.key] || 0);
    const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
    return { ...cat, avg };
  });

  return (
    <div>
      <PageHeader
        title="Rural Access Intelligence"
        description="Analyzing rural health access barriers across the research cohort to identify care deserts, workforce gaps, and intervention opportunities."
        actions={
          <div className="flex gap-2">
            <Link to="/risk-rankings">
              <Button variant="outline" size="sm">
                <BarChart3 className="w-4 h-4 mr-1" /> Rankings
              </Button>
            </Link>
            <Link to="/national-map">
              <Button size="sm">
                <Globe className="w-4 h-4 mr-1" /> National Map
              </Button>
            </Link>
          </div>
        }
      />

      <div className="p-8 space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Pilot Counties" value={pilotCounties.length} subtitle="20-county research cohort" icon={MapPin} />
          <StatCard title="Avg Risk Score" value={avgScore} subtitle="Out of 100 (higher = more risk)" icon={Activity} />
          <StatCard title="Care Deserts" value={careDeserts.length} subtitle="Counties with critical gaps" icon={AlertTriangle} />
          <StatCard title="Critical Risk" value={criticalCounties.length} subtitle="Score ≥ 75" icon={Shield} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Risk Counties Chart */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Highest Risk Counties
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [`${v}/100`, 'Risk Score']} />
                    <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={20}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={getRiskColor(entry.score)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[320px] flex items-center justify-center text-muted-foreground text-sm">
                  No risk scores calculated yet
                </div>
              )}
            </CardContent>
          </Card>

          {/* Score Category Averages */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Risk Category Averages
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {avgSubscores.map(cat => (
                <ScoreBar key={cat.key} label={cat.label} score={cat.avg} weight={cat.weight} />
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Flags & Alerts */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Care Deserts', count: careDeserts.length, color: 'bg-red-500' },
            { label: 'Benefits Deserts', count: riskScores.filter(s => s.benefits_access_desert_flag).length, color: 'bg-orange-500' },
            { label: 'Discharge Risk', count: riskScores.filter(s => s.hospital_discharge_risk_flag).length, color: 'bg-amber-500' },
            { label: 'Workforce Crisis', count: riskScores.filter(s => s.workforce_crisis_flag).length, color: 'bg-purple-500' },
          ].map(item => (
            <Card key={item.label} className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${item.color}`} />
                <div>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-xl font-bold">{item.count}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Pilot Cohort Quick List */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Pilot Research Cohort
              </CardTitle>
              <Link to="/research-cohort">
                <Button variant="ghost" size="sm">View All <ArrowRight className="w-3 h-3 ml-1" /></Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {pilotCounties.map(c => {
                const score = riskScores.find(s => s.county_id === c.id);
                return (
                  <Link key={c.id} to={`/county-profiles/${c.id}`}>
                    <div className="p-3 rounded-lg border border-border hover:border-primary/30 hover:bg-muted/50 transition-all cursor-pointer">
                      <p className="text-sm font-medium truncate">{c.county_name}</p>
                      <p className="text-xs text-muted-foreground">{c.state_abbreviation}</p>
                      {score && (
                        <div className="mt-1">
                          <RiskScoreBadge score={score.overall_rural_access_risk_score} size="sm" showLabel={false} />
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}