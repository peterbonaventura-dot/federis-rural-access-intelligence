import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { WEIGHTS, SCORE_CATEGORIES } from '@/lib/scoringEngine';
import { format } from 'date-fns';

export default function AppSettings() {
  const { data: auditLogs = [] } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: () => base44.entities.AuditLog.list('-created_date', 50),
  });

  return (
    <div>
      <PageHeader title="Settings" description="Scoring model configuration, audit log, and system settings." />
      <div className="p-8 space-y-6">
        {/* Scoring Model */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Scoring Model Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              The Rural Access Risk Score uses a transparent weighted model (0-100). Higher scores indicate greater risk.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {SCORE_CATEGORIES.map(cat => (
                <div key={cat.key} className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-sm font-medium">{cat.label}</p>
                  <p className="text-xs text-muted-foreground">Weight: <span className="font-semibold text-foreground">{cat.weight}</span></p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Thresholds */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Flag Thresholds
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-lg border">
                <span className="font-medium">Care Desert:</span> Overall ≥ 70 AND Provider Capacity ≥ 65
              </div>
              <div className="p-3 rounded-lg border">
                <span className="font-medium">Benefits Desert:</span> Benefits Access ≥ 70
              </div>
              <div className="p-3 rounded-lg border">
                <span className="font-medium">Hospital Discharge Risk:</span> Hospital Discharge ≥ 65
              </div>
              <div className="p-3 rounded-lg border">
                <span className="font-medium">Workforce Crisis:</span> Workforce Shortage ≥ 75
              </div>
              <div className="p-3 rounded-lg border sm:col-span-2">
                <span className="font-medium">High Priority Research:</span> Overall ≥ 60 OR Care Desert OR Workforce Crisis
              </div>
            </div>
          </CardContent>
        </Card>

        {/* De-identification */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Data Privacy & De-Identification
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>• All data is stored at the county aggregate level only.</p>
            <p>• No PII (names, addresses, phone numbers, Medicaid IDs, SSNs) is stored.</p>
            <p>• Public-facing research outputs use only aggregated county-level data.</p>
            <p>• Operational data is de-identified before import.</p>
            <p>• All imports and exports are logged in the audit trail.</p>
          </CardContent>
        </Card>

        {/* Audit Log */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Audit Log
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No audit entries yet</TableCell></TableRow>
                ) : (
                  auditLogs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell><Badge variant="outline">{log.action?.replace(/_/g, ' ')}</Badge></TableCell>
                      <TableCell className="text-sm">{log.description}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{log.user_email || '—'}</TableCell>
                      <TableCell className="text-xs">{format(new Date(log.created_date), 'MMM d, yyyy HH:mm')}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}