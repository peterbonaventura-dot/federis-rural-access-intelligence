import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Building2, Phone, Globe, MapPin, Plus, Pencil, Trash2, Check } from 'lucide-react';

const FACILITY_TYPES = [
  { value: 'hospital', label: 'Hospital' },
  { value: 'critical_access_hospital', label: 'Critical Access Hospital' },
  { value: 'rural_health_clinic', label: 'Rural Health Clinic' },
  { value: 'fqhc', label: 'FQHC' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'behavioral_health', label: 'Behavioral Health' },
  { value: 'substance_use', label: 'Substance Use' },
  { value: 'home_health_agency', label: 'Home Health Agency' },
  { value: 'hcbs_provider', label: 'HCBS Provider' },
  { value: 'personal_care', label: 'Personal Care' },
  { value: 'area_agency_on_aging', label: 'Area Agency on Aging' },
  { value: 'social_security_office', label: 'Social Security Office' },
  { value: 'transportation', label: 'Transportation' },
  { value: 'community_org', label: 'Community Org' },
  { value: 'hud_housing', label: 'HUD Housing' },
  { value: 'other', label: 'Other' },
];

const TYPE_COLORS = {
  hospital: 'bg-red-100 text-red-700',
  critical_access_hospital: 'bg-red-100 text-red-700',
  rural_health_clinic: 'bg-blue-100 text-blue-700',
  fqhc: 'bg-blue-100 text-blue-700',
  pharmacy: 'bg-purple-100 text-purple-700',
  behavioral_health: 'bg-orange-100 text-orange-700',
  substance_use: 'bg-orange-100 text-orange-700',
  home_health_agency: 'bg-teal-100 text-teal-700',
  hcbs_provider: 'bg-teal-100 text-teal-700',
  personal_care: 'bg-teal-100 text-teal-700',
  area_agency_on_aging: 'bg-green-100 text-green-700',
  social_security_office: 'bg-gray-100 text-gray-700',
  transportation: 'bg-yellow-100 text-yellow-700',
  community_org: 'bg-green-100 text-green-700',
  hud_housing: 'bg-indigo-100 text-indigo-700',
  other: 'bg-gray-100 text-gray-700',
};

const EMPTY_FORM = {
  facility_name: '', facility_type: 'hospital',
  address_street: '', address_city: '', address_state: '', address_zip: '',
  phone: '', website: '', notes: '',
  accepts_medicaid: false, accepts_medicare: false, accepts_uninsured: false,
  is_active: true,
};

export default function FacilityList({ countyId, countyState }) {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: facilities = [] } = useQuery({
    queryKey: ['facilities', countyId],
    queryFn: () => base44.entities.CountyFacility.filter({ county_id: countyId }),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.CountyFacility.create({ ...data, county_id: countyId }),
    onSuccess: () => { queryClient.invalidateQueries(['facilities', countyId]); setDialogOpen(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.CountyFacility.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries(['facilities', countyId]); setDialogOpen(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.CountyFacility.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['facilities', countyId]),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, address_state: countyState || '' });
    setDialogOpen(true);
  };

  const openEdit = (f) => {
    setEditing(f);
    setForm({ ...EMPTY_FORM, ...f });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (editing) updateMutation.mutate({ id: editing.id, data: form });
    else createMutation.mutate(form);
  };

  const filtered = facilities.filter(f => {
    if (typeFilter !== 'all' && f.facility_type !== typeFilter) return false;
    if (search && !f.facility_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const typeLabel = (type) => FACILITY_TYPES.find(t => t.value === type)?.label || type;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Facilities &amp; Businesses ({facilities.length})
        </h3>
        <Button size="sm" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" /> Add Facility
        </Button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <Input placeholder="Search name..." value={search} onChange={e => setSearch(e.target.value)} className="w-48 h-8 text-sm" />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44 h-8 text-sm"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {FACILITY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No facilities added yet. Click "Add Facility" to get started.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(f => (
            <div key={f.id} className="border border-border rounded-lg p-4 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{f.facility_name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[f.facility_type] || TYPE_COLORS.other}`}>
                    {typeLabel(f.facility_type)}
                  </span>
                  {!f.is_active && <Badge variant="outline" className="text-xs">Inactive</Badge>}
                </div>
                {(f.address_street || f.address_city) && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span>{[f.address_street, f.address_city, f.address_state, f.address_zip].filter(Boolean).join(', ')}</span>
                  </div>
                )}
                {f.phone && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <Phone className="w-3 h-3 shrink-0" />
                    <span>{f.phone}</span>
                  </div>
                )}
                {f.website && (
                  <div className="flex items-center gap-1 text-xs mt-0.5">
                    <Globe className="w-3 h-3 shrink-0 text-muted-foreground" />
                    <a href={f.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">{f.website}</a>
                  </div>
                )}
                <div className="flex gap-2 mt-1.5 flex-wrap">
                  {f.accepts_medicaid && <span className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded">Medicaid</span>}
                  {f.accepts_medicare && <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">Medicare</span>}
                  {f.accepts_uninsured && <span className="text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">Uninsured</span>}
                </div>
                {f.notes && <p className="text-xs text-muted-foreground mt-1 italic">{f.notes}</p>}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(f)}><Pencil className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(f.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Facility' : 'Add Facility'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Facility Name *</Label>
              <Input value={form.facility_name} onChange={e => setForm(p => ({ ...p, facility_name: e.target.value }))} placeholder="e.g. Glades General Hospital" />
            </div>
            <div>
              <Label className="text-xs">Type *</Label>
              <Select value={form.facility_type} onValueChange={v => setForm(p => ({ ...p, facility_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FACILITY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Street Address</Label>
              <Input value={form.address_street} onChange={e => setForm(p => ({ ...p, address_street: e.target.value }))} placeholder="123 Main St" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <Label className="text-xs">City</Label>
                <Input value={form.address_city} onChange={e => setForm(p => ({ ...p, address_city: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">State</Label>
                <Input value={form.address_state} onChange={e => setForm(p => ({ ...p, address_state: e.target.value }))} maxLength={2} />
              </div>
              <div>
                <Label className="text-xs">ZIP</Label>
                <Input value={form.address_zip} onChange={e => setForm(p => ({ ...p, address_zip: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Phone</Label>
                <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="(555) 000-0000" />
              </div>
              <div>
                <Label className="text-xs">Website</Label>
                <Input value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} placeholder="https://" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Any relevant notes" />
            </div>
            <div className="flex gap-4">
              {[
                { key: 'accepts_medicaid', label: 'Accepts Medicaid' },
                { key: 'accepts_medicare', label: 'Accepts Medicare' },
                { key: 'accepts_uninsured', label: 'Accepts Uninsured' },
                { key: 'is_active', label: 'Active' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" checked={!!form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.checked }))} className="rounded" />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.facility_name}>
              {editing ? 'Save Changes' : 'Add Facility'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}