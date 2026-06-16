import React, { useState } from 'react';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Download } from 'lucide-react';
import { ScoredData } from '../lib/scoring';
import { fmtCr } from '../lib/format';
import { downloadReportDocx } from '../lib/reportDocx';
import { downloadReportXlsx } from '../lib/reportXlsx';
import SourcesTab from './SourcesTab';
import RelatedPartyPanel from './RelatedPartyPanel';
import NarrativeDiffPanel from './NarrativeDiffPanel';

interface Props {
  data: ScoredData[];
  fileUrls?: Record<number, string>;
  userApiKey?: string;
}

const TABS = ['overview', 'statements', 'parties', 'changes', 'sources'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = {
  overview: 'Overview', statements: 'Financial Statements',
  parties: 'Related Parties', changes: 'YoY Changes', sources: 'Sources',
};

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#0f1117', border: '1px solid #1f2433', borderRadius: 8, padding: '10px 14px', fontSize: 11.5 }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 6, fontFamily: 'var(--font-mono)', fontSize: 10 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color, marginBottom: 3 }}>{p.name}: {fmtCr(p.value)}</div>
      ))}
    </div>
  );
}

const AXIS_STYLE = { fill: '#4a5568', fontSize: 10, fontFamily: 'Space Mono' };

type StmtRow = { label: string; key: keyof ScoredData; kind?: 'cr' | 'eps' };

const PNL_ROWS: StmtRow[] = [
  { label: 'Revenue / Total Income', key: 'revenue' },
  { label: 'EBITDA', key: 'ebitda' },
  { label: 'Depreciation & Amortisation', key: 'depreciation' },
  { label: 'Exceptional Items', key: 'exceptionalItems' },
  { label: 'Profit After Tax', key: 'pat' },
  { label: 'EPS (₹/share)', key: 'eps', kind: 'eps' },
  { label: 'Diluted EPS (₹/share)', key: 'dilutedEps', kind: 'eps' },
  { label: 'Dividend Paid', key: 'dividendPaid' },
];
const CF_ROWS: StmtRow[] = [
  { label: 'Operating Cash Flow', key: 'operatingCashFlow' },
  { label: 'Capital Expenditure', key: 'capex' },
];
const BS_ROWS: StmtRow[] = [
  { label: 'Total Assets', key: 'totalAssets' },
  { label: 'Net Worth', key: 'netWorth' },
  { label: 'Total Debt', key: 'totalDebt' },
  { label: 'Net Debt', key: 'netDebt' },
  { label: 'Cash & Equivalents', key: 'cashEquivalents' },
  { label: 'Advances', key: 'advances' },
  { label: 'Deposits', key: 'deposits' },
  { label: 'AUM', key: 'aum' },
  { label: 'Trade Receivables', key: 'tradeReceivables' },
  { label: 'Inventories', key: 'inventories' },
  { label: 'Goodwill', key: 'goodwill' },
];

