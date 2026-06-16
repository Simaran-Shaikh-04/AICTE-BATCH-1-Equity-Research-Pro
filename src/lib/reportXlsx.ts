// XLSX report generator. Place at src/lib/reportXlsx.ts
// Requires:  npm install xlsx
//
// Builds a multi-sheet, model-ready workbook (numbers as real numbers, years as
// columns) from the scored/extracted data and downloads it in the browser.

import * as XLSX from 'xlsx';
import { ScoredData } from './scoring';

type Unit = '₹ Cr' | '%' | '₹/share' | 'count' | 'x' | 'days';

const num = (v: number | null | undefined): number | null =>
  v == null || isNaN(Number(v)) ? null : Number(v);

// Metric rows for the Financials sheet: [label, key, unit]
const FIN_ROWS: [string, keyof ScoredData, Unit][] = [
  ['Revenue / Total Income', 'revenue', '₹ Cr'],
  ['EBITDA', 'ebitda', '₹ Cr'],
  ['Profit After Tax', 'pat', '₹ Cr'],
  ['Gross Profit', 'grossProfit', '₹ Cr'],
  ['Net Worth', 'netWorth', '₹ Cr'],
  ['Total Debt', 'totalDebt', '₹ Cr'],
  ['Net Debt', 'netDebt', '₹ Cr'],
  ['Cash & Equivalents', 'cashEquivalents', '₹ Cr'],
  ['Operating Cash Flow', 'operatingCashFlow', '₹ Cr'],
  ['Capex', 'capex', '₹ Cr'],
  ['Depreciation', 'depreciation', '₹ Cr'],
  ['Dividend Paid', 'dividendPaid', '₹ Cr'],
  ['Total Assets', 'totalAssets', '₹ Cr'],
  ['Trade Receivables', 'tradeReceivables', '₹ Cr'],
  ['Inventories', 'inventories', '₹ Cr'],
  ['Goodwill', 'goodwill', '₹ Cr'],
  ['Deferred Tax Assets', 'deferredTaxAssets', '₹ Cr'],
  ['Exceptional Items', 'exceptionalItems', '₹ Cr'],
  ['EPS', 'eps', '₹/share'],
  ['Diluted EPS', 'dilutedEps', '₹/share'],
  ['Contingent Liabilities', 'contingentLiabilities', '₹ Cr'],
  ['Related Party Transactions', 'relatedPartyTransactions', '₹ Cr'],
  ['Auditor Fees', 'auditorFees', '₹ Cr'],
  ['Promoter Pledge', 'promoterPledgePercent', '%'],
  // Sector-specific (only emitted if present)
  ['AUM', 'aum', '₹ Cr'],
  ['Advances', 'advances', '₹ Cr'],
  ['Deposits', 'deposits', '₹ Cr'],
  ['Net Interest Income', 'netInterestIncome', '₹ Cr'],
  ['Net Interest Margin', 'netInterestMargin', '%'],
  ['Gross NPA', 'grossNPA', '%'],
  ['Net NPA', 'netNPA', '%'],
  ['Capital Adequacy', 'capitalAdequacyRatio', '%'],
  ['Cost of Funds', 'costOfFunds', '%'],
  ['ROAA', 'roaa', '%'],
  ['R&D Expense', 'rdExpense', '₹ Cr'],
  ['Specialty Revenue', 'specialtyRevenue', '₹ Cr'],
  ['FDA Warning Letters', 'fdaWarningLetters', 'count'],
  ['Employee Count', 'employeeCount', 'count'],
  ['Attrition', 'attritionRate', '%'],
  ['Capacity Utilisation', 'capacityUtilization', '%'],
  ['Total Volumes Sold', 'totalVolumesSold', 'count'],
  ['Order Book', 'orderBook', '₹ Cr'],
  ['Toll Revenue', 'tollRevenue', '₹ Cr'],
  ['CWIP', 'cwipActive', '₹ Cr'],
  ['Gross Written Premium', 'grossWrittenPremium', '₹ Cr'],
  ['Solvency Ratio', 'solvencyRatio', 'x'],
  ['Claims Ratio', 'claimsRatio', '%'],
  ['Embedded Value', 'embeddedValue', '₹ Cr'],
];

function autoCols(aoa: any[][]): { wch: number }[] {
  const widths: number[] = [];
  aoa.forEach(row => row.forEach((cell, i) => {
    const len = cell == null ? 0 : String(cell).length;
    widths[i] = Math.max(widths[i] || 10, Math.min(48, len + 2));
  }));
  return widths.map(w => ({ wch: w }));
}

