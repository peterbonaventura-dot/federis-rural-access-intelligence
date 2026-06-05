import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Edit2, Save, X } from 'lucide-react';
import { STATUS_META } from '@/lib/arConstants';

export default function ARCaseInfo({ caseData, caseId, onUpdated }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...caseData });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    // Build audit fields
    const changedFields = Object.keys(form).filter(k => form[k] !== caseData[k]);
    await base44.entities.ARBenefitsCase.update(caseId, form);
    // Audit note for each changed field
    for (const field of changedFields) {
      await base44.entities.ARCaseNote.create({
        case_id: caseId,
        note_text: `Field "${field}" updated`,
        note_type: 'audit',
        field_changed: field,
        old_value: String(caseData[field] ?? ''),
        new_value: String(form[field] ?? ''),
        source: 'staff',
      });
    }
    setSaving(false);
    setEditing(false);
    onUpdated();
  }

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const rows = [
    { label: 'Phone', key: 'phone', type: 'text' },
    { label: 'Email', key: 'email', type: 'email' },
    { label: 'Address', key: 'address', type: 'text' },
    { label: 'County', key: 'county', type: 'text' },
    { label: 'Medicaid ID', key: 'medicaid_id', type: 'text' },
    { label: 'Guardian Name', key: 'guardian_name', type: 'text' },
    { label: 'Guardian Relationship', key: 'guardian_relationship', type: 'text' },
    { label: 'Assigned Staff', key: 'assigned_staff_name', type: 'text' },
    { label: 'Staff Access AR Username', key: 'staff_access_ar_username', type: 'text' },
    { label: 'Renewal Due Date', key: 'renewal_due_date', type: 'date' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2 items-center">
          <span className="text-sm font-medium">Case Status</span>
          <Badge className={`text-xs ${STATUS_META[caseData.status]?.color}`}>{STATUS_META[caseData.status]?.label || caseData.status}</Badge>
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setEditing(false); setForm({ ...caseData }); }}>
                <X className="w-3.5 h-3.5" /> Cancel
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
            </Button>
          )}
        </div>
      </div>

      {editing && (
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={form.status} onValueChange={v => set('status', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_META).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {rows.map(row => (
          <div key={row.key} className="space-y-1">
            <Label className="text-xs text-muted-foreground">{row.label}</Label>
            {editing ? (
              <Input type={row.type} value={form[row.key] || ''} onChange={e => set(row.key, e.target.value)} className="h-8 text-sm" />
            ) : (
              <p className="text-sm font-medium">{caseData[row.key] || <span className="text-muted-foreground italic">Not set</span>}</p>
            )}
          </div>
        ))}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
        <strong>Consent Status:</strong> {caseData.consent_status?.replace(/_/g, ' ') || 'Not collected'}
        {caseData.consent_date && ` — Signed ${caseData.consent_date}`}
      </div>
    </div>
  );
}