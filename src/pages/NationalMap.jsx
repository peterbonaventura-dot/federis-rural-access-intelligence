import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import RiskScoreBadge from '@/components/shared/RiskScoreBadge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { getRiskColor, getRiskLevel } from '@/lib/scoringEngine';
import { Input } from '@/components/ui/input';
import { Search, Layers, Shield, AlertTriangle } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

const CLUSTER_TYPES = new Set(['hospital', 'critical_access_hospital', 'rural_health_clinic', 'fqhc']);

// Grid-based clustering: bucket facilities into lat/lng grid cells
function clusterFacilities(facilities, gridSize = 1.5) {
  const buckets = {};
  facilities.forEach(f => {
    const row = Math.floor(f.latitude / gridSize);
    const col = Math.floor(f.longitude / gridSize);
    const key = `${row}_${col}`;
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(f);
  });
  return Object.values(buckets).map(group => {
    const lat = group.reduce((s, f) => s + f.latitude, 0) / group.length;
    const lng = group.reduce((s, f) => s + f.longitude, 0) / group.length;
    const hospitals = group.filter(f => f.facility_type === 'hospital' || f.facility_type === 'critical_access_hospital').length;
    const clinics = group.filter(f => f.facility_type === 'rural_health_clinic' || f.facility_type === 'fqhc').length;
    return { lat, lng, count: group.length, hospitals, clinics, facilities: group };
  });
}

function clusterColor(count) {
  if (count >= 10) return '#16a34a';
  if (count >= 5) return '#2563eb';
  if (count >= 2) return '#d97706';
  return '#6b7280';
}

const FACILITY_COLORS = {
  hospital: '#dc2626',
  critical_access_hospital: '#b91c1c',
  rural_health_clinic: '#2563eb',
  fqhc: '#1d4ed8',
  pharmacy: '#7c3aed',
  behavioral_health: '#ea580c',
  substance_use: '#c2410c',
  home_health_agency: '#0d9488',
  hcbs_provider: '#0f766e',
  personal_care: '#0891b2',
  area_agency_on_aging: '#16a34a',
  social_security_office: '#4b5563',
  transportation: '#ca8a04',
  community_org: '#15803d',
  hud_housing: '#4f46e5',
  other: '#6b7280',
};

const FACILITY_LABELS = {
  hospital: 'Hospital',
  critical_access_hospital: 'Critical Access Hospital',
  rural_health_clinic: 'Rural Health Clinic',
  fqhc: 'FQHC',
  pharmacy: 'Pharmacy',
  behavioral_health: 'Behavioral Health',
  substance_use: 'Substance Use',
  home_health_agency: 'Home Health Agency',
  hcbs_provider: 'HCBS Provider',
  personal_care: 'Personal Care',
  area_agency_on_aging: 'Area Agency on Aging',
  social_security_office: 'Social Security Office',
  transportation: 'Transportation',
  community_org: 'Community Org',
  hud_housing: 'HUD Housing',
  other: 'Other',
};