export function downloadReportXlsx(data: ScoredData[]): void {
  if (!data || data.length === 0) return;
  const latest = data[data.length - 1];
  const years = data.map(d => `FY${d.year}`);
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Financials ──────────────────────────────────────────────────
  const finAoa: any[][] = [];
  finAoa.push([latest.companyName || 'Company']);
  finAoa.push(['Sector', latest.sector, 'Generated', new Date().toISOString().slice(0, 10)]);
  finAoa.push([]);
  finAoa.push(['Metric', 'Unit', ...years]);
  for (const [label, key, unit] of FIN_ROWS) {
    if (!data.some(d => num(d[key] as number) != null)) continue;  // skip empty rows
    finAoa.push([label, unit, ...data.map(d => num(d[key] as number))]);
  }
  finAoa.push([]);
  finAoa.push(['Scorecard']);
  finAoa.push(['Grade', '', ...data.map(d => d.grade)]);
  finAoa.push(['Score', '', ...data.map(d => (d.insufficientData ? null : d.score))]);
  finAoa.push(['Consolidated', '', ...data.map(d => (d.isConsolidated === false ? 'Standalone' : 'Yes'))]);
  const finWs = XLSX.utils.aoa_to_sheet(finAoa);
  finWs['!cols'] = autoCols(finAoa);
  XLSX.utils.book_append_sheet(wb, finWs, 'Financials');

  // ── Sheet 2: Ratios ───────────────────────────────────────────────────────
  const ratioKeys = Array.from(new Set(data.flatMap(d => Object.keys(d.ratios || {}))));
  if (ratioKeys.length) {
    const rAoa: any[][] = [['Ratio', ...years]];
    ratioKeys.forEach(k => rAoa.push([k, ...data.map(d => num((d.ratios as any)?.[k]))]));
    const rWs = XLSX.utils.aoa_to_sheet(rAoa);
    rWs['!cols'] = autoCols(rAoa);
    XLSX.utils.book_append_sheet(wb, rWs, 'Ratios');
  }

  // ── Sheet 3: Related Party ──────────────────────────────────────────────────
  const rpRows = data.flatMap(d =>
    (d.relatedPartyDetails || []).map(r => ({
      FY: d.year, Party: r.party, Relationship: r.relationship || '', Nature: r.nature || '',
      'Amount (₹ Cr)': num(r.amount),
    })));
  if (rpRows.length) {
    const ws = XLSX.utils.json_to_sheet(rpRows);
    ws['!cols'] = autoCols([Object.keys(rpRows[0]), ...rpRows.map(r => Object.values(r))]);
    XLSX.utils.book_append_sheet(wb, ws, 'Related Party');
  }

  // ── Sheet 4: Contingent Liabilities ────────────────────────────────────────
  const clRows = data.flatMap(d =>
    (d.contingentLiabilityDetails || []).map(c => ({
      FY: d.year, Category: c.category, 'Amount (₹ Cr)': num(c.amount),
    })));
  if (clRows.length) {
    const ws = XLSX.utils.json_to_sheet(clRows);
    ws['!cols'] = autoCols([Object.keys(clRows[0]), ...clRows.map(r => Object.values(r))]);
    XLSX.utils.book_append_sheet(wb, ws, 'Contingent Liab');
  }

  // ── Sheet 5: Narrative (Business Overview & MD&A) ──────────────────────────
  const NARR_ROWS: [string, keyof ScoredData][] = [
    ['Business Overview', 'businessOverview'],
    ['MD&A Highlights', 'mdaHighlights'],
    ['Management Outlook', 'mgmtOutlook'],
    ['Key Risks', 'keyRisks'],
    ['Opportunities', 'opportunities'],
    ['Key Audit Matters', 'kams'],
    ['Accounting Policy Changes', 'accountingPolicyChanges'],
  ];
  const narrAoa: any[][] = [['Item', ...years]];
  for (const [label, key] of NARR_ROWS) {
    if (!data.some(d => (d as any)[key])) continue;
    narrAoa.push([label, ...data.map(d => ((d as any)[key] as string) || '')]);
  }
  if (narrAoa.length > 1) {
    const ws = XLSX.utils.aoa_to_sheet(narrAoa);
    ws['!cols'] = [{ wch: 26 }, ...years.map(() => ({ wch: 70 }))];
    XLSX.utils.book_append_sheet(wb, ws, 'Narrative');
  }

  // ── Sheet 6: Citations ──────────────────────────────────────────────────────
  const cRows = data.flatMap(d =>
    (d.citations || []).map(c => ({ FY: d.year, Field: c.field, Page: num(c.page), Quote: c.quote || '' })));
  if (cRows.length) {
    const ws = XLSX.utils.json_to_sheet(cRows);
    ws['!cols'] = autoCols([Object.keys(cRows[0]), ...cRows.map(r => Object.values(r))]);
    XLSX.utils.book_append_sheet(wb, ws, 'Citations');
  }

  // ── Sheet 7: Flags & Trends ─────────────────────────────────────────────────
  const fRows: any[] = [];
  data.forEach(d => {
    (d.flags || []).forEach(f => fRows.push({ FY: d.year, Type: 'Flag', Note: f }));
    (d.trendFlags || []).forEach(f => fRows.push({ FY: d.year, Type: 'Trend', Note: f }));
  });
  if (fRows.length) {
    const ws = XLSX.utils.json_to_sheet(fRows);
    ws['!cols'] = autoCols([Object.keys(fRows[0]), ...fRows.map(r => Object.values(r))]);
    XLSX.utils.book_append_sheet(wb, ws, 'Flags');
  }

  // ── Sheet 8: Notes ──────────────────────────────────────────────────────────
  const notes = XLSX.utils.aoa_to_sheet([
    ['Disclaimer'],
    ['Figures were extracted from annual report PDFs by an AI model and may contain errors.'],
    ['Monetary values are in ₹ Crores unless the Unit column says otherwise.'],
    ['This is not investment advice. Verify all numbers against the source filing.'],
  ]);
  notes['!cols'] = [{ wch: 90 }];
  XLSX.utils.book_append_sheet(wb, notes, 'Notes');

  const safeName = (latest.companyName || 'company').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
  XLSX.writeFile(wb, `${safeName}_Equity_Data_${years.join('-')}.xlsx`);
}
