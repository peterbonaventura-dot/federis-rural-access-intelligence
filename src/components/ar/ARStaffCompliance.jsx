import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle2, AlertTriangle, Plus, Loader2 } from 'lucide-react';

export default function ARStaffCompliance() {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ staff_name: '', staff_email: '', access_ar_username: '', role: 'benefits_coordinator', certification_date: '', certification_expiry: '', community_partner_certified: false });
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  const { data: staff = [] } = useQuery({
    queryKey: ['ar-staff'],
    queryFn: () => base44.entities.ARStaffTraining.list('-created_date', 100),
  });

  async function handleAdd(e) {
    e.preventDefault();
    setSaving(true);
    await base44.entities.ARStaffTraining.create({ ...form, active: true });
    setSaving(false);
    setShowAdd(false);
    setForm({ staff_name: '', staff_email: '', access_ar_username: '', role: 'benefits_coordinator', certification_date: '', certification_expiry: '', community_partner_certified: false });
    qc.invalidateQueries({ queryKey: ['ar-staff'] });
  }

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  function certStatus(s) {
    if (!s.community_partner_certified) return { label: 'Not Certified', color: 'bg-red-100 text-red-700' };
    if (s.certification_expiry) {
      const days = Math.floor((new Date(s.certification_expiry) - new Date()) / (1000 * 60 * 60 * 24));
      if (days < 0) return { label: 'Expired', color: 'bg-red-100 text-red-700' };
      if (days <= 30) return { label: `Expires in ${days}d`, color: 'bg-amber-100 text-amber-700' };
    }
    return { label: 'Certified', color: 'bg-green-100 text-green-700' };
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Community Partner Staff & Training</p>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-1" /> Add Staff</Button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
        Only Community Partner-certified staff may submit applications through Access Arkansas. Passwords must never be recorded here.
      </div>

      {staff.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No staff records yet.</p>
      ) : (
        <div className="space-y-2">
          {staff.map(s => {
            const cert = certStatus(s);
            return (
              <div key={s.id} className="bg-card border rounded-xl p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{s.staff_name}</span>
                    <Badge className={`text-xs ${cert.color}`}>{cert.label}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>{s.staff_email}</span>
                    {s.access_ar_username && <span>AR Username: {s.access_ar_username}</span>}
                    <span className="capitalize">{s.role?.replace(/_/g, ' ')}</span>
                    {s.certification_date && <span>Certified: {s.certification_date}</span>}
                    {s.certification_expiry && <span>Expires: {s.certification_expiry}</span>}
                  </div>
                </div>
                {s.community_partner_certified ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Staff Member</DialogTitle></DialogHeader>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Full Name *</Label>
                <Input value={form.staff_name} onChange={e => set('staff_name', e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email *</Label>
                <Input type="email" value={form.staff_email} onChange={e => set('staff_email', e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Access AR Username (no password)</Label>
                <Input value={form.access_ar_username} onChange={e => set('access_ar_username', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Role</Label>
                <Select value={form.role} onValueChange={v => set('role', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="benefits_coordinator">Benefits Coordinator</SelectItem>
                    <SelectItem value="program_director">Program Director</SelectItem>
                    <SelectItem value="read_only">Read Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Certification Date</Label>
                <Input type="date" value={form.certification_date} onChange={e => set('certification_date', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Certification Expiry</Label>
                <Input type="date" value={form.certification_expiry} onChange={e => set('certification_expiry', e.target.value)} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.community_partner_certified} onChange={e => set('community_partner_certified', e.target.checked)} />
              Community Partner Certified
            </label>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Add Staff Member
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}