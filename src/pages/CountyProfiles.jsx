import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import RiskScoreBadge from '@/components/shared/RiskScoreBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, MapPin } from 'lucide-react';
import { getRiskLevel } from '@/lib/scoringEngine';

export default function CountyProfiles() {
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('all');

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

  const filtered = counties.filter(c => {
    if (stateFilter !== 'all' && c.state !== stateFilter) return false;
    if (search && !c.county_name.toLowerCase().includes(search.toLowerCase()) && !c.state.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <PageHeader title="County Profiles" description="Browse and search county profiles across the research cohort." />
      <div className="p-8 space-y-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search counties..." className="pl-9 w-72" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All States" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              {states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(c => {
            const score = scoreMap[c.id];
            const risk = score ? getRiskLevel(score.overall_rural_access_risk_score) : null;
            return (
              <Link key={c.id} to={`/county-profiles/${c.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-sm">{c.county_name}</h3>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {c.state_abbreviation}
                        </p>
                      </div>
                      {score && <RiskScoreBadge score={score.overall_rural_access_risk_score} size="sm" showLabel={false} />}
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex justify-between"><span>Population</span><span className="text-foreground">{c.population_total?.toLocaleString() || '—'}</span></div>
                      <div className="flex justify-between"><span>65+</span><span className="text-foreground">{c.population_65_plus?.toLocaleString() || '—'}</span></div>
                      <div className="flex justify-between"><span>Poverty</span><span className="text-foreground">{c.poverty_rate ? `${c.poverty_rate}%` : '—'}</span></div>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-3">
                      {c.pilot_cohort_status === 'pilot' && <Badge className="text-[10px] bg-primary">Pilot</Badge>}
                      {score?.care_desert_flag && <Badge variant="destructive" className="text-[10px]">Care Desert</Badge>}
                      {score?.workforce_crisis_flag && <Badge className="bg-purple-500 text-[10px]">Workforce Crisis</Badge>}
                      {c.appalachian_flag && <Badge variant="outline" className="text-[10px]">Appalachian</Badge>}
                      {c.tribal_connected_flag && <Badge variant="outline" className="text-[10px]">Tribal</Badge>}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}