import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';

const BENEFITS = ['Medicaid', 'SNAP', 'TEA', 'ARKids', 'TEFRA', 'LTSS', 'Other'];

export default function ARNewCaseForm({ onSuccess }) {
  const [form, setForm] = useState({
    member_name: '', dob: '', phone: '', email: '', address: '', city: '', county: '',
    medicaid_id: '', ssn_last4: '',
    guardian_name: '', guardian_relationship: '',
    application_type: 'new_application',
    benefits_applied_for: [],
    assigned_staff_name: '', staff_access_ar_username: '',
    date_started: new Date().toISOString().split('T')[0],
    priority: 'routine',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  function toggleBenefit(b) {
    setForm(prev => ({
      ...prev,
      benefits_applied_for: prev.benefits_applied_for.includes(b)
        ? prev.benefits_applied_for.filter(x => x !== b)
        : [...prev.benefits_applied_for, b],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const created = await base44.entities.ARBenefitsCase.create({
      ...form,
      status: 'intake_started',
      consent_status: 'not_collected',
      state: 'AR',
    });
    // Create audit note
    await base44.entities.ARCaseNote.create({
      case_id: created.id,
      note_text: `Case created for ${form.member_name} — ${form.application_type.replace(/_/g, ' ')} for ${form.benefits_applied_for.join(', ')}`,
      note_type: 'audit',
      source: 'staff',
    });
    setSaving(false);
    onSuccess();
  }

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Member Full Name <span className="text-destructive">*</span></Label>
          <Input value={form.member_name} onChange={e => set('member_name', e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Date of Birth <span className="text-destructive">*</span></Label>
          <Input type="date" value={form.dob} onChange={e => set('dob', e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Phone</Label>
          <Input value={form.phone} onChange={e => set('phone', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Email</Label>
          <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">Address</Label>
          <Input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Street address" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">City</Label>
          <Input value={form.city} onChange={e => set('city', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">County (AR)</Label>
          <Input value={form.county} onChange={e => set('county', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Existing Medicaid ID</Label>
          <Input value={form.medicaid_id} onChange={e => set('medicaid_id', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">SSN Last 4 (if stored per policy)</Label>
          <Input value={form.ssn_last4} onChange={e => set('ssn_last4', e.target.value)} maxLength={4} placeholder="XXXX" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Guardian / Authorized Rep Name</Label>
          <Input value={form.guardian_name} onChange={e => set('guardian_name', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Relationship to Member</Label>
          <Input value={form.guardian_relationship} onChange={e => set('guardian_relationship', e.target.value)} />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Application Type <span className="text-destructive">*</span></Label>
        <Select value={form.application_type} onValueChange={v => set('application_type', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {['new_application','renewal','change_report','document_upload','appeal'].map(t => (
              <SelectItem key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Benefits Being Applied For</Label>
        <div className="flex flex-wrap gap-2">
          {BENEFITS.map(b => (
            <label key={b} className="flex items-center gap-1.5 text-sm cursor-pointer">
              <Checkbox checked={form.benefits_applied_for.includes(b)} onCheckedChange={() => toggleBenefit(b)} />
              {b}
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Assigned Staff Member</Label>
          <Input value={form.assigned_staff_name} onChange={e => set('assigned_staff_name', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Staff Access AR Username (no password)</Label>
          <Input value={form.staff_access_ar_username} onChange={e => set('staff_access_ar_username', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Date Started</Label>
          <Input type="date" value={form.date_started} onChange={e => set('date_started', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Priority</Label>
          <Select value={form.priority} onValueChange={v => set('priority', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="routine">Routine</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
        {saving ? 'Creating Case…' : 'Create Case'}
      </Button>
    </form>
  );
}