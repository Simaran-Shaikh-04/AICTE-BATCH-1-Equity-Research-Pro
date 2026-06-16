import { FinancialData, Sector } from './types';

export interface ScoredData extends FinancialData {
  score: number;
  grade: string;
  gradeColor: string;
  ratios: Record<string, number | null>;
  flags: string[];
  /** YoY / multi-year observations (require prevData). Empty on the first year. */
  trendFlags: string[];
  /** True when too few core fields were extracted to score meaningfully. */
  insufficientData: boolean;
}

function grade(score: number): { grade: string; color: string } {
  if (score >= 85) return { grade: 'A+', color: '#00d084' };
  if (score >= 75) return { grade: 'A',  color: '#10b981' };
  if (score >= 65) return { grade: 'B+', color: '#3b82f6' };
  if (score >= 55) return { grade: 'B',  color: '#6366f1' };
  if (score >= 45) return { grade: 'C',  color: '#f59e0b' };
  if (score >= 35) return { grade: 'D',  color: '#f97316' };
  return              { grade: 'F',  color: '#ef4444' };
}

const HIGH_LEVERAGE_NETDEBT_SECTORS: Sector[] = ['Infrastructure', 'Energy', 'Power', 'Real Estate', 'Ports'];

/**
 * Every field carried in ₹ Crores. These all share a single reporting unit within
 * a given year's statements, so a unit-extraction error scales ALL of them by the
 * same factor. Percentages, per-share figures and raw counts are deliberately
 * excluded — they are not affected by the crore/lakh/million unit.
 */
const MONETARY_FIELDS: (keyof FinancialData)[] = [
  'revenue', 'ebitda', 'pat', 'totalDebt', 'netWorth', 'cashEquivalents', 'operatingCashFlow',
  'grossProfit', 'totalAssets', 'tradeReceivables', 'inventories', 'capex', 'depreciation',
  'dividendPaid', 'goodwill', 'deferredTaxAssets', 'exceptionalItems', 'contingentLiabilities',
  'relatedPartyTransactions', 'auditorFees', 'interestIncome', 'interestExpense',
  'netInterestIncome', 'advances', 'deposits', 'aum', 'rdExpense', 'specialtyRevenue',
  'netDebt', 'orderBook', 'tollRevenue', 'cwipActive', 'orderInflow',
  'grossWrittenPremium', 'embeddedValue', 'netEarnedPremium', 'underwritingResult',
  'newBusinessPremium', 'ape', 'vnb', 'presales', 'collections',
];

/** Best available size anchor for comparing magnitudes across years. */
function magnitudeAnchor(d: FinancialData): number | null {
  const candidates = [d.revenue, d.totalAssets, d.netWorth, d.advances, d.deposits, d.aum];
  for (const c of candidates) if (c != null && c > 0) return c;
  return null;
}

/**
 * Cross-year unit normaliser.
 *
 * Each annual report is extracted independently, so the model occasionally misreads
 * the unit header on one year's PDF and emits figures that are a clean power of ten
 * (×10 / ×100 / ×1000) smaller than the others. Because the error scales the entire
 * statement uniformly, within-year ratios look fine and per-year checks miss it.
 *
 * Strategy: take the largest-magnitude year as the reference (unit misreads in this
 * pipeline overwhelmingly UNDER-state, by dividing too aggressively). Any year whose
 * anchor is smaller by a factor within ±12% of a clean power of ten is scaled UP by
 * that factor across all monetary fields, and a verification note is returned for it.
 * Years that are merely smaller (genuine growth/decline within an order of magnitude)
 * are left untouched. This is a heuristic — every correction is surfaced as a flag so
 * a human verifies against the source filing.
 */
export function normalizeUnitsAcrossYears(
  rows: FinancialData[],
): { data: FinancialData[]; notes: Record<number, string> } {
  const notes: Record<number, string> = {};
  if (!rows || rows.length < 2) return { data: rows || [], notes };

  const anchors = rows.map(magnitudeAnchor);
  const valid = anchors.filter((a): a is number => a != null && a > 0);
  if (valid.length < 2) return { data: rows, notes };

  const maxAnchor = Math.max(...valid);

  const data = rows.map((d, i) => {
    const a = anchors[i];
    if (a == null || a <= 0) return d;

    const ratio = maxAnchor / a;          // ≥ 1
    if (ratio < 5) return d;              // within one order of magnitude → leave alone

    const pow = Math.round(Math.log10(ratio));
    if (pow < 1) return d;
    const factor = Math.pow(10, pow);     // 10, 100, 1000 …

    // Only correct when the gap is genuinely close to a clean power of ten.
    if (Math.abs(ratio - factor) / factor > 0.12) return d;

    const corrected: FinancialData = { ...d };
    for (const f of MONETARY_FIELDS) {
      const v = corrected[f];
      if (typeof v === 'number') (corrected as any)[f] = v * factor;
    }
    notes[d.year] =
      `FY${d.year} figures were ~${factor}× smaller than other years and have been auto-scaled ×${factor} ` +
      `(suspected unit-extraction error). Verify against the source PDF before relying on them.`;
    return corrected;
  });

  return { data, notes };
}

