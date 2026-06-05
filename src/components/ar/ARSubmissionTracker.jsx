import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, ExternalLink, AlertTriangle } from 'lucide-react';
import { STATUS_META } from '@/lib/arConstants';

export default function ARSubmissionTracker({ caseData, caseId, onUpdated }) {
  const [form, setForm] = useState({
    status: caseData.status,
    date_submitted: caseData.date_submitted || '',
    confirmation_number: caseData.confirmation_number || '',
    dhs_case_number: caseData.dhs_case_number || '',
    interview_required: caseData.interview_required || false,
    interview_date: caseData.interview_date || '',
    dhs_decision: caseData.dhs_decision || 'pending',
    approval_date: caseData.approval_date || '',
    denial_date: caseData.denial_date || '',
    denial_reason: caseData.denial_reason || '',
    appeal_deadline: caseData.appeal_deadline || '',
    renewal_due_date: caseData.renewal_due_date || '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function handleSave() {
    setSaving(true);
    const changedFields = Object.keys(form).filter(k => String(form[k]) !== String(caseData[k] ?? ''));
    await base44.entities.ARBenefitsCase.update(caseId, form);
    for (const field of changedFields) {
      await base44.entities.ARCaseNote.create({
        case_id: caseId,
        note_text: `Submission field "${field}" updated to "${form[field]}"`,
        note_type: field === 'status' ? 'status_change' : 'audit',
        field_changed: field,
        old_value: String(caseData[field] ?? ''),
        new_value: String(form[field]),
        source: 'staff',
      });
    }
    setSaving(false);
    onUpdated();
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 flex gap-2">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div>
          <strong>Access Arkansas Compliance:</strong> All submissions must be made directly by certified Community Partner staff through{' '}
          <a href="https://access.arkansas.gov" target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-0.5">
            access.arkansas.gov <ExternalLink className="w-3 h-3" />
          </a>. This tracker records status only — do not store passwords here.
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Case Status</Label>
          <Select value={form.status} onValueChange={v => set('status', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_META).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Date Submitted to Access AR</Label>
          <Input type="date" value={form.date_submitted} onChange={e => set('date_submitted', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Confirmation Number</Label>
          <Input value={form.confirmation_number} onChange={e => set('confirmation_number', e.target.value)} placeholder="Access AR confirmation #" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">DHS Case Number</Label>
          <Input value={form.dhs_case_number} onChange={e => set('dhs_case_number', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Interview Required?</Label>
          <Select value={form.interview_required ? 'yes' : 'no'} onValueChange={v => set('interview_required', v === 'yes')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="no">No</SelectItem>
              <SelectItem value="yes">Yes</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {form.interview_required && (
          <div className="space-y-1">
            <Label className="text-xs">Interview Date</Label>
            <Input type="date" value={form.interview_date} onChange={e => set('interview_date', e.target.value)} />
          </div>
        )}
      </div>

      <div className="border-t pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">DHS Decision</Label>
          <Select value={form.dhs_decision} onValueChange={v => set('dhs_decision', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {['pending','approved','denied','partial','withdrawn'].map(d => (
                <SelectItem key={d} value={d}>{d.replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {form.dhs_decision === 'approved' && (
          <div className="space-y-1">
            <Label className="text-xs">Approval Date</Label>
            <Input type="date" value={form.approval_date} onChange={e => set('approval_date', e.target.value)} />
          </div>
        )}
        {form.dhs_decision === 'denied' && (
          <>
            <div className="space-y-1">
              <Label className="text-xs">Denial Date</Label>
              <Input type="date" value={form.denial_date} onChange={e => set('denial_date', e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Denial Reason</Label>
              <Input value={form.denial_reason} onChange={e => set('denial_reason', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Appeal Deadline</Label>
              <Input type="date" value={form.appeal_deadline} onChange={e => set('appeal_deadline', e.target.value)} />
            </div>
          </>
        )}
        <div className="space-y-1">
          <Label className="text-xs">Renewal Due Date</Label>
          <Input type="date" value={form.renewal_due_date} onChange={e => set('renewal_due_date', e.target.value)} />
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
        Save Submission Data
      </Button>
    </div>
  );
}