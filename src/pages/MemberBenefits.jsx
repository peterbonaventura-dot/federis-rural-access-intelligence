import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Shield, Plus, ChevronDown, ChevronUp, CheckCircle2,
  XCircle, Clock, AlertCircle, Heart, Eye, Pill, Car,
  Home, Brain, Stethoscope, Package
} from 'lucide-react';
import CoverageCard from '@/components/benefits/CoverageCard';
import AddBenefitDialog from '@/components/benefits/AddBenefitDialog';

const CATEGORY_ICONS = {
  medical: Stethoscope, dental: Shield, vision: Eye, mental_health: Brain,
  prescription_drugs: Pill, home_health: Home, personal_care: Heart,
  transportation: Car, dme: Package, hospice: Heart, other: Shield,
};

const CATEGORY_LABELS = {
  medical: 'Medical', dental: 'Dental', vision: 'Vision',
  mental_health: 'Mental Health', prescription_drugs: 'Prescriptions',
  home_health: 'Home Health', personal_care: 'Personal Care',
  transportation: 'Transportation', dme: 'Medical Equipment',
  hospice: 'Hospice', other: 'Other',
};

const STATUS_CONFIG = {
  covered: { label: 'Covered', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
  not_covered: { label: 'Not Covered', icon: XCircle, color: 'text-red-500', bg: 'bg-red-50 border-red-200' },
  requires_prior_auth: { label: 'Prior Auth Required', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  limited: { label: 'Limited Coverage', icon: AlertCircle, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
};

export default function MemberBenefits() {
  const [showAdd, setShowAdd] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});
  const queryClient = useQueryClient();

  const { data: coverages = [], isLoading } = useQuery({
    queryKey: ['benefits-coverage'],
    queryFn: () => base44.entities.BenefitsCoverage.list(),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['member-profiles'],
    queryFn: () => base44.entities.MemberProfile.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.BenefitsCoverage.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['benefits-coverage'] }),
  });

  const grouped = coverages.reduce((acc, c) => {
    const cat = c.benefit_category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(c);
    return acc;
  }, {});

  const toggleCategory = (cat) =>
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));

  const profile = profiles[0];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">My Benefits</h1>
          {profile && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {profile.plan_name || 'Current Plan'} — {profile.coverage_type?.replace('_', ' ')}
            </p>
          )}
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Add Benefit
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(STATUS_CONFIG).map(([status, config]) => {
          const count = coverages.filter(c => c.coverage_status === status).length;
          const Icon = config.icon;
          return (
            <Card key={status} className={`border ${config.bg}`}>
              <CardContent className="p-3 text-center">
                <Icon className={`w-5 h-5 mx-auto mb-1 ${config.color}`} />
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs text-muted-foreground">{config.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Grouped by Category */}
      {Object.keys(grouped).length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No benefits added yet</p>
          <p className="text-sm mb-4">Add your covered benefits to track them here.</p>
          <Button onClick={() => setShowAdd(true)}>Add Your First Benefit</Button>
        </div>
      ) : (
        Object.entries(grouped).map(([cat, items]) => {
          const Icon = CATEGORY_ICONS[cat] || Shield;
          const expanded = expandedCategories[cat] !== false;
          return (
            <Card key={cat}>
              <CardHeader
                className="cursor-pointer py-3 px-4"
                onClick={() => toggleCategory(cat)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-primary" />
                    <CardTitle className="text-sm font-semibold">{CATEGORY_LABELS[cat] || cat}</CardTitle>
                    <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                  </div>
                  {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </CardHeader>
              {expanded && (
                <CardContent className="pt-0 px-4 pb-4 space-y-2">
                  {items.map(c => (
                    <CoverageCard
                      key={c.id}
                      coverage={c}
                      onDelete={() => deleteMutation.mutate(c.id)}
                    />
                  ))}
                </CardContent>
              )}
            </Card>
          );
        })
      )}

      {showAdd && (
        <AddBenefitDialog
          profiles={profiles}
          onClose={() => setShowAdd(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['benefits-coverage'] });
            setShowAdd(false);
          }}
        />
      )}
    </div>
  );
}