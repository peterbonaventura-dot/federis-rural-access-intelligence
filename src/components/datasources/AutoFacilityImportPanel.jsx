import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Zap, CheckCircle2, RefreshCw, Building2, BarChart2 } from 'lucide-react';
import { format } from 'date-fns';

export default function AutoFacilityImportPanel() {
  const [running, setRunning] = useState(false);
  const [buildingProfiles, setBuildingProfiles] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['facilityImportLogs'],
    queryFn: () => base44.entities.AuditLog.filter(
      { action: 'data_import', entity_type: 'CountyFacility' },
      '-created_date',
      10
    ),
    refetchInterval: 15000,
  });

  const { data: pilotCounties = [] } = useQuery({
    queryKey: ['pilotCountiesCount'],
    queryFn: () => base44.entities.County.filter({ pilot_cohort_status: 'pilot' }, '-created_date', 200),
  });

  const handleRunNow = async () => {
    setRunning(true);
    setLastResult(null);
    try {
      const countiesWithoutFacilities = [];
      for (const county of pilotCounties) {
        const facilities = await base44.entities.CountyFacility.filter({ county_id: county.id }, '-created_date', 1);
        if (!facilities || facilities.length === 0) {
          countiesWithoutFacilities.push(county);
        }
      }

      if (countiesWithoutFacilities.length === 0) {
        setLastResult({ type: 'info', message: 'All pilot counties already have facility data.' });
        return;
      }

      let totalCreated = 0;
      for (const county of countiesWithoutFacilities) {
        const res = await base44.functions.invoke('autoImportCountyFacilities', { county_id: county.id });
        totalCreated += res?.data?.total_created || 0;
      }
      setLastResult({ type: 'success', message: `Imported facilities for ${countiesWithoutFacilities.length} counties (${totalCreated} total records).` });
    } catch (err) {
      setLastResult({ type: 'error', message: err.message });
    } finally {
      setRunning(false);
    }
  };

  const handleBuildProfiles = async () => {
    setBuildingProfiles(true);
    setLastResult(null);
    try {
      const res = await base44.functions.invoke('buildResourceProfiles', {});
      setLastResult({ type: 'success', message: `Built profiles for ${res.data.counties_processed} counties. Risk scores recalculating in background.` });
    } catch (err) {
      setLastResult({ type: 'error', message: err.message });
    } finally {
      setBuildingProfiles(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            <CardTitle className="text-base">Automatic Facility Import</CardTitle>
            <Badge className="bg-green-100 text-green-700 text-xs">Live</Badge>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleBuildProfiles} disabled={buildingProfiles || running}>
              {buildingProfiles ? <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> : <BarChart2 className="w-3.5 h-3.5 mr-1" />}
              {buildingProfiles ? 'Building...' : 'Build Profiles & Scores'}
            </Button>
            <Button size="sm" variant="outline" onClick={handleRunNow} disabled={running || buildingProfiles}>
              {running ? <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Zap className="w-3.5 h-3.5 mr-1" />}
              {running ? 'Running...' : 'Run Now'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Automatically imports CMS facility data whenever a county is added or set to <strong>pilot</strong> status. Falls back to AI-generated data if CMS returns no results. No manual steps required.
        </p>

        {lastResult && (
          <div className={`text-sm rounded-md px-3 py-2 ${lastResult.type === 'success' ? 'bg-green-50 text-green-800' : lastResult.type === 'error' ? 'bg-red-50 text-red-800' : 'bg-blue-50 text-blue-800'}`}>
            {lastResult.message}
          </div>
        )}

        {auditLogs.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Recent Import Log</p>
            {auditLogs.map(log => {
              let meta = {};
              try { meta = JSON.parse(log.metadata || '{}'); } catch {}
              return (
                <div key={log.id} className="flex items-start gap-2 text-xs py-1.5 border-b border-border last:border-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-foreground">{log.description}</span>
                    {meta.source && (
                      <Badge variant="outline" className="ml-2 text-xs py-0">{meta.source}</Badge>
                    )}
                  </div>
                  <span className="text-muted-foreground shrink-0">{format(new Date(log.created_date), 'MMM d, h:mm a')}</span>
                </div>
              );
            })}
          </div>
        )}

        {auditLogs.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No import events yet — will trigger automatically when pilot counties are added.</p>
        )}
      </CardContent>
    </Card>
  );
}