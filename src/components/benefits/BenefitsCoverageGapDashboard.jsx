import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle, CheckCircle2, XCircle, MapPin, Building2,
  Stethoscope, Brain, Pill, Home, Heart, Car, Eye, Shield,
  AlertCircle, Info
} from 'lucide-react';

// Maps benefit category → relevant facility types from CountyFacility
const BENEFIT_TO_FACILITY = {
  medical: ['hospital', 'critical_access_hospital', 'rural_health_clinic', 'fqhc'],
  mental_health: ['behavioral_health'],
  prescription_drugs: ['pharmacy'],
  home_health: ['home_health_agency'],
  personal_care: ['hcbs_provider', 'personal_care'],
  transportation: ['transportation'],
  dental: [],   // no facility type for dental
  vision: [],
  dme: [],
  hospice: ['home_health_agency'],
};

const FACILITY_LABELS = {
  hospital: 'Hospital',
  critical_access_hospital: 'Critical Access Hospital',
  rural_health_clinic: 'Rural Health Clinic',
  fqhc: 'FQHC',
  behavioral_health: 'Behavioral Health',
  pharmacy: 'Pharmacy',
  home_health_agency: 'Home Health Agency',
  hcbs_provider: 'HCBS Provider',
  personal_care: 'Personal Care',
  transportation: 'Transportation',
};

const CATEGORY_ICONS = {
  medical: Stethoscope,
  mental_health: Brain,
  prescription_drugs: Pill,
  home_health: Home,
  personal_care: Heart,
  transportation: Car,
  vision: Eye,
  dental: Shield,
  dme: Shield,
  hospice: Heart,
  other: Shield,
};

const CATEGORY_LABELS = {
  medical: 'Medical / Primary Care',
  mental_health: 'Mental Health',
  prescription_drugs: 'Prescriptions',
  home_health: 'Home Health',
  personal_care: 'Personal Care',
  transportation: 'Transportation',
  vision: 'Vision',
  dental: 'Dental',
  dme: 'Medical Equipment',
  hospice: 'Hospice',
  other: 'Other',
};

function GapSeverityBadge({ severity }) {
  if (severity === 'critical') {
    return (
      <Badge className="bg-red-100 text-red-700 border-red-200 border gap-1 text-xs">
        <AlertTriangle className="w-3 h-3" /> Critical Gap
      </Badge>
    );
  }
  if (severity === 'warning') {
    return (
      <Badge className="bg-amber-100 text-amber-700 border-amber-200 border gap-1 text-xs">
        <AlertCircle className="w-3 h-3" /> Limited Access
      </Badge>
    );
  }
  return (
    <Badge className="bg-green-100 text-green-700 border-green-200 border gap-1 text-xs">
      <CheckCircle2 className="w-3 h-3" /> Facilities Available
    </Badge>
  );
}

function CoverageGapRow({ benefit, facilities, countyName }) {
  const Icon = CATEGORY_ICONS[benefit.benefit_category] || Shield;
  const relevantTypes = BENEFIT_TO_FACILITY[benefit.benefit_category] || [];

  const matchingFacilities = facilities.filter(f => relevantTypes.includes(f.facility_type));
  const acceptsMedicaid = matchingFacilities.filter(f => f.accepts_medicaid);
  const acceptsMedicare = matchingFacilities.filter(f => f.accepts_medicare);

  // Determine severity based on coverage status + facility availability
  let severity = 'ok';
  let gapMessage = null;

  const isCovered = ['covered', 'requires_prior_auth', 'limited'].includes(benefit.coverage_status);
  const hasNoFacilityType = relevantTypes.length === 0;

  if (isCovered && !hasNoFacilityType) {
    if (matchingFacilities.length === 0) {
      severity = 'critical';
      gapMessage = `Covered benefit but no ${relevantTypes.map(t => FACILITY_LABELS[t] || t).join(' or ')} found in ${countyName}.`;
    } else if (acceptsMedicaid.length === 0 && acceptsMedicare.length === 0) {
      severity = 'critical';
      gapMessage = `${matchingFacilities.length} facility(s) exist but none accept Medicaid or Medicare in your county.`;
    } else if (acceptsMedicaid.length === 0 && benefit.coverage_status !== 'not_covered') {
      severity = 'warning';
      gapMessage = `Facilities exist but none confirmed as Medicaid-accepting in ${countyName}.`;
    } else if (matchingFacilities.length <= 1) {
      severity = 'warning';
      gapMessage = `Only ${matchingFacilities.length} facility serving this benefit type — limited redundancy.`;
    }
  }

  const statusColors = {
    covered: 'text-green-600',
    not_covered: 'text-red-500',
    requires_prior_auth: 'text-amber-600',
    limited: 'text-orange-600',
  };

  return (
    <div className={`rounded-lg border p-4 space-y-3 ${severity === 'critical' ? 'border-red-200 bg-red-50/40' : severity === 'warning' ? 'border-amber-200 bg-amber-50/30' : 'border-border bg-card'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-md ${severity === 'critical' ? 'bg-red-100' : severity === 'warning' ? 'bg-amber-100' : 'bg-primary/10'}`}>
            <Icon className={`w-4 h-4 ${severity === 'critical' ? 'text-red-600' : severity === 'warning' ? 'text-amber-600' : 'text-primary'}`} />
          </div>
          <div>
            <p className="font-medium text-sm">{benefit.benefit_name}</p>
            <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[benefit.benefit_category] || benefit.benefit_category}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs font-medium ${statusColors[benefit.coverage_status] || 'text-muted-foreground'}`}>
            {benefit.coverage_status?.replace(/_/g, ' ')}
          </span>
          {isCovered && !hasNoFacilityType && <GapSeverityBadge severity={severity} />}
        </div>
      </div>

      {/* Gap Alert */}
      {gapMessage && (
        <div className={`flex items-start gap-2 rounded-md px-3 py-2 text-xs ${severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>{gapMessage}</span>
        </div>
      )}

      {/* Facility List */}
      {isCovered && !hasNoFacilityType && matchingFacilities.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nearby Facilities ({matchingFacilities.length})</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {matchingFacilities.slice(0, 4).map(f => (
              <div key={f.id} className="flex items-start gap-1.5 text-xs bg-background rounded border border-border px-2 py-1.5">
                <Building2 className="w-3 h-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium leading-tight">{f.facility_name}</p>
                  <div className="flex gap-1 mt-0.5 flex-wrap">
                    {f.accepts_medicaid && <span className="text-green-600 font-medium">Medicaid</span>}
                    {f.accepts_medicare && <span className="text-blue-600 font-medium">Medicare</span>}
                    {f.address_city && <span className="text-muted-foreground">{f.address_city}</span>}
                  </div>
                </div>
              </div>
            ))}
            {matchingFacilities.length > 4 && (
              <div className="text-xs text-muted-foreground px-2 py-1.5 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> +{matchingFacilities.length - 4} more
              </div>
            )}
          </div>
        </div>
      )}

      {isCovered && !hasNoFacilityType && matchingFacilities.length === 0 && (
        <p className="text-xs text-muted-foreground italic">No facility records found in county database for this benefit type.</p>
      )}

      {hasNoFacilityType && isCovered && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Info className="w-3 h-3" /> Facility matching not available for this benefit category.
        </p>
      )}
    </div>
  );
}

