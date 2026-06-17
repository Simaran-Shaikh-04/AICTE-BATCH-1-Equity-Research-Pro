/**
 * Equity Research Pro — server (FINAL, all features)
 * Token fixes (thinking off, output cap, optional page-trim) + extraction of
 * citations, related-party detail, and contingent-liability detail.
 *
 * Optional deps for page-trimming:  npm install pdf-lib pdfjs-dist
 *
 * BUG FIXES applied (June 2026):
 *   FIX 1 — Unit conversion: Thousands /100000 → /10000 (1 Crore = 10,000 Thousands)
 *   FIX 2 — Banking NPA: grossNPA/netNPA prompt now explicitly demands % ratio, not ₹ Cr;
 *            server-side guard auto-corrects if absolute value sneaks through
 *   FIX 3 — Year mislabelling: financialData.year hard-stamped from request after parsing;
 *            extraction prompt reinforced with CRITICAL YEAR RULE
 *   FIX 4 — Bank EBITDA: hard-nulled for Banking/NBFC so a phantom 0 can't trigger
 *            a bogus "Low EBITDA margin" forensic flag downstream
 *   FIX 5 — Audit opinion: "Unmodified"/"Unqualified" normalised to "Clean" so a clean
 *            opinion is not mis-scored as adverse
 *   FIX 6 — Unit-scale auto-correction: RULE 2 rewritten to recognise the "'000s"
 *            notation and source the unit from the audited consolidated statements
 *            (not the "₹ in million" summary tables); plus a deterministic EPS×shares
 *            anchor that rescales all ₹ figures if a uniform power-of-ten error slipped through
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) console.warn("WARNING: GEMINI_API_KEY not set. Users must supply their own key via the UI.");

const ENABLE_PDF_TRIM = process.env.ENABLE_PDF_TRIM !== "0";
const TRIM_PAGE_THRESHOLD = 240;

const ai = new GoogleGenAI({
  apiKey: apiKey || "dummy_key",
  httpOptions: { headers: { "User-Agent": "equity-research-pro" } },
});

// ─── Per-sector extraction guidance ───────────────────────────────────────────
function getSectorGuidance(sector: string): string {
  switch (sector) {
    case "Banking":
      return `
BANKING SECTOR RULES:
- revenue: TOTAL INCOME (Interest + Other Income). Not "Revenue from Operations".
- ebitda: SET TO null.
- netInterestIncome: Interest Income MINUS Interest Expense.
- netInterestMargin: a PERCENTAGE value (e.g. 4.3 means 4.3%). From the NIM table in MD&A.
- grossNPA: GROSS NPA RATIO as a PERCENTAGE only (e.g. 2.87 means 2.87%). DO NOT store the absolute ₹ Crore Gross NPA balance here. Find the row labelled "Gross NPA %" or "GNPA Ratio" in the NPA/asset-quality table. If only the absolute ₹ Crore figure is available, compute: (Gross NPA ₹ Cr ÷ Gross Advances ₹ Cr) × 100 and store that result.
- netNPA: NET NPA RATIO as a PERCENTAGE only. Same rule as grossNPA above.
- capitalAdequacyRatio: a PERCENTAGE value (e.g. 17.2 means 17.2%).
- advances: Gross Advances in ₹ Crores (the absolute balance sheet figure).
- deposits: Total Deposits in ₹ Crores (the absolute balance sheet figure).
- totalDebt: Total Borrowings ONLY, EXCLUDING deposits.`;
    case "NBFC":
      return `
NBFC SECTOR RULES:
- revenue: Total Income (or NII + Fee Income).
- ebitda: SET TO null.
- aum: Assets Under Management — PRIMARY metric, from the MD&A AUM table (₹ Crores).
- grossNPA: GNPA RATIO as a PERCENTAGE (e.g. 3.1 means 3.1%). Do NOT store the absolute ₹ Cr balance.
- netNPA: Net NPA RATIO as a PERCENTAGE. Same rule as grossNPA.
- capitalAdequacyRatio / netInterestMargin / costOfFunds / roaa: all PERCENTAGES.
- totalDebt: Total Borrowings (NCDs + CPs + bank lines + ECBs + sub-debt + public FDs).`;
    case "IT":
      return `
IT SECTOR RULES (Infosys/Wipro/HCL = IFRS):
- revenue: Revenue from IT Services / Operations (exclude Other Income).
- ebitda: Operating Profit before Depreciation and Amortisation. This MUST be computed as Revenue minus Operating Expenses (excluding D&A and finance costs). If the report shows Operating Profit (EBIT) after Depreciation, you MUST add back Depreciation & Amortisation to arrive at EBITDA (e.g., EBITDA = EBIT + Depreciation). Do NOT report EBIT as EBITDA.
- employeeCount: year-end employee headcount (number of people employed), RAW INTEGER. DO NOT extract ESOP/options share counts (e.g., ~40L shares) as headcount. Look for "headcount" or "number of employees" in the MD&A or Board's Report.
- attritionRate: LTM voluntary attrition %.
- totalDebt: borrowings + IFRS-16 lease liabilities (note lease portion in kams).`;
    case "Pharma":
      return `
PHARMA SECTOR RULES:
- revenue: Revenue from Operations.
- ebitda: Operating Profit before Depreciation and Amortisation. This MUST be computed as Revenue from Operations minus Operating Expenses (excluding D&A and finance costs). If the report shows Operating Profit (EBIT) after Depreciation, you MUST add back Depreciation & Amortisation to arrive at EBITDA (e.g., EBITDA = EBIT + Depreciation). Do NOT report EBIT as EBITDA.
- rdExpense: REVENUE R&D (expensed only); if capitalised note in kams; null if not disclosed.
- specialtyRevenue: specialty/innovative revenue if disclosed (₹ Crores).
- fdaWarningLetters: count of ACTIVE US FDA warning letters (integer).
- goodwill: goodwill on consolidation (₹ Crores).`;
    case "FMCG":
      return `
FMCG SECTOR RULES:
- revenue: CONSOLIDATED Revenue from Operations (net of GST), not a single segment.
- grossProfit / tradeReceivables / inventories / capex / dividendPaid: ₹ Crores.`;
    case "Auto":
      return `
AUTO / OEM SECTOR RULES (Maruti Suzuki, M&M, Tata Motors, Bajaj Auto):
- revenue: the consolidated "Revenue from operations" line (already comprises vehicle/equipment sales + spares + services + exports). EXCLUDE Other Income and any finance-subsidiary income; do not re-sum product lines. Auto reports are often in "₹ in million" → divide by 10 per RULE 2.
- ebitda: Operating Profit (exclude Other Income).
- operatingMargin: Operating EBIT margin % AS THE COMPANY REPORTS IT (Maruti labels this "Operating EBIT Margin"). If only an EBITDA margin is shown, capture that and note which in citations. Percentage, e.g. 10.1.
- totalVolumesSold: RAW INTEGER units (domestic + exports), from the MD&A (e.g. 2234266, NOT 2.23).
- tradeReceivables / inventories / capex: ₹ Crores.`;
    case "Metal":
      return `
METAL & MINING SECTOR RULES (primary producers — steel, aluminium, zinc, copper):
- revenue: the consolidated "Revenue from operations" line (net of excise/GST). Do not re-sum segment notes.
- ebitda: as reported.
- capacityUtilization: % from MD&A.
- totalVolumesSold: production/sales tonnage (note unit, e.g. MT, in kams).
- inventories / capex: ₹ Crores.
NOTE: a non-metal industrial company (e.g. engines, capital goods) does not fit these rules — use the General sector for those.`;
    case "Infrastructure":
      return `
INFRASTRUCTURE / ENGINEERING & CONSTRUCTION (E&C) SECTOR RULES (L&T, KEC, IRB, roads, transmission, EPC, water, airports):
- revenue: the consolidated "Revenue from operations" line — already aggregates all infra segments (port/cargo handling, toll, EPC, annuity/HAM, transmission, O&M, project revenues). Do not re-sum segment notes. Large E&C reports often quote revenue in ₹ lakh crore → 1 lakh crore = 100,000 Cr.
- totalDebt: ALL borrowings incl. SPV + holdco + consolidated InvIT/SPV debt.
- orderBook: Order Book / Order Backlog at year-end (₹ Crores) — THE revenue-visibility metric, from the MD&A. Convert from lakh crore if needed.
- orderInflow: Order Inflow / Order Intake DURING the year (₹ Crores), from the MD&A. Distinct from order book.
- netDebt / cwipActive / tollRevenue: ₹ Crores (omit any not disclosed — e.g. ports may have no tollRevenue, an order book may not exist).
NOTE: book-to-bill (orderBook ÷ revenue) is computed downstream; you only need to extract orderBook and orderInflow accurately.`;
    case "Insurance":
      return `
INSURANCE SECTOR RULES (life & general insurers — the P&L is split into a Policyholders'/Revenue account and a Shareholders'/Profit & Loss account; there is NO "Revenue from operations" line). First decide LIFE vs GENERAL from the company name / disclosures, then apply the matching block. Populate ONLY the fields relevant to that type; leave the others null. Figures are often quoted in ₹ billion → 1 billion = 100 Cr; convert to ₹ Crores.
- ebitda: SET TO null for BOTH types (not meaningful for insurers). Never hallucinate it.
- pat: profit after tax from the Shareholders' account (both types).
- solvencyRatio: regulatory solvency as PRINTED. General insurers usually print a multiple (e.g. 2.67 = 2.67x); life insurers usually print a % (e.g. 194 = 194%). Keep the company's own scale and note which in citations. IRDAI minimum is 1.5x / 150%.
- totalDebt: subordinated/other debt only (insurers carry little conventional borrowing).

GENERAL (NON-LIFE) — e.g. ICICI Lombard, Star Health, New India:
- revenue: GROSS DIRECT PREMIUM INCOME (GDPI) / Gross Written Premium (GWP). Also store in grossWrittenPremium.
- netEarnedPremium: Net Earned Premium (after reinsurance & UPR movement), ₹ Crores.
- combinedRatio: Combined Ratio % = Loss Ratio + Expense Ratio. THE primary metric; <100 = underwriting profit. If both 'n' and '1/n' bases are given, store the headline '1/n' figure and note the 'n' figure in citations.
- claimsRatio: Loss/Incurred-claims ratio % (net incurred claims ÷ net earned premium).
- expenseRatio: Expense ratio % (commission + opex ÷ premium).
- underwritingResult: underwriting profit/(loss), ₹ Crores (negative if CR > 100%).

LIFE — e.g. HDFC Life, SBI Life, ICICI Prudential:
- revenue: TOTAL GROSS PREMIUM (first-year + renewal + single). Also store in grossWrittenPremium.
- newBusinessPremium: first-year + single premium (₹ Crores).
- ape: Annualised Premium Equivalent = regular premium + 10% of single premium (₹ Crores), from MD&A.
- vnb: Value of New Business (₹ Crores), from the EV results / MD&A.
- vnbMargin: VNB margin % = VNB ÷ APE (e.g. 25.6).
- embeddedValue: Indian Embedded Value (IEV), ₹ Crores.
- persistency13m / persistency61m: 13th- and 61st-month persistency % (by premium), from MD&A.
- opexRatio: operating-expense ratio % (opex ÷ gross premium).
NOTE: if the uploaded file is only a BRSR/ESG extract it will NOT contain the Revenue Account — most numeric fields will legitimately be null.`;
    case "CapitalGoods":
      return `
CAPITAL GOODS / INDUSTRIALS SECTOR RULES (L&T, Siemens, ABB, BEL, HAL, Cummins, Thermax, BHEL):
- revenue: consolidated "Revenue from operations" (project execution + product + services). Do not re-sum segments.
- ebitda: Operating Profit (exclude Other Income).
- orderBook: order book / order backlog / unexecuted order value at year-end (₹ Crores) — the KEY forward indicator, from the MD&A or investor section.
- tradeReceivables / inventories / capex: ₹ Crores (these businesses are working-capital intensive).`;
    case "Power":
      return `
POWER / UTILITIES SECTOR RULES (NTPC, Power Grid, Tata Power, JSW Energy, Adani Power):
- revenue: consolidated "Revenue from operations" (energy generation sales / transmission / distribution / regulated income).
- ebitda: as reported.
- capacityUtilization: Plant Load Factor (PLF) % from the MD&A — STORE PLF IN THIS FIELD (e.g. 77.44). Note installed/commercial capacity in MW in kams if useful.
- plantAvailabilityFactor: Declared Plant Availability Factor (PAF) % — drives regulated capacity charges; from MD&A. null if not disclosed.
- regulatedRoE: Regulated Return on Equity % — CERC norm is ~15.5% on regulated equity. From MD&A; null if not separately disclosed.
- receivableDays: debtor days vs DISCOMs (a key risk metric). If not stated, leave null — it is computed downstream from tradeReceivables and revenue when available.
- totalDebt / netDebt: ₹ Crores (utilities are capital-intensive and leveraged).
- capex / cwipActive / tradeReceivables: ₹ Crores (large under-construction capacity is normal).`;
    case "Chemicals":
      return `
CHEMICALS SECTOR RULES (specialty & commodity — Pidilite, SRF, Deepak Nitrite, Aarti, Navin Fluorine):
- revenue: consolidated "Revenue from operations" (net of GST).
- ebitda: as reported.
- grossProfit: revenue − raw-material/COGS cost (gross-margin trend separates specialty from commodity).
- capacityUtilization: % if disclosed; rdExpense: specialty R&D (₹ Crores) if disclosed.
- inventories / tradeReceivables / capex: ₹ Crores.`;
    case "ConsumerDurables":
      return `
CONSUMER DURABLES / RETAIL SECTOR RULES (Titan, Trent, Dixon, Havells, Voltas, Crompton):
- revenue: consolidated "Revenue from operations" (net of GST) — for retailers this is net sales across all stores/channels.
- ebitda: Operating Profit (exclude Other Income).
- grossProfit / tradeReceivables / inventories / capex: ₹ Crores.
- Note same-store-sales growth (SSSG), store count and channel mix in mdaHighlights if disclosed.`;
    case "Energy":
      return `
ENERGY / MINING SECTOR RULES:
- revenue: the consolidated "Revenue from operations" line — covers oil/gas/refining, power generation/transmission, and coal/mining sales. Use the NET figure where the line is shown "net of excise/GST/levies/royalties" (e.g. coal companies report "Revenue from operations (Net of levies)").
- capex / cwipActive: ₹ Crores.
- exceptionalItems: exploration write-offs / impairment often appear here (negative = loss).
- capacityUtilization / totalVolumesSold: production/dispatch volumes if disclosed (note unit in kams).`;
    case "Real Estate":
      return `
REAL ESTATE / DEVELOPER SECTOR RULES (Lodha/Macrotech, DLF, Godrej Properties, Oberoi):
- revenue: Revenue from Operations (P&L), ₹ Crores. WARNING: developers recognise P&L revenue on PROJECT HANDOVER — it is NOT the demand signal. Capture it, but the real operating metric is pre-sales below.
- presales: PRE-SALES / BOOKINGS value (₹ Crores) — THE primary demand metric. This is NOT a financial-statement line: find it in the MD&A / operational highlights (look for "Pre-sales", "Bookings", "Sales value"). Often quoted in ₹ billion → convert (1 bn = 100 Cr).
- collections: customer collections during the year (₹ Crores), from the MD&A — cash actually received.
- netDebt: Net Debt = total borrowings − cash & equivalents (₹ Crores). Developers and the market track NET debt, not gross.
- embeddedEbitdaMargin: operating/embedded EBITDA margin % from MD&A, if given.
- inventories: real-estate inventory / completed unsold + WIP stock (₹ Crores).
- totalDebt: total borrowings (gross).
NOTE: net-debt/equity (the key leverage gauge for developers; market rewards <0.5x) is computed downstream from netDebt and netWorth — you only need those two accurate.`;
    case "Ports":
      return `
PORTS / LOGISTICS INFRA SECTOR RULES (JSW Infrastructure, Adani Ports):
- revenue: Revenue from Operations / total income from port & logistics services (₹ Crores).
- ebitda: Operating Profit + Depreciation. Ports are high-margin (often >50%).
- capacityUtilization: Capacity Utilisation % = cargo handled ÷ operational capacity. STORE UTILISATION IN THIS FIELD (e.g. 64). Note operational capacity in MTPA in kams.
- totalVolumesSold: cargo handled during the year in MT/MTPA (store the tonnage here; note the unit in kams).
- realisationPerTonne: revenue per tonne of cargo (₹), if disclosed; else null.
- netDebt / totalDebt: ₹ Crores.
NOTE: net-debt/EBITDA (the primary leverage gauge for ports) is computed downstream from netDebt and ebitda.`;
    default:
      return `
GENERAL SECTOR RULES:
- revenue: Revenue from Operations (net of GST), exclude Other Income.
- ebitda: Operating Profit before Interest, Tax, Depreciation & Amortisation.`;
  }
}

// ─── Schema building ───────────────────────────────────────────────────────────
function commonProperties(): Record<string, any> {
  return {
    companyName:              { type: Type.STRING },
    isin:                     { type: Type.STRING },
    currency:                 { type: Type.STRING },
    reportingUnit:            { type: Type.STRING },
    isConsolidated:           { type: Type.BOOLEAN },
    revenue:                  { type: Type.NUMBER },
    ebitda:                   { type: Type.NUMBER },
    pat:                      { type: Type.NUMBER },
    totalDebt:                { type: Type.NUMBER },
    netWorth:                 { type: Type.NUMBER },
    cashEquivalents:          { type: Type.NUMBER },
    operatingCashFlow:        { type: Type.NUMBER },
    eps:                      { type: Type.NUMBER },
    dilutedEps:               { type: Type.NUMBER },
    numberOfEquityShares:     { type: Type.NUMBER },
    faceValuePerShare:        { type: Type.NUMBER },
    grossProfit:              { type: Type.NUMBER },
    totalAssets:              { type: Type.NUMBER },
    currentLiabilities:       { type: Type.NUMBER },
    tradeReceivables:         { type: Type.NUMBER },
    inventories:              { type: Type.NUMBER },
    capex:                    { type: Type.NUMBER },
    depreciation:             { type: Type.NUMBER },
    dividendPaid:             { type: Type.NUMBER },
    goodwill:                 { type: Type.NUMBER },
    deferredTaxAssets:        { type: Type.NUMBER },
    exceptionalItems:         { type: Type.NUMBER },
    contingentLiabilities:    { type: Type.NUMBER },
    relatedPartyTransactions: { type: Type.NUMBER },
    promoterPledgePercent:    { type: Type.NUMBER },
    auditorFees:              { type: Type.NUMBER },
    grossWrittenPremium:      { type: Type.NUMBER },
    solvencyRatio:            { type: Type.NUMBER },
    claimsRatio:              { type: Type.NUMBER },
    embeddedValue:            { type: Type.NUMBER },
    auditorName:              { type: Type.STRING },
    auditorOpinion:           { type: Type.STRING },
    hasGoingConcern:          { type: Type.BOOLEAN },
    auditorChangedThisYear:   { type: Type.BOOLEAN },
    businessOverview:         { type: Type.STRING },
    mdaHighlights:            { type: Type.STRING },
    kams:                     { type: Type.STRING },
    mgmtOutlook:              { type: Type.STRING },
    keyRisks:                 { type: Type.STRING },
    opportunities:            { type: Type.STRING },
    accountingPolicyChanges:  { type: Type.STRING },
    promoterChangeReason:     { type: Type.STRING },

    // source citations (page numbers in the ORIGINAL PDF, 1-based)
    citations: {
      type: Type.ARRAY,
      items: { type: Type.OBJECT, properties: {
        field: { type: Type.STRING }, page: { type: Type.NUMBER }, quote: { type: Type.STRING },
      } },
    },
    // related-party transaction breakdown
    relatedPartyDetails: {
      type: Type.ARRAY,
      items: { type: Type.OBJECT, properties: {
        party: { type: Type.STRING }, relationship: { type: Type.STRING },
        nature: { type: Type.STRING }, amount: { type: Type.NUMBER },
      } },
    },
    // contingent-liability category breakdown
    contingentLiabilityDetails: {
      type: Type.ARRAY,
      items: { type: Type.OBJECT, properties: {
        category: { type: Type.STRING }, amount: { type: Type.NUMBER },
      } },
    },
  };
}

function sectorProperties(sector: string): Record<string, any> {
  switch (sector) {
    case "Banking":
      return {
        interestIncome: { type: Type.NUMBER }, interestExpense: { type: Type.NUMBER },
        netInterestIncome: { type: Type.NUMBER }, netInterestMargin: { type: Type.NUMBER },
        grossNPA: { type: Type.NUMBER }, netNPA: { type: Type.NUMBER },
        capitalAdequacyRatio: { type: Type.NUMBER }, advances: { type: Type.NUMBER }, deposits: { type: Type.NUMBER },
      };
    case "NBFC":
      return {
        aum: { type: Type.NUMBER }, interestIncome: { type: Type.NUMBER }, interestExpense: { type: Type.NUMBER },
        netInterestIncome: { type: Type.NUMBER }, netInterestMargin: { type: Type.NUMBER },
        grossNPA: { type: Type.NUMBER }, netNPA: { type: Type.NUMBER },
        capitalAdequacyRatio: { type: Type.NUMBER }, costOfFunds: { type: Type.NUMBER }, roaa: { type: Type.NUMBER },
      };
    case "IT":
      return { employeeCount: { type: Type.NUMBER }, attritionRate: { type: Type.NUMBER } };
    case "Pharma":
      return { rdExpense: { type: Type.NUMBER }, specialtyRevenue: { type: Type.NUMBER }, fdaWarningLetters: { type: Type.NUMBER } };
    case "Auto":
      return { totalVolumesSold: { type: Type.NUMBER }, operatingMargin: { type: Type.NUMBER } };
    case "Metal":
      return { capacityUtilization: { type: Type.NUMBER }, totalVolumesSold: { type: Type.NUMBER } };
    case "Infrastructure":
      return { cwipActive: { type: Type.NUMBER }, netDebt: { type: Type.NUMBER }, orderBook: { type: Type.NUMBER }, orderInflow: { type: Type.NUMBER }, tollRevenue: { type: Type.NUMBER } };
    case "Insurance":
      return {
        grossWrittenPremium: { type: Type.NUMBER }, netEarnedPremium: { type: Type.NUMBER },
        combinedRatio: { type: Type.NUMBER }, claimsRatio: { type: Type.NUMBER },
        expenseRatio: { type: Type.NUMBER }, underwritingResult: { type: Type.NUMBER },
        solvencyRatio: { type: Type.NUMBER }, embeddedValue: { type: Type.NUMBER },
        newBusinessPremium: { type: Type.NUMBER }, ape: { type: Type.NUMBER },
        vnb: { type: Type.NUMBER }, vnbMargin: { type: Type.NUMBER },
        persistency13m: { type: Type.NUMBER }, persistency61m: { type: Type.NUMBER },
        opexRatio: { type: Type.NUMBER },
      };
    case "CapitalGoods":
      return { orderBook: { type: Type.NUMBER } };
    case "Power":
      return {
        capacityUtilization: { type: Type.NUMBER }, plantAvailabilityFactor: { type: Type.NUMBER },
        regulatedRoE: { type: Type.NUMBER }, receivableDays: { type: Type.NUMBER },
        cwipActive: { type: Type.NUMBER }, netDebt: { type: Type.NUMBER },
      };
    case "Chemicals":
      return { capacityUtilization: { type: Type.NUMBER }, rdExpense: { type: Type.NUMBER } };
    case "Energy":
      return { cwipActive: { type: Type.NUMBER } };
    case "Real Estate":
      return {
        presales: { type: Type.NUMBER }, collections: { type: Type.NUMBER },
        netDebt: { type: Type.NUMBER }, embeddedEbitdaMargin: { type: Type.NUMBER },
        inventories: { type: Type.NUMBER },
      };
    case "Ports":
      return {
        capacityUtilization: { type: Type.NUMBER }, totalVolumesSold: { type: Type.NUMBER },
        realisationPerTonne: { type: Type.NUMBER }, netDebt: { type: Type.NUMBER },
      };
    default:
      return {};
  }
}

function buildResponseSchema(sector: string) {
  return { type: Type.OBJECT, properties: { ...commonProperties(), ...sectorProperties(sector) }, required: ["companyName", "isConsolidated"] };
}

// ─── Optional, SAFE PDF page-trimming (returns the page offset for citations) ──
async function maybeTrimPdf(base64Clean: string): Promise<{ data: string; trimmed: boolean; pageOffset: number }> {
  if (!ENABLE_PDF_TRIM) return { data: base64Clean, trimmed: false, pageOffset: 0 };
  try {
    const buf = Buffer.from(base64Clean, "base64");
    // @ts-ignore optional dependency
    const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
    // @ts-ignore optional dependency
    const { PDFDocument } = await import("pdf-lib");

    const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true, disableFontFace: true }).promise;
    const total: number = doc.numPages;
    if (total <= TRIM_PAGE_THRESHOLD) return { data: base64Clean, trimmed: false, pageOffset: 0 };

    const scanStart = Math.min(20, Math.floor(total * 0.10));
    let consolIdx = -1, auditIdx = -1;
    for (let p = scanStart; p <= total; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      const text = tc.items.map((it: any) => it.str || "").join(" ").toUpperCase();
      
      const hasConsolidatedWord = text.includes("CONSOLIDATED");
      const hasBalanceSheetWord = text.includes("BALANCE SHEET") || text.includes("STATEMENT OF ASSETS AND LIABILITIES") || text.includes("STATEMENT OF FINANCIAL POSITION");
      
      if (consolIdx === -1 && hasConsolidatedWord && hasBalanceSheetWord) {
        consolIdx = p - 1;
      }
      
      if (auditIdx === -1 && (text.includes("INDEPENDENT AUDITOR") || text.includes("AUDITOR'S REPORT") || text.includes("AUDITORS' REPORT"))) {
        auditIdx = p - 1;
      }
      
      if (consolIdx !== -1 && auditIdx !== -1) break;
    }
    if (consolIdx === -1) return { data: base64Clean, trimmed: false, pageOffset: 0 };

    const lo = Math.max(0, Math.min(consolIdx, auditIdx === -1 ? consolIdx : auditIdx) - 6);
    const hi = Math.min(total - 1, consolIdx + 260);
    const src = await PDFDocument.load(buf, { ignoreEncryption: true });
    const out = await PDFDocument.create();
    const indices: number[] = [];
    for (let i = lo; i <= hi; i++) indices.push(i);
    const copied = await out.copyPages(src, indices);
    copied.forEach((pg: any) => out.addPage(pg));
    const bytes = await out.save();
    console.log(`[Trim] ${total}pp -> pages ${lo + 1}-${hi + 1} (offset ${lo}).`);
    return { data: Buffer.from(bytes).toString("base64"), trimmed: true, pageOffset: lo };
  } catch (e: any) {
    console.warn(`[Trim] skipped (${e?.message || e}). Sending full PDF.`);
    return { data: base64Clean, trimmed: false, pageOffset: 0 };
  }
}

function describeError(error: any): string {
  const msg = String(error?.message || error || "Unknown error");
  if (/quota|RESOURCE_EXHAUSTED|429/i.test(msg)) return "Gemini API quota/rate limit reached. Wait a minute and retry, or use a higher-limit key. Large PDFs cost more.";
  if (/API key|API_KEY_INVALID|PERMISSION_DENIED|401|403/i.test(msg)) return "Gemini API key is missing or invalid. Check the key in the Setup panel.";
  if (/SAFETY|blocked/i.test(msg)) return "The model blocked this response. Try re-uploading or a different report.";
  return msg;
}

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  app.get("/api/health", (_req, res) => res.json({ status: "ok", mode: process.env.NODE_ENV || "development", hasServerKey: !!apiKey }));

  app.post("/api/extract", async (req, res) => {
    try {
      const { base64, filename, year, sector, userApiKey } = req.body;
      if (!base64) return res.status(400).json({ error: "No PDF document content provided." });
      const activeApiKey = userApiKey || apiKey;
      if (!activeApiKey || activeApiKey === "dummy_key")
        return res.status(400).json({ error: "No Gemini API key found. Please enter your key in the Setup panel." });

      console.log(`[Extract] ${filename || "unnamed"} | Year: ${year} | Sector: ${sector}`);
      const localAi = new GoogleGenAI({ apiKey: activeApiKey, httpOptions: { headers: { "User-Agent": "equity-research-pro" } } });

      const systemPrompt = `You are an expert Indian equity research analyst. Extract financial disclosures with institutional-grade precision from the ATTACHED annual report. Use ONLY the attached document — never infer or recall from memory. If a value is not present, omit the field (it becomes null).

CRITICAL RULE 1 — CONSOLIDATED ONLY: Indian reports contain BOTH Standalone and Consolidated statements. Extract ONLY from CONSOLIDATED. If only Standalone exists, set isConsolidated:false and say so in kams.

CRITICAL RULE 1b — REVENUE LINE SELECTION: For the revenue field, take the single line printed as "Revenue from operations" on the consolidated Statement of Profit and Loss, EXACTLY as reported. Do NOT re-sum segment notes, product lines or business-division tables to build revenue — the sector hints below describe what that line already contains, they are NOT an instruction to add sub-components. "Total Income" (which adds Other Income) is NOT revenue, except for Banking/NBFC where revenue = "Total Income". If the line is shown "net of" levies/excise/GST (e.g. "Revenue from operations (Net of levies)"), use that net figure.

CRITICAL RULE 1c — EBITDA EXTRACTION PROCEDURE (non-financials; for Banking/NBFC/Insurance set ebitda = null).

DO NOT search the P&L for a line "labelled" EBITDA. Many Indian reports do not print such a line, and an LLM looking for the closest-named line repeatedly picks "Profit before exceptional items and tax" — that line is **PBT**, not EBITDA. Follow this DETERMINISTIC procedure instead:

  STEP A — From the consolidated Statement of Profit and Loss, read these four lines, EXACTLY as printed (apply the unit factor from RULE 2):
    (i)   Revenue from operations
    (ii)  Total expenses (the bottom of the expenses block, BEFORE "Profit before exceptional items and tax")
    (iii) Finance costs / Interest expense (a sub-line inside Total expenses)
    (iv)  Depreciation, amortisation and impairment (a sub-line inside Total expenses)

  STEP B — COMPUTE:
    First, check if (iii) Finance costs and (iv) Depreciation & amortisation are listed as sub-items inside (ii) Total expenses.
    - If they are included inside (ii) Total expenses:
      ebitda = (i) − ( (ii) − (iii) − (iv) )
    - If they are NOT included inside (ii) Total expenses:
      ebitda = (i) − (ii)
    This ensures we compute operating profit before D&A and interest, without double-subtraction.

  STEP C — SANITY CHECK (mandatory): your computed ebitda MUST satisfy:
    ebitda > PBT  AND  ebitda > PAT
  If it does not, you have made an arithmetic error or used the wrong line — recompute. NEVER return a value that fails this check.

  WORKED EXAMPLE (Sun Pharma FY2023 consolidated, "₹ in Million"):
    Revenue from operations           438,856.8
    Total expenses                    345,772.5
    Finance costs                       1,722.5
    Depreciation & amortisation        25,294.3
    ebitda (M) = 438,856.8 − (345,772.5 − 1,722.5 − 25,294.3) = 120,101.1
    ebitda in ₹ Crores = 120,101.1 ÷ 10 = 12,010 Cr  (matches the ~₹11,650 Cr Operating Profit Screener publishes; small gap from minor classification differences is fine).
    INCORRECT (do NOT do this): pulling "Profit before exceptional items and tax 95,798.8" as EBITDA → that is PBT, off by the D&A + interest amount.

  NEVER report any of the following as ebitda:
    • "Profit before tax (PBT)" or "Profit before exceptional items and tax" — PBT (after D&A and interest).
    • "EBIT" / "Operating profit after depreciation" — after D&A.
    • Anything that adds Other Income.

  In the EBITDA citation, quote the FOUR source lines you used for the computation, not a single line.

CRITICAL RULE 1d — EPS BASIS: For eps/dilutedEps take "Basic EPS" / "Diluted EPS" EXACTLY as printed on the consolidated P&L (₹ per share), computed by the company on the WEIGHTED-AVERAGE number of shares. Do NOT recompute EPS yourself. Beware of share-count changes from mergers/amalgamations (e.g. the e-HDFC merger) and bonus/split events that restate the weighted-average base — use the EPS the audited statement reports for FY${year}, and record numberOfEquityShares and faceValuePerShare so the figure can be cross-checked.

CRITICAL RULE 2 — UNIT CONVERSION (READ CAREFULLY — THIS IS THE #1 SOURCE OF ERRORS):

STEP 2a — WHERE to read the unit: Take the unit ONLY from the header printed at the top of the AUDITED financial statements — i.e. the "Consolidated Balance Sheet", "Consolidated Profit and Loss Account", and "Consolidated Cash Flow Statement" (the schedules signed by the auditor). DO NOT take the unit from "Financial Highlights", "Ten-year highlights", MD&A tables, the EPS-computation note, the capital-adequacy (Basel) note, or the related-party note. In Indian bank reports these summary tables are frequently printed "₹ in million" EVEN WHEN the audited statements are in a different unit. Using the wrong section's unit is the most common cause of a 10× error. Record the AUDITED statement's unit in reportingUnit.

STEP 2b — RECOGNISE THE UNIT NOTATION. The header may be written many ways. Map them as follows:
  • "₹ in Crore(s)" / "Rs. in Crore"                                  → multiply by 1        (no change)
  • "₹ in Lakh(s)"                                                     → divide by 100        (1 Crore = 100 Lakhs)
  • "₹ in Million(s)" / "Rs. Mn" / "₹ Mn"                              → divide by 10         (1 Crore = 10 Millions)
  • "₹ in Thousand(s)"  OR  "₹ in '000s"  OR  "₹ in '000"  OR  "in 000s"  OR  "₹ '000"  OR  "Rs. in '000s"
                                                                       → divide by 10,000     (1 Crore = 10,000 Thousands)
  • "₹ in Billion(s)" / "₹ Bn"                                         → multiply by 100      (1 Billion = 100 Crores)
IMPORTANT: the apostrophe-zeros notation "'000s" (and "'000") means THOUSANDS. Many Indian banks (ICICI, HDFC, Axis, SBI) print their audited Consolidated Balance Sheet and Profit & Loss Account as "₹ in '000s". Treat it as Thousands → divide by 10,000. Do NOT confuse it with millions.

STEP 2c — CONVERT every monetary value to ₹ Crores using the factor above, consistently, from the SAME audited statement. Ignore digit-grouping commas when reading numbers — Indian reports group as "1,37,795" and Western as "137,795"; both mean 137795. Apply the unit factor to the full number.

STEP 2d — WORKED EXAMPLE (ICICI Bank FY2024, audited Consolidated P&L, header "₹ in '000s"):
  printed TOTAL INCOME = 2,360,377,272  →  ÷ 10,000  =  236,038  → store revenue ≈ 236038 (₹ Cr)
  printed Net profit after minority = 442,563,735  →  ÷ 10,000  =  44,256  → store pat ≈ 44256 (₹ Cr)
  (If instead you had read the "₹ in million" highlights table and divided by 100, you would get ≈ 23,604 — that is WRONG, off by 10×.)

STEP 2e — VERIFY before returning. For a large listed bank, Total Income/Revenue should be roughly ₹150,000–350,000 Cr and PAT roughly ₹20,000–70,000 Cr. If your revenue comes out around 23,600 or 2,360 (i.e. suspiciously close to a clean ÷10 or ÷100 of the plausible figure), you used the wrong unit — re-read the AUDITED statement header (it is almost certainly "'000s" → ÷10,000) and redo the conversion. Revenue and PAT must come from the SAME statement and therefore the SAME unit.

Exceptions — these fields are NEVER converted to Crores: promoterPledgePercent, grossNPA, netNPA, capitalAdequacyRatio, netInterestMargin, attritionRate, capacityUtilization, costOfFunds, roaa → store as plain percentages; eps/dilutedEps → ₹ per share; employeeCount/totalVolumesSold/fdaWarningLetters → raw integers; auditorFees → ₹ Crores.

STEP 2f — UNIT-SANITY ANCHOR (extract so the conversion can be auto-verified): 
  • numberOfEquityShares: the ABSOLUTE INTEGER count of ISSUED, SUBSCRIBED & PAID-UP equity shares outstanding at year-end, read from the Share Capital schedule/note (e.g. "7,023,395,074 equity shares of ₹2 each" → 7023395074). This is a COUNT — do NOT convert it to crores/millions and do NOT shorten it. Use issued & paid-up (not authorised) shares.
  • faceValuePerShare: face/par value per equity share in ₹ (e.g. 2, 1, 5, 10) — a per-share rupee figure, never converted.
  Together with eps these let the system verify that pat (₹ Cr) ≈ eps × numberOfEquityShares ÷ 10,000,000. Because the share count is unit-invariant, this catches a wrong unit divisor that would otherwise scale every ₹ figure uniformly.

CRITICAL RULE 3 — NULL vs ZERO: Omit a field (→ null) when not present or uncertain. Return 0 only for a genuine zero. Never output 0 for "not found" and never guess.

CRITICAL RULE 4 — SOURCE CITATIONS: Fill the citations array with one entry per important number: field (exact output field name), page (1-based PDF page where read), quote (<12 word snippet). Cite at least revenue, pat, totalDebt, netWorth, ebitda (if applicable), operatingCashFlow, and the 2-3 key sector metrics. Do not fabricate page numbers.

CRITICAL RULE 5 — RELATED PARTY & CONTINGENT DETAIL: From the "Related Party Disclosures" note fill relatedPartyDetails: one row per material line with party (counterparty), relationship (Subsidiary/Associate/JV/KMP/Promoter group/Other), nature (Sale, Purchase, Loans given/taken, Guarantees, Remuneration, etc.), amount in ₹ Crores; up to ~12 largest rows; the headline relatedPartyTransactions should equal their sum. From the "Contingent Liabilities and Commitments" note fill contingentLiabilityDetails: one row per category (Income tax disputes, Indirect tax/GST disputes, Litigation & claims, Guarantees, Letters of credit, Other) with amount in ₹ Crores; for banks/NBFCs include off-balance-sheet items; the headline contingentLiabilities should equal their sum. Omit either array if the note is absent.

SECTOR-SPECIFIC RULES:
${getSectorGuidance(sector)}

STANDARD MAPPINGS: 
- pat: Profit After Tax attributable to owners of the parent (consolidated), in ₹ Crores.
- totalDebt: sum of consolidated balance-sheet borrowings (specifically (Non-current borrowings) + (Current borrowings) + (Non-current lease liabilities) + (Current lease liabilities) + (Current maturities of long-term debt, if shown separately)). Do NOT extract only lease liabilities when borrowings are present.
- netWorth: total equity attributable to shareholders/owners of the parent (must include BOTH Share Capital / Equity Share Capital AND Reserves & Surplus, but exclude non-controlling interest/minority interest).
- currentLiabilities: total current liabilities from the consolidated balance sheet.
- exceptionalItems: the net amount of exceptional or extraordinary items during the year, in ₹ Crores. Must be extracted ONLY from a specific line labeled "Exceptional Items" or "Extraordinary Items" in the P&L. If no such line exists, set this to null. DO NOT confuse PBT (e.g. ₹37,608 Cr) or ordinary tax items with exceptional items.
- auditorOpinion: EXACTLY one of "Clean","Qualified","Adverse","Disclaimer". Keep qualitative fields concise.

CRITICAL RULE 1e — TOTAL DEBT EXTRACTION: For totalDebt, sum the consolidated balance-sheet's BORROWINGS and LEASE LIABILITIES line items. Specifically:
  (Non-current Borrowings) + (Current Borrowings) + (Non-current Lease Liabilities) + (Current Lease Liabilities) + (Current maturities of long-term debt, if shown separately).
Use the CONSOLIDATED balance sheet lines directly. Do NOT extract from a sub-note details schedule unless the balance sheet does not separate borrowings/lease liabilities. Many companies (e.g., Infosys, Sun Pharma) have both borrowings and lease liabilities; you must include BOTH in the totalDebt figure. For IT sector, totalDebt MUST include both traditional borrowings and IFRS-16 lease liabilities. Do NOT overlook traditional borrowings.

CRITICAL GENERAL RULE — WORKING CAPITAL EXTRACTION: Always extract Trade Receivables (debtors), Inventories (stock), and Depreciation from the consolidated financial statements or notes for all years. These are required to compute working capital ratios and ROCE. If they are listed, they must be extracted.

CRITICAL RELATED PARTY RULE — From the "Related Party Disclosures" note fill relatedPartyDetails: one row per material commercial transaction (Sale, Purchase, Loans given/taken, Guarantees, Remuneration, etc.) during the target year, in ₹ Crores. Do NOT extract CSR spend or foundation donations (e.g. CSR contribution of Rs 408 Cr to Infosys Foundation) as the primary commercial related-party transactions. Double check that the year of the transaction matches the target fiscal year (do not mix FY24 and FY23). Make sure the total relatedPartyTransactions equals the sum of these detailed transactions. Quotes in citations must match the numerical value of the transaction.

QUALITATIVE NARRATIVE FIELDS (extract from the Management Discussion & Analysis, the Board's/Directors' Report and the business-overview pages — NOT the audited numbers):
- businessOverview: 2–4 sentences in plain English on WHAT THE COMPANY DOES — its core business, main products/services, key segments or divisions, and how it makes money. Neutral and factual (e.g. "ICICI Bank is a private-sector bank offering retail and corporate banking, with subsidiaries in life and general insurance, asset management and securities."). Do NOT copy marketing language; summarise.
- mdaHighlights: a concise digest of the MD&A operational & financial review — segment/business performance, key operating drivers, notable YoY movements management calls out, and capital/strategy actions. Use short newline-separated points. Omit if no MD&A is present.
Keep mgmtOutlook (forward commentary), keyRisks, opportunities and accountingPolicyChanges as separate fields as before.`;

      const responseSchema = buildResponseSchema(sector);
      const base64Clean = base64.replace(/^data:application\/pdf;base64,/, "");
      const { data: pdfData, trimmed, pageOffset } = await maybeTrimPdf(base64Clean);

      // FIX 3 (prompt layer) — State the year explicitly and forbid Gemini from inferring it.
      const extractionInstruction = `Extract financial disclosures for fiscal year ${year} (FY${year}, ending March ${year}).

CRITICAL YEAR RULE: The fiscal year for this extraction is definitively FY${year}. Do NOT infer or change the fiscal year from PDF cover pages, page headers, metadata, or prior-year comparison columns. Every figure you extract must be the CURRENT YEAR column (FY${year}). Ignore any prior-year comparison column.

1. Identify the reporting UNIT (set reportingUnit). 2. Use ONLY CONSOLIDATED statements. 3. Convert to ₹ Crores per CRITICAL RULE 2 above; omit fields not found with confidence. 4. Set isConsolidated. 5. Fill citations with 1-based page numbers. 6. Fill relatedPartyDetails and contingentLiabilityDetails where present.
${trimmed ? "Report page numbers as the page within THIS document; the server maps them back to the original." : ""}`;

      const response: GenerateContentResponse = await localAi.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          { inlineData: { mimeType: "application/pdf", data: pdfData } },
          { text: extractionInstruction },
        ],
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.1,
          thinkingConfig: { thinkingBudget: 0 },
          maxOutputTokens: 8192,
        },
      });

      let financialData: any;
      try { financialData = JSON.parse(response.text || "{}"); }
      catch { return res.status(502).json({ error: "Model returned malformed JSON (possibly truncated). Try re-uploading." }); }

      // FIX 3 (code layer) — Hard-stamp year and sector from the request.
      // No matter what year Gemini inferred from the PDF, the user-selected year wins.
      financialData.year   = Number(year);
      financialData.sector = sector;

      if (pageOffset > 0 && Array.isArray(financialData.citations)) {
        financialData.citations = financialData.citations
          .filter((c: any) => c && typeof c.page === "number")
          .map((c: any) => ({ ...c, page: c.page + pageOffset }));
      }

      if (financialData.auditorFees && financialData.auditorFees > 50)
        console.warn(`[Extract] auditorFees=${financialData.auditorFees} Cr looks high.`);

      // FIX 6 (code layer) — Deterministic unit-scale auto-correction via a
      // unit-INVARIANT anchor. Reports that mix "₹ in '000s" audited statements
      // with "₹ in million" summary tables can make the model apply the wrong
      // divisor uniformly, leaving every ₹ figure off by a clean power of ten.
      // Ratio-based checks can't see a uniform error, but the share COUNT is not
      // unit-scaled, so the identity  pat(₹Cr) ≈ eps × shares ÷ 1e7  exposes it.
      {
        const eps = financialData.eps;
        const shares = (financialData as any).numberOfEquityShares as number | null | undefined;
        const pat = financialData.pat;
        if (eps && eps > 0 && pat && pat > 0 && shares && shares > 1_000_000) {
          const expectedPat = (eps * shares) / 1e7;          // ₹ Cr, scale-independent
          const ratio = expectedPat / pat;                    // how far PAT is off
          const pow = Math.round(Math.log10(ratio));
          const factor = Math.pow(10, pow);                   // 1, 10, 100, … or 0.1, 0.01
          // Bidirectional scaling — both observed failure modes get corrected:
          //   pow >= 1  : model OVER-divided (e.g. read '000s as 'Cr) → scale UP
          //   pow <= -1 : model UNDER-divided (e.g. read 'Million as 'Cr) → scale DOWN
          // Each direction needs the EPS×shares anchor to land within ±15% of a clean
          // power of ten before any change is made, so a partially-wrong share count
          // cannot trigger a destructive rescale.
          const MONETARY = [
            "revenue", "ebitda", "pat", "totalDebt", "netWorth", "cashEquivalents",
            "operatingCashFlow", "grossProfit", "totalAssets", "tradeReceivables",
            "inventories", "capex", "depreciation", "dividendPaid", "goodwill",
            "deferredTaxAssets", "exceptionalItems", "contingentLiabilities",
            "relatedPartyTransactions", "auditorFees", "interestIncome", "interestExpense",
            "netInterestIncome", "advances", "deposits", "aum", "rdExpense",
            "specialtyRevenue", "netDebt", "orderBook", "tollRevenue", "cwipActive",
            "grossWrittenPremium", "embeddedValue", "netEarnedPremium", "underwritingResult",
            "newBusinessPremium", "ape", "vnb", "presales", "collections", "orderInflow",
          ];
          if (pow !== 0 && Math.abs(ratio - factor) / factor <= 0.15) {
            for (const f of MONETARY) {
              const v = (financialData as any)[f];
              if (typeof v === "number") (financialData as any)[f] = v * factor;
            }
            const dir = factor > 1 ? "×" : "÷";
            const mag = factor > 1 ? factor : (1 / factor);
            console.warn(`[Extract] Unit-scale auto-correction ${dir}${mag} applied (EPS anchor: expected PAT ≈ ${expectedPat.toFixed(0)} Cr vs extracted ${pat} Cr; shares=${shares}, eps=${eps}).`);
            (financialData as any).unitAutoScaledFactor = factor;
          }
        }
      }

      // FIX 2 (code layer) — NPA absolute-value guard.
      // grossNPA and netNPA must be percentages (e.g. 2.87).
      // If Gemini stored an absolute ₹ Crore figure instead (e.g. 24166),
      // auto-correct it using advances as the denominator.
      if (sector === "Banking" || sector === "NBFC") {
        for (const npaField of ["grossNPA", "netNPA"] as const) {
          const raw = financialData[npaField];
          if (raw != null && raw > 50) {
            const adv = financialData.advances;
            if (adv && adv > 0) {
              const corrected = parseFloat(((raw / adv) * 100).toFixed(4));
              console.warn(`[Extract] ${npaField}=${raw} looks like ₹ Cr, not %. Auto-correcting to ${corrected}% (advances=${adv} Cr).`);
              financialData[npaField] = corrected;
            } else {
              console.warn(`[Extract] ${npaField}=${raw} looks like ₹ Cr but advances not found. Nulling out to prevent bad score.`);
              financialData[npaField] = null;
            }
          }
        }
      }

      // FIX 4 (code layer) — EBITDA is meaningless for banks/NBFCs. The prompt asks
      // for null, but the schema types ebitda as NUMBER so Gemini often emits 0,
      // which then triggers a bogus "Low EBITDA margin (<8%)" forensic flag downstream.
      // Hard-null it here so scoring never sees a phantom 0.
      if (sector === "Banking" || sector === "NBFC" || sector === "Insurance") {
        financialData.ebitda = null;
      }

      // FIX 5 (code layer) — Audit-opinion normalisation. "Unmodified" and
      // "Unqualified" are the formal terms for a CLEAN opinion. If Gemini returns
      // those (or close variants) instead of the literal "Clean", downstream scoring
      // wrongly treats it as adverse (-15 pts + forensic flag). Normalise here.
      if (typeof financialData.auditorOpinion === "string") {
        const op = financialData.auditorOpinion.trim();
        if (/^(un[\s-]?modified|un[\s-]?qualified|clean)\b/i.test(op)) {
          financialData.auditorOpinion = "Clean";
        } else if (/^qualified/i.test(op)) {
          financialData.auditorOpinion = "Qualified";
        } else if (/^adverse/i.test(op)) {
          financialData.auditorOpinion = "Adverse";
        } else if (/^disclaimer/i.test(op)) {
          financialData.auditorOpinion = "Disclaimer";
        }
      }

      if (financialData.isConsolidated === false)
        financialData.kams = (financialData.kams ? financialData.kams + "\n\n" : "")
          + "⚠️ STANDALONE ONLY: Consolidated statements were not found. Figures reflect the standalone entity only.";

      console.log(`[Extract] Done: ${financialData.companyName || "Unknown"} FY${financialData.year} | Consolidated: ${financialData.isConsolidated} | Unit: ${financialData.reportingUnit || "unknown"} | Citations: ${financialData.citations?.length || 0}`);
      res.json(financialData);
    } catch (error: any) {
      const friendly = describeError(error);
      console.error("[Extract Error]", error?.message || error);
      const status = /quota|429|RESOURCE_EXHAUSTED/i.test(String(error?.message)) ? 429 : 500;
      res.status(status).json({ error: friendly });
    }
  });

  app.post("/api/discuss", async (req, res) => {
    try {
      const { message, history, context, userApiKey } = req.body;
      const activeApiKey = userApiKey || apiKey;
      if (!activeApiKey || activeApiKey === "dummy_key") return res.status(400).json({ error: "No Gemini API key found." });
      const localAi = new GoogleGenAI({ apiKey: activeApiKey, httpOptions: { headers: { "User-Agent": "equity-research-pro" } } });
      const systemPrompt = `You are a senior institutional equity analyst covering Indian companies.
Multi-year extracted metrics for ${context?.companyName || "a company"} (${context?.sector || "unknown sector"}).
${context?.isConsolidated === false ? "\n⚠️ Data below is STANDALONE.\n" : ""}
Extracted data (₹ Crores unless a percentage/per-share/count):
${JSON.stringify(context || {}, null, 2)}
Rules: answer ANY question about this company — including "what does the company do", its business model, segments, strategy, risks and outlook (use the businessOverview, mdaHighlights, mgmtOutlook, keyRisks and opportunities fields for these) as well as the numbers. Cite exact figures; if a metric is null say it wasn't extracted (don't invent it); flag stress signals; use Markdown; objective tone.`;
      const trimmedHistory = (history || []).slice(-8);
      const response = await localAi.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          ...trimmedHistory.map((h: any) => ({ role: h.role === "user" ? ("user" as const) : ("model" as const), parts: [{ text: h.text }] })),
          { role: "user" as const, parts: [{ text: message }] },
        ],
        config: { systemInstruction: systemPrompt, temperature: 0.3, maxOutputTokens: 4096 },
      });
      res.json({ text: response.text });
    } catch (error: any) {
      const friendly = describeError(error);
      console.error("[Chat Error]", error?.message || error);
      const status = /quota|429|RESOURCE_EXHAUSTED/i.test(String(error?.message)) ? 429 : 500;
      res.status(status).json({ error: friendly });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => console.log(`✅ Server running on http://localhost:${PORT}`));
}

startServer();