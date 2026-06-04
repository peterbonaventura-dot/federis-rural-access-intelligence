import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';

export default function ProfileSetupBanner() {
  return (
    <div className="flex items-center gap-4 bg-primary/5 border border-primary/20 rounded-xl p-4">
      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        <UserPlus className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">Set up your member profile</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Add your coverage details to track benefits and renewal dates.
        </p>
      </div>
      <Link to="/member-profile">
        <Button size="sm">Get Started</Button>
      </Link>
    </div>
  );
}