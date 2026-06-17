# AICTE SkillsBuild Internship Presentation Outline: Equity Research Pro

This document contains the complete, updated text and layout recommendations for your final internship presentation slides. It represents your development journey honestly and professionally.

---

## Slide 1: Title Slide
*   **Slide Header:** AICTE AI Internship Project Presentation
*   **Project Title:** Equity Research Pro
*   **Subtitle:** Automated Multimodal Corporate Valuation & Forensic Audit Platform for Indian Listed Companies
*   **Metadata Table:**
    *   **Student Name:** Simaran Shaikh
    *   **College:** Don Bosco College, Panjim, Goa
    *   **Degree:** Bachelor of Commerce (BCom) in Financial Accounting (Year 3)
    *   **Internship ID:** `INTERNSHIP_177546286369d369cf3ffb2`
    *   **Program:** Edunet Foundation × IBM SkillsBuild × AICTE AI Internship
    *   **Duration:** 6 Weeks (May 11 – June 21, 2026)

---

## Slide 2: The Problem Statement (The "Verification Gap")
*   **Slide Title:** The Problem: Black-Box Financial Data & Manual Scans
*   **Bullet Points:**
    *   **The Verification Gap:** Most financial platforms (e.g., Screener, Moneycontrol) present processed ratios and numbers, but never show where they came from or how they were calculated. Analysts must spend hours cross-checking figures against 400-page PDF annual reports.
    *   **Generic Metrics Misalignment:** Standard tools apply the same EBITDA and debt ratios to all companies—forcing banking institutions into frameworks where metrics like EBITDA are completely irrelevant.
    *   **Manual Extraction Overload:** Locating specific disclosures (Contingent Liabilities, Related Party Transactions, Audit Opinions) across multiple fiscal years is tedious and error-prone.
*   **Visual Suggestion:** A split slide showing a locked PDF on one side and a red "Trust but Verify" symbol on the other.

---

## Slide 3: My Role & Product Ownership (Honest Background)
*   **Slide Title:** Role Clarity: Product Direction & Logic Definition
*   **Bullet Points:**
    *   **Product Ownership:** I owned the overall product direction—identifying the verification gap, designing how the user interface should display information, and structuring what a useful, auditable report output should look like.
    *   **No Prior Coding Background:** The entire technical implementation was built using **Claude Code** and **AI-assisted development**, moving the project from an early prototype to a full-stack production-ready application.
    *   **Dynamic Financial Learning:** I started this project without a background in sector-specific financial analysis. That knowledge was acquired during development by using Claude AI to study real reports and conducting deep research on industry-specific benchmarks.
*   **Visual Suggestion:** A schematic diagram showing your input (Product Direction + Financial Scoring Logic) combining with AI-Assisted Coding (Claude Code) to produce the running application.

---

## Slide 4: Tech Stack & System Architecture
*   **Slide Title:** Full-Stack Architecture & Deployed Infrastructure
*   **Bullet Points:**
    *   **Frontend:** React 19, TypeScript, and Tailwind CSS v4, providing a responsive, glassmorphic financial dashboard.
    *   **Backend:** Node.js & Express API proxy server, handling multi-file PDF payloads and parsing JSON outputs safely without storing API keys.
    *   **AI Integration:** Google Gen AI SDK communicating with the `gemini-2.5-flash` model for high-context data extraction.
    *   **Containerization & Hosting:** Packaged using Docker and deployed on Hugging Face Spaces (running on port `7860`).
*   **Visual Suggestion:** A block architecture showing:
    `React 19 Frontend` ⇄ `Express Node.js Server` ⇄ `Gemini 2.5 API` ⇄ `Output Dashboard/DOCX/XLSX`

---

## Slide 5: Core Features (The 17-Sector Scoring Engine)
*   **Slide Title:** Key Capabilities: Sector-Specific Logic & Citations
*   **Bullet Points:**
    *   **Page-Level Citations:** Every single extracted financial metric includes its exact page number from the source annual report PDF, solving the verification gap.
    *   **17 Custom Sector Engines:** Ratios are selected and weighted based on the industry:
        *   *Banking:* Net Interest Margin (NIM), Capital Adequacy Ratio (CAR), Gross/Net NPA %.
        *   *Pharma:* R&D/Revenue %, FDA Warning Letters, Specialty Revenue %.
        *   *FMCG/Auto:* EBITDA Margin, Inventory Days, Receivable Days (DSO).
    *   **Annual Score Grading:** Computes a composite grade (A to D) based on sector performance benchmarks.
*   **Visual Suggestion:** A screenshot of the Sector-Specific Ratios tab showing page citations.

---

## Slide 6: Governance & Forensic Auditing
*   **Slide Title:** Deep Forensic Audits & Management Analysis
*   **Bullet Points:**
    *   **Forensic Flagging:** Automatically scans and scores risk indicators: promoter pledging shifts, related-party transactions (RPTs) as % of revenue, and contingent liabilities.
    *   **Auditor Checks:** Highlights changes in auditor firms, qualified opinions, or "going concern" warnings.
    *   **MD&A NarrativeDiff:** Sentence-level YoY comparison of the Management Discussion & Analysis section:
        *   🟢 **Green (+)** = disclosures added in the newer fiscal year.
        *   🔴 **Red (−)** = disclosures dropped from the previous year.
*   **Visual Suggestion:** A split visual showing the NarrativeDiff comparison screen and the Forensic Risk Flag dashboard.

---

## Slide 7: Verification, Testing & Results
*   **Slide Title:** Real-World Validation: HDFC & ICICI Banks
*   **Bullet Points:**
    *   **Real Data Testing:** Rigorously tested against the 3-year Consolidated Annual Reports of **HDFC Bank Limited** and **ICICI Bank Limited** (FY2023, FY2024, FY2025).
    *   **Accuracy Verification:** All AI-extracted numbers (e.g., Deposits, Advances, Interest Earned, Gross/Net NPA) were checked and verified against trusted portals like Screener.in.
    *   **Forensic Verification:** The forensic engine successfully identified and flagged HDFC Bank's FY2025 auditor change (from M M Nissim & Co to Price Waterhouse LLP) and their promoter pledging status.
*   **Visual Suggestion:** A table displaying HDFC Bank metrics extracted by the app vs. Screener.in data, showing a 100% match.

---

## Slide 8: Internship Learnings & Takeaways
*   **Slide Title:** Core Learnings & Professional Development
*   **Bullet Points:**
    *   **Indian Corporate Disclosures:** Learned how to navigate complex 300+ page corporate filings to locate schedules, commitments, and related party disclosures.
    *   **Regulatory Frameworks:** Gained a deep understanding of banking-specific metrics (CAR, Net NPA, NIM) governed by the Reserve Bank of India (RBI).
    *   **AI-Assisted Workflow:** Mastered prompt construction for structured data extraction and learned to audit AI outputs for scale errors (lakhs/crores conversions) and year labels.
    *   **Product Definition:** Realized that defining *what* the software should solve and *how* to verify its outputs is just as critical as writing the code.
*   **Slide Footer:** *"Proof beats paper. The right app doesn't just display data—it lets you audit it."*
