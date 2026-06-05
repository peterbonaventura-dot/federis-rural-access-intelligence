import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Send, FileText, User, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const NOTE_COLORS = {
  general:        'bg-slate-50 border-slate-200',
  dhs_contact:    'bg-blue-50 border-blue-200',
  member_contact: 'bg-purple-50 border-purple-200',
  document_action:'bg-green-50 border-green-200',
  status_change:  'bg-amber-50 border-amber-200',
  alert:          'bg-red-50 border-red-200',
  audit:          'bg-gray-50 border-gray-200',
};

const SOURCE_ICON = {
  staff: <User className="w-3.5 h-3.5" />,
  system: <Settings className="w-3.5 h-3.5" />,
  dhs: <FileText className="w-3.5 h-3.5" />,
  member: <User className="w-3.5 h-3.5" />,
};

export default function ARCaseNotes({ caseId }) {
  const [noteText, setNoteText] = useState('');
  const [noteType, setNoteType] = useState('general');
  const qc = useQueryClient();

  const { data: notes = [] } = useQuery({
    queryKey: ['ar-notes', caseId],
    queryFn: async () => {
      const all = await base44.entities.ARCaseNote.list('-created_date', 200);
      return all.filter(n => n.case_id === caseId);
    },
  });

  const addNote = useMutation({
    mutationFn: (data) => base44.entities.ARCaseNote.create(data),
    onSuccess: () => {
      setNoteText('');
      qc.invalidateQueries({ queryKey: ['ar-notes', caseId] });
    },
  });

  async function handleSubmit(e) {
    e.preventDefault();
    if (!noteText.trim()) return;
    addNote.mutate({ case_id: caseId, note_text: noteText.trim(), note_type: noteType, source: 'staff' });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-2 items-end">
        <div className="flex-1 space-y-1.5">
          <div className="flex gap-2">
            <Select value={noteType} onValueChange={setNoteType}>
              <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['general','dhs_contact','member_contact','document_action','status_change','alert'].map(t => (
                  <SelectItem key={t} value={t} className="text-xs">{t.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder="Add a note…"
            rows={2}
            className="text-sm resize-none"
          />
        </div>
        <Button type="submit" size="sm" disabled={addNote.isPending || !noteText.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </form>

      <div className="space-y-2">
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No notes yet.</p>
        ) : notes.map(note => (
          <div key={note.id} className={cn('rounded-lg border p-3 text-sm', NOTE_COLORS[note.note_type] || NOTE_COLORS.general)}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {SOURCE_ICON[note.source]}
                <span>{note.author_name || note.source}</span>
                {note.field_changed && (
                  <Badge variant="outline" className="text-xs">{note.field_changed}: {note.old_value} → {note.new_value}</Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-xs">{note.note_type?.replace(/_/g,' ')}</Badge>
                <span className="text-xs text-muted-foreground">{note.created_date ? new Date(note.created_date).toLocaleString() : ''}</span>
              </div>
            </div>
            <p>{note.note_text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}