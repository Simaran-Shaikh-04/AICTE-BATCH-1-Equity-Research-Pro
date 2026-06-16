import React from 'react';
import { ScoredData } from '../lib/scoring';
import { fmtCr } from '../lib/format';

interface Props { data: ScoredData[]; }

const CAT_COLORS = ['#ef4444', '#f59e0b', '#6366f1', '#3b82f6', '#00d084', '#8b5cf6', '#64748b'];
const REL_COLORS = ['#3b82f6', '#00d084', '#f59e0b', '#8b5cf6', '#ef4444', '#6366f1', '#64748b'];

function aggregate<T>(items: T[] | undefined, keyOf: (t: T) => string, amtOf: (t: T) => number) {
  const m = new Map<string, number>();
  (items || []).forEach(it => {
    const k = (keyOf(it) || 'Other').trim() || 'Other';
    m.set(k, (m.get(k) || 0) + Math.abs(Number(amtOf(it)) || 0));
  });
  return [...m.entries()].map(([key, amount]) => ({ key, amount })).sort((a, b) => b.amount - a.amount);
}

/* Horizontal proportion bar */
function Bar({ label, amount, max, total, color }: { label: string; amount: number; max: number; total: number; color: string }) {
  const w = max > 0 ? Math.max(2, (amount / max) * 100) : 0;
  const share = total > 0 ? (amount / total) * 100 : 0;
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 3 }}>
        <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '62%' }}>{label}</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
          {fmtCr(amount)} <span style={{ color: 'var(--text-muted)' }}>· {share.toFixed(0)}%</span>
        </span>
      </div>
      <div style={{ height: 7, background: 'var(--bg-hover, rgba(255,255,255,0.05))', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${w}%`, height: '100%', background: color, borderRadius: 4 }} />
      </div>
    </div>
  );
}

/* Tiny multi-year trend (one bar per year) */
function YearTrend({ rows }: { rows: { year: number; value: number | null; sub?: string }[] }) {
  const max = Math.max(1, ...rows.map(r => (r.value != null ? Math.abs(r.value) : 0)));
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', height: 92, marginTop: 6 }}>
      {rows.map(r => {
        const h = r.value != null ? Math.max(4, (Math.abs(r.value) / max) * 72) : 0;
        return (
          <div key={r.year} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
              {r.value != null ? fmtCr(r.value) : '—'}
            </div>
            <div style={{ width: '100%', maxWidth: 46, height: h, background: 'var(--accent-indigo, #6366f1)', borderRadius: '4px 4px 0 0' }} />
            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>FY{r.year}</div>
            {r.sub && <div style={{ fontSize: 8.5, color: 'var(--text-muted)' }}>{r.sub}</div>}
          </div>
        );
      })}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)' }}>
      {children}
    </div>
  );
}

export default function RelatedPartyPanel({ data }: Props) {
  if (!data || data.length === 0) {
    return <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 24 }}>No data available.</div>;
  }
  const latest = data[data.length - 1];
  const isFinancial = latest.sector === 'Banking' || latest.sector === 'NBFC' || latest.sector === 'Insurance';

  // ── Contingent liabilities ──────────────────────────────────────────────────
  const clCats = aggregate(latest.contingentLiabilityDetails, x => x.category, x => x.amount);
  const clTotal = latest.contingentLiabilities ?? (clCats.length ? clCats.reduce((s, c) => s + c.amount, 0) : null);
  const clMax = Math.max(1, ...clCats.map(c => c.amount));
  const clTrend = data.map(d => ({
    year: d.year,
    value: d.contingentLiabilities ?? null,
    sub: d.contingentLiabilities != null && d.revenue ? `${((d.contingentLiabilities / d.revenue) * 100).toFixed(0)}% rev` : undefined,
  }));
  const clPctRev = clTotal != null && latest.revenue ? (clTotal / latest.revenue) * 100 : null;

  // ── Related-party transactions ──────────────────────────────────────────────
  const rptByRel = aggregate(latest.relatedPartyDetails, x => x.relationship || 'Other', x => x.amount);
  const rptTotal = latest.relatedPartyTransactions ?? (latest.relatedPartyDetails?.length
    ? latest.relatedPartyDetails.reduce((s, r) => s + Math.abs(Number(r.amount) || 0), 0) : null);
  const relMax = Math.max(1, ...rptByRel.map(r => r.amount));
  const topItems = [...(latest.relatedPartyDetails || [])]
    .map(r => ({ ...r, amount: Math.abs(Number(r.amount) || 0) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);
  const rptTrend = data.map(d => ({
    year: d.year,
    value: d.relatedPartyTransactions ?? null,
    sub: d.relatedPartyTransactions != null && d.revenue ? `${((d.relatedPartyTransactions / d.revenue) * 100).toFixed(0)}% rev` : undefined,
  }));
  const rptPctRev = rptTotal != null && latest.revenue ? (rptTotal / latest.revenue) * 100 : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Contingent liabilities ── */}
      <div className="audit-card">
        <SectionTitle>Contingent Liabilities</SectionTitle>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <Stat label="Total (latest)" value={fmtCr(clTotal)} />
          <Stat label="% of Revenue" value={clPctRev == null ? '—' : `${clPctRev.toFixed(1)}%`}
                flag={clPctRev != null && clPctRev > 50} />
          <Stat label="Categories" value={clCats.length ? String(clCats.length) : '—'} />
        </div>

        {clCats.length > 0 ? (
          <div style={{ marginBottom: 8 }}>
            {clCats.map((c, i) => (
              <Bar key={c.key} label={c.key} amount={c.amount} max={clMax} total={clTotal || 0} color={CAT_COLORS[i % CAT_COLORS.length]} />
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '0 0 8px' }}>
            No category breakdown extracted{clTotal != null ? ' — only the headline total is available.' : '.'}
          </p>
        )}

        {data.length > 1 && (
          <>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 6 }}>
              Total trend
            </div>
            <YearTrend rows={clTrend} />
          </>
        )}
        {isFinancial && (
          <p style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 10, marginBottom: 0 }}>
            Note: for banks/NBFCs this includes off-balance-sheet exposures (guarantees, LCs, derivative notionals), which are naturally large.
          </p>
        )}
      </div>

      {/* ── Related-party transactions ── */}
      <div className="audit-card">
        <SectionTitle>Related Party Transactions</SectionTitle>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <Stat label="Total (latest)" value={fmtCr(rptTotal)} />
          <Stat label="% of Revenue" value={rptPctRev == null ? '—' : `${rptPctRev.toFixed(1)}%`}
                flag={!isFinancial && rptPctRev != null && rptPctRev > 15} />
          <Stat label="Counterparties" value={latest.relatedPartyDetails?.length ? String(latest.relatedPartyDetails.length) : '—'} />
        </div>

        {rptByRel.length > 0 ? (
          <>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
              By relationship
            </div>
            {rptByRel.map((r, i) => (
              <Bar key={r.key} label={r.key} amount={r.amount} max={relMax} total={rptTotal || 0} color={REL_COLORS[i % REL_COLORS.length]} />
            ))}

            {topItems.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
                  Top counterparties
                </div>
                {topItems.map((it, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', gap: 10,
                    padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 11.5,
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ color: 'var(--text-primary)' }}>{it.party || '—'}</span>
                      {(it.relationship || it.nature) && (
                        <span style={{ color: 'var(--text-muted)', fontSize: 10.5 }}>
                          {' · '}{[it.relationship, it.nature].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)', fontWeight: 600, flexShrink: 0 }}>
                      {fmtCr(it.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '0 0 8px' }}>
            No counterparty breakdown extracted{rptTotal != null ? ' — only the headline total is available.' : '.'}
          </p>
        )}

        {data.length > 1 && (
          <>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 6 }}>
              Total trend
            </div>
            <YearTrend rows={rptTrend} />
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, flag }: { label: string; value: string; flag?: boolean }) {
  return (
    <div style={{ minWidth: 120 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: flag ? 'var(--accent-red)' : 'var(--text-primary)' }}>
        {value}
      </div>
    </div>
  );
}
