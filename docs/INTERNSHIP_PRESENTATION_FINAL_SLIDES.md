# Capstone Project Presentation: Equity Research Pro
## Program: Edunet Foundation × IBM SkillsBuild × AICTE AI Internship (May–Jun 2026)

This document provides the complete slide-by-slide text content for your final capstone presentation PPT. It follows the required template outline and expands it where necessary to show the depth of your work.

---

## Slide 1: Title Slide (Cover)
*   **Slide Category:** CAPSTONE PROJECT
*   **Project Title:** Equity Research Pro
*   **Project Subtitle:** Automated Multimodal Corporate Valuation & Forensic Audit Platform for Indian Listed Companies
*   **Presented By:**
    1.  **Student Name:** Simaran Shaikh
    2.  **College Name:** Don Bosco College, Panjim, Goa
    3.  **Department/Degree:** Bachelor of Commerce (BCom) in Financial Accounting (Year 3)
    4.  **Internship ID:** `INTERNSHIP_177546286369d369cf3ffb2`
*   **Logo/Branding:** Edunet Foundation & IBM SkillsBuild

---

## Slide 2: Outline
*   **Slide Title:** OUTLINE
*   **Content:**
    *   **Problem Statement:** The "Verification Gap" and Manual Data Challenges in Finance
    *   **Proposed System/Solution:** Equity Research Pro & Page-Level Auditability
    *   **System Approach:** Full-Stack Architecture & AI-Assisted Implementation
    *   **Core Logic Engines (Extended):**
        *   *17-Sector Ratio Benchmarking Rules*
        *   *Forensic Audit Flagging Rules*
        *   *MD&A NarrativeDiff comparison*
    *   **Algorithm & Deployment:** Extraction pipeline and Hugging Face deployment
    *   **Result & Validation:** Live testing on HDFC and ICICI Bank (FY23-FY25) reports
    *   **Conclusion & Learnings:** Academic takeaways in corporate accounting & RBI rules
    *   **Future Scope:** DCF models and live market data integrations
    *   **References & Repository Links**

---

## Slide 3: Problem Statement
*   **Slide Title:** Problem Statement (No Solution Details)
*   **Key Points:**
    *   **The Verification Gap:** Most financial websites (e.g., Screener.in, Moneycontrol) present processed numbers and ratios, but they do not tell you where the numbers came from or how they were calculated. Analysts must search through 400-page annual reports to check them.
    *   **Generic Metric Frameworks:** Traditional analytics apply the same rigid metrics (e.g., EBITDA, Debt-to-Equity) to all sectors. This completely fails for banking and financial companies where EBITDA is a meaningless metric.
    *   **Governance & Audit Blindspots:** Warning indicators like changes in audit firms, qualified audit opinions, promoter pledge increases, and related-party transactions are buried in extensive schedules and routinely missed in manual scans.
    *   **Manual Data Gathering:** Financial analysts spend 10 to 15 hours per company manually extracting, validating, and structuring data from multi-year PDF annual reports.

---

## Slide 4: Proposed Solution
*   **Slide Title:** Proposed Solution: Equity Research Pro
*   **Key Points:**
    *   **Page-Level Citations:** Bridges the verification gap by mapping every extracted data point directly back to its exact source page in the annual report PDF. Users can audit figures instantly.
    *   **Simultaneous Multi-Year Parsing:** Supports simultaneous uploading of 3 fiscal years of PDF annual reports (Consolidated or Standalone formats).
    *   **Seventeen Sector-Specific Ratio Engines:** Automatically identifies the company's sector and applies custom ratios and grading rules (e.g., banking regulations vs. manufacturing).
    *   **Automated Forensic Scanner:** Extracts and evaluates risk variables (Contingent Liabilities, Related Party Transactions, Promoter Pledges, Auditor Opinions) and flags warnings.
    *   **DOCX & XLSX Model Export:** One-click generation of fully structured corporate reports and spreadsheet-based financial models.

