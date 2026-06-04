import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import RiskScoreBadge from '@/components/shared/RiskScoreBadge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { getRiskColor, getRiskLevel } from '@/lib/scoringEngine';
import { Input } from '@/components/ui/input';
import { Search, Filter } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

export default function NationalMap() {
  const [stateFilter, setStateFilter] = useState('all');
  const [cohortFilter, setCohortFilter] = useState('all');
  const [search, setSearch] = useState('');

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

  const filtered = useMemo(() => {
    return counties.filter(c => {
      if (stateFilter !== 'all' && c.state !== stateFilter) return false;
      if (cohortFilter !== 'all' && c.pilot_cohort_status !== cohortFilter) return false;
      if (search && !c.county_name.toLowerCase().includes(search.toLowerCase())) return false;
      return c.latitude && c.longitude;
    });
  }, [counties, stateFilter, cohortFilter, search]);

  return (
    <div>
      <PageHeader
        title="National Map"
        description="Geographic visualization of rural access risk scores across the research cohort."
      />
      <div className="p-8 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search counties..."
              className="pl-9 w-64"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All States" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              {states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={cohortFilter} onValueChange={setCohortFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All Cohorts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cohorts</SelectItem>
              <SelectItem value="pilot">Pilot</SelectItem>
              <SelectItem value="expansion">Expansion</SelectItem>
              <SelectItem value="national">National</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Map + Legend */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Card className="lg:col-span-3 overflow-hidden">
            <div className="h-[600px]">
              <MapContainer
                center={[39.5, -98.5]}
                zoom={4}
                className="h-full w-full"
                scrollWheelZoom={true}
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                  attribution='&copy; CARTO'
                />
                {filtered.map(county => {
                  const score = scoreMap[county.id];
                  const riskScore = score?.overall_rural_access_risk_score || 0;
                  return (
                    <CircleMarker
                      key={county.id}
                      center={[county.latitude, county.longitude]}
                      radius={Math.max(6, riskScore / 8)}
                      fillColor={getRiskColor(riskScore)}
                      fillOpacity={0.75}
                      stroke={true}
                      weight={1.5}
                      color="#fff"
                    >
                      <Popup>
                        <div className="text-sm">
                          <p className="font-bold">{county.county_name}, {county.state_abbreviation}</p>
                          <p>Risk Score: <strong>{riskScore}</strong></p>
                          <p>Population: {county.population_total?.toLocaleString()}</p>
                          {score?.care_desert_flag && <p className="text-red-600 font-semibold">⚠ Care Desert</p>}
                          <Link to={`/county-profiles/${county.id}`} className="text-blue-600 underline text-xs">View Profile →</Link>
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })}
              </MapContainer>
            </div>
          </Card>

          {/* Legend & Summary */}
          <div className="space-y-4">
            <Card className="p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Risk Legend</h3>
              <div className="space-y-2">
                {[
                  { label: 'Critical (75-100)', color: '#dc2626' },
                  { label: 'High (60-74)', color: '#ea580c' },
                  { label: 'Moderate (40-59)', color: '#d97706' },
                  { label: 'Low (20-39)', color: '#059669' },
                  { label: 'Minimal (0-19)', color: '#2563eb' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Counties shown</span>
                  <span className="font-medium">{filtered.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">With risk scores</span>
                  <span className="font-medium">{filtered.filter(c => scoreMap[c.id]).length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Care deserts</span>
                  <span className="font-medium text-red-600">{filtered.filter(c => scoreMap[c.id]?.care_desert_flag).length}</span>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Flags</h3>
              <div className="flex flex-wrap gap-1.5">
                {filtered.some(c => scoreMap[c.id]?.care_desert_flag) && <Badge variant="destructive">Care Desert</Badge>}
                {filtered.some(c => scoreMap[c.id]?.benefits_access_desert_flag) && <Badge className="bg-orange-500">Benefits Desert</Badge>}
                {filtered.some(c => scoreMap[c.id]?.workforce_crisis_flag) && <Badge className="bg-purple-500">Workforce Crisis</Badge>}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}