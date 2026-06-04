import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, GraduationCap, DollarSign, Clock, CheckCircle, ArrowRight, Lightbulb, AlertTriangle } from 'lucide-react';

const PIPELINE_STEPS = [
  {
    step: 1,
    title: 'Identify Eligible Unemployed Residents',
    description: 'Target working-age unemployed individuals (18–64) currently receiving unemployment benefits or SNAP.',
    duration: '2–4 weeks',
    cost: '$0 – Outreach only',
    icon: Users,
    color: 'bg-blue-50 border-blue-200',
    iconColor: 'text-blue-600',
    tactics: [
      'Partner with local SNAP/Medicaid offices to identify and refer eligible candidates',
      'Work with Arkansas Workforce Centers for job placement programs',
      'Target veterans with caregiving aptitude for preferential enrollment',
      'Use peer-referral networks in Delta communities',
    ],
  },
  {
    step: 2,
    title: 'Fast-Track CNA / HHA Training (4–6 Weeks)',
    description: 'Subsidized, accelerated caregiver certification training at community colleges, FQHCs, or mobile training units.',
    duration: '4–6 weeks',
    cost: '$1,200–$2,500 per trainee',
    icon: GraduationCap,
    color: 'bg-emerald-50 border-emerald-200',
    iconColor: 'text-emerald-600',
    tactics: [
      'Leverage WIOA (Workforce Innovation & Opportunity Act) Title I funding for training costs',
      'Apply for HRSA Rural Health Workforce grants to fund mobile training units',
      'Use DSP (Direct Support Professional) certification tracks for IDD-focused roles',
      'Coordinate with community colleges for on-site or hybrid training delivery',
    ],
  },
  {
    step: 3,
    title: 'Bridge Financial Barriers During Training',
    description: 'Stipends and support to keep trainees enrolled through the full training period.',
    duration: 'Concurrent with Step 2',
    cost: '$500–$800/month per trainee in stipends',
    icon: DollarSign,
    color: 'bg-amber-50 border-amber-200',
    iconColor: 'text-amber-600',
    tactics: [
      'Allow trainees to maintain SNAP and Medicaid benefits during training',
      'Offer training stipends funded by CMS HCBS Quality & Access initiatives',
      'Provide childcare support for single-parent trainees',
      'Partner with local employers for "earn while you learn" models',
    ],
  },
  {
    step: 4,
    title: 'Job Placement with Elderly & Disabled Clients',
    description: 'Match newly certified caregivers with elderly Medicaid beneficiaries in their own community — reducing travel barriers for both parties.',
    duration: '1–2 weeks post-certification',
    cost: '$300–$600 per placement (matching & onboarding)',
    icon: CheckCircle,
    color: 'bg-purple-50 border-purple-200',
    iconColor: 'text-purple-600',
    tactics: [
      'Prioritize neighbor-to-neighbor matching to minimize transportation barriers',
      'Use HCBS Medicaid waiver authorizations to fund caregiver hours',
      'Connect placements through Area Agencies on Aging (AAAs)',
      'Establish shared-care arrangements for isolated rural clients',
    ],
  },
  {
    step: 5,
    title: 'Retain Through Competitive Wages & Career Ladders',
    description: 'Address the #1 driver of caregiver turnover: low wages and no advancement pathways.',
    duration: 'Ongoing',
    cost: 'Medicaid rate increases + employer match',
    icon: ArrowRight,
    color: 'bg-rose-50 border-rose-200',
    iconColor: 'text-rose-600',
    tactics: [
      'Advocate for Medicaid HCBS rate increases to support $15–$17/hr wages',
      'Create CNA → LPN → RN career ladder with tuition support',
      'Implement peer mentorship programs with experienced caregivers',
      'Offer retention bonuses funded through State Directed Payments',
    ],
  },
];

const FUNDING_SOURCES = [
  { name: 'WIOA Title I', agency: 'DOL', focus: 'Workforce training subsidies', eligibility: 'Unemployed residents' },
  { name: 'HCBS Quality & Access Initiative', agency: 'CMS', focus: 'Caregiver pipeline development', eligibility: 'State Medicaid agencies' },
  { name: 'Rural Health Workforce Grant', agency: 'HRSA', focus: 'Mobile training, rural recruitment', eligibility: 'Rural health orgs' },
  { name: 'SNAP Employment & Training', agency: 'USDA/FNS', focus: 'Job readiness for SNAP recipients', eligibility: 'SNAP recipients' },
  { name: 'ARC Workforce Dev Fund', agency: 'Appalachian Reg. Comm.', focus: 'Caregiver jobs in Appalachia', eligibility: 'Appalachian counties' },
  { name: 'State Directed Payments', agency: 'CMS/State', focus: 'Higher HCBS rates to fund wages', eligibility: 'Medicaid MCOs' },
];