---

## Slide 5: System Approach & Tech Stack
*   **Slide Title:** System Approach: Full-Stack Architecture
*   **Key Points:**
    *   **Frontend Layer:** Built using React 19, TypeScript, and Tailwind CSS v4, providing a responsive, glassmorphic dashboard with interactive tabs.
    *   **Backend Layer:** Express/Node.js API proxy server that processes multi-file payloads, handles files, and acts as a secure intermediary for API keys.
    *   **AI Integration:** Deployed the Google Gen AI SDK communicating with the `gemini-2.5-flash` model utilizing custom JSON schemas for structured extraction.
    *   **Containerization:** Configured a Docker environment for deployment.
    *   **AI-Assisted Implementation:** As a BCom student with no prior coding background, the application was successfully built from early prototype to production using **Claude Code** and AI-assisted development, while I owned the **product direction, UX/UI, and validation logic**.

---

## Slide 6: Extended Detail — The 17-Sector Ratio Engine
*   **Slide Title:** Core Logic: Sector-Specific Financial Rules
*   **Key Points:**
    *   **Industry Customization:** Ratios are analyzed in the context of the business model. Standard corporate margins do not apply to finance.
    *   **Ratios Selection Breakdown:**
        *   *Banking & NBFCs:* Net Interest Margin (NIM), Capital Adequacy Ratio (CAR), Gross NPA %, Net NPA %, and Cash Flow from Operations (CFO) to Profit After Tax (PAT).
        *   *Pharmaceuticals:* R&D/Revenue % and scans for FDA warning letters.
        *   *FMCG & Durables:* Operating efficiency (Inventory Days, Receivable Days/DSO, ROCE).
    *   **Composite Scoring:** Ratios are matched against poor/good/excellent benchmarks and translated into annual letter grades (A, B+, B, C, D) using a weighted average scoring model.

---

## Slide 7: Extended Detail — Governance & Forensic Audit Rules
*   **Slide Title:** Core Logic: Forensic Accounting Risk Rules
*   **Key Points:**
    *   **Auditor Stability Scan:** Scans the Auditor Report schedule. Flags auditor changes, qualified audit opinions, and "going concern" statements.
    *   **Related Party Transactions (RPT):** Automatically parses the RPT disclosure table. Sums transaction values and flags warnings if they exceed a defined percentage of total revenue.
    *   **Promoter Pledging Analysis:** Checks for promoter pledges. Flags warning indicators if the percentage of shares pledged rises over the 3-year timeline.
    *   **Contingent Liabilities:** Extracts commitments and checks off-balance-sheet risks as a percentage of total corporate revenue.

---

## Slide 8: Extended Detail — Narrative Analytics & NarrativeDiff
*   **Slide Title:** Core Logic: MD&A Text Analysis
*   **Key Points:**
    *   **MD&A Extraction:** Automatically separates Management Discussion & Analysis (MD&A) sections (Business Overview, Corporate Highlights, Key Opportunities, Risks & Concerns).
    *   **The NarrativeDiff Engine:** Compares MD&A text year-over-year at the sentence level to identify changes in management disclosures:
        *   🟢 **Green (+):** Disclosures added in the newer fiscal year.
        *   🔴 **Red (−):** Disclosures quietly dropped from the previous year.
    *   **Strategic Advantage:** Alerts analysts when a company removes a risk warning or adds new negative disclosures.

---

## Slide 9: Algorithm & Deployment Workflow
*   **Slide Title:** Algorithm & Parsing Pipeline
*   **Key Points:**
    *   **Step 1: Input:** User enters a free Gemini API key, selects the sector (or sets to Auto), and uploads annual report PDFs.
    *   **Step 2: Schema Request:** The Express server calls the Gemini 2.5 Flash API with a prompt containing a strict JSON schema and page citation instructions.
    *   **Step 3: Multimodal Processing:** Gemini processes the PDF files (using its 2M+ context window) to locate, extract, and structure data points.
    *   **Step 4: Ratio Calculations:** Backend processes the JSON data, calculates the sector-specific ratios, performs text-diffing, and grades performance.
    *   **Step 5: Deployment:** Packaged and deployed inside a Docker container on Hugging Face Spaces for public access.

