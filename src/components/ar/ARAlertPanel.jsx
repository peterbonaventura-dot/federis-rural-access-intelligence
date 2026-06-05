import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, XCircle, ChevronRight, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const SEVERITY_META = {
  critical: { color: 'bg-red-50 border-red-200 text-red-800', badge: 'bg-red-100 text-red-700', icon: <XCircle className="w-4 h-4 text-red-500" /> },
  high:     { color: 'bg-orange-50 border-orange-200 text-orange-800', badge: 'bg-orange-100 text-orange-700', icon: <AlertTriangle className="w-4 h-4 text-orange-500" /> },
  medium:   { color: 'bg-amber-50 border-amber-200 text-amber-800', badge: 'bg-amber-100 text-amber-700', icon: <Clock className="w-4 h-4 text-amber-500" /> },
};

const TYPE_LABELS = {
  missing_consent:    'Missing Consent',
  submission_overdue: 'Submission Overdue',
  renewal_due:        'Renewal Due',
  appeal_deadline:    'Appeal Deadline',
  interview_upcoming: 'Interview Upcoming',
  denial_no_appeal:   'Denial – No Appeal Set',
  dhs_doc_due:        'DHS Document Due',
};

export default function ARAlertPanel({ onSelectCase }) {
  const { data, isLoading } = useQuery({
    queryKey: ['ar-alerts'],
    queryFn: () => base44.functions.invoke('arBenefitsAlerts', {}).then(r => r.data),
    refetchInterval: 5 * 60 * 1000,
  });

  const alerts = data?.alerts || [];

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  if (alerts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-400" />
        <p className="text-sm">No active alerts — all cases are on track.</p>
      </div>
    );
  }

  const grouped = { critical: [], high: [], medium: [] };
  alerts.forEach(a => { if (grouped[a.severity]) grouped[a.severity].push(a); });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{alerts.length} active alert{alerts.length !== 1 ? 's' : ''}</p>
      {['critical','high','medium'].map(sev => {
        if (!grouped[sev].length) return null;
        const meta = SEVERITY_META[sev];
        return (
          <div key={sev} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{sev}</p>
            {grouped[sev].map((alert, i) => (
              <div key={i} className={cn('rounded-lg border p-3 flex items-center gap-3', meta.color)}>
                {meta.icon}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium">{alert.member_name}</span>
                    <Badge className={`text-xs ${meta.badge}`}>{TYPE_LABELS[alert.type] || alert.type}</Badge>
                  </div>
                  <p className="text-xs">{alert.message}</p>
                  {alert.assigned_staff_name && <p className="text-xs mt-0.5 opacity-70">Staff: {alert.assigned_staff_name}</p>}
                </div>
                {alert.case_id && (
                  <Button size="sm" variant="outline" className="flex-shrink-0 h-7 px-2" onClick={() => onSelectCase(alert.case_id)}>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}