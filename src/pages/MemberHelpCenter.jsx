import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search, BookOpen, Phone, FileText, ChevronRight,
  Star, HelpCircle, Pill, Car, Home, Heart, AlertCircle,
  ArrowLeft, Eye, Users
} from 'lucide-react';
import HelpArticleView from '@/components/benefits/HelpArticleView';

const CATEGORIES = [
  { key: 'enrollment', label: 'Enrollment', icon: Users, color: 'text-blue-600 bg-blue-50' },
  { key: 'coverage', label: 'Coverage', icon: Heart, color: 'text-teal-600 bg-teal-50' },
  { key: 'billing', label: 'Billing', icon: FileText, color: 'text-purple-600 bg-purple-50' },
  { key: 'appeals', label: 'Appeals', icon: AlertCircle, color: 'text-red-600 bg-red-50' },
  { key: 'prescriptions', label: 'Prescriptions', icon: Pill, color: 'text-orange-600 bg-orange-50' },
  { key: 'transportation', label: 'Transportation', icon: Car, color: 'text-yellow-600 bg-yellow-50' },
  { key: 'home_health', label: 'Home Health', icon: Home, color: 'text-green-600 bg-green-50' },
  { key: 'general', label: 'General', icon: HelpCircle, color: 'text-gray-600 bg-gray-50' },
];

const QUICK_CONTACTS = [
  { label: 'Medicaid Hotline', number: '1-800-MEDICAID', note: 'Mon–Fri 8am–5pm' },
  { label: 'Medicare', number: '1-800-MEDICARE', note: '24/7 support' },
  { label: 'Benefits Navigator', number: '1-800-677-1116', note: 'Eldercare Locator' },
];

export default function MemberHelpCenter() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedArticle, setSelectedArticle] = useState(null);

  const { data: articles = [] } = useQuery({
    queryKey: ['help-articles'],
    queryFn: () => base44.entities.HelpArticle.filter({ is_published: true }),
  });

  const filtered = articles.filter(a => {
    const matchesSearch = !search ||
      a.title?.toLowerCase().includes(search.toLowerCase()) ||
      a.summary?.toLowerCase().includes(search.toLowerCase()) ||
      a.tags?.toLowerCase().includes(search.toLowerCase());
    const matchesCat = !selectedCategory || a.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const featured = articles.filter(a => a.is_featured);

  if (selectedArticle) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-6">
        <Button variant="ghost" size="sm" onClick={() => setSelectedArticle(null)} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Help Center
        </Button>
        <HelpArticleView article={selectedArticle} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary px-6 py-10 text-white text-center">
        <h1 className="text-2xl font-bold mb-2">Help Center</h1>
        <p className="text-primary-foreground/70 text-sm mb-6">
          Find answers about your Medicaid and Medicare benefits
        </p>
        <div className="relative max-w-lg mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search for topics, benefits, or questions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 bg-white text-foreground"
          />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Quick Contacts */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {QUICK_CONTACTS.map(c => (
            <div key={c.label} className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
              <Phone className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-blue-800">{c.label}</p>
                <p className="text-sm font-mono font-bold text-blue-900">{c.number}</p>
                <p className="text-xs text-blue-600">{c.note}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Categories */}
        <div>
          <h2 className="font-semibold mb-3">Browse by Topic</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {CATEGORIES.map(({ key, label, icon: Icon, color }) => (
              <button
                key={key}
                onClick={() => setSelectedCategory(selectedCategory === key ? null : key)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                  selectedCategory === key
                    ? 'border-primary bg-primary text-white'
                    : 'border-border bg-card hover:border-primary/40'
                }`}
              >
                <div className={`p-1 rounded ${selectedCategory === key ? 'bg-white/20' : color}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Featured Articles */}
        {!search && !selectedCategory && featured.length > 0 && (
          <div>
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500" /> Featured Articles
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {featured.map(a => (
                <ArticleCard key={a.id} article={a} onClick={() => setSelectedArticle(a)} />
              ))}
            </div>
          </div>
        )}

        {/* Article Results */}
        <div>
          {(search || selectedCategory) && (
            <h2 className="font-semibold mb-3">
              {filtered.length} result{filtered.length !== 1 ? 's' : ''}
              {selectedCategory && ` in ${CATEGORIES.find(c => c.key === selectedCategory)?.label}`}
            </h2>
          )}
          {!search && !selectedCategory && <h2 className="font-semibold mb-3">All Articles</h2>}
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>No articles found. Try a different search or topic.</p>
              <Link to="/member-support" className="mt-3 inline-block">
                <Button variant="outline" size="sm">Submit a Question</Button>
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filtered.map(a => (
                <ArticleCard key={a.id} article={a} onClick={() => setSelectedArticle(a)} />
              ))}
            </div>
          )}
        </div>

        {/* Submit Support */}
        <div className="bg-muted rounded-xl p-6 text-center">
          <HelpCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <h3 className="font-semibold mb-1">Can't find what you're looking for?</h3>
          <p className="text-sm text-muted-foreground mb-4">Submit a support request and we'll get back to you.</p>
          <Link to="/member-support">
            <Button>Submit a Request</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function ArticleCard({ article, onClick }) {
  const catInfo = {
    enrollment: { color: 'bg-blue-100 text-blue-700' },
    coverage: { color: 'bg-teal-100 text-teal-700' },
    billing: { color: 'bg-purple-100 text-purple-700' },
    appeals: { color: 'bg-red-100 text-red-700' },
    prescriptions: { color: 'bg-orange-100 text-orange-700' },
    transportation: { color: 'bg-yellow-100 text-yellow-700' },
    home_health: { color: 'bg-green-100 text-green-700' },
    general: { color: 'bg-gray-100 text-gray-700' },
    mental_health: { color: 'bg-pink-100 text-pink-700' },
  };
  const cat = catInfo[article.category] || catInfo.general;

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex gap-2 mb-2 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cat.color}`}>
                {article.category?.replace('_', ' ')}
              </span>
              {article.coverage_type !== 'all' && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600 capitalize">
                  {article.coverage_type}
                </span>
              )}
            </div>
            <h3 className="text-sm font-semibold leading-tight">{article.title}</h3>
            {article.summary && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{article.summary}</p>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
        </div>
      </CardContent>
    </Card>
  );
}