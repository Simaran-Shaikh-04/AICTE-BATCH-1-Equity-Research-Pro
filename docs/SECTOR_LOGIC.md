# Sector-Specific Financial Logic

## Why Generic Tools Fail for Indian Equity Research

Most stock screeners and financial tools apply a one-size-fits-all approach to ratio analysis. They calculate EBITDA margins, EV/EBITDA, and Debt/Equity for every company regardless of industry.

This is fundamentally wrong for key sectors:
*   **Banks & NBFCs** do not have EBITDA. A bank's "revenue" is Net Interest Income (interest earned minus interest paid). Operating profitability is measured by Net Interest Margin (NIM). Risk is captured by asset quality (Gross NPA % & Net NPA %) and Capital Adequacy Ratio (CAR), which measures the regulatory buffer.
*   **Insurers** do not print traditional operating lines. Life insurers are evaluated on Value of New Business (VNB) and Embedded Value (IEV). General insurers are evaluated on Combined Ratio (loss ratio + expense ratio).
*   **Asset-Heavy / Utilities (Power, Infra, Ports)** rely on capacity utilisation (Plant Load Factor), execution risk (CWIP/Total Assets), and order books rather than simple margin matrices.

This platform implements **17 separate sector engines** to model industry reality accurately.

---

## The 17 Sectors and Their Logic

### 1. General Sector (Default)
Standard logic for manufacturing and diversified companies.

| Metric | Good Threshold | Danger Zone | Why It Matters |
|---|---|---|---|
| EBITDA Margin | > 25% | < 8% | Operational profit margin |
| Net PAT Margin | > 15% | < 3% | Bottom-line profitability |
| Debt/Equity (D/E) | < 0.3x | > 1.5x | Leverage risk |
| ROE % | > 20% | < 5% | Return on shareholder equity |
| ROCE % | > 20% | < 8% | Return on capital employed |
| CFO / PAT | > 1.2x | < 0.5x | Cash conversion quality |

---

### 2. Banking
Indian commercial banks regulated by the RBI.

| Metric | Good Threshold | Danger Zone | Why It Matters |
|---|---|---|---|
| NIM % | > 3.5% | < 2.5% | Yield spread on lending |
| Gross NPA % | < 2.0% | > 4.0% | Bad loans in portfolio |
| Net NPA % | < 0.5% | > 2.0% | Bad loans net of provisions |
| CAR % | > 18% | < 12% | Capital buffer vs assets |
| ROE % | > 15% | < 10% | Profitability relative to equity |
| CFO / PAT | > 1.0x | < 0.5x | Quality of reported profits |

---

### 3. NBFC (Non-Banking Financial Companies)
Lenders without banking licenses. Similar to banking but with different leverage and funding rules.

| Metric | Good Threshold | Danger Zone | Why It Matters |
|---|---|---|---|
| NIM % | > 5.0% | < 2.5% | Typically higher spreads than banks |
| Gross NPA % | < 3.0% | > 4.0% | Asset quality benchmark |
| CAR % | > 18% | < 12% | Capital adequacy requirements |
| ROAA % | > 3.0% | < 1.5% | Return on Average Assets |
| Debt/Equity | < 7x | - | NBFC leverage is naturally high |

---

### 4. Insurance
Life and general (non-life) insurance businesses.

*   **Solvency Ratio (Both):** Good if >2.0x / 200%. Danger if below IRDAI minimum of 1.5x / 150%.
*   **General Insurance (Combined Ratio):** Good if <100% (indicates underwriting profit). Danger if >110% (underwriting loss).
*   **Life Insurance (VNB Margin):** Value of New Business Margin. Good if >27%, Danger if <18%.
*   **Life Insurance (13M Persistency):** Policy retention. Good if >87%, Danger if <78%.

---

### 5. Information Technology (IT)
Asset-light, service-driven companies.

| Metric | Good Threshold | Danger Zone | Why It Matters |
|---|---|---|---|
| EBITDA Margin | > 20% | < 8% | Pricing power and cost management |
| Attrition Rate % | < 15% | > 25% | Human capital stability |
| Rev / Employee | - | - | Employee utilization productivity |
| ROE % | > 20% | < 5% | Return on low equity base |

---

### 6. Pharma
Research-intensive sector requiring capital for pipelines and clinical trials.