function StatementTable({ title, rows, data, isFinancial }: { title: string; rows: StmtRow[]; data: ScoredData[]; isFinancial: boolean }) {
  // EBITDA is meaningless for banks/NBFCs; drop it. Only keep rows with ≥1 value.
  const present = rows
    .filter(r => !(isFinancial && r.key === 'ebitda'))
    .filter(r => data.some(d => (d as any)[r.key] != null));
  if (!present.length) return null;
  const cols = `2fr ${data.map(() => '1fr').join(' ')}`;
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 18, marginBottom: 14 }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>{title}</h3>
      <div className="ratios-table">
        <div className="ratios-thead" style={{ gridTemplateColumns: cols }}>
          <div className="ratios-th">Item</div>
          {data.map(d => <div key={d.year} className="ratios-th" style={{ textAlign: 'right' }}>FY{d.year}</div>)}
        </div>
        {present.map(r => (
          <div key={String(r.key)} className="ratio-row" style={{ gridTemplateColumns: cols }}>
            <div className="ratio-cell">{r.label}</div>
            {data.map(d => {
              const v = (d as any)[r.key] as number | null | undefined;
              const txt = v == null ? '—' : r.kind === 'eps' ? `₹${Number(v).toFixed(2)}` : fmtCr(v);
              return <div key={d.year} className="ratio-cell" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{txt}</div>;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard({ data, fileUrls, userApiKey }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [exporting, setExporting] = useState(false);
  const latest = data[data.length - 1];
  // EBITDA is not a meaningful line for banks/NBFCs — hide it from KPIs and charts.
  const isFinancial = latest.sector === 'Banking' || latest.sector === 'NBFC' || latest.sector === 'Insurance';

  const handleExportDocx = async () => {
    try { setExporting(true); await downloadReportDocx(data); }
    catch (e) { console.error('DOCX export failed', e); alert('Could not generate the DOCX. Make sure the "docx" package is installed.'); }
    finally { setExporting(false); }
  };
  const handleExportXlsx = () => {
    try { downloadReportXlsx(data); }
    catch (e) { console.error('XLSX export failed', e); alert('Could not generate the XLSX. Make sure the "xlsx" package is installed.'); }
  };

  const chartData = data.map(d => ({
    year: `FY${d.year}`,
    Revenue: d.revenue ?? null, EBITDA: d.ebitda ?? null, PAT: d.pat ?? null,
    'Op. Cash Flow': d.operatingCashFlow ?? null, 'Total Debt': d.totalDebt ?? null,
  }));

  const kpiDefs: { label: string; key: keyof ScoredData }[] = [
    { label: 'Revenue', key: 'revenue' },
    ...(isFinancial ? [] : [{ label: 'EBITDA', key: 'ebitda' as keyof ScoredData }]),
    { label: 'Net Profit', key: 'pat' }, { label: 'Op. Cash Flow', key: 'operatingCashFlow' },
  ];

  const anyInsufficient = data.some(d => d.insufficientData);

  return (
    <div className="animate-fade-in-up" style={{ padding: '28px 32px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>
            {latest.companyName}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {latest.sector} · {data.map(d => `FY${d.year}`).join(', ')}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 12 }}>
            {data.map(d => (
              <div key={d.year}>
                <div style={{
                  width: 42, height: 42, borderRadius: 11, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16,
                  background: d.gradeColor + '18', border: `1.5px solid ${d.gradeColor}`, color: d.gradeColor, lineHeight: 1,
                }}>
                  {d.grade}
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, marginTop: 3, color: d.gradeColor }}>
                    {d.insufficientData ? '·' : d.score}
                  </span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', marginTop: 3 }}>FY{d.year}</div>
              </div>
            ))}
          </div>

          <button onClick={handleExportDocx} disabled={exporting} className="proceed-btn" style={{ height: 40, opacity: exporting ? 0.6 : 1 }} title="Download the full extracted report as Word">
            <Download size={14} /> {exporting ? 'Generating…' : 'DOCX'}
          </button>
          <button onClick={handleExportXlsx} className="proceed-btn" style={{ height: 40 }} title="Download model-ready spreadsheet">
            <Download size={14} /> XLSX
          </button>
        </div>
      </div>

      {anyInsufficient && (
        <div style={{
          background: 'rgba(245,158,11,0.12)', border: '1px solid var(--accent-amber)', borderRadius: 'var(--radius-md)',
          padding: '10px 14px', marginBottom: 14, fontSize: 12, color: 'var(--accent-amber)', display: 'flex', gap: 8, alignItems: 'flex-start',
        }}>
          <span style={{ flexShrink: 0 }}>⚠</span>
          <span><strong>Limited extraction for one or more years.</strong> Too few core figures were found, so those grades show as “—”. Re-upload a clearer PDF or check it contains consolidated statements.</span>
        </div>
      )}

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${kpiDefs.length}, 1fr)`, gap: 10, marginBottom: 18 }}>
        {kpiDefs.map(kpi => {
          const cur = latest[kpi.key] as number | null;
          const prev = data.length > 1 ? data[data.length - 2][kpi.key] as number | null : null;
          let trend = '', cls = 'trend-flat';
          if (cur != null && prev != null && prev !== 0) {
            const pct = ((cur - prev) / Math.abs(prev) * 100).toFixed(1);
            if (cur > prev * 1.02) { trend = `▲ +${pct}% YoY`; cls = 'trend-up'; }
            else if (cur < prev * 0.98) { trend = `▼ ${pct}% YoY`; cls = 'trend-dn'; }
            else trend = '→ Stable';
          }
          return (
            <div key={String(kpi.key)} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 14 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{kpi.label}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>{fmtCr(cur)}</div>
              {trend && <div className={cls} style={{ fontSize: 10, marginTop: 4 }}>{trend}</div>}
            </div>
          );
        })}
      </div>

      {/* Tab bar */}
      <div className="tab-bar">
        {TABS.map(t => (
          <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div>
          {latest.businessOverview ? (
            <div className="audit-card" style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--accent-green)', marginBottom: 8 }}>
                What {latest.companyName || 'the company'} does
              </div>
              <p style={{ fontSize: 12.5, lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-wrap' }}>
                {latest.businessOverview}
              </p>
              <p style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 10, marginBottom: 0 }}>
                Ask the AI Analyst for more on the business model, segments or strategy.
              </p>
            </div>
          ) : (
            <div className="audit-card" style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                No business overview was extracted. Re-upload a report whose MD&amp;A / business section is included, or ask the AI Analyst “what does this company do?”.
              </p>
            </div>
          )}

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 18, marginBottom: 14 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 13.5, fontWeight: 700, marginBottom: 2 }}>Revenue &amp; Profitability</h3>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginBottom: 14 }}>₹ Crores · null values shown as gaps</div>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={chartData}>
                <CartesianGrid vertical={false} stroke="#1f2433" />
                <XAxis dataKey="year" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} tick={AXIS_STYLE} axisLine={false} tickLine={false} width={48} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 10, color: '#4a5568' }} />
                <Bar dataKey="Revenue" fill="#3b82f6cc" radius={[4, 4, 0, 0]} />
                {!isFinancial && <Bar dataKey="EBITDA" fill="#6366f1cc" radius={[4, 4, 0, 0]} />}
                <Bar dataKey="PAT" fill="#00d084cc" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 18, marginBottom: 14 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 13.5, fontWeight: 700, marginBottom: 2 }}>Operating Cash Flow vs Total Debt</h3>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginBottom: 14 }}>₹ Crores · gaps indicate missing data</div>
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={chartData}>
                <CartesianGrid stroke="#1f2433" strokeDasharray="3 3" />
                <XAxis dataKey="year" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} tick={AXIS_STYLE} axisLine={false} tickLine={false} width={48} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 10, color: '#4a5568' }} />
                <Line dataKey="Op. Cash Flow" stroke="#00d084" strokeWidth={2} dot={{ fill: '#00d084', r: 4 }} activeDot={{ r: 6 }} connectNulls={false} />
                <Line dataKey="Total Debt" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 4 }} activeDot={{ r: 6 }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* FINANCIAL STATEMENTS */}
      {tab === 'statements' && (
        <div>
          <StatementTable title="Profit &amp; Loss" rows={PNL_ROWS} data={data} isFinancial={isFinancial} />
          <StatementTable title="Cash Flow" rows={CF_ROWS} data={data} isFinancial={isFinancial} />
          <StatementTable title="Balance Sheet — Key Items" rows={BS_ROWS} data={data} isFinancial={isFinancial} />
        </div>
      )}

      {tab === 'parties' && <RelatedPartyPanel data={data} />}
      {tab === 'changes' && <NarrativeDiffPanel data={data} userApiKey={userApiKey} />}
      {tab === 'sources' && <SourcesTab data={data} fileUrls={fileUrls} />}
    </div>
  );
}
