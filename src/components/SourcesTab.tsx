import React from 'react';
import { FileText, ExternalLink } from 'lucide-react';
import { ScoredData } from '../lib/scoring';

interface Props {
  data: ScoredData[];
  /** year -> object URL of the uploaded PDF (built in App.tsx) */
  fileUrls?: Record<number, string>;
}

// Friendly labels for the field names the model cites.
const LABELS: Record<string, string> = {
  revenue: 'Revenue / Total Income', pat: 'Profit After Tax', ebitda: 'EBITDA',
  totalDebt: 'Total Debt', netWorth: 'Net Worth', cashEquivalents: 'Cash & Equivalents',
  operatingCashFlow: 'Operating Cash Flow', eps: 'EPS', aum: 'AUM',
  grossNPA: 'Gross NPA %', netNPA: 'Net NPA %', capitalAdequacyRatio: 'Capital Adequacy %',
  netInterestMargin: 'Net Interest Margin %', netInterestIncome: 'Net Interest Income',
  advances: 'Advances', deposits: 'Deposits', costOfFunds: 'Cost of Funds %', roaa: 'ROAA %',
  rdExpense: 'R&D Expense', specialtyRevenue: 'Specialty Revenue', fdaWarningLetters: 'FDA Warning Letters',
  employeeCount: 'Employee Count', attritionRate: 'Attrition %', capacityUtilization: 'Capacity Utilisation %',
  totalVolumesSold: 'Volumes Sold', netDebt: 'Net Debt', orderBook: 'Order Book', tollRevenue: 'Toll Revenue',
  cwipActive: 'CWIP', contingentLiabilities: 'Contingent Liabilities', relatedPartyTransactions: 'Related Party Txns',
  promoterPledgePercent: 'Promoter Pledge %', auditorFees: 'Auditor Fees', goodwill: 'Goodwill',
};

export default function SourcesTab({ data, fileUrls }: Props) {
  const openPage = (year: number, page: number) => {
    const url = fileUrls?.[year];
    if (!url) return;
    // Most built-in PDF viewers honour #page=N when opened in a new tab.
    window.open(`${url}#page=${page}`, '_blank', 'noopener');
  };

  const anyCitations = data.some(d => (d.citations?.length || 0) > 0);

  if (!anyCitations) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: 12.5, padding: '12px 2px', lineHeight: 1.6 }}>
        No source citations were returned for this extraction. Citations are best-effort — re-running the
        extraction, or uploading a text-based (non-scanned) PDF, usually improves them.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
        Each figure below links to the page of the annual report it was read from. Click a page chip to open the
        source PDF at that page. Citations are AI-generated and approximate — verify before relying on them.
      </p>

      {data.map(d => {
        const cites = d.citations || [];
        if (!cites.length) return null;
        const hasUrl = !!fileUrls?.[d.year];
        return (
          <div key={d.year} className="audit-card">
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
              fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700,
            }}>
              <FileText size={14} style={{ color: 'var(--accent-green)' }} />
              FY{d.year} · {cites.length} citation{cites.length === 1 ? '' : 's'}
              {!hasUrl && (
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>
                  (PDF not available this session — page links disabled)
                </span>
              )}
            </div>

            {cites.map((c, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12,
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                    {LABELS[c.field] || c.field}
                  </div>
                  {c.quote && (
                    <div style={{
                      color: 'var(--text-muted)', fontSize: 10.5, marginTop: 2,
                      fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      “{c.quote}”
                    </div>
                  )}
                </div>
                <button
                  onClick={() => hasUrl && openPage(d.year, c.page)}
                  disabled={!hasUrl}
                  style={{
                    flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
                    background: 'var(--accent-green-dim)', color: 'var(--accent-green)',
                    border: '1px solid var(--accent-green)', borderRadius: 999,
                    padding: '3px 10px', fontSize: 10.5, fontFamily: 'var(--font-mono)',
                    cursor: hasUrl ? 'pointer' : 'default', opacity: hasUrl ? 1 : 0.5,
                  }}
                  title={hasUrl ? `Open page ${c.page}` : 'PDF not available'}
                >
                  p.{c.page}
                  {hasUrl && <ExternalLink size={11} />}
                </button>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
