export const SECTORS = [
  'General', 'Banking', 'NBFC', 'Insurance', 'IT', 'Pharma',
  'FMCG', 'ConsumerDurables', 'Auto', 'CapitalGoods', 'Metal',
  'Chemicals', 'Infrastructure', 'Energy', 'Power', 'Real Estate', 'Ports'
] as const;

export type Sector = typeof SECTORS[number];

export interface Citation {
  field: string;       // output field name, e.g. "revenue"
  page: number;        // 1-based page in the ORIGINAL uploaded PDF
  quote?: string;      // short snippet of the source line item
}

export interface RelatedPartyItem {
  party: string;
  relationship?: string;   // Subsidiary / Associate / JV / KMP / Promoter group / Other
  nature?: string;         // Sale / Purchase / Loans / Guarantees / Remuneration ...
  amount: number;          // ₹ Crores
}

export interface ContingentItem {
  category: string;        // Income tax / GST / Litigation / Guarantees / LCs / Other
  amount: number;          // ₹ Crores
}

export interface GuidanceItem {
  metric: string;          // e.g. "Revenue growth", "EBITDA margin", "AUM growth"
  target?: string;         // e.g. "15-17%", "₹5,000 crore", "mid-teens"
  timeframe?: string;      // e.g. "FY26", "next 3 years"
  quote?: string;          // short verbatim snippet
}

export interface FinancialData {
  companyName: string;
  year: number;            // FIX 3: always stamped from the user-selected slot year in server.ts
  sector: Sector;
  isConsolidated?: boolean;

  isin?:          string | null;
  currency?:      string | null;
  reportingUnit?: string | null;  // e.g. "₹ in Thousands" — logged for audit/debug

  revenue:          number | null;
  ebitda:           number | null;
  pat:              number | null;
  totalDebt:        number | null;
  netWorth:         number | null;
  cashEquivalents:  number | null;
  operatingCashFlow:number | null;
  eps:              number | null;
  dilutedEps?:      number | null;
  numberOfEquityShares?: number | null;  // absolute issued & paid-up share count (unit-invariant EPS anchor)
  faceValuePerShare?:    number | null;  // ₹ per share (2, 1, 5, 10 …)

  grossProfit?:        number | null;
  totalAssets?:        number | null;
  tradeReceivables?:   number | null;
  inventories?:        number | null;
  capex?:              number | null;
  depreciation?:       number | null;
  dividendPaid?:       number | null;
  goodwill?:           number | null;
  deferredTaxAssets?:  number | null;
  exceptionalItems?:   number | null;

  contingentLiabilities?:    number | null;
  relatedPartyTransactions?: number | null;
  promoterPledgePercent?:    number | null;
  cwipActive?:               number | null;
  auditorFees?:              number | null;
  auditorChangedThisYear?:   boolean | null;

  // Banking / NBFC fields
  interestIncome?:        number | null;
  interestExpense?:       number | null;
  netInterestIncome?:     number | null;
  netInterestMargin?:     number | null;  // percentage, e.g. 4.3 = 4.3%
  grossNPA?:              number | null;  // FIX 2: PERCENTAGE (e.g. 2.87 = 2.87%), NOT ₹ Crores
  netNPA?:                number | null;  // FIX 2: PERCENTAGE, NOT ₹ Crores
  capitalAdequacyRatio?:  number | null;  // percentage
  advances?:              number | null;  // ₹ Crores — used as denominator for NPA auto-correction
  deposits?:              number | null;

  aum?:           number | null;
  costOfFunds?:   number | null;
  roaa?:          number | null;

  employeeCount?:   number | null;
  attritionRate?:   number | null;

  rdExpense?:        number | null;
  specialtyRevenue?: number | null;
  fdaWarningLetters?:number | null;

  capacityUtilization?: number | null;
  totalVolumesSold?:    number | null;

  netDebt?:     number | null;
  orderBook?:   number | null;
  tollRevenue?: number | null;
  orderInflow?: number | null;        // Infra/E&C: order intake during the year (₹ Cr)

  // Auto
  operatingMargin?: number | null;    // Operating EBIT margin % as company reports it

  // Power (PLF continues to live in capacityUtilization for engine compatibility)
  plantAvailabilityFactor?: number | null;  // %
  regulatedRoE?:            number | null;   // % (CERC norm ~15.5)
  receivableDays?:          number | null;   // debtor days vs DISCOMs

  // Real Estate (inventory reuses `inventories`; net debt reuses `netDebt`)
  presales?:             number | null;  // bookings/sales value, ₹ Cr — primary demand metric
  collections?:          number | null;  // customer collections, ₹ Cr
  embeddedEbitdaMargin?: number | null;  // operating/embedded EBITDA margin %

  // Ports (utilisation reuses capacityUtilization; cargo reuses totalVolumesSold; net debt reuses netDebt)
  realisationPerTonne?: number | null;   // revenue per tonne of cargo (₹)

  // Insurance fields (life & general — only the relevant subset is populated per company)
  grossWrittenPremium?: number | null;  // ₹ Crores (general: GDPI/GWP; life: total gross premium)
  netEarnedPremium?:    number | null;  // ₹ Crores (general insurers)
  combinedRatio?:       number | null;  // % (general) — Loss + Expense ratio; <100 = u/w profit
  claimsRatio?:         number | null;  // % (general) — loss/incurred-claims ratio
  expenseRatio?:        number | null;  // % (general)
  underwritingResult?:  number | null;  // ₹ Crores (general) — negative if CR > 100%
  solvencyRatio?:       number | null;  // ratio or % as reported (both)
  newBusinessPremium?:  number | null;  // ₹ Crores (life) — FYP + single
  ape?:                 number | null;  // ₹ Crores (life) — annualised premium equivalent
  vnb?:                 number | null;  // ₹ Crores (life) — value of new business
  vnbMargin?:           number | null;  // % (life)
  embeddedValue?:       number | null;  // ₹ Crores (life) — Indian Embedded Value
  persistency13m?:      number | null;  // % (life)
  persistency61m?:      number | null;  // % (life)
  opexRatio?:           number | null;  // % (life) — opex / gross premium

  auditorName?:             string;
  auditorOpinion?:          string;
  hasGoingConcern?:         boolean;
  businessOverview?:        string;   // what the company does (business model, segments)
  mdaHighlights?:           string;   // MD&A operational/financial review highlights
  kams?:                    string;
  mgmtOutlook?:             string;
  keyRisks?:                string;
  opportunities?:           string;
  accountingPolicyChanges?: string;
  promoterChangeReason?:    string;

  // feature payloads
  citations?:                  Citation[];
  relatedPartyDetails?:        RelatedPartyItem[];
  contingentLiabilityDetails?: ContingentItem[];
  guidance?:                   GuidanceItem[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

export interface YearSlot {
  year: number;
  file?: File;
  data?: FinancialData;
  loading: boolean;
  error?: string;
}

export type AppView = 'setup' | 'upload' | 'dashboard' | 'ratios' | 'mda' | 'chat' | 'forensic';