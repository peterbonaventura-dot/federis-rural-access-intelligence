import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const cases = await base44.asServiceRole.entities.ARBenefitsCase.list();
    const alerts = [];

    for (const c of cases) {
      const caseRef = { case_id: c.id, member_name: c.member_name, assigned_staff_name: c.assigned_staff_name };

      // Missing consent
      if (c.consent_status === 'not_collected' || c.consent_status === 'pending') {
        alerts.push({ ...caseRef, type: 'missing_consent', severity: 'high', message: `Consent not collected for ${c.member_name}` });
      }

      // Application not submitted within 3 business days of intake
      if (c.date_started && !c.date_submitted && ['intake_started','consent_needed','documents_needed','ready_to_submit'].includes(c.status)) {
        const started = new Date(c.date_started);
        const diffDays = Math.floor((today - started) / (1000 * 60 * 60 * 24));
        if (diffDays >= 3) {
          alerts.push({ ...caseRef, type: 'submission_overdue', severity: 'high', message: `Application not submitted — started ${diffDays} days ago` });
        }
      }

      // Renewal due alerts: 60, 30, 14, 7 days
      if (c.renewal_due_date) {
        const renewal = new Date(c.renewal_due_date);
        const daysUntil = Math.floor((renewal - today) / (1000 * 60 * 60 * 24));
        if ([60, 30, 14, 7].includes(daysUntil) || (daysUntil <= 7 && daysUntil >= 0)) {
          alerts.push({ ...caseRef, type: 'renewal_due', severity: daysUntil <= 14 ? 'critical' : 'medium', message: `Renewal due in ${daysUntil} days (${c.renewal_due_date})` });
        }
      }

      // Appeal deadline approaching (within 10 days)
      if (c.appeal_deadline) {
        const appealDate = new Date(c.appeal_deadline);
        const daysUntil = Math.floor((appealDate - today) / (1000 * 60 * 60 * 24));
        if (daysUntil >= 0 && daysUntil <= 10) {
          alerts.push({ ...caseRef, type: 'appeal_deadline', severity: 'critical', message: `Appeal deadline in ${daysUntil} days (${c.appeal_deadline})` });
        }
      }

      // Interview scheduled
      if (c.interview_required && c.interview_date) {
        const intDate = new Date(c.interview_date);
        const daysUntil = Math.floor((intDate - today) / (1000 * 60 * 60 * 24));
        if (daysUntil >= 0 && daysUntil <= 7) {
          alerts.push({ ...caseRef, type: 'interview_upcoming', severity: 'medium', message: `Interview in ${daysUntil} days (${c.interview_date})` });
        }
      }

      // Denial received — alert staff
      if (c.status === 'denied' && !c.appeal_deadline) {
        alerts.push({ ...caseRef, type: 'denial_no_appeal', severity: 'critical', message: `Denial received — no appeal deadline set` });
      }
    }

    // DHS document requests due within 7 days
    const docs = await base44.asServiceRole.entities.ARCaseDocument.list();
    for (const d of docs) {
      if (d.dhs_requested && d.dhs_request_due_date && d.status !== 'uploaded') {
        const due = new Date(d.dhs_request_due_date);
        const daysUntil = Math.floor((due - today) / (1000 * 60 * 60 * 24));
        if (daysUntil >= 0 && daysUntil <= 7) {
          const relatedCase = cases.find(c => c.id === d.case_id);
          alerts.push({
            case_id: d.case_id,
            member_name: relatedCase?.member_name || 'Unknown',
            assigned_staff_name: relatedCase?.assigned_staff_name,
            type: 'dhs_doc_due',
            severity: daysUntil <= 2 ? 'critical' : 'high',
            message: `DHS requested "${d.document_name}" due in ${daysUntil} days`
          });
        }
      }
    }

    return Response.json({ alerts, total: alerts.length, generated_at: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});