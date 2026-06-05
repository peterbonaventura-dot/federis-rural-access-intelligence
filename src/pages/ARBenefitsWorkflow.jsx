import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Shield } from 'lucide-react';
import ARCaseDashboard from '@/components/ar/ARCaseDashboard';
import ARCaseDetail from '@/components/ar/ARCaseDetail';
import ARRenewalCalendar from '@/components/ar/ARRenewalCalendar';
import ARStaffCompliance from '@/components/ar/ARStaffCompliance';
import ARAlertPanel from '@/components/ar/ARAlertPanel';

export default function ARBenefitsWorkflow() {
  const [activeTab, setActiveTab] = useState('cases');
  const [selectedCaseId, setSelectedCaseId] = useState(null);

  if (selectedCaseId) {
    return <ARCaseDetail caseId={selectedCaseId} onBack={() => setSelectedCaseId(null)} />;
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Access Arkansas Community Partner</h1>
          <p className="text-sm text-muted-foreground">Independence Care / Camp Independence — DHS Benefits Workflow</p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-xs text-amber-800">
        <strong>Compliance Notice:</strong> This system manages workflow and documents only. Do not store Access Arkansas passwords. All submissions must be made directly through Access Arkansas by a certified Community Partner staff member.
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="cases">Cases</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="renewals">Renewals</TabsTrigger>
          <TabsTrigger value="staff">Staff & Training</TabsTrigger>
        </TabsList>

        <TabsContent value="cases" className="mt-4">
          <ARCaseDashboard onSelectCase={setSelectedCaseId} />
        </TabsContent>
        <TabsContent value="alerts" className="mt-4">
          <ARAlertPanel onSelectCase={setSelectedCaseId} />
        </TabsContent>
        <TabsContent value="renewals" className="mt-4">
          <ARRenewalCalendar onSelectCase={setSelectedCaseId} />
        </TabsContent>
        <TabsContent value="staff" className="mt-4">
          <ARStaffCompliance />
        </TabsContent>
      </Tabs>
    </div>
  );
}