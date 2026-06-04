import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import RiskScoreBadge from '@/components/shared/RiskScoreBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Users, MapPin, Target, AlertTriangle } from 'lucide-react';
import StatCard from '@/components/shared/StatCard';

export default function ResearchCohort() {
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

  const pilot = counties.filter(c => c.pilot_cohort_status === 'pilot');
  const byState = {};
  pilot.forEach(c => {
    if (!byState[c.state]) byState[c.state] = [];
    byState[c.state].push(c);
  });

  const pilotScores = pilot.map(c => scoreMap[c.id]?.overall_rural_access_risk_score).filter(Boolean);
  const avgScore = pilotScores.length ? Math.round(pilotScores.reduce((a, b) => a + b, 0) / pilotScores.length) : 0;
  const careDeserts = pilot.filter(c => scoreMap[c.id]?.care_desert_flag).length;

  return (
    <div>
      <PageHeader
        title="Research Cohort"
        description="The initial 20-county pilot cohort for validating rural access risk scoring."
      />
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard title="Pilot Counties" value={pilot.length} icon={Target} subtitle="Initial cohort" />
          <StatCard title="States" value={Object.keys(byState).length} icon={MapPin} subtitle="Multi-state coverage" />
          <StatCard title="Avg Risk Score" value={avgScore} icon={Users} subtitle="Cohort average" />
          <StatCard title="Care Deserts" value={careDeserts} icon={AlertTriangle} subtitle="In pilot cohort" />
        </div>

        {Object.entries(byState).sort().map(([state, stateCounties]) => (
          <Card key={state}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{state}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>County</TableHead>
                    <TableHead>FIPS</TableHead>
                    <TableHead>Risk Score</TableHead>
                    <TableHead>Population</TableHead>
                    <TableHead>65+</TableHead>
                    <TableHead>Poverty</TableHead>
                    <TableHead>Flags</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stateCounties.sort((a, b) => a.county_name.localeCompare(b.county_name)).map(c => {
                    const s = scoreMap[c.id];
                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <Link to={`/county-profiles/${c.id}`} className="font-medium text-primary hover:underline">
                            {c.county_name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">{c.fips_code}</TableCell>
                        <TableCell>{s ? <RiskScoreBadge score={s.overall_rural_access_risk_score} size="sm" /> : '—'}</TableCell>
                        <TableCell>{c.population_total?.toLocaleString() || '—'}</TableCell>
                        <TableCell>{c.population_65_plus?.toLocaleString() || '—'}</TableCell>
                        <TableCell>{c.poverty_rate ? `${c.poverty_rate}%` : '—'}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {s?.care_desert_flag && <Badge variant="destructive" className="text-[10px]">Care Desert</Badge>}
                            {s?.workforce_crisis_flag && <Badge className="bg-purple-500 text-[10px]">Workforce</Badge>}
                            {c.appalachian_flag && <Badge variant="outline" className="text-[10px]">Appalachian</Badge>}
                            {c.tribal_connected_flag && <Badge variant="outline" className="text-[10px]">Tribal</Badge>}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}