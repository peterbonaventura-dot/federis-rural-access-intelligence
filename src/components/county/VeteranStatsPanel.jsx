import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Shield, AlertTriangle } from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';

const COLORS = {
  veterans: 'hsl(var(--primary))',
  nonVeterans: 'hsl(var(--muted))',
  enrolled: 'hsl(var(--secondary))',
  disability: 'hsl(var(--chart-3))',
  pension: 'hsl(var(--chart-5))',
  unenrolled: 'hsl(var(--border))',
};

function DonutLabel({ cx, cy, value, label }) {
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
      <tspan x={cx} dy="-0.4em" fontSize="22" fontWeight="700" fill="hsl(var(--foreground))">{value}</tspan>
      <tspan x={cx} dy="1.4em" fontSize="11" fill="hsl(var(--muted-foreground))">{label}</tspan>
    </text>
  );
}

const CustomTooltip = ({ active, payload }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-md">
        <p className="font-semibold">{payload[0].name}</p>
        <p className="text-muted-foreground">{payload[0].value?.toLocaleString()}</p>
      </div>
    );
  }
  return null;
};

export default function VeteranStatsPanel({ county }) {
  const hasData = county.veterans_population != null || county.nearest_va_facility_miles != null;
  if (!hasData) return null;

  const pop = county.population_total;
  const vets = county.veterans_population;
  const vets65 = county.veterans_65_plus;
  const withDisability = county.veterans_with_disability;
  const enrolled = county.veterans_enrolled_va_healthcare;
  const disabilityRecipients = county.veterans_va_disability_recipients;
  const pension = county.veterans_pension_recipients;
  const unenrolled = vets != null && enrolled != null ? Math.max(0, vets - enrolled) : null;

  // Pie: veteran vs non-veteran population
  const popPieData = (vets != null && pop != null) ? [
    { name: 'Veterans', value: vets },
    { name: 'Non-Veterans', value: Math.max(0, pop - vets) },
  ] : null;

  // Bar: service-connected healthcare breakdown (all as % of veteran population)
  const healthcareBarData = vets ? [
    { name: 'VA Enrolled', value: enrolled != null ? Math.round((enrolled / vets) * 100) : null, count: enrolled },
    { name: 'Disability', value: withDisability != null ? Math.round((withDisability / vets) * 100) : null, count: withDisability },
    { name: 'Disability\nBenefits', value: disabilityRecipients != null ? Math.round((disabilityRecipients / vets) * 100) : null, count: disabilityRecipients },
    { name: 'Pension', value: pension != null ? Math.round((pension / vets) * 100) : null, count: pension },
  ].filter(d => d.value != null) : [];

  // Pie: VA enrolled vs unenrolled
  const enrollmentPieData = (enrolled != null && unenrolled != null) ? [
    { name: 'Enrolled in VA Care', value: enrolled },
    { name: 'Not Enrolled', value: unenrolled },
  ] : null;

  const vetPct = (vets != null && pop != null) ? ((vets / pop) * 100).toFixed(1) : null;
  const enrolledPct = (enrolled != null && vets != null) ? ((enrolled / vets) * 100).toFixed(0) : null;
  const unenrolledCount = unenrolled != null ? unenrolled.toLocaleString() : null;

  const distanceHigh = county.nearest_va_facility_miles > 50;
  const noLocalVA = county.number_of_va_facilities === 0;

  return (
    <Card className="p-6 border-l-4 border-l-primary">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
            Veteran Population & Service-Connected Healthcare
          </h3>
        </div>
        <div className="flex gap-2">
          {noLocalVA && <Badge variant="destructive" className="text-xs">No Local VA</Badge>}
          {distanceHigh && <Badge className="bg-amber-500 text-white text-xs">High Distance Burden</Badge>}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Donut: Veterans % of County */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 text-center">
            Veterans as % of County
          </p>
          {popPieData ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={popPieData}
                  cx="50%" cy="50%"
                  innerRadius={52} outerRadius={76}
                  dataKey="value"
                  startAngle={90} endAngle={-270}
                >
                  <Cell fill={COLORS.veterans} />
                  <Cell fill="hsl(var(--muted))" />
                  <DonutLabel cx={0} cy={0} value={`${vetPct}%`} label="Veterans" />
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-muted-foreground text-xs">No data</div>
          )}
          {vets != null && (
            <p className="text-center text-xs text-muted-foreground">{vets.toLocaleString()} total veterans</p>
          )}
        </div>

        {/* Bar: Service-connected healthcare as % of vets */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 text-center">
            Healthcare Need (% of Vets)
          </p>
          {healthcareBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={healthcareBarData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} unit="%" domain={[0, 100]} />
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-md">
                        <p className="font-semibold">{payload[0].payload.name}</p>
                        <p>{payload[0].payload.count?.toLocaleString()} veterans ({payload[0].value}%)</p>
                      </div>
                    ) : null
                  }
                />
                <Bar dataKey="value" fill={COLORS.disability} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-muted-foreground text-xs">No data</div>
          )}
        </div>

        {/* Donut: VA enrollment gap */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 text-center">
            VA Healthcare Enrollment Gap
          </p>
          {enrollmentPieData ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={enrollmentPieData}
                  cx="50%" cy="50%"
                  innerRadius={52} outerRadius={76}
                  dataKey="value"
                  startAngle={90} endAngle={-270}
                >
                  <Cell fill={COLORS.enrolled} />
                  <Cell fill="hsl(var(--muted))" />
                  <DonutLabel cx={0} cy={0} value={`${enrolledPct}%`} label="Enrolled" />
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-muted-foreground text-xs">No data</div>
          )}
          {unenrolledCount && (
            <p className="text-center text-xs text-muted-foreground">{unenrolledCount} not enrolled in VA care</p>
          )}
        </div>
      </div>

      <Separator className="my-4" />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 text-sm">
        {[
          { label: 'Total Veterans', value: vets },
          { label: 'Age 65+', value: vets65, sub: vets65 != null && vets ? `${((vets65/vets)*100).toFixed(0)}% of vets` : null },
          { label: 'Svc-Connected Disability', value: withDisability, sub: withDisability != null && vets ? `${((withDisability/vets)*100).toFixed(0)}% of vets` : null },
          { label: 'VA Enrolled', value: enrolled },
          { label: 'Disability Benefits', value: disabilityRecipients },
          { label: 'Pension', value: pension },
          { label: 'VA Facilities', value: county.number_of_va_facilities, sub: county.nearest_va_facility_miles != null ? `${county.nearest_va_facility_miles} mi to nearest` : null },
        ].map(item => (
          <div key={item.label} className="bg-muted/40 rounded-lg p-3">
            <p className="text-xs text-muted-foreground leading-tight">{item.label}</p>
            <p className="font-bold text-base mt-0.5">{item.value != null ? item.value.toLocaleString() : '—'}</p>
            {item.sub && <p className="text-xs text-muted-foreground mt-0.5">{item.sub}</p>}
          </div>
        ))}
      </div>
    </Card>
  );
}