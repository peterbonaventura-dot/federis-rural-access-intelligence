import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';

const CAT_COLORS = {
  enrollment: 'bg-blue-100 text-blue-700',
  coverage: 'bg-teal-100 text-teal-700',
  billing: 'bg-purple-100 text-purple-700',
  appeals: 'bg-red-100 text-red-700',
  prescriptions: 'bg-orange-100 text-orange-700',
  transportation: 'bg-yellow-100 text-yellow-700',
  home_health: 'bg-green-100 text-green-700',
  mental_health: 'bg-pink-100 text-pink-700',
  general: 'bg-gray-100 text-gray-700',
};

export default function HelpArticleView({ article }) {
  const catColor = CAT_COLORS[article.category] || CAT_COLORS.general;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${catColor}`}>
          {article.category?.replace('_', ' ')}
        </span>
        {article.coverage_type !== 'all' && (
          <span className="text-xs px-2 py-1 rounded-full font-medium bg-slate-100 text-slate-600 capitalize">
            {article.coverage_type}
          </span>
        )}
      </div>
      <h1 className="text-xl font-bold">{article.title}</h1>
      {article.summary && (
        <p className="text-muted-foreground border-l-4 border-primary/30 pl-3">{article.summary}</p>
      )}
      <Card>
        <CardContent className="pt-5 prose prose-sm max-w-none text-foreground">
          <ReactMarkdown>{article.content || ''}</ReactMarkdown>
        </CardContent>
      </Card>
      <div className="bg-muted rounded-lg p-4 text-center">
        <p className="text-sm text-muted-foreground mb-2">Still have questions?</p>
        <Link to="/member-support">
          <Button size="sm" variant="outline">
            <FileText className="w-3.5 h-3.5 mr-1.5" /> Submit a Support Request
          </Button>
        </Link>
      </div>
    </div>
  );
}