export default function BenefitsCoverageGapDashboard({ profile, coverages, facilities }) {
  const countyName = profile?.county || 'your county';

  const covered = coverages.filter(c => c.coverage_status !== 'not_covered');

  const { critical, warning, ok } = useMemo(() => {
    const counts = { critical: 0, warning: 0, ok: 0 };
    covered.forEach(benefit => {
      const relevantTypes = BENEFIT_TO_FACILITY[benefit.benefit_category] || [];
      if (relevantTypes.length === 0) return;
      const matching = facilities.filter(f => relevantTypes.includes(f.facility_type));
      const acceptsMedicaid = matching.filter(f => f.accepts_medicaid);
      if (matching.length === 0 || (acceptsMedicaid.length === 0 && matching.length === 0)) {
        counts.critical++;
      } else if (acceptsMedicaid.length === 0 || matching.length <= 1) {
        counts.warning++;
      } else {
        counts.ok++;
      }
    });
    return counts;
  }, [covered, facilities]);

  return (
    <div className="space-y-6">
      {/* Header Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{critical}</p>
            <p className="text-xs text-red-700 font-medium mt-0.5">Critical Gaps</p>
            <p className="text-xs text-muted-foreground mt-0.5">Covered, no local clinic</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{warning}</p>
            <p className="text-xs text-amber-700 font-medium mt-0.5">Limited Access</p>
            <p className="text-xs text-muted-foreground mt-0.5">Few or non-accepting facilities</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{ok}</p>
            <p className="text-xs text-green-700 font-medium mt-0.5">Well Covered</p>
            <p className="text-xs text-muted-foreground mt-0.5">Facilities available nearby</p>
          </CardContent>
        </Card>
      </div>

      {/* County Context */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-lg px-4 py-2.5 border border-border">
        <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
        <span>Comparing benefits against <strong className="text-foreground">{facilities.length} facilities</strong> on record in <strong className="text-foreground">{countyName}</strong>{profile?.state ? `, ${profile.state}` : ''}</span>
      </div>

      {/* Benefit Rows */}
      {covered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Shield className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No covered benefits to compare</p>
          <p className="text-sm">Add covered benefits in My Benefits to see the gap analysis.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Critical first, then warning, then ok */}
          {[...covered]
            .sort((a, b) => {
              const severity = (benefit) => {
                const types = BENEFIT_TO_FACILITY[benefit.benefit_category] || [];
                if (types.length === 0) return 3;
                const matching = facilities.filter(f => types.includes(f.facility_type));
                if (matching.length === 0) return 0;
                if (matching.filter(f => f.accepts_medicaid).length === 0) return 1;
                if (matching.length <= 1) return 2;
                return 3;
              };
              return severity(a) - severity(b);
            })
            .map(benefit => (
              <CoverageGapRow
                key={benefit.id}
                benefit={benefit}
                facilities={facilities}
                countyName={countyName}
              />
            ))}
        </div>
      )}
    </div>
  );
}