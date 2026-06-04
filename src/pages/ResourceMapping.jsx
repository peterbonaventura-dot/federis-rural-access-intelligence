import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function ResourceMapping() {
  const [stateFilter, setStateFilter] = useState('all');

  const { data: counties = [] } = useQuery({
    queryKey: ['counties'],
    queryFn: () => base44.entities.County.list('-created_date', 200),
  });

  const { data: resources = [] } = useQuery({
    queryKey: ['resources'],
    queryFn: () => base44.entities.CountyResourceProfile.list('-created_date', 200),
  });

  const countyMap = {};
  counties.forEach(c => { countyMap[c.id] = c; });
  const states = [...new Set(counties.map(c => c.state))].sort();

  const enriched = resources
    .filter(r => {
      const c = countyMap[r.county_id];
      if (!c) return false;
      if (stateFilter !== 'all' && c.state !== stateFilter) return false;
      return true;
    })
    .map(r => ({ ...r, county: countyMap[r.county_id] }));

  const chartData = enriched.map(r => ({
    name: r.county?.county_name || 'Unknown',
    HCBS: r.number_of_hcbs_providers || 0,
    'Home Health': r.number_of_home_health_agencies || 0,
    Hospitals: (r.number_of_hospitals || 0) + (r.number_of_critical_access_hospitals || 0),
    'BH Providers': r.number_of_behavioral_health_providers || 0,
    Pharmacies: r.number_of_pharmacies || 0,
  }));

  return (
    <div>
      <PageHeader title="Resource Mapping" description="Provider and resource availability by county." />
      <div className="p-8 space-y-6">
        <Select value={stateFilter} onValueChange={setStateFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All States" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            {states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        {chartData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Provider Count Comparison
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={chartData}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={80} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="HCBS" fill="hsl(210, 70%, 32%)" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Home Health" fill="hsl(175, 42%, 40%)" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Hospitals" fill="hsl(0, 72%, 51%)" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="BH Providers" fill="hsl(32, 85%, 55%)" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Pharmacies" fill="hsl(260, 50%, 50%)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>County</TableHead>
                    <TableHead>HCBS</TableHead>
                    <TableHead>PC</TableHead>
                    <TableHead>HH</TableHead>
                    <TableHead>Hosp</TableHead>
                    <TableHead>CAH</TableHead>
                    <TableHead>RHC</TableHead>
                    <TableHead>FQHC</TableHead>
                    <TableHead>Pharm</TableHead>
                    <TableHead>BH</TableHead>
                    <TableHead>SS Off</TableHead>
                    <TableHead>Hosp mi</TableHead>
                    <TableHead>Pharm mi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enriched.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Link to={`/county-profiles/${r.county_id}`} className="font-medium text-primary hover:underline text-sm">
                          {r.county?.county_name}, {r.county?.state_abbreviation}
                        </Link>
                      </TableCell>
                      <TableCell>{r.number_of_hcbs_providers}</TableCell>
                      <TableCell>{r.number_of_personal_care_providers}</TableCell>
                      <TableCell>{r.number_of_home_health_agencies}</TableCell>
                      <TableCell>{r.number_of_hospitals}</TableCell>
                      <TableCell>{r.number_of_critical_access_hospitals}</TableCell>
                      <TableCell>{r.number_of_rural_health_clinics}</TableCell>
                      <TableCell>{r.number_of_fqhcs}</TableCell>
                      <TableCell>{r.number_of_pharmacies}</TableCell>
                      <TableCell>{r.number_of_behavioral_health_providers}</TableCell>
                      <TableCell>{r.number_of_social_security_offices}</TableCell>
                      <TableCell>{r.nearest_hospital_miles_avg ?? '—'}</TableCell>
                      <TableCell>{r.nearest_pharmacy_miles_avg ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}