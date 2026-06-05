import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import ReactMarkdown from 'react-markdown';
import { Send, Plus, Shield, ChevronRight, Loader2, MessageSquare, Paperclip, FileText, X, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import BenefitFormFiller from '@/components/benefits/BenefitFormFiller';

const AGENT_NAME = 'benefits_navigator';

const QUICK_STARTS = [
  "I need help applying for food assistance (SNAP)",
  "I want to check if I qualify for SSI",
  "Help me understand my Medicare options",
  "I need Medicaid coverage — where do I start?",
];

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  return (
    <div className={cn('flex gap-3 mb-4', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Shield className="w-4 h-4 text-primary" />
        </div>
      )}
      <div className={cn('max-w-[80%]', isUser && 'flex flex-col items-end')}>
        <div className={cn(
          'rounded-2xl px-4 py-3 text-sm',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-card border border-border text-foreground'
        )}>
          {isUser ? (
            <p className="leading-relaxed">{message.content}</p>
          ) : (
            <ReactMarkdown
              className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 prose-p:leading-relaxed"
              components={{
                p: ({ children }) => <p className="my-1">{children}</p>,
                ul: ({ children }) => <ul className="my-1 ml-4 list-disc space-y-0.5">{children}</ul>,
                ol: ({ children }) => <ol className="my-1 ml-4 list-decimal space-y-0.5">{children}</ol>,
                li: ({ children }) => <li className="text-sm">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BenefitsNavigator() {
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [attachedFile, setAttachedFile] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showFormPanel, setShowFormPanel] = useState(false);
  const bottomRef = useRef(null);
  const unsubscribeRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => { unsubscribeRef.current?.(); };
  }, []);

  async function loadConversations() {
    setLoadingConvos(true);
    const convos = await base44.agents.listConversations({ agent_name: AGENT_NAME });
    setConversations(convos || []);
    setLoadingConvos(false);
  }

  async function openConversation(convo) {
    unsubscribeRef.current?.();
    setActiveConversation(convo);
    const full = await base44.agents.getConversation(convo.id);
    setMessages(full.messages || []);
    const unsub = base44.agents.subscribeToConversation(convo.id, (data) => {
      setMessages(data.messages || []);
    });
    unsubscribeRef.current = unsub;
  }

  async function startNewConversation(initialMessage) {
    const convo = await base44.agents.createConversation({
      agent_name: AGENT_NAME,
      metadata: { name: initialMessage?.slice(0, 60) || 'New conversation' },
    });
    setConversations(prev => [convo, ...prev]);
    await openConversation(convo);
    if (initialMessage) {
      await sendMessage(convo, initialMessage, null);
    }
  }

  async function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      alert('Please select a PDF file.');
      return;
    }
    setUploadingFile(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setAttachedFile({ name: file.name, url: file_url });
    setUploadingFile(false);
    e.target.value = '';
  }

  async function sendMessage(convo, text, fileUrl) {
    const target = convo || activeConversation;
    if (!target) return;
    setSending(true);
    setInput('');
    setAttachedFile(null);
    const msgText = text?.trim() || (fileUrl ? 'I have attached a patient record PDF for review.' : '');
    const msg = { role: 'user', content: msgText };
    if (fileUrl) msg.file_urls = [fileUrl];
    await base44.agents.addMessage(target, msg);
    setSending(false);
  }

  async function handleSend() {
    if (!input.trim() && !attachedFile) return;
    if (!activeConversation) {
      const convo = await base44.agents.createConversation({
        agent_name: AGENT_NAME,
        metadata: { name: input.trim().slice(0, 60) || attachedFile?.name || 'New conversation' },
      });
      setConversations(prev => [convo, ...prev]);
      await openConversation(convo);
      await sendMessage(convo, input.trim(), attachedFile?.url);
    } else {
      await sendMessage(null, input.trim(), attachedFile?.url);
    }
  }

  async function handleFormReady({ name, url, formLabel }) {
    setShowFormPanel(false);
    // Ensure there's an active conversation
    let target = activeConversation;
    if (!target) {
      const convo = await base44.agents.createConversation({
        agent_name: AGENT_NAME,
        metadata: { name: `${formLabel} — Application` },
      });
      setConversations(prev => [convo, ...prev]);
      await openConversation(convo);
      target = convo;
    }
    await sendMessage(target, `I've completed the ${formLabel} intake form. Please review it and help me with next steps.`, url);
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isTyping = messages.length > 0 && messages[messages.length - 1]?.role === 'user' && sending === false;
  const lastMsg = messages[messages.length - 1];
  const agentIsResponding = lastMsg?.role === 'user';

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background">
      {/* Sidebar */}
      <div className="w-72 border-r flex flex-col bg-muted/20">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-5 h-5 text-primary" />
            <div>
              <p className="font-semibold text-sm">Benefits Navigator</p>
              <p className="text-xs text-muted-foreground">Federis Health Technology</p>
            </div>
          </div>
          <div className="flex gap-1.5">
            <Button className="flex-1" size="sm" onClick={() => startNewConversation()}>
              <Plus className="w-4 h-4 mr-1" /> New Chat
            </Button>
            <Button
              size="sm"
              variant={showFormPanel ? 'default' : 'outline'}
              onClick={() => setShowFormPanel(v => !v)}
              title="Fill an application form"
              className="px-2.5"
            >
              <ClipboardList className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {showFormPanel ? (
          <div className="flex-1 overflow-hidden flex flex-col">
            <BenefitFormFiller
              onFileReady={handleFormReady}
              onClose={() => setShowFormPanel(false)}
            />
          </div>
        ) : (
          <ScrollArea className="flex-1 p-2">
            {loadingConvos ? (
              <div className="flex justify-center p-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
            ) : conversations.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center p-4">No conversations yet</p>
            ) : (
              conversations.map(c => (
                <button
                  key={c.id}
                  onClick={() => openConversation(c)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 rounded-lg text-sm mb-1 transition-colors flex items-center gap-2',
                    activeConversation?.id === c.id
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'hover:bg-muted text-foreground'
                  )}
                >
                  <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
                  <span className="truncate">{c.metadata?.name || 'Conversation'}</span>
                </button>
              ))
            )}
          </ScrollArea>
        )}

        <div className="p-3 border-t">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
            <p className="text-xs text-amber-800 font-medium mb-1">Important</p>
            <p className="text-xs text-amber-700 leading-relaxed">This navigator prepares applications. A human always reviews and files. We never guarantee eligibility.</p>
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {!activeConversation ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Shield className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Federis Benefits Navigator</h2>
            <p className="text-muted-foreground text-sm max-w-md mb-8 leading-relaxed">
              I help rural residents access SSI, Medicare, Medicaid, and SNAP benefits — without driving hours to an office. Ask me anything to get started.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {QUICK_STARTS.map((q) => (
                <button
                  key={q}
                  onClick={() => startNewConversation(q)}
                  className="text-left px-4 py-3 rounded-xl border bg-card hover:bg-muted transition-colors text-sm flex items-center justify-between gap-2 group"
                >
                  <span>{q}</span>
                  <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground group-hover:text-foreground" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="border-b px-6 py-3 flex items-center gap-3 bg-card">
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium truncate">{activeConversation.metadata?.name || 'Conversation'}</span>
              <Badge variant="outline" className="ml-auto text-xs">Benefits Navigator</Badge>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-6 py-4">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-8">Starting conversation…</div>
              ) : (
                messages.map((msg, i) => <MessageBubble key={i} message={msg} />)
              )}
              {agentIsResponding && (
                <div className="flex gap-3 mb-4">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Shield className="w-4 h-4 text-primary" />
                  </div>
                  <div className="bg-card border rounded-2xl px-4 py-3">
                    <div className="flex gap-1 items-center">
                      <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </ScrollArea>

            {/* Input */}
            <div className="border-t p-4 bg-card">
              <div className="max-w-3xl mx-auto space-y-2">
                {/* Attached file preview */}
                {attachedFile && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg text-sm">
                    <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="truncate text-foreground flex-1">{attachedFile.name}</span>
                    <button onClick={() => setAttachedFile(null)} className="text-muted-foreground hover:text-destructive flex-shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-xl flex-shrink-0"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending || uploadingFile}
                    title="Attach PDF"
                  >
                    {uploadingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                  </Button>
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your question or attach a PDF…"
                    disabled={sending || uploadingFile}
                    className="rounded-xl"
                  />
                  <Button onClick={handleSend} disabled={sending || uploadingFile || (!input.trim() && !attachedFile)} size="icon" className="rounded-xl flex-shrink-0">
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Applications are prepared, not filed. A human always reviews before submission.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}