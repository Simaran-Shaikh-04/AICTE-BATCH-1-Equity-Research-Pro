// DOCX report generator. Place at src/lib/reportDocx.ts
// Requires:  npm install docx
//
// Builds a Word document from the AI-extracted, scored data and downloads it
// in the browser (no server round-trip). Called from Dashboard's export button.

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, AlignmentType, ShadingType, BorderStyle,
} from 'docx';
import { ScoredData } from './scoring';
import { fmtCr, fmtRatio } from './format';

const BRAND = '10B981';   // header fill
const ZEBRA = 'F3F4F6';   // alternate row fill
const MUTED = '6B7280';

function fmtIntLocal(v: number | null | undefined): string {
  return v == null || isNaN(Number(v)) ? '—' : Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function cell(text: string, opts: { bold?: boolean; color?: string; fill?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}): TableCell {
  return new TableCell({
    shading: opts.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: opts.fill } : undefined,
    margins: { top: 60, bottom: 60, left: 110, right: 110 },
    children: [new Paragraph({
      alignment: opts.align || AlignmentType.LEFT,
      children: [new TextRun({ text: text == null || text === '' ? '—' : text, bold: opts.bold, color: opts.color, size: 19 })],
    })],
  });
}

function table(headers: string[], rows: string[][]): Table {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) =>
      cell(h, { bold: true, color: 'FFFFFF', fill: BRAND, align: i === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT })),
  });
  const bodyRows = rows.map((r, ri) => new TableRow({
    children: r.map((c, ci) =>
      cell(c, { fill: ri % 2 === 1 ? ZEBRA : undefined, align: ci === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT })),
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 2, color: 'E5E7EB' },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: 'E5E7EB' },
      left:   { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      right:  { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
      insideVertical:   { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    },
    rows: [headerRow, ...bodyRows],
  });
}

function heading(text: string): Paragraph {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 120 }, children: [new TextRun({ text })] });
}

function body(text: string): Paragraph {
  return new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text, size: 21 })] });
}

function bullet(text: string): Paragraph {
  return new Paragraph({ bullet: { level: 0 }, spacing: { after: 40 }, children: [new TextRun({ text, size: 21 })] });
}

