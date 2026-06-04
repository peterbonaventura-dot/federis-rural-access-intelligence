import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Globe, MapPin, Building, Users, BarChart3,
  Map, Database, FileText, HardDrive, Settings, ChevronLeft,
  ChevronRight, Shield, Wifi, Briefcase, Hospital, ShieldCheck,
  Heart, HelpCircle, MessageSquare, User, AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { path: '/', label: 'Overview', icon: LayoutDashboard },
  { path: '/national-map', label: 'National Map', icon: Globe },
  { path: '/state-analysis', label: 'State Analysis', icon: MapPin },
  { path: '/county-profiles', label: 'County Profiles', icon: Building },
  { path: '/research-cohort', label: 'Research Cohort', icon: Users },
  { path: '/risk-rankings', label: 'Risk Rankings', icon: BarChart3 },
  { path: '/resource-mapping', label: 'Resource Mapping', icon: Map },
  { path: '/telehealth-access', label: 'Telehealth Access', icon: Wifi },
  { path: '/workforce-capacity', label: 'Workforce Capacity', icon: Briefcase },
  { path: '/hospital-discharge-risk', label: 'Discharge Risk', icon: Hospital },
  { path: '/benefits-access', label: 'Benefits Access', icon: ShieldCheck },
  { path: '/operational-data', label: 'Operational Data', icon: Database },
  { divider: true, label: 'Member Portal' },
  { path: '/member-dashboard', label: 'Member Dashboard', icon: Heart },
  { path: '/member-benefits', label: 'My Benefits', icon: Shield },
  { path: '/member-coverage-gap', label: 'Coverage Gaps', icon: AlertTriangle },
  { path: '/member-help-center', label: 'Help Center', icon: HelpCircle },
  { path: '/member-support', label: 'Support', icon: MessageSquare },
  { path: '/member-profile', label: 'My Profile', icon: User },
  { path: '/research-briefs', label: 'Research Briefs', icon: FileText },
  { path: '/data-sources', label: 'Data Sources', icon: HardDrive },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ collapsed, setCollapsed }) {
  const location = useLocation();

  return (
    <aside className={cn(
      "fixed left-0 top-0 h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border z-40 transition-all duration-300 flex flex-col",
      collapsed ? "w-16" : "w-60"
    )}>
      {/* Logo */}
      <div className="p-4 border-b border-sidebar-border flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center flex-shrink-0">
          <Shield className="w-4 h-4 text-sidebar-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold tracking-tight text-sidebar-foreground">Federis</h1>
            <p className="text-[10px] text-sidebar-foreground/60 leading-tight">Rural Access Intelligence</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item, idx) => {
          if (item.divider) {
            return collapsed ? (
              <div key={idx} className="border-t border-sidebar-border my-2" />
            ) : (
              <div key={idx} className="px-3 pt-3 pb-1">
                <div className="border-t border-sidebar-border mb-2" />
                <p className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">{item.label}</p>
              </div>
            );
          }
          const { path, label, icon: Icon } = item;
          const active = location.pathname === path ||
            (path !== '/' && location.pathname.startsWith(path));
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all",
                active
                  ? "bg-sidebar-accent text-sidebar-primary font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
              title={collapsed ? label : undefined}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="p-3 border-t border-sidebar-border flex items-center justify-center text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
}