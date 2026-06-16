import React, { useMemo, useState } from 'react';
import { ScoredData } from '../lib/scoring';
import { fmtCr } from '../lib/format';

interface Props {
  data: ScoredData[];            // sorted ascending by year (as App provides)
  userApiKey?: string;           // optional — enables the AI summary button
}

/* ── text helpers ─────────────────────────────────────────────────────────── */
function norm(s: string): string {
  return s.toLowerCase().replace(/^\s*[•\-*\d.)]+\s*/, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function tokenSet(s: string): Set<string> {
  return new Set(norm(s).split(' ').filter(w => w.length > 2));
}
function jaccard(a: string, b: string): number {
  const A = tokenSet(a), B = tokenSet(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach(x => { if (B.has(x)) inter++; });
  return inter / (A.size + B.size - inter);
}
function matches(a: string, b: string): boolean {
  const na = norm(a), nb = norm(b);
  if (na === nb) return true;
  if (na.length > 15 && (nb.includes(na) || na.includes(nb))) return true;
  return jaccard(a, b) >= 0.6;
}
function splitItems(t?: string): string[] {
  if (!t) return [];
  return t
    .split(/\n+/)
    .flatMap(line => (line.length > 180 ? line.split(/(?<=\.)\s+(?=[A-Z0-9])/) : [line]))
    .map(s => s.replace(/^\s*[•\-*\d.)]+\s*/, '').trim())
    .filter(s => s.length >= 8);
}
function diffText(oldT?: string, newT?: string): { added: string[]; removed: string[] } {
  const O = splitItems(oldT), N = splitItems(newT);
  return {
    added: N.filter(n => !O.some(o => matches(o, n))),
    removed: O.filter(o => !N.some(n => matches(o, n))),
  };
}

/* ── tiny safe markdown (bold + bullets) for the optional AI summary ───────── */
function renderLines(text: string): React.ReactNode[] {
  return text.split(/\n/).map((line, i) => {
    const bullet = /^\s*[-•*]\s+/.test(line);
    const clean = line.replace(/^\s*[-•*]\s+/, '');
    const parts = clean.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
      p.startsWith('**') && p.endsWith('**')
        ? <strong key={j}>{p.slice(2, -2)}</strong>
        : <span key={j}>{p}</span>);
    return (
      <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 3 }}>
        {bullet && <span style={{ color: 'var(--accent-green)', flexShrink: 0 }}>•</span>}
        <span>{parts}</span>
      </div>
    );
  });
}

const QUAL: { key: keyof ScoredData; label: string }[] = [
  { key: 'keyRisks', label: 'Key Risks' },
  { key: 'opportunities', label: 'Opportunities' },
  { key: 'mgmtOutlook', label: 'Management Outlook' },
  { key: 'kams', label: 'Key Audit Matters' },
  { key: 'accountingPolicyChanges', label: 'Accounting Policy Changes' },
];

