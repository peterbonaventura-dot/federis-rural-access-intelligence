import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Plus, MessageSquare, CheckCircle2, Clock, AlertCircle,
  ChevronRight, X, FileText
} from 'lucide-react';

const STATUS_CONFIG = {
  open: { label: 'Open', color: 'bg-blue-100 text-blue-700', icon: MessageSquare },
  in_review: { label: 'In Review', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  closed: { label: 'Closed', color: 'bg-gray-100 text-gray-500', icon: X },
};

const CATEGORIES = [
  { value: 'enrollment', label: 'Enrollment' },
  { value: 'coverage_question', label: 'Coverage Question' },
  { value: 'billing', label: 'Billing' },
  { value: 'appeal', label: 'Appeal' },
  { value: 'complaint', label: 'Complaint' },
  { value: 'other', label: 'Other' },
];

export default function MemberSupport() {
  const [showForm, setShowForm] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [form, setForm] = useState({ subject: '', category: '', description: '' });
  const queryClient = useQueryClient();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['support-requests'],
    queryFn: () => base44.entities.SupportRequest.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.SupportRequest.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-requests'] });
      setForm({ subject: '', category: '', description: '' });
      setShowForm(false);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(form);
  };

  if (selectedRequest) {
    const config = STATUS_CONFIG[selectedRequest.status];
    const Icon = config.icon;
    return (
      <div className="max-w-2xl mx-auto px-6 py-6">
        <Button variant="ghost" size="sm" onClick={() => setSelectedRequest(null)} className="mb-4">
          ← Back to Requests
        </Button>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <CardTitle className="text-base">{selectedRequest.subject}</CardTitle>
              <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${config.color}`}>
                {config.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground capitalize">
              {selectedRequest.category?.replace('_', ' ')} ·{' '}
              {selectedRequest.created_date ? new Date(selectedRequest.created_date).toLocaleDateString() : ''}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Your Message</p>
              <p className="text-sm bg-muted rounded-lg p-3">{selectedRequest.description}</p>
            </div>
            {selectedRequest.response && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Response</p>
                <p className="text-sm bg-green-50 border border-green-200 rounded-lg p-3">{selectedRequest.response}</p>
              </div>
            )}
            {!selectedRequest.response && selectedRequest.status !== 'closed' && (
              <p className="text-sm text-muted-foreground italic">
                A benefits navigator will respond within 1–3 business days.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Support Requests</h1>
        <Button onClick={() => setShowForm(!showForm)} size="sm">
          <Plus className="w-4 h-4 mr-1" /> New Request
        </Button>
      </div>

      {/* New Request Form */}
      {showForm && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Submit a Support Request</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Subject</label>
                <Input
                  placeholder="What's your question about?"
                  value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
                <Textarea
                  placeholder="Describe your issue or question in detail..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={4}
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createMutation.isPending} size="sm">
                  {createMutation.isPending ? 'Submitting...' : 'Submit Request'}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Request List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No requests yet</p>
          <p className="text-sm mb-4">Submit a request if you need help with your benefits.</p>
          <Button onClick={() => setShowForm(true)}>Submit First Request</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(r => {
            const config = STATUS_CONFIG[r.status] || STATUS_CONFIG.open;
            const Icon = config.icon;
            return (
              <Card
                key={r.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedRequest(r)}
              >
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${config.color.includes('blue') ? 'text-blue-600' : config.color.includes('yellow') ? 'text-yellow-600' : config.color.includes('green') ? 'text-green-600' : 'text-gray-400'}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{r.subject}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {r.category?.replace('_', ' ')} · {r.created_date ? new Date(r.created_date).toLocaleDateString() : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.color}`}>
                      {config.label}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}