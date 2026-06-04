import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import RiskScoreBadge from '@/components/shared/RiskScoreBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, ArrowUpDown } from 'lucide-react';

export default function RiskRankings() {
  const [sortBy, setSortBy] = useState('overall_rural_access_risk_score');
  const [stateFilter, setStateFilter] = useState('all');

  const { data: counties = [] } = useQuery({
    queryKey: ['counties'],
    queryFn: () => base44.entities.County.list('-created_date', 200),
  });

  const { data: riskScores = [] } = useQuery({
    queryKey: ['riskScores'],
    queryFn: () => base44.entities.RuralAccessRiskScore.list('-overall_rural_access_risk_score', 200),
  });

  const countyMap = {};
  counties.forEach(c => { countyMap[c.id] = c; });
  const states = [...new Set(counties.map(c => c.state))].sort();

  const ranked = useMemo(() => {
    return riskScores
      .filter(s => {
        const c = countyMap[s.county_id];
        if (!c) return false;
        if (stateFilter !== 'all' && c.state !== stateFilter) return false;
        return true;
      })
      .sort((a, b) => (b[sortBy] || 0) - (a[sortBy] || 0));
  }, [riskScores, sortBy, stateFilter, countyMap]);

  const exportCSV = () => {
    const headers = ['Rank', 'County', 'State', 'FIPS', 'Overall', 'Workforce', 'Provider', 'Transport', 'Discharge', 'Benefits', 'Behavioral', 'Pharmacy', 'Continuity', 'EVV', 'Care Desert', 'Benefits Desert'];
    const rows = ranked.map((s, i) => {
      const c = countyMap[s.county_id];
      return [i + 1, c?.county_name, c?.state_abbreviation, c?.fips_code, s.overall_rural_access_risk_score, s.workforce_shortage_score, s.provider_capacity_score, s.transportation_burden_score, s.hospital_discharge_risk_score, s.benefits_access_score, s.behavioral_health_access_score, s.pharmacy_access_score, s.service_continuity_score, s.evv_documentation_burden_score, s.care_desert_flag, s.benefits_access_desert_flag];
    });
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'risk-rankings.csv'; a.click();
  };

  return (
    <div>
      <PageHeader
        title="Risk Score Rankings"
        description="County rankings by rural access risk score."
        actions={
          <Button onClick={exportCSV} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-1" /> Export CSV
          </Button>
        }
      />
      <div className="p-8 space-y-4">
        <div className="flex flex-wrap gap-3">
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All States" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              {states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="overall_rural_access_risk_score">Overall Risk</SelectItem>
              <SelectItem value="workforce_shortage_score">Workforce Shortage</SelectItem>
              <SelectItem value="provider_capacity_score">Provider Capacity</SelectItem>
              <SelectItem value="transportation_burden_score">Transportation</SelectItem>
              <SelectItem value="hospital_discharge_risk_score">Hospital Discharge</SelectItem>
              <SelectItem value="benefits_access_score">Benefits Access</SelectItem>
              <SelectItem value="behavioral_health_access_score">Behavioral Health</SelectItem>
              <SelectItem value="pharmacy_access_score">Pharmacy Access</SelectItem>
              <SelectItem value="service_continuity_score">Service Continuity</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>County</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Overall</TableHead>
                    <TableHead>Work</TableHead>
                    <TableHead>Prov</TableHead>
                    <TableHead>Trans</TableHead>
                    <TableHead>Disch</TableHead>
                    <TableHead>Ben</TableHead>
                    <TableHead>BH</TableHead>
                    <TableHead>Pharm</TableHead>
                    <TableHead>Cont</TableHead>
                    <TableHead>EVV</TableHead>
                    <TableHead>Flags</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranked.map((s, i) => {
                    const c = countyMap[s.county_id];
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                        <TableCell>
                          <Link to={`/county-profiles/${s.county_id}`} className="font-medium text-primary hover:underline text-sm">
                            {c?.county_name || 'Unknown'}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs">{c?.state_abbreviation}</TableCell>
                        <TableCell><RiskScoreBadge score={s.overall_rural_access_risk_score} size="sm" showLabel={false} /></TableCell>
                        <TableCell className="text-xs">{s.workforce_shortage_score}</TableCell>
                        <TableCell className="text-xs">{s.provider_capacity_score}</TableCell>
                        <TableCell className="text-xs">{s.transportation_burden_score}</TableCell>
                        <TableCell className="text-xs">{s.hospital_discharge_risk_score}</TableCell>
                        <TableCell className="text-xs">{s.benefits_access_score}</TableCell>
                        <TableCell className="text-xs">{s.behavioral_health_access_score}</TableCell>
                        <TableCell className="text-xs">{s.pharmacy_access_score}</TableCell>
                        <TableCell className="text-xs">{s.service_continuity_score}</TableCell>
                        <TableCell className="text-xs">{s.evv_documentation_burden_score}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {s.care_desert_flag && <Badge variant="destructive" className="text-[9px] px-1">CD</Badge>}
                            {s.benefits_access_desert_flag && <Badge className="bg-orange-500 text-[9px] px-1">BD</Badge>}
                            {s.workforce_crisis_flag && <Badge className="bg-purple-500 text-[9px] px-1">WC</Badge>}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}