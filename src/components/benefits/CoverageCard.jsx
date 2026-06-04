import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, XCircle, Clock, AlertCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STATUS_CONFIG = {
  covered: { label: 'Covered', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
  not_covered: { label: 'Not Covered', icon: XCircle, color: 'text-red-500', bg: 'bg-red-50 border-red-200' },
  requires_prior_auth: { label: 'Prior Auth', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  limited: { label: 'Limited', icon: AlertCircle, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
};

export default function CoverageCard({ coverage, compact, onDelete }) {
  const config = STATUS_CONFIG[coverage.coverage_status] || STATUS_CONFIG.covered;
  const Icon = config.icon;

  if (compact) {
    return (
      <div className={`flex items-center justify-between rounded-lg border px-3 py-2.5 ${config.bg}`}>
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={`w-4 h-4 flex-shrink-0 ${config.color}`} />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{coverage.benefit_name}</p>
            {coverage.coverage_notes && (
              <p className="text-xs text-muted-foreground truncate">{coverage.coverage_notes}</p>
            )}
          </div>
        </div>
        <span className={`text-xs font-medium whitespace-nowrap ml-2 ${config.color}`}>{config.label}</span>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border p-3 ${config.bg}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${config.color}`} />
          <div className="min-w-0">
            <p className="text-sm font-semibold">{coverage.benefit_name}</p>
            <p className={`text-xs font-medium ${config.color}`}>{config.label}</p>
            {coverage.coverage_notes && (
              <p className="text-xs text-muted-foreground mt-1">{coverage.coverage_notes}</p>
            )}
            <div className="flex flex-wrap gap-3 mt-1.5">
              {coverage.copay_amount != null && (
                <span className="text-xs text-muted-foreground">Copay: <strong>${coverage.copay_amount}</strong></span>
              )}
              {coverage.annual_limit != null && (
                <span className="text-xs text-muted-foreground">Limit: <strong>${coverage.annual_limit}</strong></span>
              )}
              {coverage.used_to_date != null && (
                <span className="text-xs text-muted-foreground">Used: <strong>${coverage.used_to_date}</strong></span>
              )}
              {coverage.prior_auth_required && (
                <span className="text-xs text-amber-600 font-medium">Prior Auth Required</span>
              )}
            </div>
          </div>
        </div>
        {onDelete && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}