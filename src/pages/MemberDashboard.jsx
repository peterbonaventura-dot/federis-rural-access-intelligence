import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Shield, Heart, Eye, Pill, Car, Home, AlertCircle,
  CheckCircle2, Clock, ChevronRight, User, HelpCircle,
  FileText, Phone, CalendarDays, RefreshCw
} from 'lucide-react';
import CoverageCard from '@/components/benefits/CoverageCard';
import ProfileSetupBanner from '@/components/benefits/ProfileSetupBanner';
import CountyClinicsPanel from '@/components/member/CountyClinicsPanel';

const COVERAGE_LABELS = {
  medicaid_only: { label: 'Medicaid', color: 'bg-blue-100 text-blue-800' },
  medicare_only: { label: 'Medicare', color: 'bg-purple-100 text-purple-800' },
  dual_eligible: { label: 'Dual Eligible', color: 'bg-teal-100 text-teal-800' },
  none: { label: 'No Coverage', color: 'bg-gray-100 text-gray-700' },
};

const STATUS_ICON = {
  active: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  pending: <Clock className="w-4 h-4 text-yellow-500" />,
  inactive: <AlertCircle className="w-4 h-4 text-gray-400" />,
  terminated: <AlertCircle className="w-4 h-4 text-red-500" />,
};

const QUICK_LINKS = [
  { label: 'Help Center', icon: HelpCircle, to: '/member-help-center', color: 'text-blue-600' },
  { label: 'Submit Request', icon: FileText, to: '/member-support', color: 'text-purple-600' },
  { label: 'My Benefits', icon: Shield, to: '/member-benefits', color: 'text-teal-600' },
  { label: 'Contact Info', icon: Phone, to: '/member-profile', color: 'text-orange-600' },
];

export default function MemberDashboard() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: profiles = [] } = useQuery({
    queryKey: ['member-profiles'],
    queryFn: () => base44.entities.MemberProfile.list(),
  });

  const { data: coverages = [] } = useQuery({
    queryKey: ['benefits-coverage'],
    queryFn: () => base44.entities.BenefitsCoverage.list(),
  });

  const { data: requests = [] } = useQuery({
    queryKey: ['support-requests'],
    queryFn: () => base44.entities.SupportRequest.list(),
  });

  const profile = profiles[0];
  const coverageLabel = profile ? COVERAGE_LABELS[profile.coverage_type] : null;
  const openRequests = requests.filter(r => r.status === 'open' || r.status === 'in_review');

  const renewalDays = profile?.renewal_due_date
    ? Math.ceil((new Date(profile.renewal_due_date) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary px-6 py-8 text-white">
        <div className="max-w-4xl mx-auto">
          <p className="text-primary-foreground/70 text-sm mb-1">Welcome back</p>
          <h1 className="text-2xl font-bold">{user?.full_name || 'Member'}</h1>
          {profile && (
            <div className="flex items-center gap-3 mt-3">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${coverageLabel?.color}`}>
                {coverageLabel?.label}
              </span>
              <div className="flex items-center gap-1.5 text-sm text-primary-foreground/80">
                {STATUS_ICON[profile.enrollment_status]}
                <span className="capitalize">{profile.enrollment_status}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {!profile && <ProfileSetupBanner />}

        {/* Alerts */}
        {renewalDays !== null && renewalDays <= 60 && renewalDays > 0 && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <CalendarDays className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-amber-800 text-sm">Coverage Renewal Due</p>
              <p className="text-amber-700 text-sm mt-0.5">
                Your coverage renews in <strong>{renewalDays} days</strong> on{' '}
                {new Date(profile.renewal_due_date).toLocaleDateString()}.
                Make sure your information is up to date.
              </p>
              <Link to="/member-profile">
                <Button size="sm" variant="outline" className="mt-2 border-amber-400 text-amber-700 hover:bg-amber-100">
                  Review Profile
                </Button>
              </Link>
            </div>
          </div>
        )}

        {openRequests.length > 0 && (
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-blue-800 font-medium">
                {openRequests.length} support request{openRequests.length > 1 ? 's' : ''} in progress
              </span>
            </div>
            <Link to="/member-support">
              <Button size="sm" variant="ghost" className="text-blue-700 text-xs">View <ChevronRight className="w-3 h-3 ml-1" /></Button>
            </Link>
          </div>
        )}

        {/* Quick Links */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {QUICK_LINKS.map(({ label, icon: Icon, to, color }) => (
            <Link key={to} to={to}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer text-center py-4">
                <CardContent className="p-0 flex flex-col items-center gap-2">
                  <Icon className={`w-6 h-6 ${color}`} />
                  <span className="text-xs font-medium text-foreground">{label}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Plan Summary */}
        {profile && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4 text-primary" /> My Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Plan Name</p>
                  <p className="font-medium">{profile.plan_name || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Primary Care Provider</p>
                  <p className="font-medium">{profile.primary_care_provider || '—'}</p>
                </div>
                {profile.medicaid_id && (
                  <div>
                    <p className="text-muted-foreground text-xs">Medicaid ID</p>
                    <p className="font-mono text-sm">{profile.medicaid_id}</p>
                  </div>
                )}
                {profile.medicare_id && (
                  <div>
                    <p className="text-muted-foreground text-xs">Medicare ID</p>
                    <p className="font-mono text-sm">{profile.medicare_id}</p>
                  </div>
                )}
                {profile.plan_start_date && (
                  <div>
                    <p className="text-muted-foreground text-xs">Coverage Start</p>
                    <p className="font-medium">{new Date(profile.plan_start_date).toLocaleDateString()}</p>
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-1">
                <Link to="/member-profile">
                  <Button size="sm" variant="outline">Edit Profile</Button>
                </Link>
                <Link to="/member-benefits">
                  <Button size="sm" variant="outline">View Benefits</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* In-Network Clinics + Coverage Gaps */}
        {profile && (
          <CountyClinicsPanel profile={profile} coverages={coverages} />
        )}

        {/* Key Benefits Preview */}
        {coverages.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-foreground">My Benefits</h2>
              <Link to="/member-benefits">
                <Button variant="ghost" size="sm" className="text-primary text-xs">
                  View All <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {coverages.slice(0, 4).map(c => (
                <CoverageCard key={c.id} coverage={c} compact />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}