export default function UnemployedCaregiverPipeline({ county }) {
  const [expanded, setExpanded] = useState(null);

  // Estimate pipeline potential based on county data
  const unemployedPool = county ? Math.round((county.population_total || 10000) * ((county.unemployment_rate || 8) / 100)) : null;
  const estimatedEligible = unemployedPool ? Math.round(unemployedPool * 0.35) : null;
  const estimatedCaregivers = estimatedEligible ? Math.round(estimatedEligible * 0.25) : null;
  const elderlyNeedingCare = county ? Math.round((county.population_65_plus || 2000) * 0.18) : null;

  return (
    <div className="space-y-6">
      {/* Header insight */}
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="pt-5">
          <div className="flex items-start gap-3">
            <Lightbulb className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <h3 className="font-semibold text-amber-900 mb-1">Unemployment-to-Caregiver Pipeline Strategy</h3>
              <p className="text-sm text-amber-800 leading-relaxed">
                In counties with high unemployment and a growing elderly population, the unemployed workforce represents the largest untapped caregiver pipeline. With targeted training and Medicaid-funded wages, local unemployed residents can be trained and placed as paid caregivers for elderly and disabled neighbors — addressing workforce shortages while reducing poverty.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* County-specific estimates */}
      {county && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{unemployedPool?.toLocaleString() ?? '—'}</p>
            <p className="text-xs text-muted-foreground mt-1">Est. Unemployed Residents</p>
            <p className="text-[10px] text-muted-foreground">{county.unemployment_rate}% unemployment rate</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{estimatedEligible?.toLocaleString() ?? '—'}</p>
            <p className="text-xs text-muted-foreground mt-1">Pipeline-Eligible Adults</p>
            <p className="text-[10px] text-muted-foreground">Ages 18–64, no barriers to care work</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{estimatedCaregivers?.toLocaleString() ?? '—'}</p>
            <p className="text-xs text-muted-foreground mt-1">Projected New Caregivers</p>
            <p className="text-[10px] text-muted-foreground">~25% conversion with incentives</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">{elderlyNeedingCare?.toLocaleString() ?? '—'}</p>
            <p className="text-xs text-muted-foreground mt-1">Elderly Needing Home Care</p>
            <p className="text-[10px] text-muted-foreground">Est. 18% of 65+ population</p>
          </div>
        </div>
      )}

      {/* Pipeline Steps */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">5-Step Implementation Pathway</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {PIPELINE_STEPS.map((step) => {
            const Icon = step.icon;
            const isOpen = expanded === step.step;
            return (
              <div
                key={step.step}
                className={`border rounded-xl overflow-hidden cursor-pointer transition-all ${step.color}`}
                onClick={() => setExpanded(isOpen ? null : step.step)}
              >
                <div className="flex items-start gap-4 p-4">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full bg-white border shrink-0 mt-0.5`}>
                    <span className={`text-sm font-bold ${step.iconColor}`}>{step.step}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-semibold text-foreground">{step.title}</h4>
                      <div className="flex gap-2 shrink-0">
                        <Badge variant="outline" className="text-[10px]">{step.duration}</Badge>
                        <Badge variant="outline" className="text-[10px]">{step.cost}</Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{step.description}</p>
                  </div>
                  <Icon className={`h-4 w-4 ${step.iconColor} shrink-0 mt-1`} />
                </div>
                {isOpen && (
                  <div className="px-4 pb-4 pt-0 border-t border-current/10">
                    <p className="text-xs font-semibold text-muted-foreground mb-2 mt-3">IMPLEMENTATION TACTICS</p>
                    <ul className="space-y-1.5">
                      {step.tactics.map((t, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Funding Sources */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Available Federal Funding Sources</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {FUNDING_SOURCES.map((f, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-muted/40 rounded-lg border border-border">
                <DollarSign className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-foreground">{f.name}</p>
                    <Badge variant="outline" className="text-[9px] py-0">{f.agency}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{f.focus}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Eligible: {f.eligibility}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Key barriers callout */}
      <Card className="border-red-200 bg-red-50/30">
        <CardContent className="pt-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-800 mb-1">Critical Barriers to Address</p>
              <ul className="space-y-1">
                {[
                  'Transportation: Many unemployed residents lack reliable vehicles to reach training sites — mobile training or stipended rideshare is essential',
                  'Medicaid wage floors: Training is pointless if caregiver wages remain below $12/hr — Medicaid rate reform must run in parallel',
                  'Background check delays: Streamline state-level CNA background checks to reduce time-to-placement',
                  'Digital literacy: Rural unemployed populations may need basic digital skills for EVV (Electronic Visit Verification) systems',
                ].map((b, i) => (
                  <li key={i} className="text-xs text-red-700 flex items-start gap-1.5">
                    <span className="mt-1 shrink-0">•</span>{b}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}