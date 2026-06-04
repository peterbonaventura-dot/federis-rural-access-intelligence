import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, AlertTriangle } from 'lucide-react';
import BenefitsCoverageGapDashboard from '@/components/benefits/BenefitsCoverageGapDashboard';

export default function MemberCoverageGap() {
  const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ['member-profiles'],
    queryFn: () => base44.entities.MemberProfile.list(),
  });

  const { data: coverages = [], isLoading: loadingCoverages } = useQuery({
    queryKey: ['benefits-coverage'],
    queryFn: () => base44.entities.BenefitsCoverage.list(),
  });

  const profile = profiles[0];

  // Match county to County entity
  const { data: counties = [] } = useQuery({
    queryKey: ['counties-all'],
    queryFn: () => base44.entities.County.list(),
    enabled: !!profile?.county,
  });

  const matchedCounty = counties.find(c =>
    c.county_name?.toLowerCase() === profile?.county?.toLowerCase() &&
    (!profile?.state || c.state_abbreviation === profile?.state || c.state?.toLowerCase().includes(profile?.state?.toLowerCase()))
  );

  const { data: facilities = [], isLoading: loadingFacilities } = useQuery({
    queryKey: ['county-facilities', matchedCounty?.id],
    queryFn: () => base44.entities.CountyFacility.filter({ county_id: matchedCounty.id }),
    enabled: !!matchedCounty?.id,
  });

  const isLoading = loadingProfiles || loadingCoverages || loadingFacilities;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Analyzing coverage gaps...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center text-muted-foreground">
        <MapPin className="w-10 h-10 mx-auto mb-3 opacity-20" />
        <p className="font-medium text-foreground">No member profile found</p>
        <p className="text-sm mt-1">Set up your profile first so we can match your county's facilities.</p>
      </div>
    );
  }

  if (!profile.county) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center text-muted-foreground">
        <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-20" />
        <p className="font-medium text-foreground">County not set in profile</p>
        <p className="text-sm mt-1">Add your county in My Profile to see local facility data.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold">Coverage Gap Analysis</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Where your covered benefits don't have a nearby in-network clinic
        </p>
      </div>

      {!matchedCounty && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="p-4 flex items-start gap-2 text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              County "<strong>{profile.county}</strong>" was not found in the research database.
              Facility comparison may be incomplete. Check your county spelling in My Profile.
            </span>
          </CardContent>
        </Card>
      )}

      <BenefitsCoverageGapDashboard
        profile={profile}
        coverages={coverages}
        facilities={facilities}
      />
    </div>
  );
}