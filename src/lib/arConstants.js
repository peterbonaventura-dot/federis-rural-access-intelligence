export const STATUS_META = {
  intake_started:              { label: 'Intake Started',               color: 'bg-slate-100 text-slate-700' },
  consent_needed:              { label: 'Consent Needed',               color: 'bg-amber-100 text-amber-700' },
  documents_needed:            { label: 'Documents Needed',             color: 'bg-orange-100 text-orange-700' },
  ready_to_submit:             { label: 'Ready to Submit',              color: 'bg-blue-100 text-blue-700' },
  submitted:                   { label: 'Submitted',                    color: 'bg-cyan-100 text-cyan-700' },
  pending_dhs_review:          { label: 'Pending DHS Review',           color: 'bg-indigo-100 text-indigo-700' },
  interview_scheduled:         { label: 'Interview Scheduled',          color: 'bg-violet-100 text-violet-700' },
  additional_docs_requested:   { label: 'Additional Docs Requested',    color: 'bg-red-100 text-red-700' },
  approved:                    { label: 'Approved',                     color: 'bg-green-100 text-green-700' },
  denied:                      { label: 'Denied',                       color: 'bg-red-100 text-red-700' },
  appeal_needed:               { label: 'Appeal Needed',                color: 'bg-rose-100 text-rose-700' },
  renewal_due:                 { label: 'Renewal Due',                  color: 'bg-yellow-100 text-yellow-700' },
  closed:                      { label: 'Closed',                       color: 'bg-muted text-muted-foreground' },
};

export const BENEFIT_COLORS = {
  Medicaid: 'bg-purple-100 text-purple-700',
  SNAP:     'bg-green-100 text-green-700',
  TEA:      'bg-blue-100 text-blue-700',
  ARKids:   'bg-pink-100 text-pink-700',
  TEFRA:    'bg-orange-100 text-orange-700',
  LTSS:     'bg-teal-100 text-teal-700',
  Other:    'bg-slate-100 text-slate-600',
};

export const DOC_TYPE_LABELS = {
  consent_form:            'Consent Form',
  proof_of_identity:       'Proof of Identity',
  proof_of_residency:      'Proof of Residency',
  proof_of_income:         'Proof of Income',
  proof_of_disability:     'Proof of Disability',
  birth_certificate:       'Birth Certificate',
  social_security_card:    'Social Security Card',
  insurance_card:          'Insurance Card',
  tax_return:              'Tax Return',
  bank_statement:          'Bank Statement',
  dhs_notice:              'DHS Notice',
  confirmation_screenshot: 'Confirmation Screenshot',
  appeal_letter:           'Appeal Letter',
  medical_record:          'Medical Record',
  authorized_rep_form:     'Authorized Rep Form',
  other:                   'Other',
};

export const REQUIRED_DOCS_BY_BENEFIT = {
  Medicaid: ['consent_form', 'proof_of_identity', 'proof_of_residency', 'proof_of_income'],
  SNAP:     ['consent_form', 'proof_of_identity', 'proof_of_residency', 'proof_of_income', 'bank_statement'],
  TEA:      ['consent_form', 'proof_of_identity', 'proof_of_residency', 'proof_of_income', 'birth_certificate'],
  ARKids:   ['consent_form', 'proof_of_identity', 'birth_certificate'],
  TEFRA:    ['consent_form', 'proof_of_identity', 'proof_of_disability', 'medical_record'],
  LTSS:     ['consent_form', 'proof_of_identity', 'proof_of_disability', 'medical_record', 'authorized_rep_form'],
};