/**
 * Score a full multi-year set. Prefer this over calling scoreCompany() per year:
 * it first reconciles cross-year unit errors, then scores oldest→newest so each
 * year sees the correct prior-year context. Any auto-scaling is prepended to that
 * year's flags. Drop-in replacement for `rows.map(d => scoreCompany(d, prev))`.
 */
export function scoreAll(rows: FinancialData[]): ScoredData[] {
  if (!rows || rows.length === 0) return [];
  const { data, notes } = normalizeUnitsAcrossYears(rows);
  const sorted = [...data].sort((x, y) => x.year - y.year);
  return sorted.map((d, i) => {
    const scored = scoreCompany(d, i > 0 ? sorted[i - 1] : null);
    const note = notes[d.year];
    if (note) scored.flags = [note, ...scored.flags];
    return scored;
  });
}

/** An "Unmodified" / "Unqualified" opinion IS a clean opinion. Treat all three as clean. */
function isCleanOpinion(op?: string | null): boolean {
  if (!op) return true; // no opinion extracted → don't penalise
  return /^(clean|un[\s-]?modified|un[\s-]?qualified)\b/i.test(op.trim());
}

export function scoreCompany(data: FinancialData, prevData?: FinancialData | null): ScoredData {
  let score = 50;
  const flags: string[] = [];
  const trendFlags: string[] = [];
  const ratios: Record<string, number | null> = {};

  const sector    = data.sector;
  const isFinancial = sector === 'Banking' || sector === 'NBFC' || sector === 'Insurance';

  const revenue   = data.revenue  ?? null;
  // FIX 4 — EBITDA is not a meaningful metric for banks/NBFCs. Even if a phantom 0
  // slipped through extraction, force it to null here so it can't generate a
  // spurious "Low EBITDA margin (<8%)" flag or a 0% margin in the ratios table.
  const ebitda    = isFinancial ? null : (data.ebitda ?? null);
  const pat       = data.pat      ?? null;
  const netWorth  = data.netWorth ?? null;
  const totalDebt = data.totalDebt ?? null;
  const ocf       = data.operatingCashFlow ?? null;
  const cash      = data.cashEquivalents ?? null;

  // ── Per-year degenerate-ratio check ──────────────────────────────────────
  // NOTE: this only catches cases where PAT and Revenue were scaled by DIFFERENT
  // factors. A whole-statement 10× unit error scales numerator and denominator
  // equally, leaving this ratio unchanged — those are caught by the cross-year
  // normaliser (see normalizeUnitsAcrossYears / scoreAll below), not here.
  if (revenue != null && pat != null && revenue > 0 && Math.abs(pat) > 0 && Math.abs(pat / revenue) < 0.0001) {
    flags.push('⚠️ Unit conversion error suspected: monetary values may be inconsistent. Re-upload this report.');
  }

  // ── FIX 2 — NPA absolute-value guard ─────────────────────────────────────
  // grossNPA and netNPA must be percentage values (e.g. 2.87 = 2.87%).
  // If an absolute ₹ Crore figure slipped through the server guard (value > 50),
  // attempt to correct it here using advances; otherwise null it out.
  if (isFinancial) {
    for (const npaField of ['grossNPA', 'netNPA'] as const) {
      const raw = data[npaField];
      if (raw != null && raw > 50) {
        const adv = data.advances ?? null;
        if (adv && adv > 0) {
          const corrected = parseFloat(((raw / adv) * 100).toFixed(4));
          (data as any)[npaField] = corrected;
          flags.push(`ℹ️ ${npaField} auto-corrected from absolute ₹ value to ${corrected.toFixed(2)}%`);
        } else {
          (data as any)[npaField] = null;
          flags.push(`⚠️ ${npaField} (${raw}) looks like ₹ Crores not %; nulled — re-upload report`);
        }
      }
    }
  }

  // ── Insufficient-data guard ───────────────────────────────────────────────
  const coreFields = [revenue, pat, netWorth, totalDebt, isFinancial ? null : ebitda];
  const coreCount = coreFields.filter(v => v != null).length;
  const insufficientData = coreCount < 3;

  // ── Core ratios ───────────────────────────────────────────────────────────
  const ebitdaMargin = revenue && revenue > 0 && ebitda != null ? (ebitda / revenue) * 100 : null;
  const patMargin    = revenue && revenue > 0 && pat != null    ? (pat / revenue) * 100    : null;
  const debtToEquity = netWorth && netWorth > 0 && totalDebt != null ? totalDebt / netWorth : null;

  // ROE on average equity when prior year is available
  const prevNetWorth = prevData?.netWorth ?? null;
  const avgEquity = (netWorth != null && prevNetWorth != null) ? (netWorth + prevNetWorth) / 2 : netWorth;
  const roe = avgEquity && avgEquity > 0 && pat != null ? (pat / avgEquity) * 100 : null;

  ratios['EBITDA Margin %']       = ebitdaMargin;
  ratios['Net Profit Margin (%)'] = patMargin;
  if (!isFinancial) ratios['Debt/Equity'] = debtToEquity;
  ratios['ROE %'] = roe;

  // Free cash flow (OCF − capex)
  const capex = data.capex ?? null;
  const fcf = (ocf != null && capex != null) ? ocf - capex : null;
  if (fcf != null) ratios['Free Cash Flow (Cr)'] = fcf;

  // Net debt / EBITDA (skip for banks/NBFCs)
  const netDebt = data.netDebt ?? ((totalDebt != null && cash != null) ? totalDebt - cash : null);
  const ndEbitda = (!isFinancial && netDebt != null && ebitda && ebitda > 0) ? netDebt / ebitda : null;
  if (ndEbitda != null) ratios['Net Debt/EBITDA'] = ndEbitda;

  // ── EBITDA margin scoring (sector-adjusted) ───────────────────────────────
  if (ebitdaMargin != null) {
    const hiThresh  = ['IT', 'Pharma'].includes(sector) ? 20 : ['Metal'].includes(sector) ? 18 : 25;
    const midThresh = ['IT', 'Pharma'].includes(sector) ? 12 : ['Metal'].includes(sector) ? 10 : 15;
    if      (ebitdaMargin > hiThresh)  score += 10;
    else if (ebitdaMargin > midThresh) score += 6;
    else if (ebitdaMargin > 8)         score += 2;
    else { score -= 5; flags.push('Low EBITDA margin (<8%)'); }
  }

  // ── PAT margin scoring ────────────────────────────────────────────────────
  // For insurers, PAT ÷ gross premium is structurally ~2-3% (most premium becomes
  // policyholder liability, not profit), so the thin-margin band and the high-margin
  // bonuses are meaningless — insurers are judged on combined ratio / VNB / solvency
  // instead. The loss-making check still applies to everyone.
  if (patMargin != null) {
    if (patMargin < 0) { score -= 15; flags.push('Negative PAT — loss-making'); }
    else if (sector !== 'Insurance') {
      if      (patMargin > 15) score += 8;
      else if (patMargin > 8)  score += 4;
      else if (patMargin < 3)  { score -= 5;  flags.push('Very thin PAT margin (<3%)'); }
    }
  }

  // ── Debt/Equity scoring — NOT for banks/NBFCs ────────────────────────────
  if (!isFinancial && debtToEquity != null) {
    const debtThreshold = ['Infrastructure', 'Power'].includes(sector) ? 5 : 1.5;
    if      (debtToEquity < 0.3)                 score += 8;
    else if (debtToEquity < debtThreshold)       score += 3;
    else if (debtToEquity > debtThreshold * 2)   { score -= 10; flags.push(`High leverage (D/E: ${debtToEquity.toFixed(2)})`); }
    else                                         { score -= 4;  flags.push(`Elevated leverage (D/E: ${debtToEquity.toFixed(2)})`); }
  }

  // ── Net Debt/EBITDA scoring (non-financials) ──────────────────────────────
  if (ndEbitda != null) {
    const ndThreshold = HIGH_LEVERAGE_NETDEBT_SECTORS.includes(sector) ? 6 : 3;
    if (ndEbitda > ndThreshold) { score -= 8; flags.push(`High Net Debt/EBITDA: ${ndEbitda.toFixed(2)}x`); }
    else if (ndEbitda < 1)        score += 4;
  }

  // ── ROE scoring ───────────────────────────────────────────────────────────
  if (roe != null) {
    if      (roe > 20) score += 8;
    else if (roe > 12) score += 4;
    else if (roe < 5)  { score -= 5; flags.push('Poor ROE (<5%)'); }
  }

  // ── ROCE (Return on Capital Employed) ─────────────────────────────────────
  // EBIT / Capital Employed, where EBIT ≈ EBITDA − Depreciation and
  // Capital Employed ≈ Net Worth + Total Debt. Not meaningful for banks/NBFCs/insurers.
  if (!isFinancial) {
    const dep = data.depreciation ?? null;
    const ebit = (ebitda != null && dep != null) ? ebitda - dep : null;
    const capitalEmployed = (netWorth != null && totalDebt != null) ? netWorth + totalDebt : netWorth;
    if (ebit != null && capitalEmployed && capitalEmployed > 0) {
      const roce = (ebit / capitalEmployed) * 100;
      ratios['ROCE %'] = roce;
      if      (roce > 20) score += 4;
      else if (roce < 8)  { score -= 3; flags.push(`Low ROCE (${roce.toFixed(0)}%)`); }
    }
  }

  // ── Exceptional-item normalisation ────────────────────────────────────────
  // A large one-off (e.g. ITC FY25's ₹15,128 Cr Hotels-demerger gain) inflates PAT,
  // EPS and margins and distorts the grade. When the exceptional item is material
  // (>20% of PAT), surface a normalised PAT and margin alongside the reported ones so
  // the headline isn't read at face value. Reported ratios are left intact.
  const exc = data.exceptionalItems ?? null;
  if (exc != null && pat != null && pat !== 0 && Math.abs(exc) > 0.20 * Math.abs(pat)) {
    const normalizedPat = pat - exc;
    ratios['Normalized PAT (Cr)'] = normalizedPat;
    if (revenue && revenue > 0) ratios['Normalized PAT Margin %'] = (normalizedPat / revenue) * 100;
    flags.push(`Reported PAT includes a ₹${Math.abs(exc).toLocaleString('en-IN')} Cr exceptional ${exc > 0 ? 'gain' : 'charge'}; normalised PAT ≈ ₹${normalizedPat.toLocaleString('en-IN')} Cr`);
  }

  // ── EPS sanity check ──────────────────────────────────────────────────────
  // pat (₹ Cr) and share count (absolute) are unit-invariant: implied EPS = pat / shares
  // (both in crore terms cancel). A >50% gap usually means a wrong share-count base
  // (e.g. HDFC Bank's post-merger weighted-average vs year-end shares produced ~2× EPS)
  // or a face-value mismatch. Flag for verification rather than auto-correcting.
  if (data.eps != null && pat != null && pat > 0 && data.numberOfEquityShares && data.numberOfEquityShares > 0) {
    const impliedEps = (pat * 1e7) / data.numberOfEquityShares;   // ₹ per share
    if (impliedEps > 0 && Math.abs(data.eps - impliedEps) / impliedEps > 0.5) {
      flags.push(`Reported EPS (₹${data.eps.toFixed(2)}) diverges >50% from PAT÷shares (₹${impliedEps.toFixed(2)}) — verify share count / face value`);
    }
  }

  // ── Cash conversion ───────────────────────────────────────────────────────
  if (ocf != null && pat != null && pat > 0 && ocf > 0) {
    const cfConversion = ocf / pat;
    ratios['CFO/PAT'] = cfConversion;
    if      (cfConversion > 1.2) score += 6;
    else if (cfConversion < 0.5) { score -= 8; flags.push('Weak cash conversion (OCF << PAT)'); }
  } else if (ocf != null && ocf < 0) {
    score -= 10;
    flags.push('Negative operating cash flow');
  } else if (pat != null && pat < 0 && ocf != null && ocf > 0) {
    trendFlags.push('Cash-generative despite an accounting loss — possible turnaround');
  }

  // ── Forensic penalties ────────────────────────────────────────────────────
  const pledge = data.promoterPledgePercent ?? null;
  if (pledge != null) {
    if      (pledge > 50) { score -= 12; flags.push(`High promoter pledge: ${pledge.toFixed(1)}%`); }
    else if (pledge > 25) { score -= 6;  flags.push(`Elevated promoter pledge: ${pledge.toFixed(1)}%`); }
  }
  if (data.hasGoingConcern) { score -= 20; flags.push('⚠️ Going concern risk raised by auditors'); }
  if (data.auditorOpinion && !isCleanOpinion(data.auditorOpinion)) { score -= 15; flags.push(`Audit opinion: ${data.auditorOpinion}`); }
  if (data.auditorChangedThisYear) { score -= 4; flags.push('Auditor changed this year — governance watch'); }

  const cl = data.contingentLiabilities ?? null;
  if (cl != null && revenue && revenue > 0) {
    const clRatio = cl / revenue;
    ratios['Contingent Liab/Rev'] = clRatio;
    // FIX — For banks/NBFCs, contingent liabilities are dominated by derivative
    // notionals, LCs and guarantees that are structurally many multiples of revenue
    // and are NOT a forensic red flag. Revenue is the wrong denominator here, so we
    // record the ratio for reference but do not penalise or flag financials on it.
    if (!isFinancial && clRatio > 0.5) {
      score -= 8;
      flags.push(`High contingent liabilities (${(clRatio * 100).toFixed(0)}% of revenue)`);
    }
  }

  const rpt = data.relatedPartyTransactions ?? null;
  if (rpt != null && revenue && revenue > 0 && rpt / revenue > 0.15 && !isFinancial) {
    flags.push(`High related-party transactions (${((rpt / revenue) * 100).toFixed(0)}% of revenue)`);
  }

  // ── Working capital ───────────────────────────────────────────────────────
  const receivables = data.tradeReceivables ?? null;
  if (receivables != null && revenue && revenue > 0) {
    const dso = (receivables / revenue) * 365;
    ratios['DSO (days)'] = dso;
  }
  const inventories = data.inventories ?? null;
  const grossProfit = data.grossProfit ?? null;
  // Inventory Days = Inventory / COGS × 365. COGS ≈ Revenue − Gross Profit.
  // (The earlier formula divided by Gross Profit itself, which is not a cost base and
  //  produced wildly inconsistent results vs Screener — e.g. ITC 57/190/71 days.)
  if (inventories != null && revenue && revenue > 0 && grossProfit != null && grossProfit < revenue) {
    const cogs = revenue - grossProfit;
    if (cogs > 0) ratios['Inventory Days'] = (inventories / cogs) * 365;
  }

  // ── Sector-specific scoring ───────────────────────────────────────────────
  if (isFinancial) {
    // FIX 2 — use the already-corrected data[grossNPA] value (corrected above if needed)
    const gnpa = data.grossNPA ?? null;
    const car  = data.capitalAdequacyRatio ?? null;
    const nim  = data.netInterestMargin ?? null;
    if (gnpa != null) {
      ratios['Gross NPA %'] = gnpa;
      if      (gnpa > 8) { score -= 12; flags.push(`High GNPA: ${gnpa.toFixed(2)}%`); }
      else if (gnpa > 4) { score -= 5;  flags.push(`Elevated GNPA: ${gnpa.toFixed(2)}%`); }
      else if (gnpa < 2)   score += 6;
    }
    if (car != null) {
      ratios['CAR %'] = car;
      if      (car > 18) score += 6;
      else if (car < 12) { score -= 10; flags.push('CAR below comfortable level'); }
    }
    if (nim != null) {
      ratios['NIM %'] = nim;
      if      (nim > 4)   score += 6;
      else if (nim < 2.5) { score -= 5; flags.push('Thin NIM (<2.5%)'); }
    }
  }

  if (sector === 'NBFC') {
    const aum  = data.aum ?? null;
    const roaa = data.roaa ?? null;
    const cof  = data.costOfFunds ?? null;
    if (aum != null) ratios['AUM (Cr)'] = aum;
    if (cof != null) ratios['Cost of Funds %'] = cof;
    if (roaa != null) {
      ratios['ROAA %'] = roaa;
      if      (roaa > 3)   score += 6;
      else if (roaa < 1.5) { score -= 4; flags.push('Low ROAA (<1.5%)'); }
    }
  }

  if (sector === 'IT') {
    const attrition = data.attritionRate ?? null;
    if (attrition != null) {
      ratios['Attrition %'] = attrition;
      if      (attrition > 25) { score -= 8; flags.push(`Very high attrition: ${attrition}%`); }
      else if (attrition > 18) { score -= 4; flags.push(`Elevated attrition: ${attrition}%`); }
    }
    const heads = data.employeeCount ?? null;
    if (heads && heads > 0 && revenue) ratios['Revenue/Employee (Cr)'] = revenue / heads;
  }

  if (sector === 'Pharma') {
    const rd = data.rdExpense ?? null;
    if (rd != null && revenue && revenue > 0) {
      const rdRatio = (rd / revenue) * 100;
      ratios['R&D/Revenue %'] = rdRatio;
      if (rdRatio > 8) score += 5;
      else if (rdRatio < 3) { score -= 3; flags.push('Low R&D spend (<3% of revenue)'); }
    }
    const fda = data.fdaWarningLetters ?? null;
    if (fda != null && fda > 0) { score -= 6; flags.push(`Active US FDA warning letters: ${fda}`); }
    const spec = data.specialtyRevenue ?? null;
    if (spec != null && revenue && revenue > 0) ratios['Specialty/Revenue %'] = (spec / revenue) * 100;
  }

  if (sector === 'Metal') {
    const cu = data.capacityUtilization ?? null;
    if (cu != null) {
      ratios['Capacity Utilization %'] = cu;
      if      (cu > 85) score += 5;
      else if (cu < 60) { score -= 5; flags.push(`Low capacity utilisation: ${cu}%`); }
    }
  }

  if (sector === 'Auto') {
    const om = data.operatingMargin ?? null;
    if (om != null) {
      ratios['Operating Margin %'] = om;
      if      (om > 12) score += 5;
      else if (om < 8)  { score -= 3; flags.push(`Below-band operating margin (${om.toFixed(1)}%)`); }
    }
    const vol = data.totalVolumesSold ?? null;
    if (vol && vol > 0 && ebitda != null) {
      ratios['EBITDA per unit (₹)'] = (ebitda * 1e7) / vol;
    }
  }

  if (sector === 'Infrastructure') {
    const ob = data.orderBook ?? null;
    if (ob != null && revenue && revenue > 0) {
      const obToRev = ob / revenue;
      ratios['Order Book/Revenue (x)'] = obToRev;
      if (obToRev > 5) flags.push(`Very large order book (${obToRev.toFixed(1)}x revenue) — execution stretch`);
    }
    const cwip = data.cwipActive ?? null;
    const ta = data.totalAssets ?? null;
    if (cwip != null && ta && ta > 0) {
      const cwipRatio = cwip / ta;
      ratios['CWIP/Total Assets %'] = cwipRatio * 100;
      if (cwipRatio > 0.5) { score -= 6; flags.push(`High CWIP (${(cwipRatio * 100).toFixed(0)}% of assets) — execution risk`); }
    }
    const ic = (ebitda && data.interestExpense) ? ebitda / data.interestExpense : null;
    if (ic != null) {
      ratios['Interest Coverage (x)'] = ic;
      if (ic < 1.5) { score -= 6; flags.push(`Weak interest coverage (${ic.toFixed(2)}x)`); }
    }
  }

  // ── Insurance (dual-mode: general + life) ────────────────────────────────
  if (sector === 'Insurance') {
    // General insurer signals
    const cr  = data.combinedRatio ?? null;
    const clr = data.claimsRatio ?? null;
    const sol = data.solvencyRatio ?? null;
    if (cr != null) {
      ratios['Combined Ratio %'] = cr;
      if      (cr < 100) { score += 8; flags.push(`Underwriting profit (CR ${cr.toFixed(1)}%)`); }
      else if (cr <= 105)  score += 3;
      else if (cr > 110) { score -= 8; flags.push(`Weak underwriting (CR ${cr.toFixed(1)}%)`); }
    }
    if (clr != null) ratios['Loss/Claims Ratio %'] = clr;
    if (data.underwritingResult != null) ratios['Underwriting Result (Cr)'] = data.underwritingResult;

    // Life insurer signals
    const vnbM = data.vnbMargin ?? null;
    if (vnbM != null) {
      ratios['VNB Margin %'] = vnbM;
      if      (vnbM > 27) score += 6;
      else if (vnbM < 18) { score -= 3; flags.push(`Thin VNB margin (${vnbM.toFixed(1)}%)`); }
    }
    const p13 = data.persistency13m ?? null;
    if (p13 != null) {
      ratios['13M Persistency %'] = p13;
      if      (p13 > 87) score += 4;
      else if (p13 < 78) { score -= 4; flags.push(`Weak 13M persistency (${p13.toFixed(0)}%)`); }
    }
    if (data.persistency61m != null) ratios['61M Persistency %'] = data.persistency61m;
    if (data.vnb != null) ratios['VNB (Cr)'] = data.vnb;
    if (data.embeddedValue != null) ratios['Embedded Value (Cr)'] = data.embeddedValue;

    // Solvency applies to both; thresholds differ by reporting scale (x vs %)
    if (sol != null) {
      ratios['Solvency Ratio'] = sol;
      const min    = sol > 10 ? 150 : 1.5;   // % scale vs multiple scale
      const strong = sol > 10 ? 200 : 2.0;
      if      (sol >= strong) score += 4;
      else if (sol < min)   { score -= 10; flags.push('Solvency below regulatory minimum'); }
    }
  }

  // ── Power / Utilities ─────────────────────────────────────────────────────
  if (sector === 'Power') {
    const plf = data.capacityUtilization ?? null;   // PLF stored here per extraction rule
    if (plf != null) {
      ratios['Plant Load Factor %'] = plf;
      if      (plf > 80) score += 6;
      else if (plf < 65) { score -= 5; flags.push(`Low PLF (${plf.toFixed(1)}%)`); }
    }
    const paf = data.plantAvailabilityFactor ?? null;
    if (paf != null) {
      ratios['Plant Availability %'] = paf;
      if (paf < 80) { score -= 3; flags.push(`Low availability (${paf.toFixed(0)}%) — capacity-charge risk`); }
    }
    if (data.regulatedRoE != null) ratios['Regulated RoE %'] = data.regulatedRoE;
    // Receivable days vs DISCOMs — use field if given, else derive
    let recDays = data.receivableDays ?? null;
    if (recDays == null && data.tradeReceivables != null && revenue && revenue > 0) {
      recDays = (data.tradeReceivables / revenue) * 365;
    }
    if (recDays != null) {
      ratios['Receivable Days (DISCOM)'] = recDays;
      if (recDays > 90) { score -= 5; flags.push(`Stretched DISCOM receivables (${recDays.toFixed(0)} days)`); }
    }
  }

  // ── Real Estate / Developers ──────────────────────────────────────────────
  if (sector === 'Real Estate') {
    const presales = data.presales ?? null;
    if (presales != null) ratios['Pre-sales (Cr)'] = presales;
    const collections = data.collections ?? null;
    if (collections != null && presales && presales > 0) {
      const conv = (collections / presales) * 100;
      ratios['Collections/Pre-sales %'] = conv;
      if (conv < 70) { score -= 3; flags.push(`Weak cash conversion (collections ${conv.toFixed(0)}% of pre-sales)`); }
    }
    const nd = data.netDebt ?? null;
    if (nd != null && netWorth && netWorth > 0) {
      const ndte = nd / netWorth;
      ratios['Net Debt/Equity (x)'] = ndte;
      if      (ndte < 0.3) score += 6;
      else if (ndte > 1.0) { score -= 6; flags.push(`Elevated net leverage (${ndte.toFixed(2)}x net debt/equity)`); }
    }
    const em = data.embeddedEbitdaMargin ?? null;
    if (em != null) {
      ratios['Embedded EBITDA Margin %'] = em;
      if (em < 20) { score -= 2; flags.push(`Thin embedded margin (${em.toFixed(0)}%)`); }
    }
  }

  // ── Ports / Logistics Infra ───────────────────────────────────────────────
  if (sector === 'Ports') {
    const util = data.capacityUtilization ?? null;   // utilisation stored here
    if (util != null) {
      ratios['Capacity Utilisation %'] = util;
      if      (util > 75) score += 6;
      else if (util < 55) { score -= 4; flags.push(`Low capacity utilisation (${util.toFixed(0)}%)`); }
    }
    if (ebitdaMargin != null) {   // ports are structurally high-margin
      if      (ebitdaMargin > 55) score += 5;
      else if (ebitdaMargin < 45) { score -= 3; flags.push(`Sub-par port EBITDA margin (${ebitdaMargin.toFixed(0)}%)`); }
    }
    const nd = data.netDebt ?? null;
    if (nd != null && ebitda && ebitda > 0) {
      const nde = nd / ebitda;
      ratios['Net Debt/EBITDA (x)'] = nde;
      if      (nde < 1.5) score += 4;
      else if (nde > 3.5) { score -= 6; flags.push(`High leverage (${nde.toFixed(1)}x net debt/EBITDA)`); }
    }
    if (data.realisationPerTonne != null) ratios['Realisation/Tonne (₹)'] = data.realisationPerTonne;
  }

  // ── YoY trend analysis (requires prevData) ────────────────────────────────
  if (prevData) {
    const pRev = prevData.revenue ?? null;
    if (pRev && pRev > 0 && revenue != null) {
      ratios['Revenue Growth YoY %'] = ((revenue - pRev) / pRev) * 100;
    }

    const pDebt = prevData.totalDebt ?? null;
    // Only flag a debt jump when the debt is actually MATERIAL. A move from ₹1.76 Cr to
    // ₹91 Cr is +5,085% but operationally irrelevant (ITC: D/E ≈ 0.004x). Require the
    // current debt to exceed ₹500 Cr AND the resulting D/E to be non-trivial (≥0.05x).
    if (pDebt && pDebt > 0 && totalDebt != null && (totalDebt - pDebt) / pDebt > 0.30) {
      const materialAbs = totalDebt > 500;
      const materialLeverage = netWorth && netWorth > 0 ? (totalDebt / netWorth) >= 0.05 : true;
      if (materialAbs && materialLeverage) {
        trendFlags.push(`Rapid debt accumulation: +${(((totalDebt - pDebt) / pDebt) * 100).toFixed(0)}% YoY`);
      }
    }

    const pPledge = prevData.promoterPledgePercent ?? null;
    if (pPledge != null && pledge != null && pledge - pPledge > 5) {
      trendFlags.push(`Rising promoter pledge: +${(pledge - pPledge).toFixed(1)}pp YoY — possible distress`);
    }

    const pCl = prevData.contingentLiabilities ?? null;
    if (pCl && pCl > 0 && cl != null && (cl - pCl) / pCl > 0.30) {
      trendFlags.push(`Contingent liabilities up ${(((cl - pCl) / pCl) * 100).toFixed(0)}% YoY — off-balance-sheet risk`);
    }

    const pRec = prevData.tradeReceivables ?? null;
    if (pRec && pRec > 0 && receivables != null && pRev && pRev > 0 && revenue != null) {
      const recG = (receivables - pRec) / pRec;
      const revG = (revenue - pRev) / pRev;
      if (recG - revG > 0.15) {
        trendFlags.push('Receivables growing faster than revenue — collection / channel-stuffing risk');
      }
    }

    const pAum = prevData.aum ?? null;
    const aum = data.aum ?? null;
    if (pAum && pAum > 0 && aum != null) {
      const aumG = ((aum - pAum) / pAum) * 100;
      ratios['AUM Growth YoY %'] = aumG;
      if (aumG < 10) trendFlags.push(`Stagnant AUM growth (${aumG.toFixed(0)}% YoY) for an NBFC`);
    }

    if (isFinancial) {
      // FIX 2 — use corrected NPA values (already normalised above)
      const pGnpa = prevData.grossNPA ?? null;
      const pNim  = prevData.netInterestMargin ?? null;
      const gnpa  = data.grossNPA ?? null;
      const nim   = data.netInterestMargin ?? null;
      if (pGnpa != null && gnpa != null && gnpa > pGnpa && pNim != null && nim != null && nim < pNim) {
        trendFlags.push('Dual stress: rising NPAs AND margin compression');
      }
    }

    if (sector === 'Auto') {
      const pVol = prevData.totalVolumesSold ?? null;
      const vol = data.totalVolumesSold ?? null;
      if (pVol && pVol > 0 && vol != null && vol < pVol) {
        trendFlags.push('Vehicle volumes declined YoY — demand / share weakness');
      }
    }

    if (sector === 'Real Estate') {
      const pPre = prevData.presales ?? null;
      const pre = data.presales ?? null;
      if (pPre && pPre > 0 && pre != null) {
        const g = ((pre - pPre) / pPre) * 100;
        ratios['Pre-sales Growth YoY %'] = g;
        if (g < 0) trendFlags.push(`Pre-sales declined ${Math.abs(g).toFixed(0)}% YoY — demand softness`);
      }
    }

    if (sector === 'Ports') {
      const pVol = prevData.totalVolumesSold ?? null;
      const vol = data.totalVolumesSold ?? null;
      if (pVol && pVol > 0 && vol != null) {
        const g = ((vol - pVol) / pVol) * 100;
        ratios['Cargo Growth YoY %'] = g;
        if (g < 0) trendFlags.push(`Cargo volumes declined ${Math.abs(g).toFixed(0)}% YoY`);
      }
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const { grade: g, color } = grade(score);

  if (insufficientData) {
    flags.unshift('Insufficient data extracted — grade not reliable');
    return {
      ...data, score, grade: '—', gradeColor: '#6b7280',
      ratios, flags, trendFlags, insufficientData: true,
    };
  }

  return { ...data, score, grade: g, gradeColor: color, ratios, flags, trendFlags, insufficientData: false };
}