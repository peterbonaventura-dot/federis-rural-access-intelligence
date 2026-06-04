import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Download, CheckCircle2, AlertCircle, Loader2, Building2 } from 'lucide-react';

export default function CmsImportPanel() {
  const [selectedCountyId, setSelectedCountyId] = useState('');
  const [providerTypes, setProviderTypes] = useState(['hospitals', 'home_health', 'behavioral_health', 'fqhc', 'substance_use', 'dialysis']);
  const [status, setStatus] = useState(null); // null | 'loading' | { success, imported, county } | { error }

  const { data: counties = [] } = useQuery({
    queryKey: ['counties'],
    queryFn: () => base44.entities.County.list('-created_date', 200),
  });

  const pilotCounties = counties.filter(c => c.pilot_cohort_status === 'pilot' || c.pilot_cohort_status === 'expansion');
  const selectedCounty = counties.find(c => c.id === selectedCountyId);

  const toggleType = (type) => {
    setProviderTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleImport = async () => {
    if (!selectedCounty) return;
    setStatus('loading');
    try {
      const res = await base44.functions.invoke('importCmsProviders', {
        county_id: selectedCounty.id,
        county_name: selectedCounty.county_name,
        state_abbreviation: selectedCounty.state_abbreviation,
        provider_types: providerTypes,
      });
      setStatus(res.data);
    } catch (err) {
      setStatus({ error: err.message });
    }
  };

  const PROVIDER_TYPE_OPTIONS = [
    { key: 'hospitals', label: 'Hospitals & Critical Access', color: 'bg-red-100 text-red-700' },
    { key: 'home_health', label: 'Home Health Agencies', color: 'bg-teal-100 text-teal-700' },
    { key: 'behavioral_health', label: 'Behavioral Health (Psychiatric)', color: 'bg-orange-100 text-orange-700' },
    { key: 'fqhc', label: 'FQHCs (Community Health)', color: 'bg-blue-100 text-blue-700' },
    { key: 'substance_use', label: 'Opioid Treatment / Substance Use', color: 'bg-purple-100 text-purple-700' },
    { key: 'dialysis', label: 'Dialysis Facilities', color: 'bg-cyan-100 text-cyan-700' },
  ];

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Building2 className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-sm">Import Providers from CMS Data</h3>
        <Badge className="bg-blue-100 text-blue-700 text-xs">Live API</Badge>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Pull real provider names, addresses, and phone numbers directly from{' '}
        <a href="https://data.cms.gov/provider-data" target="_blank" rel="noopener noreferrer" className="text-primary underline">
          CMS Provider Data Catalog
        </a>{' '}and the{' '}
        <a href="https://data.cms.gov" target="_blank" rel="noopener noreferrer" className="text-primary underline">
          CMS Data API
        </a>. Includes hospitals, behavioral health, FQHCs, OTP/substance use, dialysis, and home health. Duplicates are automatically skipped.
      </p>

      <div className="space-y-4">
        {/* County selector */}
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Select County</label>
          <Select value={selectedCountyId} onValueChange={setSelectedCountyId}>
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Choose a county..." />
            </SelectTrigger>
            <SelectContent>
              {pilotCounties.length > 0 && (
                <>
                  <div className="px-2 py-1 text-xs text-muted-foreground font-medium">Pilot / Expansion Cohort</div>
                  {pilotCounties.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.county_name}, {c.state_abbreviation}</SelectItem>
                  ))}
                  <div className="px-2 py-1 text-xs text-muted-foreground font-medium border-t mt-1 pt-1">All Counties</div>
                </>
              )}
              {counties.filter(c => !pilotCounties.includes(c)).map(c => (
                <SelectItem key={c.id} value={c.id}>{c.county_name}, {c.state_abbreviation}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Provider type toggles */}
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Provider Types to Import</label>
          <div className="flex gap-2 flex-wrap">
            {PROVIDER_TYPE_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => toggleType(opt.key)}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                  providerTypes.includes(opt.key)
                    ? opt.color + ' border-current'
                    : 'bg-background text-muted-foreground border-border'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Import button */}
        <div className="flex items-center gap-3">
          <Button
            onClick={handleImport}
            disabled={!selectedCountyId || providerTypes.length === 0 || status === 'loading'}
            className="gap-2"
          >
            {status === 'loading' ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</>
            ) : (
              <><Download className="w-4 h-4" /> Import from CMS</>
            )}
          </Button>
          {status && status !== 'loading' && (
            <div className="flex items-center gap-2 text-sm">
              {status.error ? (
                <>
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  <span className="text-destructive">{status.error}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="text-green-700 font-medium">
                    Imported {status.imported} new provider{status.imported !== 1 ? 's' : ''} for {status.county}
                  </span>
                  {status.imported === 0 && (
                    <span className="text-muted-foreground text-xs">(all already existed)</span>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          <strong>Note:</strong> After importing, go to the County Profile page to view and edit the imported facilities. Facilities with lat/lng will automatically appear on the National Map.
        </p>
      </div>
    </Card>
  );
}