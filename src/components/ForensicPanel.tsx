import React from 'react';
import { ScoredData } from '../lib/scoring';
import { fmtCr, fmtPct } from '../lib/format';

interface Props { data: ScoredData[]; }

function ForensicRow({ label, value, flag }: { label: string; value: string; flag?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12,
    }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ color: flag ? 'var(--accent-red)' : 'var(--text-primary)', fontWeight: 600 }}>
        {value}
      </span>
    </div>
  );
}

export default function ForensicPanel({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 24 }}>
        No data available. Upload annual reports to see forensic analysis.
      </div>
    );
  }

  const latest = data[data.length - 1];
  const isFinancial = latest.sector === 'Banking' || latest.sector === 'NBFC' || latest.sector === 'Insurance';
  // "Unmodified" / "Unqualified" are clean opinions; only flag genuine exceptions.
  const isCleanOpinion = (op?: string | null) =>
    !op || /^(clean|un[\s-]?modified|un[\s-]?qualified)\b/i.test(op.trim());

  // Headline flags computed here (kept from the original) …
  const flags: string[] = [];
  if (latest.promoterPledgePercent != null && latest.promoterPledgePercent > 20)
    flags.push(`High promoter pledge: ${fmtPct(latest.promoterPledgePercent)}`);
  // For banks/NBFCs, contingent liabilities (derivative notionals, LCs, guarantees) are
  // structurally many multiples of revenue and are NOT a forensic red flag — skip them.
  if (!isFinancial && latest.contingentLiabilities != null && latest.revenue != null && latest.revenue > 0 &&
      latest.contingentLiabilities / latest.revenue > 0.3)
    flags.push(`Contingent liabilities ${fmtPct((latest.contingentLiabilities / latest.revenue) * 100)} of revenue`);
  if (latest.hasGoingConcern)
    flags.push('Going concern qualification noted by auditor');
  if (latest.auditorOpinion && !isCleanOpinion(latest.auditorOpinion))
    flags.push(`Auditor opinion: ${latest.auditorOpinion}`);

  // … merged with the richer flags the scoring engine produced.
  const scoreFlags = [...new Set(data.flatMap(d => d.flags || []))];
  const allFlags = [...new Set([...flags, ...scoreFlags])];

  // NEW — year-over-year trend signals from the scoring engine.
  const trendFlags = [...new Set(data.flatMap(d => d.trendFlags || []))];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {latest.insufficientData && (
        <div style={{
          background: 'rgba(245,158,11,0.12)', border: '1px solid var(--accent-amber)',
          borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: 12,
          color: 'var(--accent-amber)', display: 'flex', gap: 8, alignItems: 'flex-start',
        }}>
          <span style={{ flexShrink: 0 }}>⚠</span>
          <span><strong>Insufficient data extracted.</strong> Too few core figures were found to
            assess this company reliably. Re-upload a clearer PDF or verify it contains consolidated statements.</span>
        </div>
      )}

      {latest.isConsolidated === false && (
        <div style={{
          background: 'rgba(245,158,11,0.12)', border: '1px solid var(--accent-amber)',
          borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: 12,
          color: 'var(--accent-amber)', display: 'flex', gap: 8, alignItems: 'flex-start',
        }}>
          <span style={{ flexShrink: 0 }}>⚠</span>
          <span><strong>Standalone data only.</strong> Consolidated statements were not found.</span>
        </div>
      )}

      {allFlags.length > 0 && (
        <div className="forensic-flag-card">
          <div className="forensic-flag-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Forensic Flags ({allFlags.length})
          </div>
          {allFlags.map((f, i) => (
            <div key={i} className="flag-item">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--accent-red)" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              {f}
            </div>
          ))}
        </div>
      )}

      {/* NEW — Trend Signals card */}
      {trendFlags.length > 0 && (
        <div className="forensic-flag-card" style={{ borderColor: 'var(--accent-indigo, #6366f1)' }}>
          <div className="forensic-flag-title" style={{ color: 'var(--accent-indigo, #6366f1)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              <polyline points="17 6 23 6 23 12" />
            </svg>
            Trend Signals ({trendFlags.length})
          </div>
          {trendFlags.map((f, i) => (
            <div key={i} className="flag-item">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--accent-indigo, #6366f1)" strokeWidth="2">
                <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
              </svg>
              {f}
            </div>
          ))}
        </div>
      )}

      <div className="audit-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: 12 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-indigo)" strokeWidth="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          Audit &amp; Governance
        </div>
        <ForensicRow label="Auditor" value={latest.auditorName || '—'} />
        <ForensicRow label="Opinion" value={latest.auditorOpinion || '—'} flag={!!latest.auditorOpinion && !isCleanOpinion(latest.auditorOpinion)} />
        <ForensicRow label="Promoter Pledge" value={fmtPct(latest.promoterPledgePercent)} flag={latest.promoterPledgePercent != null && latest.promoterPledgePercent > 20} />
        <ForensicRow label="Contingent Liabilities" value={fmtCr(latest.contingentLiabilities)} />
        <ForensicRow label="Related Party Transactions" value={fmtCr(latest.relatedPartyTransactions)} />
        <ForensicRow label="Auditor Fees" value={fmtCr(latest.auditorFees)} />
        <ForensicRow label="Auditor Changed" value={latest.auditorChangedThisYear == null ? '—' : latest.auditorChangedThisYear ? 'Yes ⚠' : 'No'} flag={!!latest.auditorChangedThisYear} />
        <ForensicRow label="Going Concern" value={latest.hasGoingConcern == null ? '—' : latest.hasGoingConcern ? 'Yes ⚠' : 'No'} flag={!!latest.hasGoingConcern} />
      </div>

      {(['kams'] as const).map(k => {
        const val = (latest as any)[k];
        if (!val) return null;
        const lbls: Record<string, string> = {
          kams: 'Key Audit Matters',
        };
        return (
          <div key={k} className="audit-card">
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', marginBottom: 8 }}>
              {lbls[k]}
            </div>
            <p style={{ fontSize: 11.5, lineHeight: 1.7, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', margin: 0 }}>
              {val}
            </p>
          </div>
        );
      })}

      {allFlags.length === 0 && trendFlags.length === 0 && !latest.auditorName && (
        <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>No forensic flags identified.</p>
      )}
    </div>
  );
}
