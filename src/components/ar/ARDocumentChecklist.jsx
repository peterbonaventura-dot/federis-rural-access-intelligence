import React, { useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Clock, Upload, AlertCircle, Loader2, Plus } from 'lucide-react';
import { DOC_TYPE_LABELS, REQUIRED_DOCS_BY_BENEFIT } from '@/lib/arConstants';

const STATUS_ICON = {
  uploaded: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  verified:  <CheckCircle2 className="w-4 h-4 text-green-600" />,
  required:  <Clock className="w-4 h-4 text-amber-500" />,
  rejected:  <AlertCircle className="w-4 h-4 text-red-500" />,
  not_required: <CheckCircle2 className="w-4 h-4 text-muted-foreground" />,
};

export default function ARDocumentChecklist({ caseId, benefits }) {
  const qc = useQueryClient();
  const fileRefs = useRef({});

  const { data: docs = [] } = useQuery({
    queryKey: ['ar-docs', caseId],
    queryFn: async () => {
      const all = await base44.entities.ARCaseDocument.list();
      return all.filter(d => d.case_id === caseId);
    },
  });

  const updateDoc = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ARCaseDocument.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ar-docs', caseId] }),
  });

  const createDoc = useMutation({
    mutationFn: (data) => base44.entities.ARCaseDocument.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ar-docs', caseId] }),
  });

  // Derive required doc types from selected benefits
  const requiredTypes = [...new Set(benefits.flatMap(b => REQUIRED_DOCS_BY_BENEFIT[b] || []))];

  // Auto-create missing required docs
  React.useEffect(() => {
    if (!docs.length && benefits.length) return; // wait for load
    const existing = new Set(docs.map(d => d.document_type));
    requiredTypes.forEach(docType => {
      if (!existing.has(docType)) {
        createDoc.mutate({
          case_id: caseId,
          document_name: DOC_TYPE_LABELS[docType] || docType,
          document_type: docType,
          status: 'required',
        });
      }
    });
  }, [benefits.join(',')]);

  async function handleUpload(docId, file) {
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    updateDoc.mutate({ id: docId, data: {
      file_url,
      status: 'uploaded',
      upload_date: new Date().toISOString().split('T')[0],
    }});
  }

  async function addBlankDoc() {
    await createDoc.mutateAsync({
      case_id: caseId,
      document_name: 'New Document',
      document_type: 'other',
      status: 'required',
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Document Checklist</p>
        <Button size="sm" variant="outline" onClick={addBlankDoc}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Document
        </Button>
      </div>

      {docs.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No documents yet. Select benefits to auto-populate required documents.</p>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => (
            <div key={doc.id} className="bg-card border rounded-lg p-3 flex items-center gap-3">
              {STATUS_ICON[doc.status] || <Clock className="w-4 h-4 text-muted-foreground" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.document_name}</p>
                <div className="flex gap-2 mt-0.5">
                  <Badge variant="outline" className="text-xs">{DOC_TYPE_LABELS[doc.document_type] || doc.document_type}</Badge>
                  {doc.dhs_requested && <Badge className="bg-red-100 text-red-700 text-xs">DHS Requested</Badge>}
                  {doc.dhs_request_due_date && <span className="text-xs text-red-600">Due {doc.dhs_request_due_date}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Select value={doc.status} onValueChange={v => updateDoc.mutate({ id: doc.id, data: { status: v } })}>
                  <SelectTrigger className="w-32 h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['required','uploaded','verified','rejected','not_required'].map(s => (
                      <SelectItem key={s} value={s} className="text-xs">{s.replace(/_/g,' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {doc.status !== 'uploaded' && doc.status !== 'verified' && (
                  <>
                    <input
                      ref={el => fileRefs.current[doc.id] = el}
                      type="file" className="hidden"
                      onChange={e => e.target.files?.[0] && handleUpload(doc.id, e.target.files[0])}
                    />
                    <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => fileRefs.current[doc.id]?.click()}>
                      <Upload className="w-3.5 h-3.5" />
                    </Button>
                  </>
                )}
                {doc.file_url && (
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">View</a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}