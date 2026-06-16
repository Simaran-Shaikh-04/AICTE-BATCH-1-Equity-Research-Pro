# Sector-Specific Financial Logic

## Why Generic Tools Fail for Indian Equity Research

Most stock screeners and financial tools apply a one-size-fits-all approach to ratio analysis. They calculate EBITDA margins, EV/EBITDA, and Debt/Equity for every company regardless of industry.

This is fundamentally wrong for at least two major sectors:

**Banks** do not have EBITDA. A bank's "revenue" is Net Interest Income — the spread between what it earns on loans and what it pays on deposits. Applying EBITDA margin analysis to ICICI Bank or HDFC Bank produces a meaningless number. The correct metrics are NIM (Net Interest Margin), GNPA % (how much of the loan book is non-performing), and CAR (Capital Adequacy Ratio, the RBI-mandated buffer).

**Pharma companies** should not be scored the same way as FMCG companies. A pharma company spending 8–10% of revenue on R&D is making a strategic investment in future pipeline, not wasting money. FMCG companies rarely have R&D. Pharma needs to be scored on R&D intensity and ANDA pipeline quality, not just EBITDA margin.

This project built 12 separate sector engines to solve this problem.

---

## The 12 Sectors and Their Logic

### 1. Banking

Indian commercial banks are regulated by RBI and must maintain specific capital and asset quality standards.

| Ratio | Why It Matters for Banks | Good Threshold | Danger Zone |
|-------|--------------------------|----------------|-------------|
| Net Interest Margin (NIM) | Core measure of lending profitability | > 3.5% | < 2.5% |
| Gross NPA % | Percentage of loans gone bad | < 2.0% | > 4.0% |
| Net NPA % | Bad loans after provisions | < 0.5% | > 2.0% |
| Capital Adequacy Ratio (CAR) | RBI-mandated buffer against losses | > 16% | < 14% |
| ROE % | Shareholder returns on equity | > 15% | < 10% |
| CFO/PAT | Quality of reported earnings (cash vs accrual) | > 1.0x | < 0.5x |

**What I learned:** ICICI Bank's GNPA improved from 2.26% to 1.73% across FY2023-25, signaling improving loan book quality. HDFC Bank's NIM compressed from 4.33% to ~3.74% partly due to HDFC Ltd merger integration.

---

### 2. NBFC (Non-Banking Financial Company)

Similar to banking but with different RBI regulations and funding structure.

| Ratio | Good Threshold |
|-------|---------------|
| NIM % | > 5% (typically higher than banks) |
| GNPA % | < 3.0% |
| CAR % | > 15% |
| Debt/Equity | < 7x |

---

### 3. Information Technology

Indian IT companies (TCS, Infosys, HCL Tech) are service businesses with minimal capital requirements.

| Ratio | Why It Matters | Good Threshold |
|-------|---------------|----------------|
| EBITDA Margin | Operating efficiency | > 25% |
| Revenue Growth YoY | Business momentum | > 12% |
| FCF | Ability to return capital to shareholders | Positive & growing |
| ROE % | Shareholder return | > 20% |
| Net PAT Margin | Bottom-line profitability | > 20% |