| Metric | Good Threshold | Danger Zone | Why It Matters |
|---|---|---|---|
| EBITDA Margin | > 20% | < 8% | Operating profitability |
| R&D / Revenue % | > 8% | < 3% | Investment in pipeline innovation |
| US FDA Warnings | 0 letters | > 0 | Regulatory compliance flag |
| Specialty % | Higher is better | - | Share of high-margin complex drugs |

---

### 7. FMCG (Fast-Moving Consumer Goods)
High cash conversion and rapid working capital cycles.

*   **Key Metrics:** EBITDA Margin (Good >25%), Inventory Days, DSO (days), ROE, ROCE, Cash Conversion (CFO/PAT).

---

### 8. Consumer Durables
Retail and white-goods brands.

*   **Key Metrics:** EBITDA Margin (Good >25%), Inventory Days, DSO (days), ROE (Good >20%).

---

### 9. Auto / OEM
Capital-intensive manufacturing with cyclical sales volumes.

| Metric | Good Threshold | Danger Zone | Why It Matters |
|---|---|---|---|
| EBITDA Margin | > 25% | < 8% | Asset utilization profitability |
| Operating Margin % | > 12% | < 8% | Core operating efficiency |
| EBITDA / Unit | - | - | Per-vehicle earnings power |
| Inventory Days | - | - | Working capital velocity |

---

### 10. Capital Goods
Heavy engineering, project execution, and equipment manufacturing.

*   **Key Metrics:** EBITDA Margin (Good >25%), Order Book (growth and size), Inventory Days, DSO (days).

---

### 11. Metal
Commodity cyclical businesses.

| Metric | Good Threshold | Danger Zone | Why It Matters |
|---|---|---|---|
| EBITDA Margin | > 18% | < 8% | Operating leverage during cycles |
| Capacity Util. % | > 85% | < 60% | Plant efficiency and production |
| Inventory Days | - | - | Raw material and stock control |

---

### 12. Chemicals
Specialty and commodity chemical producers.

*   **Key Metrics:** EBITDA Margin (Good >25%), Capacity Utilisation %, R&D / Revenue % (strategic differentiation).

---

### 13. Infrastructure / E&C
High leverage, execution timelines, and large working capital requirements.

*   **Order Book / Revenue:** Tracked (Warning if >5x, indicating potential execution bottlenecks).
*   **CWIP / Total Assets:** Danger if >50% (under-construction assets dragging down ROA).
*   **Interest Coverage (EBITDA / Interest):** Danger if <1.5x (inability to service project debt).

---

### 14. Energy
Oil, gas, and commodity refining.

*   **Key Metrics:** EBITDA Margin (Good >25%), Capex, D/E Ratio (Good <5x).

---

### 15. Power / Utilities
Regulated utility models with stable returns but massive capital investment.

| Metric | Good Threshold | Danger Zone | Why It Matters |
|---|---|---|---|
| PLF % (Load Factor) | > 80% | < 65% | Power plant utilization |
| Availability % (PAF) | > 80% | < 80% | Regulated capacity charge eligibility |
| Regulated RoE % | ~15.5% (CERC) | - | Target regulated return |
| Receivable Days | < 60 days | > 90 days | Payment risk from state DISCOMs |

---

### 16. Real Estate
Developers characterized by long cycles where cash collections matter more than P&L revenue.

| Metric | Good Threshold | Danger Zone | Why It Matters |
|---|---|---|---|
| Collections / Pre-sales | > 70% | < 70% | Real cash generation vs bookings |
| Net Debt / Equity | < 0.3x | > 1.0x | Net leverage buffer |
| Embedded EBITDA Margin | > 25% | < 20% | Projected margin on booked projects |
| Pre-sales YoY Growth | Positive | Negative | Booking momentum |

---

### 17. Ports & Logistics
High-margin infrastructure concessions.

| Metric | Good Threshold | Danger Zone | Why It Matters |
|---|---|---|---|
| Capacity Util. % | > 75% | < 55% | Port terminal throughput efficiency |
| Port EBITDA Margin | > 55% | < 45% | Operational cash flow conversion |
| Net Debt / EBITDA | < 1.5x | > 3.5x | Cash flow leverage ratio |
| Realisation / Tonne | - | - | Pricing power per cargo tonne |