export default function NationalMap() {
  const [stateFilter, setStateFilter] = useState('all');
  const [cohortFilter, setCohortFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [facilityTypeFilter, setFacilityTypeFilter] = useState('all');
  const [showFacilities, setShowFacilities] = useState(true);
  const [clusterMode, setClusterMode] = useState(false);
  const [showVeteranLayer, setShowVeteranLayer] = useState(true);
  const [showCoverageGaps, setShowCoverageGaps] = useState(true);

  const { data: counties = [] } = useQuery({
    queryKey: ['counties'],
    queryFn: () => base44.entities.County.list('-created_date', 200),
  });

  const { data: riskScores = [] } = useQuery({
    queryKey: ['riskScores'],
    queryFn: () => base44.entities.RuralAccessRiskScore.list('-overall_rural_access_risk_score', 200),
  });

  const { data: allFacilities = [] } = useQuery({
    queryKey: ['facilities-all'],
    queryFn: () => base44.entities.CountyFacility.list('-created_date', 1000),
  });

  const scoreMap = {};
  riskScores.forEach(s => { scoreMap[s.county_id] = s; });

  // Build county lookup for facilities
  const countyMap = {};
  counties.forEach(c => { countyMap[c.id] = c; });

  const states = [...new Set(counties.map(c => c.state))].sort();

  const filtered = useMemo(() => {
    return counties.filter(c => {
      if (stateFilter !== 'all' && c.state !== stateFilter) return false;
      if (cohortFilter !== 'all' && c.pilot_cohort_status !== cohortFilter) return false;
      if (search && !c.county_name.toLowerCase().includes(search.toLowerCase())) return false;
      return c.latitude && c.longitude;
    });
  }, [counties, stateFilter, cohortFilter, search]);

  const filteredCountyIds = useMemo(() => new Set(filtered.map(c => c.id)), [filtered]);

  // Enrich facilities with county coords + jitter so stacked facilities spread out visibly
  const facilitiesWithCoords = useMemo(() => {
    // Track how many facilities we've placed at each county to offset them
    const countySlotMap = {};
    return allFacilities
      .filter(f => filteredCountyIds.has(f.county_id) && f.is_active)
      .map(f => {
        if (f.latitude && f.longitude) return f;
        const county = countyMap[f.county_id];
        if (county?.latitude && county?.longitude) {
          // Spiral jitter: spread facilities around the county center
          const slot = countySlotMap[f.county_id] || 0;
          countySlotMap[f.county_id] = slot + 1;
          const angle = (slot * 137.5) * (Math.PI / 180); // golden angle spiral
          const radius = 0.02 + (Math.floor(slot / 8) * 0.025); // expand ring every 8
          const jitterLat = Math.sin(angle) * radius;
          const jitterLng = Math.cos(angle) * radius;
          return {
            ...f,
            latitude: county.latitude + jitterLat,
            longitude: county.longitude + jitterLng,
            _usedCountyCoords: true,
          };
        }
        return null;
      })
      .filter(Boolean);
  }, [allFacilities, filteredCountyIds, countyMap]);

  const filteredFacilities = useMemo(() => {
    return facilitiesWithCoords.filter(f => {
      if (facilityTypeFilter !== 'all' && f.facility_type !== facilityTypeFilter) return false;
      return true;
    });
  }, [facilitiesWithCoords, facilityTypeFilter]);

  // Cluster-eligible facilities (hospitals + clinics only)
  const clusterFacilitiesFiltered = useMemo(() => {
    return facilitiesWithCoords.filter(f => CLUSTER_TYPES.has(f.facility_type));
  }, [facilitiesWithCoords]);

  // Coverage gap: counties with high veteran density but few health facilities
  const coverageGaps = useMemo(() => {
    const facilityCountByCounty = {};
    facilitiesWithCoords.forEach(f => {
      facilityCountByCounty[f.county_id] = (facilityCountByCounty[f.county_id] || 0) + 1;
    });
    return filtered
      .filter(c => c.veterans_population && c.population_total)
      .map(c => ({
        ...c,
        vetPct: c.veterans_population / c.population_total,
        facilityCount: facilityCountByCounty[c.id] || 0,
        riskScore: scoreMap[c.id]?.overall_rural_access_risk_score || 0,
      }))
      .filter(c => c.vetPct >= 0.05 && c.facilityCount < 5)
      .sort((a, b) => b.vetPct - a.vetPct)
      .slice(0, 8);
  }, [filtered, facilitiesWithCoords, scoreMap]);

  const clusters = useMemo(() => clusterFacilities(clusterFacilitiesFiltered), [clusterFacilitiesFiltered]);

  // Veteran density: pct of population that are veterans, normalized for coloring
  const veteranDensityColor = (pct) => {
    if (pct >= 0.12) return '#7c2d12';  // very high >12%
    if (pct >= 0.09) return '#c2410c';  // high 9-12%
    if (pct >= 0.06) return '#ea580c';  // moderate 6-9%
    if (pct >= 0.03) return '#fb923c';  // low 3-6%
    return '#fed7aa';                   // minimal <3%
  };

  return (
    <div>
      <PageHeader
        title="National Map"
        description="Geographic visualization of rural access risk scores across the research cohort."
      />
      <div className="p-8 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search counties..."
              className="pl-9 w-64"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All States" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              {states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={cohortFilter} onValueChange={setCohortFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All Cohorts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cohorts</SelectItem>
              <SelectItem value="pilot">Pilot</SelectItem>
              <SelectItem value="expansion">Expansion</SelectItem>
              <SelectItem value="national">National</SelectItem>
            </SelectContent>
          </Select>
          <Select value={facilityTypeFilter} onValueChange={setFacilityTypeFilter}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="All Facility Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Facility Types</SelectItem>
              {Object.entries(FACILITY_LABELS).map(([val, lbl]) => (
                <SelectItem key={val} value={val}>{lbl}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            onClick={() => setShowFacilities(v => !v)}
            className={`text-xs px-3 py-1.5 rounded border font-medium transition-colors ${showFacilities ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border'}`}
          >
            {showFacilities ? '● Facilities On' : '○ Facilities Off'}
          </button>
          <button
            onClick={() => setClusterMode(v => !v)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border font-medium transition-colors ${clusterMode ? 'bg-green-600 text-white border-green-600' : 'bg-background text-muted-foreground border-border'}`}
          >
            <Layers className="w-3.5 h-3.5" />
            Cluster View
          </button>
          <button
            onClick={() => setShowVeteranLayer(v => !v)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border font-medium transition-colors ${showVeteranLayer ? 'bg-orange-600 text-white border-orange-600' : 'bg-background text-muted-foreground border-border'}`}
          >
            <Shield className="w-3.5 h-3.5" />
            Veteran Density
          </button>
          <button
            onClick={() => setShowCoverageGaps(v => !v)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border font-medium transition-colors ${showCoverageGaps ? 'bg-red-600 text-white border-red-600' : 'bg-background text-muted-foreground border-border'}`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Coverage Gaps
          </button>
        </div>

        {/* Notice: facilities using county-center coords */}
        {showFacilities && filteredFacilities.length > 0 && filteredFacilities.some(f => f._usedCountyCoords) && (
          <div className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-amber-800">
            <span>📍</span>
            <span>
              <strong>{filteredFacilities.filter(f => f._usedCountyCoords).length}</strong> of {filteredFacilities.length} facilities lack precise GPS coordinates and are plotted in a spiral pattern around their county center. Zoom in to see individual facilities.
            </span>
          </div>
        )}

        {/* Map + Legend */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Card className="lg:col-span-3 overflow-hidden">
            <div className="h-[600px]">
              <MapContainer
                center={[39.5, -98.5]}
                zoom={4}
                className="h-full w-full"
                scrollWheelZoom={true}
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                  attribution='&copy; CARTO'
                />
                {filtered.map(county => {
                  const score = scoreMap[county.id];
                  const riskScore = score?.overall_rural_access_risk_score || 0;
                  return (
                    <CircleMarker
                      key={county.id}
                      center={[county.latitude, county.longitude]}
                      radius={Math.max(6, riskScore / 8)}
                      fillColor={getRiskColor(riskScore)}
                      fillOpacity={0.75}
                      stroke={true}
                      weight={1.5}
                      color="#fff"
                    >
                      <Popup>
                        <div className="text-sm">
                          <p className="font-bold">{county.county_name}, {county.state_abbreviation}</p>
                          <p>Risk Score: <strong>{riskScore}</strong></p>
                          <p>Population: {county.population_total?.toLocaleString()}</p>
                          {score?.care_desert_flag && <p className="text-red-600 font-semibold">⚠ Care Desert</p>}
                          <Link to={`/county-profiles/${county.id}`} className="text-blue-600 underline text-xs">View Profile →</Link>
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })}

                {/* Coverage gap highlight: high vet density + low facilities */}
                {showCoverageGaps && coverageGaps.map(county => (
                  <CircleMarker
                    key={`gap-${county.id}`}
                    center={[county.latitude, county.longitude]}
                    radius={22}
                    fillColor="transparent"
                    fillOpacity={0}
                    stroke={true}
                    weight={2.5}
                    color="#dc2626"
                    dashArray="6 4"
                  >
                    <Popup>
                      <div className="text-sm space-y-0.5">
                        <p className="font-bold text-red-600">⚠ Coverage Gap</p>
                        <p className="font-semibold">{county.county_name}, {county.state_abbreviation}</p>
                        <p>Veterans: <strong>{county.veterans_population?.toLocaleString()}</strong> ({(county.vetPct * 100).toFixed(1)}% of pop)</p>
                        <p>Facilities in county: <strong>{county.facilityCount}</strong></p>
                        <p>Risk Score: <strong>{county.riskScore}</strong></p>
                        <Link to={`/county-profiles/${county.id}`} className="text-blue-600 underline text-xs block mt-1">View Profile →</Link>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}

                {/* Veteran population density layer */}
                {showVeteranLayer && filtered.map(county => {
                  if (!county.veterans_population || !county.population_total) return null;
                  const pct = county.veterans_population / county.population_total;
                  const color = veteranDensityColor(pct);
                  const radius = Math.max(5, Math.min(28, county.veterans_population / 500));
                  return (
                    <CircleMarker
                      key={`vet-${county.id}`}
                      center={[county.latitude, county.longitude]}
                      radius={radius}
                      fillColor={color}
                      fillOpacity={0.5}
                      stroke={true}
                      weight={1.5}
                      color={color}
                    >
                      <Popup>
                        <div className="text-sm space-y-0.5">
                          <p className="font-bold">🎖 {county.county_name}, {county.state_abbreviation}</p>
                          <p>Veterans: <strong>{county.veterans_population?.toLocaleString()}</strong></p>
                          <p>Vet Share: <strong>{(pct * 100).toFixed(1)}% of population</strong></p>
                          {county.veterans_65_plus != null && <p className="text-xs text-gray-600">65+: {county.veterans_65_plus?.toLocaleString()}</p>}
                          {county.veterans_with_disability != null && <p className="text-xs text-gray-600">With disability: {county.veterans_with_disability?.toLocaleString()}</p>}
                          {county.nearest_va_facility_miles != null && <p className="text-xs text-gray-600">Nearest VA: {county.nearest_va_facility_miles} mi</p>}
                          <Link to={`/county-profiles/${county.id}`} className="text-blue-600 underline text-xs block mt-1">View Profile →</Link>
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })}

                {/* Cluster hotspot markers */}
                {clusterMode && clusters.map((cluster, i) => {
                  const radius = Math.max(14, Math.min(40, cluster.count * 4));
                  const color = clusterColor(cluster.count);
                  return (
                    <CircleMarker
                      key={`cluster-${i}`}
                      center={[cluster.lat, cluster.lng]}
                      radius={radius}
                      fillColor={color}
                      fillOpacity={0.55}
                      stroke={true}
                      weight={2}
                      color={color}
                    >
                      <Popup>
                        <div className="text-sm space-y-1">
                          <p className="font-bold">Care Density Hotspot</p>
                          <p className="text-xs text-gray-600">{cluster.count} facilities in this area</p>
                          <div className="flex gap-2 flex-wrap mt-1">
                            {cluster.hospitals > 0 && <span className="text-xs bg-red-100 text-red-700 px-1.5 rounded">🏥 {cluster.hospitals} Hospital{cluster.hospitals > 1 ? 's' : ''}</span>}
                            {cluster.clinics > 0 && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 rounded">🩺 {cluster.clinics} Clinic{cluster.clinics > 1 ? 's' : ''}</span>}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">Facilities:</p>
                          <ul className="text-xs text-gray-700 max-h-32 overflow-y-auto space-y-0.5">
                            {cluster.facilities.map(f => (
                              <li key={f.id}>• {f.facility_name} <span className="text-gray-400">({FACILITY_LABELS[f.facility_type] || f.facility_type})</span></li>
                            ))}
                          </ul>
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })}

                {/* Individual facility markers */}
                {showFacilities && !clusterMode && filteredFacilities.map(f => {
                  const color = FACILITY_COLORS[f.facility_type] || FACILITY_COLORS.other;
                  const county = countyMap[f.county_id];
                  const address = [f.address_street, f.address_city, f.address_state, f.address_zip].filter(Boolean).join(', ');
                  return (
                    <CircleMarker
                      key={f.id}
                      center={[f.latitude, f.longitude]}
                      radius={f._usedCountyCoords ? 6 : 5}
                      fillColor={color}
                      fillOpacity={0.9}
                      stroke={true}
                      weight={1}
                      color="#fff"
                    >
                      <Popup>
                        <div className="text-sm space-y-0.5">
                          <p className="font-bold">{f.facility_name}</p>
                          <p className="text-xs font-medium" style={{ color }}>{FACILITY_LABELS[f.facility_type] || f.facility_type}</p>
                          {address && <p className="text-xs text-gray-600">{address}</p>}
                          {f.phone && <p className="text-xs text-gray-600">📞 {f.phone}</p>}
                          {county && (
                            <Link to={`/county-profiles/${county.id}`} className="text-blue-600 underline text-xs block">
                              {county.county_name}, {county.state_abbreviation} →
                            </Link>
                          )}
                          {f._usedCountyCoords && <p className="text-xs text-amber-600 italic">📍 Plotted at county center</p>}
                          {f.website && <a href={f.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-xs block">{f.website}</a>}
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {f.accepts_medicaid && <span className="text-xs bg-green-100 text-green-700 px-1 rounded">Medicaid</span>}
                            {f.accepts_medicare && <span className="text-xs bg-blue-100 text-blue-700 px-1 rounded">Medicare</span>}
                            {f.accepts_uninsured && <span className="text-xs bg-amber-100 text-amber-700 px-1 rounded">Uninsured</span>}
                          </div>
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })}
              </MapContainer>
            </div>
          </Card>

          {/* Legend & Summary */}
          <div className="space-y-4">
            <Card className="p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Risk Legend</h3>
              <div className="space-y-2">
                {[
                  { label: 'Critical (75-100)', color: '#dc2626' },
                  { label: 'High (60-74)', color: '#ea580c' },
                  { label: 'Moderate (40-59)', color: '#d97706' },
                  { label: 'Low (20-39)', color: '#059669' },
                  { label: 'Minimal (0-19)', color: '#2563eb' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Counties shown</span>
                  <span className="font-medium">{filtered.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">With risk scores</span>
                  <span className="font-medium">{filtered.filter(c => scoreMap[c.id]).length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Care deserts</span>
                  <span className="font-medium text-red-600">{filtered.filter(c => scoreMap[c.id]?.care_desert_flag).length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Facilities mapped</span>
                  <span className="font-medium">{filteredFacilities.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-red-600">Coverage gaps</span>
                  <span className="font-medium text-red-600">{coverageGaps.length}</span>
                </div>
              </div>
            </Card>

            {clusterMode && (
              <Card className="p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Cluster Density</h3>
                <div className="space-y-2">
                  {[
                    { label: '10+ facilities', color: '#16a34a' },
                    { label: '5–9 facilities', color: '#2563eb' },
                    { label: '2–4 facilities', color: '#d97706' },
                    { label: '1 facility', color: '#6b7280' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-2 text-xs">
                      <div className="w-3 h-3 rounded-full opacity-70" style={{ backgroundColor: item.color }} />
                      <span>{item.label}</span>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">Showing hospitals, critical access hospitals, rural health clinics, and FQHCs. Circle size = density.</p>
                </div>
                <div className="mt-3 pt-3 border-t space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Hotspot clusters</span><span className="font-medium">{clusters.length}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Facilities clustered</span><span className="font-medium">{clusterFacilitiesFiltered.length}</span></div>
                </div>
              </Card>
            )}

            {showFacilities && !clusterMode && filteredFacilities.length > 0 && (
              <Card className="p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Facility Types</h3>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {Object.entries(
                    filteredFacilities.reduce((acc, f) => {
                      acc[f.facility_type] = (acc[f.facility_type] || 0) + 1;
                      return acc;
                    }, {})
                  ).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: FACILITY_COLORS[type] || '#6b7280' }} />
                        <span className="truncate">{FACILITY_LABELS[type] || type}</span>
                      </div>
                      <span className="font-medium ml-1">{count}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {showVeteranLayer && (
              <Card className="p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-orange-600" /> Veteran Density
                </h3>
                <div className="space-y-2">
                  {[
                    { label: 'Very High (>12% of pop)', color: '#7c2d12' },
                    { label: 'High (9–12%)', color: '#c2410c' },
                    { label: 'Moderate (6–9%)', color: '#ea580c' },
                    { label: 'Low (3–6%)', color: '#fb923c' },
                    { label: 'Minimal (<3%)', color: '#fed7aa' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-2 text-xs">
                      <div className="w-3 h-3 rounded-full opacity-80" style={{ backgroundColor: item.color }} />
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">Circle size = absolute veteran count. Color = % of county population. Overlaps with facility clusters reveal service gaps.</p>
                <div className="mt-2 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Counties with vet data</span>
                    <span className="font-medium">{filtered.filter(c => c.veterans_population).length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total veterans shown</span>
                    <span className="font-medium">{filtered.reduce((s, c) => s + (c.veterans_population || 0), 0).toLocaleString()}</span>
                  </div>
                </div>
              </Card>
            )}

            {showCoverageGaps && coverageGaps.length > 0 && (
              <Card className="p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600" /> Coverage Gaps
                </h3>
                <p className="text-xs text-muted-foreground mb-3">High veteran density + fewer than 5 facilities</p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {coverageGaps.map(county => (
                    <Link key={county.id} to={`/county-profiles/${county.id}`} className="block">
                      <div className="text-xs p-2 rounded border border-red-200 bg-red-50 hover:bg-red-100 transition-colors">
                        <div className="font-semibold text-red-800">{county.county_name}, {county.state_abbreviation}</div>
                        <div className="flex justify-between mt-0.5 text-red-700">
                          <span>🎖 {(county.vetPct * 100).toFixed(1)}% vets</span>
                          <span>🏥 {county.facilityCount} facilities</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </Card>
            )}

            <Card className="p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Flags</h3>
              <div className="flex flex-wrap gap-1.5">
                {filtered.some(c => scoreMap[c.id]?.care_desert_flag) && <Badge variant="destructive">Care Desert</Badge>}
                {filtered.some(c => scoreMap[c.id]?.benefits_access_desert_flag) && <Badge className="bg-orange-500">Benefits Desert</Badge>}
                {filtered.some(c => scoreMap[c.id]?.workforce_crisis_flag) && <Badge className="bg-purple-500">Workforce Crisis</Badge>}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}