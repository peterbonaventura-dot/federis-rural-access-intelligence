import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Download, CheckCircle2, AlertCircle, Loader2, BarChart3 } from 'lucide-react';

const DATASET_OPTIONS = [
  { key: 'medicare', label: 'Medicare Enrollment', color: 'bg-blue-100 text-blue-700', desc: 'Total Medicare beneficiaries by county' },
  { key: 'dual_eligible', label: 'Dual Eligible (Medicare + Medicaid)', color: 'bg-purple-100 text-purple-700', desc: 'Dual-enrolled and Medicaid beneficiaries' },
  { key: 'veterans', label: 'Veterans (VA-Enrolled Medicare)', color: 'bg-green-100 text-green-700', desc: 'Veterans enrolled in VA healthcare (from CMS PUF)' },
  { key: 'ssi', label: 'SSI Recipients', color: 'bg-orange-100 text-orange-700', desc: 'Supplemental Security Income recipients' },
];

export default function CmsEnrollmentImportPanel() {
  const [selectedCountyId, setSelectedCountyId] = useState('');
  const [datasetTypes, setDatasetTypes] = useState(['medicare', 'dual_eligible', 'veterans']);
  const [status, setStatus] = useState(null);

  const { data: counties = [] } = useQuery({
    queryKey: ['counties'],
    queryFn: () => base44.entities.County.list('-created_date', 200),
  });

  const pilotCounties = counties.filter(c => c.pilot_cohort_status === 'pilot' || c.pilot_cohort_status === 'expansion');
  const otherCounties = counties.filter(c => !pilotCounties.includes(c));
  const selectedCounty = counties.find(c => c.id === selectedCountyId);

  const toggleType = (key) => {
    setDatasetTypes(prev => prev.includes(key) ? prev.filter(t => t !== key) : [...prev, key]);
  };

  const handleImport = async () => {
    if (!selectedCounty || !selectedCounty.fips_code) return;
    setStatus('loading');
    try {
      const res = await base44.functions.invoke('importCmsEnrollmentData', {
        county_id: selectedCounty.id,
        fips_code: selectedCounty.fips_code,
        dataset_types: datasetTypes,
      });
      setStatus(res.data);
    } catch (err) {
      setStatus({ error: err.message });
    }
  };

  const missingFips = selectedCounty && !selectedCounty.fips_code;

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-1">
        <BarChart3 className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-sm">Import Enrollment & Benefits Data from CMS</h3>
        <Badge className="bg-indigo-100 text-indigo-700 text-xs">data-api/v1</Badge>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Pull Medicare enrollment, dual-eligible, veterans, and SSI recipient counts directly from{' '}
        <a href="https://data.cms.gov" target="_blank" rel="noopener noreferrer" className="text-primary underline">
          data.cms.gov
        </a>{' '}
        using FIPS code. Data is saved directly to the County record.
      </p>

      <div className="space-y-4">
        {/* County selector */}
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Select County (requires FIPS code)</label>
          <Select value={selectedCountyId} onValueChange={setSelectedCountyId}>
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Choose a county..." />
            </SelectTrigger>
            <SelectContent>
              {pilotCounties.length > 0 && (
                <>
                  <div className="px-2 py-1 text-xs text-muted-foreground font-medium">Pilot / Expansion Cohort</div>
                  {pilotCounties.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.county_name}, {c.state_abbreviation}
                      {!c.fips_code && <span className="text-muted-foreground ml-1">(no FIPS)</span>}
                    </SelectItem>
                  ))}
                  <div className="px-2 py-1 text-xs text-muted-foreground font-medium border-t mt-1 pt-1">All Counties</div>
                </>
              )}
              {otherCounties.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.county_name}, {c.state_abbreviation}
                  {!c.fips_code && <span className="text-muted-foreground ml-1">(no FIPS)</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {missingFips && (
            <p className="text-xs text-amber-600 mt-1">⚠ This county has no FIPS code set. Edit the county record first.</p>
          )}
          {selectedCounty?.fips_code && (
            <p className="text-xs text-muted-foreground mt-1">FIPS: {selectedCounty.fips_code}</p>
          )}
        </div>

        {/* Dataset toggles */}
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-2">Datasets to Import</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {DATASET_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => toggleType(opt.key)}
                className={`text-left px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                  datasetTypes.includes(opt.key)
                    ? opt.color + ' border-current'
                    : 'bg-background text-muted-foreground border-border hover:border-muted-foreground'
                }`}
              >
                <div className="font-semibold">{opt.label}</div>
                <div className="opacity-70 text-[11px] mt-0.5 font-normal">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Import button + status */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            onClick={handleImport}
            disabled={!selectedCountyId || missingFips || datasetTypes.length === 0 || status === 'loading'}
            className="gap-2"
          >
            {status === 'loading' ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Fetching from CMS...</>
            ) : (
              <><Download className="w-4 h-4" /> Import Enrollment Data</>
            )}
          </Button>

          {status && status !== 'loading' && (
            <div className="text-sm">
              {status.error ? (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="w-4 h-4" />
                  <span>{status.error}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <div>
                    <span className="font-medium">
                      Updated {status.fields_updated?.length || 0} field{status.fields_updated?.length !== 1 ? 's' : ''}
                    </span>
                    {status.fields_updated?.length > 0 && (
                      <span className="text-xs text-muted-foreground ml-1">
                        ({status.fields_updated.join(', ')})
                      </span>
                    )}
                    {status.fields_updated?.length === 0 && (
                      <span className="text-xs text-muted-foreground ml-1"> — no matching data found for this county's FIPS</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Raw results preview */}
        {status && status !== 'loading' && status.raw_results && Object.keys(status.raw_results).length > 0 && (
          <div className="bg-muted/40 rounded-lg p-3 text-xs space-y-1">
            <p className="font-semibold text-muted-foreground mb-1">API Response Summary</p>
            {Object.entries(status.raw_results).map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="font-mono text-muted-foreground w-36 shrink-0">{k}:</span>
                <span>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          <strong>Note:</strong> Fields are updated directly on the County record. View changes on the County Profile page under Benefits Enrollment and Veterans sections.
        </p>
      </div>
    </Card>
  );
}