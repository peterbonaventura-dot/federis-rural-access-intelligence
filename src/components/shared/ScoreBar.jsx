import React from 'react';
import { getRiskColor } from '@/lib/scoringEngine';
import { cn } from '@/lib/utils';

export default function ScoreBar({ label, score, weight }) {
  const color = getRiskColor(score);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <div className="flex items-center gap-2">
          {weight && <span className="text-muted-foreground">{weight}</span>}
          <span className="font-bold" style={{ color }}>{score}</span>
        </div>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}