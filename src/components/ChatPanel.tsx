import React, { useState, useRef, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import { ChatMessage, FinancialData } from '../lib/types';

interface Props {
  data: FinancialData[];
  userApiKey: string;
}

function renderMd(t: string): string {
  return (t || '')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    .replace(/^### (.+)$/gm,   '<strong>$1</strong><br>')
    .replace(/^## (.+)$/gm,    '<strong>$1</strong><br>')
    .replace(/^- (.+)$/gm,     '• $1<br>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g,   '<br>');
}

const QUICK_PROMPTS = [
  'Summarise the 3-year financial trend',
  'Identify key forensic risks',
  'What is the DuPont decomposition of ROE?',
  'Evaluate debt sustainability',
  'Compare operating leverage across years',
];

export default function ChatPanel({ data, userApiKey }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [quickHidden, setQuickHidden] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const context = data.reduce((acc: any, d) => {
    acc[`FY${d.year}`] = d;
    return acc;
  }, { company: data[0]?.companyName, sector: data[0]?.sector });

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    setQuickHidden(true);
    const userMsg: ChatMessage = { role: 'user', text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    if (taRef.current) { taRef.current.style.height = 'auto'; }
    setLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role === 'user' ? 'user' : 'model', text: m.text }));
      const res = await fetch('/api/discuss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history, context, userApiKey }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setMessages(prev => [...prev, { role: 'assistant', text: json.text, timestamp: Date.now() }]);
    } catch (e: any) {
      setMessages(prev => [...prev, {
        role: 'assistant', text: `**Error:** ${e.message}. Please check your API key and try again.`,
        timestamp: Date.now(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const canSend = input.trim().length > 0 && !loading;

  const handleInput = () => {
    if (!taRef.current) return;
    taRef.current.style.height = 'auto';
    taRef.current.style.height = Math.min(taRef.current.scrollHeight, 100) + 'px';
    setInput(taRef.current.value);
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: 'calc(100vh - 30px)',  /* subtract ticker tape */
    }}>
      {/* Header */}
      <div style={{ padding: '18px 24px 12px', flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700 }}>
          AI Analyst Chat
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 3 }}>
          Institutional-grade analysis of {data[0]?.companyName || 'loaded data'}
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '0 24px 12px',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {/* Quick prompts */}
        {!quickHidden && messages.length === 0 && (
          <div style={{ paddingTop: 4 }}>
            <p style={{
              fontFamily: 'var(--font-mono)', fontSize: 9,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              color: 'var(--text-muted)', marginBottom: 8,
            }}>
              Quick prompts
            </p>
            {QUICK_PROMPTS.map(p => (
              <button
                key={p}
                className="qp-btn"
                onClick={() => send(p)}
              >
                {p}
                <ArrowRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              </button>
            ))}
          </div>
        )}

        {/* Message list */}
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              display: 'flex', gap: 8,
              justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            {m.role === 'assistant' && (
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'var(--accent-green-dim)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, marginTop: 2,
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="var(--accent-green)" strokeWidth="2.2">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
              </div>
            )}

            {m.role === 'assistant' ? (
              <div
                className="msg-bubble-bot"
                dangerouslySetInnerHTML={{ __html: renderMd(m.text) }}
              />
            ) : (
              <div className="msg-bubble-user">{m.text}</div>
            )}

            {m.role === 'user' && (
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, marginTop: 2,
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="var(--text-muted)" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'var(--accent-green-dim)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="var(--accent-green)" strokeWidth="2.2">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            </div>
            <div className="typing-bubble">
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Input area */}
      <div style={{ padding: '10px 24px 18px', flexShrink: 0 }}>
        <div className={`chat-input-wrap${canSend ? ' has-text' : ''}`}>
          <textarea
            ref={taRef}
            className="chat-input"
            rows={1}
            value={input}
            placeholder="Ask anything about the financials..."
            onInput={handleInput}
            onChange={handleInput}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
            }}
          />
          <button
            className={`send-btn${canSend ? ' ready' : ' empty'}`}
            onClick={() => send(input)}
            disabled={!canSend}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <p style={{ fontSize: 10, color: 'var(--text-secondary)', textAlign: 'center', marginTop: 6 }}>
          Powered by Gemini 2.5 Flash · Data from uploaded annual reports
        </p>
      </div>
    </div>
  );
}