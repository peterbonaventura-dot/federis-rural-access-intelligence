import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Home, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export default function HudHousingImportPanel() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const runImport = async () => {
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      const res = await base44.functions.invoke('importHudHousingCounselors', {
        distance: 75,
        skip_existing: true,
      });
      setResult(res.data);
    } catch (e) {
      setError(e.message || 'Import failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Home className="w-4 h-4 text-primary" />
            HUD Housing Counseling Agencies
          </CardTitle>
          <Badge variant="outline" className="text-xs">data.hud.gov</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Imports real HUD-approved housing counseling agencies within 75 miles of each pilot county centroid using the HUD Housing Counselor API. Agencies are stored as <code>hud_housing</code> facilities in the County Facility list.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          size="sm"
          onClick={runImport}
          disabled={running}
          className="gap-2"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Home className="w-4 h-4" />}
          {running ? 'Importing HUD Agencies...' : 'Import HUD Housing Agencies'}
        </Button>

        {error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{result.message}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              HUD national database: <strong>{result.total_hud_agencies_in_db?.toLocaleString()}</strong> active agencies |
              Processed: <strong>{result.summary?.processed}</strong> counties |
              Skipped (already populated): <strong>{result.summary?.skipped}</strong>
            </div>
            {result.summary?.counties?.filter(c => c.status === 'imported' && c.created > 0).length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded border text-xs divide-y">
                {result.summary.counties
                  .filter(c => c.status === 'imported' && c.created > 0)
                  .map((c, i) => (
                    <div key={i} className="flex justify-between px-3 py-1.5">
                      <span className="font-medium">{c.county}, {c.state}</span>
                      <span className="text-muted-foreground">{c.created} agency{c.created !== 1 ? 's' : ''} added</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}