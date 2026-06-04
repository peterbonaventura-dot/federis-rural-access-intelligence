import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, MapPin, Phone, Globe, CheckCircle2 } from 'lucide-react';

const CLINICAL_TYPES = [
  'hospital', 'critical_access_hospital', 'rural_health_clinic', 'fqhc',
  'pharmacy', 'behavioral_health', 'substance_use', 'home_health_agency',
  'hcbs_provider', 'personal_care',
];

const COVERAGE_BENEFIT_MAP = {
  medical: ['hospital', 'critical_access_hospital', 'rural_health_clinic', 'fqhc'],
  prescription_drugs: ['pharmacy'],
  mental_health: ['behavioral_health'],
  home_health: ['home_health_agency'],
  personal_care: ['personal_care', 'hcbs_provider'],
  substance_use: ['substance_use'],
};

const FACILITY_LABELS = {
  hospital: 'Hospital',
  critical_access_hospital: 'Critical Access Hospital',
  rural_health_clinic: 'Rural Health Clinic',
  fqhc: 'FQHC',
  pharmacy: 'Pharmacy',
  behavioral_health: 'Behavioral Health',
  substance_use: 'Substance Use',
  home_health_agency: 'Home Health Agency',
  hcbs_provider: 'HCBS Provider',
  personal_care: 'Personal Care',
};

const FACILITY_COLORS = {
  hospital: 'bg-red-100 text-red-700',
  critical_access_hospital: 'bg-red-100 text-red-800',
  rural_health_clinic: 'bg-blue-100 text-blue-700',
  fqhc: 'bg-blue-100 text-blue-800',
  pharmacy: 'bg-purple-100 text-purple-700',
  behavioral_health: 'bg-orange-100 text-orange-700',
  substance_use: 'bg-orange-100 text-orange-800',
  home_health_agency: 'bg-teal-100 text-teal-700',
  hcbs_provider: 'bg-teal-100 text-teal-800',
  personal_care: 'bg-cyan-100 text-cyan-700',
};

export default function CountyClinicsPanel({ profile, coverages = [] }) {
  const countyName = profile?.county;
  const state = profile?.state;

  const { data: counties = [] } = useQuery({
    queryKey: ['counties-member'],
    queryFn: () => base44.entities.County.list('-created_date', 200),
    enabled: !!countyName,
  });

  const county = useMemo(() => {
    if (!countyName) return null;
    return counties.find(c =>
      c.county_name?.toLowerCase().includes(countyName.toLowerCase()) &&
      (!state || c.state?.toLowerCase().includes(state.toLowerCase()))
    );
  }, [counties, countyName, state]);

  const { data: facilities = [], isLoading } = useQuery({
    queryKey: ['county-facilities', county?.id],
    queryFn: () => base44.entities.CountyFacility.filter({ county_id: county.id, is_active: true }),
    enabled: !!county?.id,
  });

  const clinics = useMemo(() => {
    return facilities.filter(f => CLINICAL_TYPES.includes(f.facility_type));
  }, [facilities]);

  // Detect coverage gaps: member has a covered benefit but no facility of matching type in county
  const gaps = useMemo(() => {
    if (!coverages.length || !county) return [];
    const coveredCategories = coverages
      .filter(c => c.coverage_status === 'covered' || c.coverage_status === 'limited')
      .map(c => c.benefit_category);

    const facilityTypesPresent = new Set(clinics.map(f => f.facility_type));

    const gapList = [];
    for (const cat of coveredCategories) {
      const neededTypes = COVERAGE_BENEFIT_MAP[cat];
      if (!neededTypes) continue;
      const hasAny = neededTypes.some(t => facilityTypesPresent.has(t));
      if (!hasAny) {
        gapList.push({ benefit_category: cat, neededTypes });
      }
    }
    return gapList;
  }, [coverages, clinics, county]);

  if (!countyName) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" /> In-Network Clinics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Set your county in your profile to see local clinics.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Coverage Gap Alerts */}
      {gaps.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-2">
          <div className="flex items-center gap-2 text-red-700 font-semibold text-sm">
            <AlertTriangle className="w-4 h-4" />
            Coverage Gaps in {countyName}
          </div>
          <p className="text-xs text-red-600">You have coverage for these benefits, but no matching facility was found in your county:</p>
          <div className="flex flex-wrap gap-2 mt-1">
            {gaps.map(g => (
              <span key={g.benefit_category} className="text-xs bg-red-100 text-red-800 border border-red-200 px-2 py-0.5 rounded-full capitalize">
                {g.benefit_category.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
          <p className="text-xs text-red-500 mt-1">Contact your care coordinator for assistance finding providers.</p>
        </div>
      )}

      {/* Clinic List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              Clinics in {countyName}
            </span>
            {clinics.length > 0 && (
              <span className="text-xs font-normal text-muted-foreground">{clinics.length} found</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <p className="text-sm text-muted-foreground">Loading facilities...</p>
          )}
          {!isLoading && !county && (
            <p className="text-sm text-muted-foreground">Could not match "{countyName}" to a county in our database.</p>
          )}
          {!isLoading && county && clinics.length === 0 && (
            <div className="flex items-start gap-2 text-amber-700 text-sm bg-amber-50 border border-amber-200 rounded-md p-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>No in-network clinical facilities found for your county. This may indicate a care desert. Please contact your care coordinator.</span>
            </div>
          )}
          <div className="space-y-3">
            {clinics.map(f => {
              const address = [f.address_street, f.address_city, f.address_state, f.address_zip].filter(Boolean).join(', ');
              return (
                <div key={f.id} className="flex items-start gap-3 border-b border-border last:border-0 pb-3 last:pb-0">
                  <div className="mt-0.5">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium truncate">{f.facility_name}</p>
                      <Badge className={`text-xs px-1.5 py-0 ${FACILITY_COLORS[f.facility_type] || 'bg-gray-100 text-gray-700'}`}>
                        {FACILITY_LABELS[f.facility_type] || f.facility_type}
                      </Badge>
                    </div>
                    {address && (
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3 shrink-0" /> {address}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-3 mt-1">
                      {f.phone && (
                        <a href={`tel:${f.phone}`} className="text-xs text-primary flex items-center gap-1 hover:underline">
                          <Phone className="w-3 h-3" /> {f.phone}
                        </a>
                      )}
                      {f.website && (
                        <a href={f.website} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline">
                          <Globe className="w-3 h-3" /> Website
                        </a>
                      )}
                    </div>
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                      {f.accepts_medicaid && <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-1.5 rounded">Medicaid</span>}
                      {f.accepts_medicare && <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-1.5 rounded">Medicare</span>}
                      {f.accepts_uninsured && <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-1.5 rounded">Uninsured OK</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}