import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Search, ExternalLink, AlertTriangle, Clock, CheckCircle2, XCircle } from 'lucide-react';
import ARNewCaseForm from '@/components/ar/ARNewCaseForm';
import { STATUS_META, BENEFIT_COLORS } from '@/lib/arConstants';

export default function ARCaseDashboard({ onSelectCase }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showNew, setShowNew] = useState(false);
  const qc = useQueryClient();

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ['ar-cases'],
    queryFn: () => base44.entities.ARBenefitsCase.list('-created_date', 200),
  });

  const filtered = cases.filter(c => {
    const matchSearch = !search || c.member_name?.toLowerCase().includes(search.toLowerCase()) || c.dhs_case_number?.includes(search);
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusCounts = cases.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Cases', value: cases.length, icon: <Clock className="w-4 h-4" />, color: 'text-primary' },
          { label: 'Needs Action', value: cases.filter(c => ['consent_needed','documents_needed','ready_to_submit','additional_docs_requested'].includes(c.status)).length, icon: <AlertTriangle className="w-4 h-4" />, color: 'text-amber-600' },
          { label: 'Approved', value: statusCounts['approved'] || 0, icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-green-600' },
          { label: 'Denied / Appeal', value: (statusCounts['denied'] || 0) + (statusCounts['appeal_needed'] || 0), icon: <XCircle className="w-4 h-4" />, color: 'text-destructive' },
        ].map(s => (
          <div key={s.label} className="bg-card border rounded-lg p-4 flex items-center gap-3">
            <span className={s.color}>{s.icon}</span>
            <div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-xl font-bold">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search member name or DHS case #…" className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_META).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setShowNew(true)}>
          <Plus className="w-4 h-4 mr-1" /> New Case
        </Button>
      </div>

      {/* Cases list */}
      {isLoading ? (
        <div className="text-center text-muted-foreground py-12 text-sm">Loading cases…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 text-sm">No cases found.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => {
            const meta = STATUS_META[c.status] || { label: c.status, color: 'bg-muted text-muted-foreground' };
            return (
              <button
                key={c.id}
                onClick={() => onSelectCase(c.id)}
                className="w-full text-left bg-card border rounded-xl p-4 hover:border-primary/40 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">{c.member_name}</span>
                      {c.priority === 'urgent' && <Badge className="bg-amber-100 text-amber-700 text-xs">Urgent</Badge>}
                      {c.priority === 'critical' && <Badge className="bg-red-100 text-red-700 text-xs">Critical</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {(c.benefits_applied_for || []).map(b => (
                        <span key={b} className={`text-xs px-1.5 py-0.5 rounded font-medium ${BENEFIT_COLORS[b] || 'bg-muted text-muted-foreground'}`}>{b}</span>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {c.dhs_case_number && <span>DHS #{c.dhs_case_number}</span>}
                      {c.assigned_staff_name && <span>Staff: {c.assigned_staff_name}</span>}
                      {c.renewal_due_date && <span>Renewal: {c.renewal_due_date}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <Badge className={`text-xs ${meta.color}`}>{meta.label}</Badge>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Benefit Assistance Case</DialogTitle>
          </DialogHeader>
          <ARNewCaseForm onSuccess={() => { setShowNew(false); qc.invalidateQueries({ queryKey: ['ar-cases'] }); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}