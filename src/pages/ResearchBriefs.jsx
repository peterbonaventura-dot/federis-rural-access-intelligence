import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, FileText, Loader2, Eye } from 'lucide-react';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';

export default function ResearchBriefs() {
  const [showGenerator, setShowGenerator] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedBrief, setSelectedBrief] = useState(null);
  const [form, setForm] = useState({
    title: '', brief_type: 'topic_study', geography_scope: 'county',
    reporting_period_start: '', reporting_period_end: '', topic: '',
  });

  const queryClient = useQueryClient();

  const { data: briefs = [] } = useQuery({
    queryKey: ['briefs'],
    queryFn: () => base44.entities.ResearchBrief.list('-created_date', 50),
  });

  const { data: counties = [] } = useQuery({
    queryKey: ['counties'],
    queryFn: () => base44.entities.County.list('-created_date', 200),
  });

  const { data: riskScores = [] } = useQuery({
    queryKey: ['riskScores'],
    queryFn: () => base44.entities.RuralAccessRiskScore.list('-overall_rural_access_risk_score', 200),
  });

  const generateBrief = async () => {
    setGenerating(true);
    const countyMap = {};
    counties.forEach(c => { countyMap[c.id] = c; });

    const pilotCounties = counties.filter(c => c.pilot_cohort_status === 'pilot');
    const countyNames = pilotCounties.map(c => c.county_name + ', ' + c.state_abbreviation).join('; ');
    const topRisk = riskScores.slice(0, 5).map(s => {
      const c = countyMap[s.county_id];
      return `${c?.county_name || 'Unknown'} (${s.overall_rural_access_risk_score})`;
    }).join(', ');

    const prompt = `Generate a research brief for Federis Rural Access Intelligence.
Title: ${form.title || 'Rural Health Access Analysis'}
Type: ${form.brief_type}
Scope: ${form.geography_scope}
Topic: ${form.topic || 'General rural health access barriers'}
Pilot counties: ${countyNames}
Top risk counties: ${topRisk}

Please provide:
1. Executive Summary (2-3 paragraphs)
2. Key Findings (5-7 bullet points)
3. Policy Implications (3-5 points)
4. Recommended Interventions (5-7 actions)
5. Limitations (3-4 points)

Format with markdown headers.`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          executive_summary: { type: 'string' },
          key_findings: { type: 'string' },
          policy_implications: { type: 'string' },
          recommended_interventions: { type: 'string' },
          limitations: { type: 'string' },
        },
      },
    });

    await base44.entities.ResearchBrief.create({
      title: form.title || 'Rural Health Access Analysis',
      brief_type: form.brief_type,
      geography_scope: form.geography_scope,
      counties_included: pilotCounties.map(c => c.county_name),
      reporting_period_start: form.reporting_period_start,
      reporting_period_end: form.reporting_period_end,
      executive_summary: result.executive_summary,
      key_findings: result.key_findings,
      policy_implications: result.policy_implications,
      recommended_interventions: result.recommended_interventions,
      limitations: result.limitations,
      generated_by: 'ai',
      status: 'draft',
    });

    queryClient.invalidateQueries({ queryKey: ['briefs'] });
    setGenerating(false);
    setShowGenerator(false);
  };

  const statusColors = {
    draft: 'bg-slate-100 text-slate-700',
    in_review: 'bg-blue-100 text-blue-700',
    approved: 'bg-green-100 text-green-700',
    published: 'bg-purple-100 text-purple-700',
    archived: 'bg-gray-100 text-gray-500',
  };

  return (
    <div>
      <PageHeader
        title="Research Briefs"
        description="Generate and manage research products from rural access intelligence data."
        actions={
          <Button size="sm" onClick={() => setShowGenerator(!showGenerator)}>
            <Plus className="w-4 h-4 mr-1" /> Generate Brief
          </Button>
        }
      />

      <div className="p-8 space-y-6">
        {showGenerator && (
          <Card className="p-6 border-primary/20 bg-primary/[0.02]">
            <h3 className="font-semibold mb-4">Research Brief Generator</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label>Title</Label>
                <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Brief title" />
              </div>
              <div>
                <Label>Brief Type</Label>
                <Select value={form.brief_type} onValueChange={v => setForm({ ...form, brief_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="county_profile">County Profile</SelectItem>
                    <SelectItem value="state_analysis">State Analysis</SelectItem>
                    <SelectItem value="topic_study">Topic Study</SelectItem>
                    <SelectItem value="national_overview">National Overview</SelectItem>
                    <SelectItem value="policy_brief">Policy Brief</SelectItem>
                    <SelectItem value="rapid_response">Rapid Response</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Topic / Focus</Label>
                <Input value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })} placeholder="e.g., Workforce shortage in Appalachian counties" />
              </div>
              <div>
                <Label>Geography Scope</Label>
                <Select value={form.geography_scope} onValueChange={v => setForm({ ...form, geography_scope: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="county">County</SelectItem>
                    <SelectItem value="state">State</SelectItem>
                    <SelectItem value="regional">Regional</SelectItem>
                    <SelectItem value="national">National</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={generateBrief} disabled={generating}>
              {generating ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Generating...</> : 'Generate Brief'}
            </Button>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {briefs.map(brief => (
            <Card key={brief.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedBrief(brief)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <FileText className="w-5 h-5 text-primary" />
                  <Badge className={statusColors[brief.status]}>{brief.status}</Badge>
                </div>
                <h3 className="font-semibold text-sm mb-1">{brief.title}</h3>
                <p className="text-xs text-muted-foreground mb-2">{brief.brief_type?.replace(/_/g, ' ')} • {brief.geography_scope}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{brief.executive_summary?.slice(0, 120)}...</p>
                <p className="text-[10px] text-muted-foreground mt-2">{format(new Date(brief.created_date), 'MMM d, yyyy')}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Brief Detail Dialog */}
        {selectedBrief && (
          <Dialog open={!!selectedBrief} onOpenChange={() => setSelectedBrief(null)}>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{selectedBrief.title}</DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="summary">
                <TabsList>
                  <TabsTrigger value="summary">Summary</TabsTrigger>
                  <TabsTrigger value="findings">Findings</TabsTrigger>
                  <TabsTrigger value="policy">Policy</TabsTrigger>
                  <TabsTrigger value="interventions">Interventions</TabsTrigger>
                </TabsList>
                <TabsContent value="summary" className="prose prose-sm max-w-none">
                  <ReactMarkdown>{selectedBrief.executive_summary || 'No content'}</ReactMarkdown>
                </TabsContent>
                <TabsContent value="findings" className="prose prose-sm max-w-none">
                  <ReactMarkdown>{selectedBrief.key_findings || 'No content'}</ReactMarkdown>
                </TabsContent>
                <TabsContent value="policy" className="prose prose-sm max-w-none">
                  <ReactMarkdown>{selectedBrief.policy_implications || 'No content'}</ReactMarkdown>
                </TabsContent>
                <TabsContent value="interventions" className="prose prose-sm max-w-none">
                  <ReactMarkdown>{selectedBrief.recommended_interventions || 'No content'}</ReactMarkdown>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}