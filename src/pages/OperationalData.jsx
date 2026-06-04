import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export default function OperationalData() {
  const [stateFilter, setStateFilter] = useState('all');

  const { data: counties = [] } = useQuery({
    queryKey: ['counties'],
    queryFn: () => base44.entities.County.list('-created_date', 200),
  });

  const { data: opsData = [] } = useQuery({
    queryKey: ['operationalData'],
    queryFn: () => base44.entities.OperationalServiceData.list('-reporting_period_end', 200),
  });

  const countyMap = {};
  counties.forEach(c => { countyMap[c.id] = c; });
  const states = [...new Set(counties.map(c => c.state))].sort();

  const filtered = opsData.filter(o => {
    const c = countyMap[o.county_id];
    if (!c) return false;
    if (stateFilter !== 'all' && c.state !== stateFilter) return false;
    return true;
  });

  return (
    <div>
      <PageHeader title="Operational Data" description="De-identified operational service data by county." />
      <div className="p-8 space-y-4">
        <Select value={stateFilter} onValueChange={setStateFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All States" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            {states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>County</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Clients</TableHead>
                    <TableHead>High-Need</TableHead>
                    <TableHead>Auth Hrs</TableHead>
                    <TableHead>Staffed</TableHead>
                    <TableHead>Unstaffed</TableHead>
                    <TableHead>Caregivers</TableHead>
                    <TableHead>Missed</TableHead>
                    <TableHead>Ref→Start</TableHead>
                    <TableHead>Transport</TableHead>
                    <TableHead>BH Flagged</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(o => {
                    const c = countyMap[o.county_id];
                    const unstaffedPct = o.authorized_hours_total ? Math.round((o.unstaffed_hours_total / o.authorized_hours_total) * 100) : 0;
                    return (
                      <TableRow key={o.id}>
                        <TableCell>
                          <Link to={`/county-profiles/${o.county_id}`} className="font-medium text-primary hover:underline text-sm">
                            {c?.county_name}, {c?.state_abbreviation}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {o.reporting_period_start && format(new Date(o.reporting_period_start), 'MMM yyyy')}
                        </TableCell>
                        <TableCell>{o.active_client_count}</TableCell>
                        <TableCell>{o.high_need_client_count}</TableCell>
                        <TableCell>{o.authorized_hours_total?.toLocaleString()}</TableCell>
                        <TableCell>{o.staffed_hours_total?.toLocaleString()}</TableCell>
                        <TableCell>
                          <span className={unstaffedPct > 30 ? 'text-red-600 font-semibold' : ''}>
                            {o.unstaffed_hours_total?.toLocaleString()} ({unstaffedPct}%)
                          </span>
                        </TableCell>
                        <TableCell>{o.caregiver_count_active}</TableCell>
                        <TableCell>{o.missed_visit_count}</TableCell>
                        <TableCell>{o.average_referral_to_start_days ? `${o.average_referral_to_start_days}d` : '—'}</TableCell>
                        <TableCell>{o.transportation_barrier_count}</TableCell>
                        <TableCell>{o.behavioral_health_flagged_client_count}</TableCell>
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