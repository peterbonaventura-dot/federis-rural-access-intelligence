import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { Loader2, CheckCircle2, ArrowLeft, FileText, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';

const FORMS = [
  {
    id: 'snap',
    label: 'SNAP (Food Assistance)',
    color: 'bg-green-50 border-green-200 text-green-800',
    badgeClass: 'bg-green-100 text-green-700',
    fields: [
      { key: 'full_name', label: 'Full Legal Name', type: 'text', required: true },
      { key: 'dob', label: 'Date of Birth', type: 'date', required: true },
      { key: 'ssn_last4', label: 'Last 4 of SSN', type: 'text', required: true, placeholder: 'XXXX' },
      { key: 'address', label: 'Home Address', type: 'text', required: true },
      { key: 'city', label: 'City', type: 'text', required: true },
      { key: 'state', label: 'State', type: 'text', required: true },
      { key: 'zip', label: 'ZIP Code', type: 'text', required: true },
      { key: 'household_size', label: 'Household Size', type: 'number', required: true },
      { key: 'monthly_income', label: 'Monthly Gross Income ($)', type: 'number', required: true },
      { key: 'employer', label: 'Employer (if any)', type: 'text' },
      { key: 'phone', label: 'Phone Number', type: 'text', required: true },
      { key: 'email', label: 'Email Address', type: 'email' },
    ],
  },
  {
    id: 'ssi',
    label: 'SSI (Supplemental Security Income)',
    color: 'bg-blue-50 border-blue-200 text-blue-800',
    badgeClass: 'bg-blue-100 text-blue-700',
    fields: [
      { key: 'full_name', label: 'Full Legal Name', type: 'text', required: true },
      { key: 'dob', label: 'Date of Birth', type: 'date', required: true },
      { key: 'ssn_last4', label: 'Last 4 of SSN', type: 'text', required: true, placeholder: 'XXXX' },
      { key: 'address', label: 'Home Address', type: 'text', required: true },
      { key: 'city', label: 'City', type: 'text', required: true },
      { key: 'state', label: 'State', type: 'text', required: true },
      { key: 'zip', label: 'ZIP Code', type: 'text', required: true },
      { key: 'disability_description', label: 'Disability / Medical Condition', type: 'text', required: true },
      { key: 'monthly_income', label: 'Monthly Income ($)', type: 'number', required: true },
      { key: 'living_situation', label: 'Living Situation', type: 'select', options: ['Own home', 'Renting', 'Living with family', 'Homeless / Transitional housing'], required: true },
      { key: 'phone', label: 'Phone Number', type: 'text', required: true },
      { key: 'email', label: 'Email Address', type: 'email' },
    ],
  },
  {
    id: 'medicaid',
    label: 'Medicaid Application',
    color: 'bg-purple-50 border-purple-200 text-purple-800',
    badgeClass: 'bg-purple-100 text-purple-700',
    fields: [
      { key: 'full_name', label: 'Full Legal Name', type: 'text', required: true },
      { key: 'dob', label: 'Date of Birth', type: 'date', required: true },
      { key: 'ssn_last4', label: 'Last 4 of SSN', type: 'text', required: true, placeholder: 'XXXX' },
      { key: 'address', label: 'Home Address', type: 'text', required: true },
      { key: 'city', label: 'City', type: 'text', required: true },
      { key: 'state', label: 'State', type: 'text', required: true },
      { key: 'zip', label: 'ZIP Code', type: 'text', required: true },
      { key: 'citizenship_status', label: 'Citizenship Status', type: 'select', options: ['US Citizen', 'Lawful Permanent Resident', 'Other qualified immigrant'], required: true },
      { key: 'household_size', label: 'Household Size', type: 'number', required: true },
      { key: 'annual_income', label: 'Annual Household Income ($)', type: 'number', required: true },
      { key: 'currently_insured', label: 'Currently Insured?', type: 'select', options: ['No', 'Yes — losing coverage soon', 'Yes — want to switch'], required: true },
      { key: 'phone', label: 'Phone Number', type: 'text', required: true },
      { key: 'email', label: 'Email Address', type: 'email' },
    ],
  },
  {
    id: 'medicare',
    label: 'Medicare Enrollment (Part B)',
    color: 'bg-orange-50 border-orange-200 text-orange-800',
    badgeClass: 'bg-orange-100 text-orange-700',
    fields: [
      { key: 'full_name', label: 'Full Legal Name', type: 'text', required: true },
      { key: 'dob', label: 'Date of Birth', type: 'date', required: true },
      { key: 'ssn_last4', label: 'Last 4 of SSN', type: 'text', required: true, placeholder: 'XXXX' },
      { key: 'medicare_number', label: 'Medicare Number (if known)', type: 'text' },
      { key: 'address', label: 'Home Address', type: 'text', required: true },
      { key: 'city', label: 'City', type: 'text', required: true },
      { key: 'state', label: 'State', type: 'text', required: true },
      { key: 'zip', label: 'ZIP Code', type: 'text', required: true },
      { key: 'part_a_enrollment', label: 'Currently have Part A?', type: 'select', options: ['Yes', 'No', 'Not sure'], required: true },
      { key: 'reason_for_enrollment', label: 'Reason for Enrollment', type: 'select', options: ['Turning 65', 'Disability', 'End of employer coverage', 'Other'], required: true },
      { key: 'phone', label: 'Phone Number', type: 'text', required: true },
      { key: 'email', label: 'Email Address', type: 'email' },
    ],
  },
];

function generatePDF(formDef, formData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(30, 64, 120);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Federis Benefits Navigator', 14, 11);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(formDef.label + ' — Application Intake Form', 14, 20);

  // Date
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.text(`Prepared: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, pageWidth - 14, 35, { align: 'right' });

  // Disclaimer
  doc.setFillColor(255, 247, 230);
  doc.rect(14, 38, pageWidth - 28, 12, 'F');
  doc.setTextColor(160, 90, 0);
  doc.setFontSize(8);
  doc.text('⚠  This form is prepared for review only. A human reviewer will verify and submit this application. Eligibility is not guaranteed.', 18, 45.5);

  // Fields
  doc.setTextColor(40, 40, 40);
  let y = 60;
  formDef.fields.forEach((field) => {
    const value = formData[field.key] || '—';
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80, 80, 80);
    doc.text(field.label + ':', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(20, 20, 20);
    doc.text(String(value), 80, y);
    y += 10;
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
  });

  // Footer
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(7.5);
  doc.text('Federis Health Technology — Benefits Navigator | For internal review use only', pageWidth / 2, 285, { align: 'center' });

  return doc.output('blob');
}

export default function BenefitFormFiller({ onFileReady, onClose }) {
  const [selectedForm, setSelectedForm] = useState(null);
  const [formData, setFormData] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  function handleChange(key, value) {
    setFormData(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    const pdfBlob = generatePDF(selectedForm, formData);
    const fileName = `${selectedForm.id}_intake_${Date.now()}.pdf`;
    const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setDone(true);
    setSubmitting(false);
    onFileReady({ name: fileName, url: file_url, formLabel: selectedForm.label });
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
        <CheckCircle2 className="w-10 h-10 text-green-500" />
        <p className="font-semibold text-sm">Form prepared!</p>
        <p className="text-xs text-muted-foreground">The completed intake form has been attached to your conversation for review.</p>
        <Button size="sm" onClick={onClose}>Close</Button>
      </div>
    );
  }

  if (!selectedForm) {
    return (
      <div className="p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Select a Form</p>
        {FORMS.map(f => (
          <button
            key={f.id}
            onClick={() => { setSelectedForm(f); setFormData({}); }}
            className={cn('w-full text-left px-3 py-2.5 rounded-lg border text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-opacity', f.color)}
          >
            <FileText className="w-4 h-4 flex-shrink-0" />
            {f.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <button type="button" onClick={() => setSelectedForm(null)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold truncate">{selectedForm.label}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {selectedForm.fields.map(field => (
          <div key={field.key} className="space-y-1">
            <Label className="text-xs">
              {field.label}{field.required && <span className="text-destructive ml-0.5">*</span>}
            </Label>
            {field.type === 'select' ? (
              <Select value={formData[field.key] || ''} onValueChange={v => handleChange(field.key, v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {field.options.map(o => (
                    <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                type={field.type}
                value={formData[field.key] || ''}
                onChange={e => handleChange(field.key, e.target.value)}
                placeholder={field.placeholder || ''}
                required={field.required}
                className="h-8 text-xs"
              />
            )}
          </div>
        ))}
      </div>
      <div className="p-4 border-t">
        <Button type="submit" className="w-full" size="sm" disabled={submitting}>
          {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
          {submitting ? 'Generating PDF…' : 'Generate & Attach to Conversation'}
        </Button>
      </div>
    </form>
  );
}