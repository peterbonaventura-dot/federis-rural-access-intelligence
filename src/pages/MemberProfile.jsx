import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, User, Save } from 'lucide-react';

const COVERAGE_TYPES = [
  { value: 'medicaid_only', label: 'Medicaid Only' },
  { value: 'medicare_only', label: 'Medicare Only' },
  { value: 'dual_eligible', label: 'Dual Eligible (Both)' },
  { value: 'none', label: 'No Coverage' },
];

const ENROLLMENT_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'terminated', label: 'Terminated' },
];

export default function MemberProfile() {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState(null);

  const { data: profiles = [] } = useQuery({
    queryKey: ['member-profiles'],
    queryFn: () => base44.entities.MemberProfile.list(),
  });

  const profile = profiles[0];

  useEffect(() => {
    if (profile && !form) {
      setForm({ ...profile });
    } else if (!profile && !form) {
      setForm({
        full_name: '', date_of_birth: '', medicaid_id: '', medicare_id: '',
        coverage_type: 'none', plan_name: '', plan_start_date: '', plan_end_date: '',
        county: '', state: '', phone: '', address: '', primary_care_provider: '',
        pcn_number: '', enrollment_status: 'pending', renewal_due_date: '', notes: '',
      });
    }
  }, [profile]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.MemberProfile.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member-profiles'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.MemberProfile.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member-profiles'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const handleSave = (e) => {
    e.preventDefault();
    if (profile) {
      updateMutation.mutate({ id: profile.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  if (!form) return null;

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <User className="w-5 h-5 text-primary" /> My Profile
        </h1>
        {saved && (
          <div className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" /> Saved
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Personal Info */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Personal Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Field label="Full Name" required>
              <Input value={form.full_name} onChange={e => set('full_name', e.target.value)} required />
            </Field>
            <Field label="Date of Birth">
              <Input type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={e => set('phone', e.target.value)} />
            </Field>
            <Field label="Address">
              <Textarea value={form.address} onChange={e => set('address', e.target.value)} rows={2} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="County">
                <Input value={form.county} onChange={e => set('county', e.target.value)} />
              </Field>
              <Field label="State">
                <Input value={form.state} onChange={e => set('state', e.target.value)} />
              </Field>
            </div>
          </CardContent>
        </Card>

        {/* Coverage Info */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Coverage & Enrollment</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Field label="Coverage Type">
              <Select value={form.coverage_type} onValueChange={v => set('coverage_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{COVERAGE_TYPES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Enrollment Status">
              <Select value={form.enrollment_status} onValueChange={v => set('enrollment_status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ENROLLMENT_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Medicaid ID">
                <Input value={form.medicaid_id} onChange={e => set('medicaid_id', e.target.value)} />
              </Field>
              <Field label="Medicare ID">
                <Input value={form.medicare_id} onChange={e => set('medicare_id', e.target.value)} />
              </Field>
            </div>
            <Field label="Plan Name">
              <Input value={form.plan_name} onChange={e => set('plan_name', e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Plan Start Date">
                <Input type="date" value={form.plan_start_date} onChange={e => set('plan_start_date', e.target.value)} />
              </Field>
              <Field label="Renewal Due Date">
                <Input type="date" value={form.renewal_due_date} onChange={e => set('renewal_due_date', e.target.value)} />
              </Field>
            </div>
            <Field label="Primary Care Provider">
              <Input value={form.primary_care_provider} onChange={e => set('primary_care_provider', e.target.value)} />
            </Field>
            <Field label="Notes">
              <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} />
            </Field>
          </CardContent>
        </Card>

        <Button type="submit" disabled={isLoading} className="w-full">
          <Save className="w-4 h-4 mr-2" />
          {isLoading ? 'Saving...' : 'Save Profile'}
        </Button>
      </form>
    </div>
  );
}

function Field({ label, children, required }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}