import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import RiskScoreBadge from '@/components/shared/RiskScoreBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Search, ArrowRight, AlertTriangle, Shield, Users, Activity,
  MapPin, Building, ChevronUp, ChevronDown, Download
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getRiskColor, getRiskLevel, SCORE_CATEGORIES } from '@/lib/scoringEngine';

const FLAG_FILTERS = [
  { key: 'care_desert_flag', label: 'Care Desert', color: 'bg-red-500' },
  { key: 'benefits_access_desert_flag', label: 'Benefits Desert', color: 'bg-orange-500' },
  { key: 'hospital_discharge_risk_flag', label: 'Discharge Risk', color: 'bg-amber-500' },
  { key: 'workforce_crisis_flag', label: 'Workforce Crisis', color: 'bg-purple-500' },
  { key: 'high_priority_research_flag', label: 'High Priority', color: 'bg-blue-600' },
];

export default function RuralAccessExplorer() {
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [cohortFilter, setCohortFilter] = useState('all');
  const [flagFilter, setFlagFilter] = useState('all');
  const [sortBy, setSortBy] = useState('overall_rural_access_risk_score');
  const [sortDir, setSortDir] = useState('desc');
  const [view, setView] = useState('table'); // 'table' | 'chart'

  const { data: counties = [] } = useQuery({
    queryKey: ['counties'],
    queryFn: () => base44.entities.County.list('-created_date', 500),
  });

  const { data: riskScores = [] } = useQuery({
    queryKey: ['riskScores'],
    queryFn: () => base44.entities.RuralAccessRiskScore.list('-overall_rural_access_risk_score', 500),
  });

  const countyMap = useMemo(() => {
    const m = {};
    counties.forEach(c => { m[c.id] = c; });
    return m;
  }, [counties]);

  const scoreMap = useMemo(() => {
    const m = {};
    riskScores.forEach(s => { m[s.county_id] = s; });
    return m;
  }, [riskScores]);

  const states = useMemo(() => [...new Set(counties.map(c => c.state))].sort(), [counties]);

  const filtered = useMemo(() => {
    return counties
      .filter(c => {
        if (stateFilter !== 'all' && c.state !== stateFilter) return false;
        if (cohortFilter !== 'all' && c.pilot_cohort_status !== cohortFilter) return false;
        if (search && !c.county_name.toLowerCase().includes(search.toLowerCase()) && !c.state.toLowerCase().includes(search.toLowerCase())) return false;
        if (flagFilter !== 'all') {
          const s = scoreMap[c.id];
          if (!s || !s[flagFilter]) return false;
        }
        return true;
      })
      .map(c => ({ ...c, score: scoreMap[c.id] }))
      .sort((a, b) => {
        const aVal = sortBy === 'county_name' ? (a.county_name || '') : (a.score?.[sortBy] ?? -1);
        const bVal = sortBy === 'county_name' ? (b.county_name || '') : (b.score?.[sortBy] ?? -1);
        if (typeof aVal === 'string') return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      });
  }, [counties, stateFilter, cohortFilter, search, flagFilter, sortBy, sortDir, scoreMap]);

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <ChevronUp className="w-3 h-3 opacity-30" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  // Summary stats
  const totalWithScores = filtered.filter(c => c.score).length;
  const avgScore = totalWithScores
    ? Math.round(filtered.filter(c => c.score).reduce((s, c) => s + (c.score.overall_rural_access_risk_score || 0), 0) / totalWithScores)
    : 0;
  const careDeserts = filtered.filter(c => c.score?.care_desert_flag).length;
  const criticalCount = filtered.filter(c => (c.score?.overall_rural_access_risk_score || 0) >= 75).length;

  // Chart data top 20
  const chartData = filtered
    .filter(c => c.score)
    .slice(0, 20)
    .map(c => ({ name: c.county_name, state: c.state_abbreviation, score: c.score.overall_rural_access_risk_score || 0 }));

  const exportCSV = () => {
    const headers = ['County', 'State', 'FIPS', 'Cohort', 'Overall Risk', 'Workforce', 'Provider Capacity', 'Transport', 'Discharge', 'Benefits', 'Behavioral Health', 'Pharmacy', 'Continuity', 'EVV', 'Care Desert', 'Benefits Desert', 'Workforce Crisis'];
    const rows = filtered.map(c => [
      c.county_name, c.state, c.fips_code, c.pilot_cohort_status,
      c.score?.overall_rural_access_risk_score ?? '',
      c.score?.workforce_shortage_score ?? '',
      c.score?.provider_capacity_score ?? '',
      c.score?.transportation_burden_score ?? '',
      c.score?.hospital_discharge_risk_score ?? '',
      c.score?.benefits_access_score ?? '',
      c.score?.behavioral_health_access_score ?? '',
      c.score?.pharmacy_access_score ?? '',
      c.score?.service_continuity_score ?? '',
      c.score?.evv_documentation_burden_score ?? '',
      c.score?.care_desert_flag ?? '',
      c.score?.benefits_access_desert_flag ?? '',
      c.score?.workforce_crisis_flag ?? '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'rural-access-explorer.csv';
    a.click();
  };

  return (
    <div>
      <PageHeader
        title="Rural Access Explorer"
        description="Explore, filter, and compare rural access risk data across all counties in the research cohort."
        actions={
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="w-4 h-4 mr-1" /> Export CSV
          </Button>
        }
      />

      <div className="p-8 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Matching Counties</p>
                <p className="text-2xl font-bold">{filtered.length}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-secondary" />
              <div>
                <p className="text-xs text-muted-foreground">Avg Risk Score</p>
                <p className="text-2xl font-bold">{avgScore}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-xs text-muted-foreground">Care Deserts</p>
                <p className="text-2xl font-bold">{careDeserts}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-destructive" />
              <div>
                <p className="text-xs text-muted-foreground">Critical Risk (≥75)</p>
                <p className="text-2xl font-bold">{criticalCount}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search county or state..."
              className="pl-9 w-56"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All States" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              {states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={cohortFilter} onValueChange={setCohortFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All Cohorts" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cohorts</SelectItem>
              <SelectItem value="pilot">Pilot</SelectItem>
              <SelectItem value="expansion">Expansion</SelectItem>
              <SelectItem value="national">National</SelectItem>
              <SelectItem value="none">None</SelectItem>
            </SelectContent>
          </Select>
          <Select value={flagFilter} onValueChange={setFlagFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All Flags" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Flags</SelectItem>
              {FLAG_FILTERS.map(f => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex border rounded-md overflow-hidden ml-auto">
            <button
              onClick={() => setView('table')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${view === 'table' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
            >
              Table
            </button>
            <button
              onClick={() => setView('chart')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${view === 'chart' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
            >
              Chart
            </button>
          </div>
        </div>

        {/* Chart View */}
        {view === 'chart' && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Top 20 Counties by Risk Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={440}>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 30 }}>
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }}
                      tickFormatter={(v, i) => `${v} (${chartData[i]?.state})`}
                    />
                    <Tooltip formatter={(v) => [`${v}/100`, 'Risk Score']} />
                    <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={16}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={getRiskColor(entry.score)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">No data to display</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Table View */}
        {view === 'table' && (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8 text-center">#</TableHead>
                      <TableHead>
                        <button onClick={() => toggleSort('county_name')} className="flex items-center gap-1 hover:text-foreground">
                          County <SortIcon col="county_name" />
                        </button>
                      </TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Cohort</TableHead>
                      <TableHead>
                        <button onClick={() => toggleSort('overall_rural_access_risk_score')} className="flex items-center gap-1 hover:text-foreground">
                          Overall <SortIcon col="overall_rural_access_risk_score" />
                        </button>
                      </TableHead>
                      {SCORE_CATEGORIES.slice(0, 5).map(cat => (
                        <TableHead key={cat.key}>
                          <button onClick={() => toggleSort(cat.key)} className="flex items-center gap-1 hover:text-foreground text-xs whitespace-nowrap">
                            {cat.label.split(' ')[0]} <SortIcon col={cat.key} />
                          </button>
                        </TableHead>
                      ))}
                      <TableHead>Flags</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                          No counties match your filters
                        </TableCell>
                      </TableRow>
                    )}
                    {filtered.map((c, i) => {
                      const s = c.score;
                      return (
                        <TableRow key={c.id} className="hover:bg-muted/30">
                          <TableCell className="text-center text-xs text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-medium">
                            <Link to={`/county-profiles/${c.id}`} className="hover:text-primary hover:underline">
                              {c.county_name}
                            </Link>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{c.state_abbreviation}</TableCell>
                          <TableCell>
                            {c.pilot_cohort_status !== 'none' && (
                              <Badge variant="outline" className="text-[10px] capitalize">{c.pilot_cohort_status}</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {s ? <RiskScoreBadge score={s.overall_rural_access_risk_score} size="sm" showLabel={false} /> : <span className="text-muted-foreground text-xs">—</span>}
                          </TableCell>
                          {SCORE_CATEGORIES.slice(0, 5).map(cat => {
                            const val = s?.[cat.key];
                            return (
                              <TableCell key={cat.key} className="text-xs">
                                {val != null ? (
                                  <span style={{ color: getRiskColor(val) }} className="font-medium">{val}</span>
                                ) : '—'}
                              </TableCell>
                            );
                          })}
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {s?.care_desert_flag && <Badge variant="destructive" className="text-[9px] px-1 py-0">CD</Badge>}
                              {s?.benefits_access_desert_flag && <Badge className="bg-orange-500 text-[9px] px-1 py-0">BD</Badge>}
                              {s?.workforce_crisis_flag && <Badge className="bg-purple-500 text-[9px] px-1 py-0">WC</Badge>}
                              {s?.hospital_discharge_risk_flag && <Badge className="bg-amber-500 text-[9px] px-1 py-0">DR</Badge>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Link to={`/county-profiles/${c.id}`}>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <ArrowRight className="w-3.5 h-3.5" />
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}