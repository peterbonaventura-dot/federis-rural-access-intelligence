import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CATEGORIES = [
  { value: 'medical', label: 'Medical' },
  { value: 'dental', label: 'Dental' },
  { value: 'vision', label: 'Vision' },
  { value: 'mental_health', label: 'Mental Health' },
  { value: 'prescription_drugs', label: 'Prescription Drugs' },
  { value: 'home_health', label: 'Home Health' },
  { value: 'personal_care', label: 'Personal Care' },
  { value: 'transportation', label: 'Transportation' },
  { value: 'dme', label: 'Medical Equipment' },
  { value: 'hospice', label: 'Hospice' },
  { value: 'other', label: 'Other' },
];

const STATUSES = [
  { value: 'covered', label: 'Covered' },
  { value: 'not_covered', label: 'Not Covered' },
  { value: 'requires_prior_auth', label: 'Requires Prior Authorization' },
  { value: 'limited', label: 'Limited Coverage' },
];

export default function AddBenefitDialog({ profiles, onClose, onSuccess }) {
  const profile = profiles[0];
  const [form, setForm] = useState({
    member_profile_id: profile?.id || '',
    benefit_category: '',
    benefit_name: '',
    coverage_status: 'covered',
    coverage_notes: '',
    copay_amount: '',
    prior_auth_required: false,
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const mutation = useMutation({
    mutationFn: (data) => base44.entities.BenefitsCoverage.create({
      ...data,
      copay_amount: data.copay_amount ? Number(data.copay_amount) : undefined,
    }),
    onSuccess,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add a Benefit</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
            <Select value={form.benefit_category} onValueChange={v => set('benefit_category', v)}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Benefit Name</label>
            <Input
              placeholder="e.g. Annual Physical, Generic Prescriptions"
              value={form.benefit_name}
              onChange={e => set('benefit_name', e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Coverage Status</label>
            <Select value={form.coverage_status} onValueChange={v => set('coverage_status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Copay Amount ($)</label>
            <Input
              type="number"
              placeholder="0.00"
              value={form.copay_amount}
              onChange={e => set('copay_amount', e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes</label>
            <Textarea
              placeholder="Any details about this benefit..."
              value={form.coverage_notes}
              onChange={e => set('coverage_notes', e.target.value)}
              rows={2}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={mutation.isPending} className="flex-1">
              {mutation.isPending ? 'Adding...' : 'Add Benefit'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}