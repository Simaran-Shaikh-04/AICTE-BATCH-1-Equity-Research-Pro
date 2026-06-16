# System Architecture — Indian Equity Research Assistant Pro

## Overview

The app is a full-stack web application with three logical layers:

```
┌─────────────────────────────────────────────────────┐
│                  BROWSER (React UI)                  │
│  SetupPanel → UploadPanel → Dashboard → Panels      │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP (fetch)
┌──────────────────────▼──────────────────────────────┐
│              NODE.JS / EXPRESS BACKEND               │
│  /api/extract  →  Gemini API  →  structured JSON    │
│  /api/chat     →  Gemini API  →  analyst response   │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────────┐
│              GEMINI 2.5 FLASH API                    │
│  Multimodal PDF reading + structured extraction      │
└─────────────────────────────────────────────────────┘
```

---

## Data Flow

### Step 1 — Upload
User selects sector and uploads 1–3 PDF files (one per fiscal year) via `UploadPanel.tsx`. Files are sent as base64 to the Express backend.

### Step 2 — Gemini Extraction (`server.ts`)
For each PDF:
- Gemini 2.5 Flash receives the full PDF as a multimodal input
- A structured prompt asks for ~25 specific financial fields
- Each extracted value includes the source page number
- Response is parsed into a typed `FinancialData` object

**Extraction fields include:**
Revenue/Total Income, PAT, Total Debt, Net Worth, Operating Cash Flow, Total Assets, Advances (banks), Deposits (banks), Net Interest Income (banks), Gross NPA %, Capital Adequacy %, NIM %, EPS, Diluted EPS, Contingent Liabilities, Related Party Transactions, Auditor Name, Audit Opinion, Promoter Pledge %, Going Concern

### Step 3 — Sector Routing (`src/lib/scoring.ts`)
The extracted data is routed to the sector-specific scoring engine. Each sector calculates:
- Ratios relevant to that industry only
- A weighted composite score
- A letter grade (D / C / B / B+ / A)

### Step 4 — MD&A Extraction (`server.ts`)
A second Gemini call extracts structured MD&A sections:
- Business Overview
- MD&A Highlights
- Management Outlook
- Key Risks
- Opportunities
- Accounting Policy Changes
- Key Audit Matters

### Step 5 — NarrativeDiff (`src/components/NarrativeDiffPanel.tsx`)
Compares MD&A text between adjacent years at the sentence level using a diff algorithm. Output: sentences marked as added (+) or removed (−).

### Step 6 — Forensic Scoring
The forensic engine evaluates:
- Is contingent liabilities / revenue above sector threshold?
- Is RPT / revenue above 10%?
- Has the auditor changed?
- Is the audit opinion clean, qualified, or adverse?
- Is promoter pledge > 0% and trending up?
- Are there going concern flags?

### Step 7 — Rendering
All computed data flows into the React component tree and is rendered across 7 navigation panels.

---

## File Responsibilities

| File | Responsibility |
|------|---------------|
| `server.ts` | Gemini API calls, PDF base64 handling, MD&A extraction, AI chat endpoint |
| `src/lib/scoring.ts` | 12 sector ratio engines, score calculation, grade assignment |
| `src/lib/types.ts` | All TypeScript interfaces (`FinancialData`, `SectorRatios`, `ForensicData`, etc.) |
| `src/App.tsx` | Global state, navigation state machine, data passing between components |
| `src/components/Dashboard.tsx` | 5-tab dashboard: Overview, Financials, Related Parties, YoY, Sources |
| `src/components/ForensicPanel.tsx` | Forensic flag display, trend signals, audit governance section |
| `src/components/MDAPanel.tsx` | MD&A viewer with Raw/AI Summary toggle, per-year tabs |
| `src/components/NarrativeDiffPanel.tsx` | Sentence-level diff rendering with green/red highlighting |
| `src/components/ChatPanel.tsx` | AI chat UI, quick prompts, message history |
| `src/lib/reportDocx.ts` | Word document generation using docx library |
| `src/lib/reportXlsx.ts` | Excel workbook generation using xlsx library |

---

## Sector Scoring Logic

Each sector defines:
1. **Which ratios to calculate** from the extracted financial data
2. **Thresholds** for rating each ratio (poor / average / good / excellent)
3. **Weights** for each ratio in the composite score
4. **Exclusions** — ratios that don't apply (e.g., no EBITDA for Banking/NBFC)

### Banking Sector Example
```
NIM %           → weight: 25%  → good threshold: >3.5%
Gross NPA %     → weight: 25%  → good threshold: <2.0%
CAR %           → weight: 20%  → good threshold: >16%
ROE %           → weight: 15%  → good threshold: >15%
CFO/PAT         → weight: 10%  → good threshold: >1.0x
Net PAT Margin  → weight:  5%  → good threshold: >15%
```

### IT Sector Example
```
EBITDA Margin   → weight: 30%  → good threshold: >25%
Revenue Growth  → weight: 20%  → good threshold: >15%
ROE %           → weight: 20%  → good threshold: >20%
FCF             → weight: 15%  → good threshold: positive
Net PAT Margin  → weight: 15%  → good threshold: >20%
```

---

## Deployment Architecture

```
GitHub (source code)
        │
        │ push to main
        ▼
        Hugging Face Spaces (CI/CD)
        │
        │ docker build
        ▼
Docker Container
  - Vite builds React frontend → static files
  - Node.js/Express serves static files + API routes
  - App runs on port 7860
        │
        ▼
Public URL: huggingface.co/spaces/LumoraX/equity-research-pro
```

The Gemini API key is entered by the user in the browser and sent with each request. It is never stored server-side.

---

## State Management

No Redux or external state library. Global state is managed in `App.tsx` using React `useState`:
- `financialData: FinancialData[]` — extracted data per year
- `mdaData: MDAData[]` — MD&A sections per year
- `currentView: string` — active panel/navigation state
- `companyName: string` — detected company name
- `sector: string` — user-selected sector

Data flows downward via props. No bidirectional data flow or context (kept simple for maintainability).
