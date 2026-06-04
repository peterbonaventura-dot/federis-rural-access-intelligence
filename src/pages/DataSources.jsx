import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import CmsImportPanel from '@/components/datasources/CmsImportPanel';
import CmsEnrollmentImportPanel from '@/components/datasources/CmsEnrollmentImportPanel';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

export default function DataSources() {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ source_name: '', source_type: 'public_federal', source_url: '', update_frequency: 'annually', fields_used: '', notes: '' });

  const queryClient = useQueryClient();

  const { data: sources = [] } = useQuery({
    queryKey: ['dataSources'],
    queryFn: () => base44.entities.DataSource.list('-created_date', 100),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.DataSource.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['dataSources'] }); setShowAdd(false); },
  });

  const typeColors = {
    public_federal: 'bg-blue-100 text-blue-700',
    public_state: 'bg-teal-100 text-teal-700',
    internal_operational: 'bg-purple-100 text-purple-700',
    research_partner: 'bg-green-100 text-green-700',
    census: 'bg-orange-100 text-orange-700',
    cms: 'bg-red-100 text-red-700',
    hrsa: 'bg-indigo-100 text-indigo-700',
    other: 'bg-gray-100 text-gray-700',
  };

  return (
    <div>
      <PageHeader
        title="Data Sources"
        description="Track public and internal data sources used in the research infrastructure."
        actions={<Button size="sm" onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-1" /> Add Source</Button>}
      />
      <div className="p-8 space-y-6">
        <CmsImportPanel />
        <CmsEnrollmentImportPanel />
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Fields Used</TableHead>
                  <TableHead>Last Import</TableHead>
                  <TableHead>URL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.source_name}</TableCell>
                    <TableCell><Badge className={typeColors[s.source_type]}>{s.source_type?.replace(/_/g, ' ')}</Badge></TableCell>
                    <TableCell className="text-sm">{s.update_frequency}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{s.fields_used}</TableCell>
                    <TableCell className="text-xs">{s.last_imported_at ? format(new Date(s.last_imported_at), 'MMM d, yyyy') : '—'}</TableCell>
                    <TableCell>
                      {s.source_url && (
                        <a href={s.source_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Data Source</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Source Name</Label><Input value={form.source_name} onChange={e => setForm({ ...form, source_name: e.target.value })} /></div>
            <div>
              <Label>Type</Label>
              <Select value={form.source_type} onValueChange={v => setForm({ ...form, source_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['public_federal', 'public_state', 'internal_operational', 'research_partner', 'census', 'cms', 'hrsa', 'other'].map(t => (
                    <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>URL</Label><Input value={form.source_url} onChange={e => setForm({ ...form, source_url: e.target.value })} /></div>
            <div>
              <Label>Update Frequency</Label>
              <Select value={form.update_frequency} onValueChange={v => setForm({ ...form, update_frequency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['daily', 'weekly', 'monthly', 'quarterly', 'annually', 'ad_hoc'].map(f => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Fields Used</Label><Input value={form.fields_used} onChange={e => setForm({ ...form, fields_used: e.target.value })} /></div>
            <div><Label>Notes</Label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            <Button onClick={() => createMutation.mutate(form)} disabled={!form.source_name}>Add Source</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}