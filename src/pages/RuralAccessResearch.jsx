import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend as RLegend,
} from 'recharts';
import 'leaflet/dist/leaflet.css';

/**
 * Rural Access Research — visual surface over the research data substrate.
 *
 * Data source today: static JSON snapshots at /data/research/* (see
 * /public/data/research/README.md). Swap-in point: replace the four fetch
 * URLs with REST endpoints backed by the research database — schema and
 * queries live in /research/.
 */

const DATA_BASE = '/data/research';

function useJson(path) {
  return useQuery({
    queryKey: ['research-data', path],
    queryFn: async () => {
      const resp = await fetch(`${DATA_BASE}/${path}`);
      if (!resp.ok) throw new Error(`fetch ${path}: ${resp.status}`);
      return resp.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Five-stop diverging palette for workers per 1k 65+.
function workforceColor(v) {
  if (v == null) return '#e5e7eb';
  if (v < 8) return '#7f0000';
  if (v < 14) return '#d7301f';
  if (v < 20) return '#fc8d59';
  if (v < 28) return '#fdcc8a';
  return '#1a9850';
}

function radiusFor(v) {
  if (v == null) return 4;
  return Math.max(4, Math.min(14, 4 + v / 4));
}

export default function RuralAccessResearch() {
  const [ruralityFilter, setRuralityFilter] = useState('all');
  const [showFacilities, setShowFacilities] = useState(true);

  const counties = useJson('county_workforce.json');
  const bars = useJson('rural_urban_bars.json');
  const facilities = useJson('facilities.geojson');
  const meta = useJson('meta.json');

  const filteredCounties = useMemo(() => {
    const all = counties.data?.counties || [];
    if (ruralityFilter === 'rural') return all.filter(c => c.is_rural);
    if (ruralityFilter === 'metro') return all.filter(c => !c.is_rural);
    return all;
  }, [counties.data, ruralityFilter]);

  const filteredFacilities = useMemo(() => {
    const all = facilities.data?.features || [];
    if (ruralityFilter === 'rural') return all.filter(f => f.properties?.is_rural);
    if (ruralityFilter === 'metro') return all.filter(f => !f.properties?.is_rural);
    return all;
  }, [facilities.data, ruralityFilter]);

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Rural Access Research"
        description="Direct-care workforce gaps and home-care access deserts, mapped from public-domain federal data (USDA ERS rurality, BLS OEWS workforce, Census ACS need, CMS facility geocoding)."
        actions={
          <Select value={ruralityFilter} onValueChange={setRuralityFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All counties</SelectItem>
              <SelectItem value="rural">Rural (RUCC 4–9)</SelectItem>
              <SelectItem value="metro">Metro (RUCC 1–3)</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map — spans 2 cols on large screens */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Workforce & facilities map</CardTitle>
            <div className="flex items-center gap-2 text-xs">
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showFacilities}
                  onChange={e => setShowFacilities(e.target.checked)}
                />
                Show facilities
              </label>
            </div>
          </CardHeader>
          <CardContent>
            <div style={{ height: 520 }} className="rounded-md overflow-hidden border">
              <MapContainer center={[39.5, -98]} zoom={4} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  attribution='&copy; OpenStreetMap'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {filteredCounties.map(c => (
                  <CircleMarker
                    key={c.fips}
                    center={[c.lat, c.lng]}
                    radius={radiusFor(c.value)}
                    pathOptions={{
                      color: c.is_rural ? '#1f2937' : 'transparent',
                      weight: c.is_rural ? 1 : 0,
                      fillColor: workforceColor(c.value),
                      fillOpacity: 0.85,
                    }}
                  >
                    <Popup>
                      <div className="text-sm">
                        <div className="font-semibold">{c.name} County, {c.state}</div>
                        <div className="text-muted-foreground">FIPS {c.fips}</div>
                        <div className="mt-1">Workers per 1k 65+: <strong>{c.value?.toFixed(1)}</strong></div>
                        <div>Classification: {c.is_rural ? 'Rural (RUCC 4–9)' : 'Metro (RUCC 1–3)'}</div>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
                {showFacilities && filteredFacilities.map((f, i) => {
                  const [lng, lat] = f.geometry?.coordinates || [];
                  if (lat == null || lng == null) return null;
                  return (
                    <CircleMarker
                      key={`f-${i}`}
                      center={[lat, lng]}
                      radius={3}
                      pathOptions={{
                        color: '#0f172a', weight: 0.5,
                        fillColor: '#08306b', fillOpacity: 0.6,
                      }}
                    >
                      <Popup>
                        <div className="text-sm">
                          <div className="font-semibold">{f.properties?.name}</div>
                          <div className="text-muted-foreground">{f.properties?.source}</div>
                          <div>County FIPS {f.properties?.county_fips}</div>
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })}
              </MapContainer>
            </div>

            <Legend />
          </CardContent>
        </Card>

        {/* Rural-vs-metro bars */}
        <Card>
          <CardHeader>
            <CardTitle>Rural vs metro gap</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ height: 340 }}>
              {bars.data?.measures ? (
                <ResponsiveContainer>
                  <BarChart data={bars.data.measures} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-12} textAnchor="end" height={70} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <RLegend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="rural" name="Rural (RUCC 4–9)" fill="#1f6fb4" />
                    <Bar dataKey="metro" name="Metro (RUCC 1–3)" fill="#9ca3af" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-sm text-muted-foreground">loading…</div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Population-weighted county means. Lower workforce + lower facility density + higher
              self-care difficulty in rural counties = the access gap the studies quantify.
            </p>
          </CardContent>
        </Card>

        {/* Data currency */}
        <Card className="lg:col-span-3">
          <CardHeader><CardTitle>Data currency</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(meta.data?.sources || []).map(s => (
                <Badge key={s.source_key} variant="outline" className="font-mono text-xs">
                  {s.source_key} · vintage {s.data_vintage} · loaded {s.downloaded_at?.slice(0, 10)}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Source-of-truth: <code>load_runs</code> table in the research database
              (see <code>/research/</code>). All datasets are U.S. Government works (public domain).
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Legend() {
  const stops = [
    { c: '#7f0000', label: '< 8'  },
    { c: '#d7301f', label: '8–14' },
    { c: '#fc8d59', label: '14–20' },
    { c: '#fdcc8a', label: '20–28' },
    { c: '#1a9850', label: '28+' },
  ];
  return (
    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
      <span>Workers per 1k 65+:</span>
      {stops.map(s => (
        <span key={s.label} className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: s.c }} />
          {s.label}
        </span>
      ))}
      <span className="flex items-center gap-1 ml-4">
        <span className="inline-block w-3 h-3 rounded-full border border-gray-900" />
        rural outline
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block w-2 h-2 rounded-full" style={{ background: '#08306b' }} />
        facility
      </span>
    </div>
  );
}