---

## Slide 10: Result & Validation Case Study
*   **Slide Title:** Results & Real-World Validation
*   **Key Points:**
    *   **Real Data Testing:** Rigorously tested against the 3-year Consolidated Annual Reports of **HDFC Bank Limited** and **ICICI Bank Limited** (FY2023, FY2024, FY2025).
    *   **Accuracy Verification:** Checked all extracted balance sheet and P&L figures against trusted financial portals (Screener.in) to guarantee a 100% extraction match.
    *   **Auditor Alert Validation:** The forensic engine successfully identified and flagged HDFC Bank's FY2025 auditor shift (from M M Nissim & Co to Price Waterhouse LLP) and verified the related page number instantly.

---

## Slide 11: Conclusion & Key Learnings
*   **Slide Title:** Conclusion & Internship Learnings
*   **Key Points:**
    *   **Indian Corporate Accounting:** Learned to navigate complex 300+ page corporate reports to locate Balance Sheets, schedules, commitments, and related party disclosures.
    *   **Regulatory Frameworks:** Understood banking-specific metrics (CAR, Net NPA, NIM) governed by the Reserve Bank of India (RBI).
    *   **AI-Assisted Workflow:** Mastered prompt construction for structured data extraction and learned to audit AI outputs for scale errors (lakhs/crores conversions) and year labels.
    *   **Product Definition:** Realized that defining *what* the software should solve and *how* to verify its outputs is just as critical as writing the code.

---

## Slide 12: Future Scope
*   **Slide Title:** Future Scope & Extensions
*   **Key Points:**
    *   **Intrinsic Valuation Models:** Integrating Discounted Cash Flow (DCF) calculators directly beside ratio analysis.
    *   **Live Market Data:** Connecting live stock APIs (BSE/NSE) to overlay real-time P/E, P/B, and dividend yield indicators.
    *   **Multi-Company Screener:** Allowing side-by-side sector benchmarking across multiple companies on a single interface.
    *   **SEC 10-K Filings:** Expanding extraction support to US SEC 10-K and UK Companies House reports.

---

## Slide 13: References
*   **Slide Title:** References & Sources
*   **Content:**
    *   *Google Gemini API Documentation:* Google AI Studio developer guidelines.
    *   *Hugging Face Spaces:* Docker SDK container orchestration docs.
    *   *Reserve Bank of India (RBI) Regulations:* Capital Adequacy Ratio (CAR) and NPA guidelines.
    *   *Screener.in:* Historical financial statement data for model verification.
    *   *Edunet Foundation & IBM SkillsBuild:* Capstone project templates.

---

## Slide 14: Github & Deployment Link
*   **Slide Title:** Project Links & Repository
*   **Content:**
    *   **GitHub Repository:** [github.com/Simaran-Shaikh-04/AICTE-BATCH-1-Equity-Research-Pro](https://github.com/Simaran-Shaikh-04/AICTE-BATCH-1-Equity-Research-Pro)
    *   **Live Space Deployment:** [huggingface.co/spaces/LumoraX/equity-research-pro](https://huggingface.co/spaces/LumoraX/equity-research-pro)
    *   **Portfolio Page:** [simaran-shaikh-04.github.io](https://simaran-shaikh-04.github.io)

---

## Slide 15: Thank You (Q&A)
*   **Slide Title:** THANK YOU
*   **Content:**
    *   *“Thank you for this learning opportunity.”*
    *   **Simaran Shaikh** — simaranshaikh04@gmail.com
    *   Open for Questions and Answers.
