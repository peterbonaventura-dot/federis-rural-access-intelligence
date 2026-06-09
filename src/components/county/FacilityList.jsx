import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Phone, Globe, MapPin, Plus, Pencil, Trash2, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';

const FACILITY_TYPES = [
  { value: 'hospital', label: 'Hospital', group: 'Healthcare' },
  { value: 'critical_access_hospital', label: 'Critical Access Hospital', group: 'Healthcare' },
  { value: 'rural_health_clinic', label: 'Rural Health Clinic', group: 'Healthcare' },
  { value: 'fqhc', label: 'FQHC', group: 'Healthcare' },
  { value: 'pharmacy', label: 'Pharmacy', group: 'Healthcare' },
  { value: 'behavioral_health', label: 'Behavioral Health', group: 'Behavioral & Substance Use' },
  { value: 'substance_use', label: 'Substance Use', group: 'Behavioral & Substance Use' },
  { value: 'home_health_agency', label: 'Home Health Agency', group: 'Home & Community' },
  { value: 'hcbs_provider', label: 'HCBS Provider', group: 'Home & Community' },
  { value: 'personal_care', label: 'Personal Care', group: 'Home & Community' },
  { value: 'area_agency_on_aging', label: 'Area Agency on Aging', group: 'Social Services' },
  { value: 'social_security_office', label: 'Social Security Office', group: 'Social Services' },
  { value: 'transportation', label: 'Transportation', group: 'Social Services' },
  { value: 'community_org', label: 'Community Org', group: 'Social Services' },
  { value: 'hud_housing', label: 'HUD Housing', group: 'Housing' },
  { value: 'other', label: 'Other', group: 'Other' },
];

const GROUPS = ['Healthcare', 'Behavioral & Substance Use', 'Home & Community', 'Social Services', 'Housing', 'Other'];

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
  social_security_office: 'bg-slate-100 text-slate-700',
  transportation: 'bg-yellow-100 text-yellow-700',
  community_org: 'bg-green-100 text-green-700',
  hud_housing: 'bg-indigo-100 text-indigo-700',
  other: 'bg-gray-100 text-gray-700',
};

const GROUP_COLORS = {
  'Healthcare': 'border-red-200 bg-red-50/40',
  'Behavioral & Substance Use': 'border-orange-200 bg-orange-50/40',
  'Home & Community': 'border-teal-200 bg-teal-50/40',
  'Social Services': 'border-slate-200 bg-slate-50/40',
  'Housing': 'border-indigo-200 bg-indigo-50/40',
  'Other': 'border-gray-200 bg-gray-50/40',
};

const EMPTY_FORM = {
  facility_name: '', facility_type: 'hospital',
  address_street: '', address_city: '', address_state: '', address_zip: '',
  phone: '', website: '', notes: '',
  accepts_medicaid: false, accepts_medicare: false, accepts_uninsured: false,
  is_active: true,
};

function FacilityCard({ f, typeLabel, onEdit, onDelete }) {
  return (
    <div className="border border-border rounded-lg p-3 flex items-start justify-between gap-3 bg-card hover:shadow-sm transition-shadow">
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
        <div className="flex gap-1.5 mt-1.5 flex-wrap">
          {f.accepts_medicaid && <span className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded">Medicaid</span>}
          {f.accepts_medicare && <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">Medicare</span>}
          {f.accepts_uninsured && <span className="text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">Uninsured</span>}
        </div>
        {f.notes && <p className="text-xs text-muted-foreground mt-1 italic">{f.notes}</p>}
      </div>
      <div className="flex gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(f)}><Pencil className="w-3.5 h-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(f.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
      </div>
    </div>
  );
}

function FacilityGroup({ group, facilities, typeLabel, onEdit, onDelete }) {
  const [open, setOpen] = useState(true);
  if (facilities.length === 0) return null;
  return (
    <div className={`rounded-lg border ${GROUP_COLORS[group] || GROUP_COLORS.Other} overflow-hidden`}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:opacity-80 transition-opacity"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-foreground">{group}</span>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">{facilities.length}</Badge>
          {open ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2 bg-background/60">
          {facilities.map(f => (
            <FacilityCard key={f.id} f={f} typeLabel={typeLabel} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FacilityList({ countyId, countyState, countyName, stateName }) {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const autoImportedRef = useRef(false);

  const { data: facilities = [], isLoading } = useQuery({
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

  const handleAutoImport = async () => {
    setImporting(true);
    setImportResult(null);
    const res = await base44.functions.invoke('autoImportCountyFacilities', {
      county_id: countyId,
      county_name: countyName,
      state: stateName,
    });
    setImporting(false);
    setImportResult(res.data);
    queryClient.invalidateQueries(['facilities', countyId]);
  };

  // Auto-trigger import on first load when county has no facilities
  useEffect(() => {
    if (!isLoading && facilities.length === 0 && !autoImportedRef.current) {
      autoImportedRef.current = true;
      handleAutoImport();
    }
  }, [isLoading, facilities.length]);

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

  const typeLabel = (type) => FACILITY_TYPES.find(t => t.value === type)?.label || type;

  const filtered = facilities.filter(f => {
    if (!f.is_active) return false;
    if (typeFilter !== 'all' && f.facility_type !== typeFilter) return false;
    if (search && !f.facility_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Group facilities
  const grouped = GROUPS.map(group => ({
    group,
    facilities: filtered.filter(f => {
      const ft = FACILITY_TYPES.find(t => t.value === f.facility_type);
      return ft?.group === group;
    }),
  }));

  const totalActive = facilities.filter(f => f.is_active).length;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Facilities & Social Services
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isLoading ? 'Loading...' : `${totalActive} active facilities across ${GROUPS.filter(g => grouped.find(gr => gr.group === g)?.facilities.length > 0).length} categories`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleAutoImport}
            disabled={importing}
            className="text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${importing ? 'animate-spin' : ''}`} />
            {importing ? 'Importing...' : 'Auto-Import'}
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>
      </div>

      {importResult && (
        <div className={`text-xs rounded-md px-3 py-2 mb-3 ${importResult.added > 0 ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-muted text-muted-foreground border border-border'}`}>
          {importResult.added > 0
            ? `✓ Imported ${importResult.added} new facilities from public data sources.`
            : importResult.message || 'No new facilities found to import.'}
        </div>
      )}

      <div className="flex gap-2 mb-4 flex-wrap">
        <Input placeholder="Search facilities..." value={search} onChange={e => setSearch(e.target.value)} className="w-48 h-8 text-sm" />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44 h-8 text-sm"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {FACILITY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Loading facilities...</div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm text-muted-foreground mb-3">No facilities found for this county.</p>
          <Button variant="outline" size="sm" onClick={handleAutoImport} disabled={importing}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${importing ? 'animate-spin' : ''}`} />
            {importing ? 'Importing...' : 'Auto-Import from Public Data'}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(({ group, facilities: gFacilities }) => (
            <FacilityGroup
              key={group}
              group={group}
              facilities={gFacilities}
              typeLabel={typeLabel}
              onEdit={openEdit}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
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
            <div className="flex gap-4 flex-wrap">
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