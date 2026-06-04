import React from 'react';
import { getRiskLevel } from '@/lib/scoringEngine';
import { cn } from '@/lib/utils';

export default function RiskScoreBadge({ score, size = 'md', showLabel = true }) {
  const risk = getRiskLevel(score);
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-lg',
    xl: 'w-20 h-20 text-xl',
  };

  return (
    <div className="flex items-center gap-2">
      <div className={cn(
        "rounded-full flex items-center justify-center font-bold border-2",
        sizeClasses[size],
        risk.bg,
        risk.color,
        risk.border
      )}>
        {score}
      </div>
      {showLabel && (
        <span className={cn("text-xs font-semibold uppercase tracking-wider", risk.color)}>
          {risk.label}
        </span>
      )}
    </div>
  );
}