export default function NarrativeDiffPanel({ data, userApiKey }: Props) {
  // Build consecutive transitions: [FY(n-1) -> FY(n)]
  const transitions = useMemo(
    () => data.slice(1).map((to, i) => ({ from: data[i], to })),
    [data]
  );
  const [idx, setIdx] = useState(transitions.length - 1);
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  if (data.length < 2) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 24, lineHeight: 1.6 }}>
        Load at least two years of annual reports to compare what changed between them.
      </div>
    );
  }

  const t = transitions[Math.max(0, Math.min(idx, transitions.length - 1))];
  const { from, to } = t;

  // Structured governance changes
  const structured: { label: string; from: string; to: string; changed: boolean }[] = [
    row('Auditor', from.auditorName, to.auditorName),
    row('Audit Opinion', from.auditorOpinion, to.auditorOpinion),
    row('Going Concern', boolStr(from.hasGoingConcern), boolStr(to.hasGoingConcern)),
    row('Promoter Pledge %', pctStr(from.promoterPledgePercent), pctStr(to.promoterPledgePercent)),
    row('Related Party Txns', fmtCr(from.relatedPartyTransactions), fmtCr(to.relatedPartyTransactions)),
    row('Contingent Liabilities', fmtCr(from.contingentLiabilities), fmtCr(to.contingentLiabilities)),
  ];

  const generateAI = async () => {
    if (!userApiKey && true) { /* server key may still exist; attempt anyway */ }
    setAiLoading(true); setAiError(''); setAiText('');
    try {
      const ctx: any = { companyName: to.companyName, sector: to.sector };
      ctx[`FY${from.year}`] = pick(from);
      ctx[`FY${to.year}`] = pick(to);
      const res = await fetch('/api/discuss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Compare the FY${from.year} and FY${to.year} qualitative disclosures in the context. Summarise only what MATERIALLY CHANGED, grouped under bold headings: New / intensified risks, Dropped or softened risks, Outlook shift, Governance & accounting changes. Be concise and specific; ignore cosmetic wording changes.`,
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Transition selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>Compare:</span>
        {transitions.map((tr, i) => (
          <button
            key={i}
            onClick={() => { setIdx(i); setAiText(''); setAiError(''); }}
            className={`tab-btn${i === idx ? ' active' : ''}`}
            style={{ padding: '4px 12px', fontSize: 11.5 }}
          >
            FY{tr.from.year} → FY{tr.to.year}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={generateAI} disabled={aiLoading} className="proceed-btn" style={{ height: 34, fontSize: 12, opacity: aiLoading ? 0.6 : 1 }}>
          {aiLoading ? 'Summarising…' : '✨ AI summary'}
        </button>
      </div>

      {/* Optional AI summary */}
      {(aiText || aiError) && (
        <div className="audit-card" style={{ borderColor: 'var(--accent-green)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--accent-green)', marginBottom: 8 }}>
            AI summary · FY{from.year} → FY{to.year}
          </div>
          {aiError
            ? <div style={{ fontSize: 12, color: 'var(--accent-red)' }}>{aiError}</div>
            : <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{renderLines(aiText)}</div>}
        </div>
      )}

      {/* Structured changes */}
      <div className="audit-card">
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
          Governance &amp; Disclosure Changes
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 0, fontSize: 11.5 }}>
          <Head>Item</Head><Head right>FY{from.year}</Head><Head right>FY{to.year}</Head>
          {structured.map((s, i) => (
            <React.Fragment key={i}>
              <Cell>{s.label}</Cell>
              <Cell right muted>{s.from}</Cell>
              <Cell right strong color={s.changed ? 'var(--accent-amber)' : undefined}>{s.to}</Cell>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Per-field text diffs */}
      {QUAL.map(({ key, label }) => {
        const { added, removed } = diffText(from[key] as string, to[key] as string);
        const hasOld = !!(from[key]), hasNew = !!(to[key]);
        if (!hasOld && !hasNew) return null;
        const nochange = added.length === 0 && removed.length === 0;
        return (
          <div key={String(key)} className="audit-card">
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', marginBottom: 10 }}>
              {label}
            </div>
            {nochange ? (
              <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: 0 }}>No material change detected.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {added.map((a, i) => <DiffItem key={`a${i}`} sign="+" color="var(--accent-green)" text={a} />)}
                {removed.map((r, i) => <DiffItem key={`r${i}`} sign="−" color="var(--accent-red)" text={r} />)}
              </div>
            )}
          </div>
        );
      })}

      <p style={{ fontSize: 10.5, color: 'var(--text-muted)', margin: 0 }}>
        Added (green) appears in FY{to.year} but not FY{from.year}; removed (red) was in FY{from.year} but is gone in FY{to.year}.
        Matching is fuzzy, so minor rewording is ignored — verify against the reports.
      </p>
    </div>
  );
}

/* ── small presentational helpers ─────────────────────────────────────────── */
function DiffItem({ sign, color, text }: { sign: string; color: string; text: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 11.5, lineHeight: 1.5 }}>
      <span style={{ color, fontWeight: 700, flexShrink: 0, fontFamily: 'var(--font-mono)' }}>{sign}</span>
      <span style={{ color: 'var(--text-secondary)' }}>{text}</span>
    </div>
  );
}
function Head({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', padding: '6px 0', borderBottom: '1px solid var(--border)', textAlign: right ? 'right' : 'left' }}>{children}</div>;
}
function Cell({ children, right, muted, strong, color }: { children: React.ReactNode; right?: boolean; muted?: boolean; strong?: boolean; color?: string }) {
  return <div style={{ padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: right ? 'right' : 'left', color: color || (muted ? 'var(--text-muted)' : 'var(--text-primary)'), fontWeight: strong ? 600 : 400 }}>{children}</div>;
}

function row(label: string, a?: string | null, b?: string | null) {
  const from = a == null || a === '' ? '—' : String(a);
  const to = b == null || b === '' ? '—' : String(b);
  return { label, from, to, changed: from !== to && to !== '—' };
}
function boolStr(v?: boolean | null) { return v == null ? '—' : v ? 'Yes' : 'No'; }
function pctStr(v?: number | null) { return v == null ? '—' : `${Number(v).toFixed(1)}%`; }
function pick(d: ScoredData) {
  return {
    keyRisks: d.keyRisks, opportunities: d.opportunities, mgmtOutlook: d.mgmtOutlook,
    kams: d.kams, accountingPolicyChanges: d.accountingPolicyChanges,
    auditorName: d.auditorName, auditorOpinion: d.auditorOpinion, hasGoingConcern: d.hasGoingConcern,
  };
}
