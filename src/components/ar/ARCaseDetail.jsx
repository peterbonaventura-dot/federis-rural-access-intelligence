import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowLeft, Shield } from 'lucide-react';
import { STATUS_META, BENEFIT_COLORS } from '@/lib/arConstants';
import ARCaseInfo from '@/components/ar/ARCaseInfo';
import ARDocumentChecklist from '@/components/ar/ARDocumentChecklist';
import ARSubmissionTracker from '@/components/ar/ARSubmissionTracker';
import ARCaseNotes from '@/components/ar/ARCaseNotes';

export default function ARCaseDetail({ caseId, onBack }) {
  const [tab, setTab] = useState('info');
  const qc = useQueryClient();

  const { data: caseData, isLoading } = useQuery({
    queryKey: ['ar-case', caseId],
    queryFn: async () => {
      const cases = await base44.entities.ARBenefitsCase.list();
      return cases.find(c => c.id === caseId);
    },
  });

  if (isLoading || !caseData) {
    return <div className="p-8 text-center text-muted-foreground text-sm">Loading case…</div>;
  }

  const meta = STATUS_META[caseData.status] || { label: caseData.status, color: 'bg-muted text-muted-foreground' };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" /> All Cases
        </Button>
        <div className="flex items-center gap-2 flex-1">
          <Shield className="w-4 h-4 text-primary" />
          <span className="font-semibold">{caseData.member_name}</span>
          <span className="text-sm text-muted-foreground">DOB: {caseData.dob}</span>
        </div>
        <Badge className={`text-xs ${meta.color}`}>{meta.label}</Badge>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(caseData.benefits_applied_for || []).map(b => (
          <span key={b} className={`text-xs px-2 py-0.5 rounded font-medium ${BENEFIT_COLORS[b] || 'bg-muted text-muted-foreground'}`}>{b}</span>
        ))}
        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">
          {caseData.application_type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
        </span>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="info">Case Info</TabsTrigger>
          <TabsTrigger value="docs">Documents</TabsTrigger>
          <TabsTrigger value="submission">Submission & DHS</TabsTrigger>
          <TabsTrigger value="notes">Notes & Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4">
          <ARCaseInfo caseData={caseData} caseId={caseId} onUpdated={() => qc.invalidateQueries({ queryKey: ['ar-case', caseId] })} />
        </TabsContent>
        <TabsContent value="docs" className="mt-4">
          <ARDocumentChecklist caseId={caseId} benefits={caseData.benefits_applied_for || []} />
        </TabsContent>
        <TabsContent value="submission" className="mt-4">
          <ARSubmissionTracker caseData={caseData} caseId={caseId} onUpdated={() => qc.invalidateQueries({ queryKey: ['ar-case', caseId] })} />
        </TabsContent>
        <TabsContent value="notes" className="mt-4">
          <ARCaseNotes caseId={caseId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}