export async function downloadReportDocx(data: ScoredData[]): Promise<void> {
  if (!data || data.length === 0) return;
  const latest = data[data.length - 1];
  const years = data.map(d => `FY${d.year}`);
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  const children: (Paragraph | Table)[] = [];

  // ── Title ─────────────────────────────────────────────────────────────────
  children.push(new Paragraph({
    heading: HeadingLevel.TITLE,
    children: [new TextRun({ text: latest.companyName || 'Company Report' })],
  }));
  children.push(new Paragraph({
    spacing: { after: 60 },
    children: [new TextRun({ text: `${latest.sector} · ${years.join(', ')}`, color: MUTED, size: 22 })],
  }));
  children.push(new Paragraph({
    spacing: { after: 200 },
    children: [new TextRun({ text: `AI-extracted equity research report · Generated ${today}`, italics: true, color: MUTED, size: 18 })],
  }));

  // ── Business overview (what the company does) ───────────────────────────────
  if (latest.businessOverview) {
    children.push(heading('Business Overview'));
    String(latest.businessOverview).split(/\n{2,}|\n/).map(s => s.trim()).filter(Boolean)
      .forEach(line => children.push(body(line)));
  }

  // ── Scorecard ───────────────────────────────────────────────────────────────
  children.push(heading('Scorecard'));
  children.push(table(
    ['Year', 'Grade', 'Score', 'Basis'],
    data.map(d => [`FY${d.year}`, d.grade, d.insufficientData ? 'N/A' : String(d.score), d.insufficientData ? 'Insufficient data' : 'Composite']),
  ));

  // ── Key financials ───────────────────────────────────────────────────────────
  children.push(heading('Key Financials (₹ Crores unless noted)'));
  const isFin = latest.sector === 'Banking' || latest.sector === 'NBFC' || latest.sector === 'Insurance';
  const isBankOrNbfc = latest.sector === 'Banking' || latest.sector === 'NBFC';
  const finRows: string[][] = [
    [isBankOrNbfc ? 'Total Income' : 'Revenue / Total Income', ...data.map(d => fmtCr(d.revenue))],
    ...(isBankOrNbfc && data.some(d => d.interestIncome != null) ? [['Interest Earned (Revenue)', ...data.map(d => fmtCr(d.interestIncome))]] : []),
    ...(isFin ? [] : [['EBITDA', ...data.map(d => fmtCr(d.ebitda))]]),
    ['Profit After Tax', ...data.map(d => fmtCr(d.pat))],
    ['Net Worth', ...data.map(d => fmtCr(d.netWorth))],
    ['Current Liabilities', ...data.map(d => fmtCr(d.currentLiabilities))],
    ['Total Debt', ...data.map(d => fmtCr(d.totalDebt))],
    ['Cash & Equivalents', ...data.map(d => fmtCr(d.cashEquivalents))],
    ['Operating Cash Flow', ...data.map(d => fmtCr(d.operatingCashFlow))],
    ['EPS (₹/share)', ...data.map(d => d.eps == null ? '—' : `₹${Number(d.eps).toFixed(2)}`)],
  ];

  // Sector-relevant optional rows — included only if any year reports them.
  const optional: [string, keyof ScoredData, 'cr' | 'pct' | 'int' | 'ratio'][] = [
    ['AUM', 'aum', 'cr'],
    ['Gross Written Premium', 'grossWrittenPremium', 'cr'],
    ['Solvency Ratio', 'solvencyRatio', 'ratio'],
    ['Claims Ratio %', 'claimsRatio', 'pct'],
    ['Embedded Value', 'embeddedValue', 'cr'],
    ['Net Debt', 'netDebt', 'cr'],
    ['Order Book', 'orderBook', 'cr'],
    ['Toll Revenue', 'tollRevenue', 'cr'],
    ['Advances', 'advances', 'cr'],
    ['Deposits', 'deposits', 'cr'],
    ['Gross NPA %', 'grossNPA', 'pct'],
    ['Net NPA %', 'netNPA', 'pct'],
    ['Capital Adequacy %', 'capitalAdequacyRatio', 'pct'],
    ['Net Interest Margin %', 'netInterestMargin', 'pct'],
    ['Cost of Funds %', 'costOfFunds', 'pct'],
    ['ROAA %', 'roaa', 'pct'],
    ['R&D Expense', 'rdExpense', 'cr'],
    ['Specialty Revenue', 'specialtyRevenue', 'cr'],
    ['FDA Warning Letters', 'fdaWarningLetters', 'int'],
    ['Employee Count', 'employeeCount', 'int'],
    ['Attrition %', 'attritionRate', 'pct'],
    ['Capacity Utilisation %', 'capacityUtilization', 'pct'],
    ['Total Volumes Sold', 'totalVolumesSold', 'int'],
    ['CWIP', 'cwipActive', 'cr'],
    ['Goodwill', 'goodwill', 'cr'],
    ['Trade Receivables', 'tradeReceivables', 'cr'],
    ['Inventories', 'inventories', 'cr'],
    ['Capex', 'capex', 'cr'],
    ['Contingent Liabilities', 'contingentLiabilities', 'cr'],
    ['Related Party Txns', 'relatedPartyTransactions', 'cr'],
  ];
  for (const [label, key, kind] of optional) {
    const present = data.some(d => (d as any)[key] != null);
    if (!present) continue;
    finRows.push([label, ...data.map(d => {
      const v = (d as any)[key] as number | null | undefined;
      if (v == null) return '—';
      return kind === 'cr' ? fmtCr(v) : kind === 'pct' ? `${Number(v).toFixed(2)}%` : kind === 'ratio' ? `${Number(v).toFixed(2)}x` : fmtIntLocal(v);
    })]);
  }
  children.push(table(['Metric', ...years], finRows));

  // ── Ratios ───────────────────────────────────────────────────────────────────
  const ratioKeys = Array.from(new Set(data.flatMap(d => Object.keys(d.ratios || {}))));
  if (ratioKeys.length) {
    children.push(heading('Computed Ratios'));
    children.push(table(
      ['Ratio', ...years],
      ratioKeys.map(k => [k, ...data.map(d => fmtRatio(k, (d.ratios as any)?.[k]))]),
    ));
  }

  // ── Forensic flags & trend signals ────────────────────────────────────────────
  const flags = Array.from(new Set(data.flatMap(d => d.flags || [])));
  const trends = Array.from(new Set(data.flatMap(d => d.trendFlags || [])));
  if (flags.length) {
    children.push(heading('Forensic Flags'));
    flags.forEach(f => children.push(bullet(f)));
  }
  if (trends.length) {
    children.push(heading('Trend Signals (year-over-year)'));
    trends.forEach(f => children.push(bullet(f)));
  }

  // ── Audit & governance ─────────────────────────────────────────────────────────
  children.push(heading('Audit & Governance'));
  children.push(table(
    ['Item', 'Value'],
    [
      ['Auditor', latest.auditorName || '—'],
      ['Audit Opinion', latest.auditorOpinion || '—'],
      ['Going Concern Flag', latest.hasGoingConcern == null ? '—' : latest.hasGoingConcern ? 'Yes' : 'No'],
      ['Auditor Changed This Year', latest.auditorChangedThisYear == null ? '—' : latest.auditorChangedThisYear ? 'Yes' : 'No'],
      ['Promoter Pledge %', latest.promoterPledgePercent == null ? '—' : `${Number(latest.promoterPledgePercent).toFixed(1)}%`],
      ['Contingent Liabilities', fmtCr(latest.contingentLiabilities)],
      ['Related Party Transactions', fmtCr(latest.relatedPartyTransactions)],
      ['Auditor Fees', fmtCr(latest.auditorFees)],
    ],
  ));

  // ── Methodology Notes ────────────────────────────────────────────────────────
  children.push(heading('Methodology & Alignment Notes'));
  children.push(paragraph({
    children: [
      new TextRun({ text: "• PAT: ", bold: true }),
      new TextRun("Attributable to parent shareholders. Differs from Screener consolidated PAT (which includes minority interests) by ~4–6%.\n"),
      new TextRun({ text: "• Net Worth: ", bold: true }),
      new TextRun("Represents Share Capital + Reserves & Surplus attributable to parent. Differences from Screener can exist due to minority interest or revaluation reserves.\n"),
      isBankOrNbfc ? new TextRun({ text: "• Total Income vs. Revenue: ", bold: true }) : new TextRun(""),
      isBankOrNbfc ? new TextRun("Total Income includes other income, whereas Screener's Revenue row is narrower (typically Interest Earned only).\n") : new TextRun(""),
      new TextRun({ text: "• EPS: ", bold: true }),
      new TextRun("Basic consolidated EPS as printed in the annual reports. May differ from Screener due to stock splits, face value, or post-merger share count changes.\n"),
      new TextRun({ text: "• Fiscal Year: ", bold: true }),
      new TextRun("Annual reports use March-ending fiscal years (e.g. FY2024 ends March 31, 2024). Some database tools may show a one-year label offset.\n"),
    ],
  }));

  // ── Qualitative narrative (latest year) ────────────────────────────────────────
  const qual: [string, keyof ScoredData][] = [
    ['MD&A Highlights', 'mdaHighlights'],
    ['Key Audit Matters', 'kams'],
    ['Management Outlook', 'mgmtOutlook'],
    ['Key Risks', 'keyRisks'],
    ['Opportunities', 'opportunities'],
    ['Accounting Policy Changes', 'accountingPolicyChanges'],
  ];
  for (const [label, key] of qual) {
    const val = (latest as any)[key] as string | undefined;
    if (!val) continue;
    children.push(heading(label));
    // split on blank lines / newlines into readable paragraphs
    String(val).split(/\n{2,}|\n/).map(s => s.trim()).filter(Boolean).forEach(line => children.push(body(line)));
  }

  // ── Sources & citations (page references per year) ─────────────────────────────
  const citationLabels: Record<string, string> = {
    revenue: 'Revenue / Total Income', pat: 'Profit After Tax', ebitda: 'EBITDA',
    totalDebt: 'Total Debt', netWorth: 'Net Worth', cashEquivalents: 'Cash & Equivalents',
    operatingCashFlow: 'Operating Cash Flow', eps: 'EPS', aum: 'AUM',
    grossNPA: 'Gross NPA', netNPA: 'Net NPA', capitalAdequacyRatio: 'Capital Adequacy',
    netInterestMargin: 'Net Interest Margin', netInterestIncome: 'Net Interest Income',
    advances: 'Advances', deposits: 'Deposits', costOfFunds: 'Cost of Funds', roaa: 'ROAA',
    rdExpense: 'R&D Expense', specialtyRevenue: 'Specialty Revenue', fdaWarningLetters: 'FDA Warning Letters',
    employeeCount: 'Employee Count', attritionRate: 'Attrition', capacityUtilization: 'Capacity Utilisation',
    totalVolumesSold: 'Volumes Sold', netDebt: 'Net Debt', orderBook: 'Order Book', tollRevenue: 'Toll Revenue',
    cwipActive: 'CWIP', contingentLiabilities: 'Contingent Liabilities', relatedPartyTransactions: 'Related Party Txns',
    promoterPledgePercent: 'Promoter Pledge', auditorFees: 'Auditor Fees', goodwill: 'Goodwill',
  };
  const yearsWithCitations = data.filter(d => (d.citations?.length || 0) > 0);
  if (yearsWithCitations.length) {
    children.push(heading('Sources & Citations'));
    children.push(new Paragraph({
      spacing: { after: 120 },
      children: [new TextRun({
        text: 'Page numbers refer to the original annual report PDF and are AI-generated (approximate). Verify before relying on them.',
        italics: true, color: MUTED, size: 17,
      })],
    }));
    for (const d of yearsWithCitations) {
      children.push(new Paragraph({
        spacing: { before: 120, after: 60 },
        children: [new TextRun({ text: `FY${d.year}`, bold: true, size: 20 })],
      }));
      children.push(table(
        ['Metric', 'Page', 'Source line'],
        (d.citations || []).map(c => [
          citationLabels[c.field] || c.field,
          c.page != null ? `p.${c.page}` : '—',
          c.quote || '—',
        ]),
      ));
    }
  }

  // ── Disclaimer ──────────────────────────────────────────────────────────────────
  children.push(new Paragraph({
    spacing: { before: 320 },
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB', space: 8 } },
    children: [new TextRun({
      text: 'Disclaimer: Figures were extracted from annual report PDFs by an AI model and may contain errors. ' +
            'This is not investment advice. Verify all numbers against the source filing before relying on them.',
      italics: true, color: MUTED, size: 16,
    })],
  }));

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Calibri' } } } },
    sections: [{ properties: {}, children }],
  });

  const blob = await Packer.toBlob(doc);
  const safeName = (latest.companyName || 'company').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
  const filename = `${safeName}_Equity_Report_${years.join('-')}.docx`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
