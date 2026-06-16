import React, { useMemo, useState } from 'react';
import { ScoredData } from '../lib/scoring';

interface Props {
  data: ScoredData[];          // ascending by year
  userApiKey?: string;
}

// Fields that make up the MD&A / management narrative, in reading order.
const FIELDS: { key: keyof ScoredData; label: string }[] = [
  { key: 'businessOverview',        label: 'Business Overview' },
  { key: 'mdaHighlights',           label: 'MD&A Highlights' },
  { key: 'mgmtOutlook',             label: 'Management Outlook' },
  { key: 'keyRisks',                label: 'Key Risks' },
  { key: 'opportunities',           label: 'Opportunities' },
  { key: 'accountingPolicyChanges', label: 'Accounting Policy Changes' },
];

/* minimal markdown: **bold** + bullet lines */
function renderLines(text: string): React.ReactNode[] {
  return String(text).split(/\n/).map((line, i) => {
    const bullet = /^\s*[-•*]\s+/.test(line);
    const clean = line.replace(/^\s*[-•*]\s+/, '');
    const parts = clean.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
      p.startsWith('**') && p.endsWith('**')
        ? <strong key={j}>{p.slice(2, -2)}</strong>
        : <span key={j}>{p}</span>);
    return (
      <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
        {bullet && <span style={{ color: 'var(--accent-green)', flexShrink: 0 }}>•</span>}
        <span>{parts}</span>
      </div>
    );
  });
}

export default function MDAPanel({ data, userApiKey }: Props) {
  const years = data.map(d => d.year);
  const [year, setYear] = useState<number>(years[years.length - 1]);
  const [mode, setMode] = useState<'raw' | 'ai'>('raw');
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const d = useMemo(() => data.find(x => x.year === year) || data[data.length - 1], [data, year]);
  const present = FIELDS.filter(f => !!(d as any)[f.key]);

  const generateAI = async () => {
    setAiLoading(true); setAiError(''); setAiText('');
    try {
      const ctx: any = { companyName: d.companyName, sector: d.sector };
      ctx[`FY${d.year}`] = {
        businessOverview: d.businessOverview, mdaHighlights: d.mdaHighlights,
        mgmtOutlook: d.mgmtOutlook, keyRisks: d.keyRisks, opportunities: d.opportunities,
        accountingPolicyChanges: d.accountingPolicyChanges,
      };
      const res = await fetch('/api/discuss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Summarise the FY${d.year} MD&A for ${d.companyName} under these bold headings: What the business does, Operating performance, Outlook, Key risks, Opportunities. Be concise, specific and neutral; use bullet points; do not invent anything not in the context.`,
          history: [],
          context: ctx,
          userApiKey: userApiKey || '',
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setAiText(json.text || '');
    } catch (e: any) {
      setAiError(e.message || 'Failed to generate summary.');
    } finally {
      setAiLoading(false);
    }
  };

  const switchMode = (m: 'raw' | 'ai') => {
    setMode(m);
    if (m === 'ai' && !aiText && !aiLoading) generateAI();
  };

  return (
    <div className="animate-fade-in-up" style={{ padding: '28px 32px' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>
        MD&amp;A Analysis
      </h1>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 18 }}>
        {d.companyName} · Management Discussion &amp; Analysis and business review
      </p>

      {/* Controls: year + Raw/AI toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        {years.length > 1 && (
          <div style={{ display: 'flex', gap: 6 }}>
            {years.map(y => (
              <button
                key={y}
                onClick={() => { setYear(y); setAiText(''); setAiError(''); setMode('raw'); }}
                className={`tab-btn${y === year ? ' active' : ''}`}
                style={{ padding: '4px 12px', fontSize: 11.5 }}
              >
                FY{y}
              </button>
            ))}
          </div>
        )}
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 6 }}>
          <button className={`tab-btn${mode === 'raw' ? ' active' : ''}`} style={{ padding: '4px 14px', fontSize: 11.5 }} onClick={() => switchMode('raw')}>Raw</button>
          <button className={`tab-btn${mode === 'ai' ? ' active' : ''}`} style={{ padding: '4px 14px', fontSize: 11.5 }} onClick={() => switchMode('ai')}>✨ AI Summary</button>
        </div>
      </div>

      {/* AI summary view */}
      {mode === 'ai' ? (
        <div className="audit-card" style={{ borderColor: 'var(--accent-green)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--accent-green)', marginBottom: 10 }}>
            AI summary · FY{d.year}
          </div>
          {aiLoading
            ? <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Summarising MD&amp;A…</p>
            : aiError
              ? <div style={{ fontSize: 12, color: 'var(--accent-red)' }}>{aiError}</div>
              : aiText
                ? <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{renderLines(aiText)}</div>
                : <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No summary yet.</p>}
        </div>
      ) : (
        /* Raw view */
        present.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            No MD&amp;A narrative was extracted for FY{d.year}. Re-upload a report that includes the Management Discussion &amp; Analysis / Directors' Report.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {present.map(f => (
              <div key={String(f.key)} className="audit-card">
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', marginBottom: 8 }}>
                  {f.label}
                </div>
                <p style={{ fontSize: 12, lineHeight: 1.7, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', margin: 0 }}>
                  {(d as any)[f.key]}
                </p>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
