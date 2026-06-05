import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarClock, ChevronRight } from 'lucide-react';
import { BENEFIT_COLORS } from '@/lib/arConstants';
import { cn } from '@/lib/utils';

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.floor((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
}

function urgencyColor(days) {
  if (days <= 14) return 'bg-red-50 border-red-200';
  if (days <= 30) return 'bg-orange-50 border-orange-200';
  if (days <= 60) return 'bg-amber-50 border-amber-200';
  return 'bg-card';
}

function urgencyBadge(days) {
  if (days < 0) return 'bg-red-100 text-red-700';
  if (days <= 14) return 'bg-red-100 text-red-700';
  if (days <= 30) return 'bg-orange-100 text-orange-700';
  if (days <= 60) return 'bg-amber-100 text-amber-700';
  return 'bg-green-100 text-green-700';
}

export default function ARRenewalCalendar({ onSelectCase }) {
  const { data: cases = [] } = useQuery({
    queryKey: ['ar-cases'],
    queryFn: () => base44.entities.ARBenefitsCase.list('-renewal_due_date', 200),
  });

  const renewals = cases
    .filter(c => c.renewal_due_date && c.status !== 'closed')
    .map(c => ({ ...c, daysUntilRenewal: daysUntil(c.renewal_due_date) }))
    .sort((a, b) => a.daysUntilRenewal - b.daysUntilRenewal);

  const withAppeals = cases.filter(c => c.appeal_deadline && c.status !== 'closed')
    .map(c => ({ ...c, daysUntilAppeal: daysUntil(c.appeal_deadline) }))
    .sort((a, b) => a.daysUntilAppeal - b.daysUntilAppeal);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <CalendarClock className="w-4 h-4 text-primary" />
          <p className="font-semibold text-sm">Upcoming Renewals</p>
        </div>
        {renewals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No renewals on record.</p>
        ) : (
          <div className="space-y-2">
            {renewals.map(c => {
              const days = c.daysUntilRenewal;
              return (
                <div key={c.id} className={cn('border rounded-xl p-3 flex items-center gap-3', urgencyColor(days))}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{c.member_name}</span>
                      <Badge className={`text-xs ${urgencyBadge(days)}`}>
                        {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-1">
                      {(c.benefits_applied_for || []).map(b => (
                        <span key={b} className={`text-xs px-1.5 py-0.5 rounded font-medium ${BENEFIT_COLORS[b] || 'bg-muted text-muted-foreground'}`}>{b}</span>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">Due: {c.renewal_due_date} · Staff: {c.assigned_staff_name || 'Unassigned'}</p>
                  </div>
                  <Button size="sm" variant="outline" className="flex-shrink-0 h-7 px-2" onClick={() => onSelectCase(c.id)}>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {withAppeals.length > 0 && (
        <div>
          <p className="font-semibold text-sm mb-3 text-destructive">Appeal Deadlines</p>
          <div className="space-y-2">
            {withAppeals.map(c => {
              const days = c.daysUntilAppeal;
              return (
                <div key={c.id} className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-sm">{c.member_name}</span>
                      <Badge className="bg-red-100 text-red-700 text-xs">{days < 0 ? 'OVERDUE' : `${days}d left`}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Appeal deadline: {c.appeal_deadline}</p>
                  </div>
                  <Button size="sm" variant="outline" className="flex-shrink-0 h-7 px-2" onClick={() => onSelectCase(c.id)}>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}