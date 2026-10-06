# SharkTankCIBILings — PortfolioIQ

Our short-term idea of four CIBILians: an AI platform that gives lenders end-to-end portfolio monitoring, industry intelligence, benchmarking and a conversational analyst, in one place.

> **One platform for understanding what is happening in the industry, what is happening in the member's own portfolio, why the two differ, and what to do about it.**

The concept note is in [`portfolio_intelligence_ai_platform.md`](portfolio_intelligence_ai_platform.md). The working prototype is in [`app/`](app/). **To learn the demo, open the app and press ▶ Demo tour** (a guided, auto-playable walkthrough), then read [`docs/PRESENTER_GUIDE.md`](docs/PRESENTER_GUIDE.md) for how to explain it to different audiences. The timed talk track is in [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md). A recorded run of the tour is in [`docs/demo/PortfolioIQ-tour.webm`](docs/demo/PortfolioIQ-tour.webm) (opens in Chrome/Edge/VLC).

⚠️ **All data in this prototype is synthetic.** No real bureau, member or borrower data is used anywhere.

---

## Run the prototype

**Option 0: one file.** [`dist/PortfolioIQ.html`](dist/PortfolioIQ.html) is the whole prototype in a single self-contained HTML file (≈420 KB, no internet needed). Email it, put it on a USB stick, double-click to open. Rebuild it after changes with `node scripts/build-single-html.js`.

**Option 1: no installation (works on locked-down laptops).** Double-click `app/index.html`. Everything works, including the AI Analyst, which runs on the built-in governed engine.

**Option 2: with the local server (needed to connect an approved LLM).**

```bash
node server.js          # Node 18+, no npm install needed
# open http://127.0.0.1:8080
```

To connect the organisation's approved LLM, see [`docs/LLM_SETUP.md`](docs/LLM_SETUP.md). If no LLM is configured, or the LLM fails mid-demo, the analyst falls back to the governed engine automatically, so the demo can't break.

## Coverage

- **Products (10):** Personal Loan, Credit Card, Housing Loan, Loan Against Property, Auto Loan, Two-Wheeler Loan, Gold Loan, MSME Loan, Agri Loan, Microfinance Loan, plus **All products** (the default).
- **Geography (24):** every state individually, the 8 north-eastern states grouped as **North-East states**, Delhi (NCT), Jammu & Kashmir, and **Other UTs**, plus **All states** (the default).
- **Lender categories (8):** PSU, PVT, NBFC, Fintech, SFB, MFI, RRB/DCCB, HFC.
- **Delinquency buckets:** a 30+ / 90+ / 180+ switch in the filter bar (default 30+).

## What's inside

| Module | What it shows | Why it matters in the pitch |
|---|---|---|
| **Command Centre** | Monday-morning view led by the early-warning alerts, then the headline number, "is it me or the market" and the top 3 actions | Opens the story in 30 seconds |
| **Industry Intelligence** | Market trends by product, state, lender type and risk band; standard vs self-service modes with saved views | Replaces static industry reports |
| **Peer Benchmarking** | You vs a peer group vs industry across 8 lender categories (PSU, PVT, NBFC, Fintech, SFB, MFI, RRB/DCCB, HFC); custom peer builder; state × band heatmap | Privacy guardrails enforced live |
| **Ticket size (a measure, not a page)** | Average ticket of new loans (value disbursed ÷ new accounts, bureau-reported at opening). Switch **Measure → Ticket size** in the filter bar on the Command Centre, Industry Intelligence and Peer Benchmarking; ticket-size alerts (bigger loans to riskier borrowers), amount asked in enquiries on the login pulse, and in the AI analyst | One bureau variable every dashboard was missing |
| **Fresh Signals (weekly)** ⭐ | What weekly & fortnightly submissions add: latest DPD vs the monthly file, fresh EMI bounces, repayments vs dues, current balances, first-payment defaults, bounce hotspots, uses by team | Stress seen weeks before the monthly file |
| **Overlap Intelligence** ⭐ | Retail × Microfinance (8 Cr MFI base → 50% retail footprint → 25% live-to-live; products, states, MFI lender count, stress spill-over, member exposure) and Commercial × Retail (MSME promoters' retail loans as early warning) | Only a bureau can see these |
| **Why did it change?** ⭐ | Splits any delinquency move into **mix shift / market-wide / member-specific** with a waterfall and segment table | The hero innovation: no bureau offers this self-serve |
| **What should I do?** ⭐ | Ranked, quantified recommendations, each linked to a simulation | Turns insight into decisions |
| **Policy Simulator** | Score cut-off slider → approvals, bad rate, expected loss, net contribution; best cut-off per state. The member's **current cut-offs by product × state** can be typed into a grid or imported as CSV (long or wide layout), with a feasibility assessment on the page | "Surgical, not blanket" policy |
| **Login & Application Pulse** ⭐ | Last 5 days of applications vs the market (weekday-adjusted), enquiry intensity, plus a **last 7 / 15 / 30 days** quality check (dropdown): applicants with more than one enquiry on the same day, score banding, expected probability of default, PIN-code risk tier (high / medium / low), the applicant's bureau credit profile (new to credit, thin file, established, already leveraged, existing customer) and the loan amount requested. Everything comes from bureau enquiry and tradeline data | Earliest warning signal; no competitor shows it |
| **AI Analyst** | Chat or **speak** (🎤 voice input), 70-question library, follow-ups with memory, sources on every answer, guardrails | The new interface to all of the above |
| **Bring Your Data** | Four upload buttons for bureau Portfolio Review outputs (**Consumer PR, Commercial PR, Microfinance PR, MFI + Consumer PR**), each with its own layout, sample file and analysis computed from that file alone; plus custom files with the bank's own fields (e.g. approval route) joined to industry | Extends the platform beyond bureau fields |
| **Action Board** ⭐ | Pin anything from any module (📌 buttons or right-click → "Send to Action Board"; highlight text to send just that). Each action keeps its source module and filters, gets priority, owner, due date, status and notes; export to CSV, print, feeds the Board Brief | Insight → action in one click |
| **Board Brief** | Auto-generated, printable one-pager | Replaces the monthly deck |
| **Governance & Trust** | Tenant isolation, peer privacy rules, metric catalogue, live audit trail | Answers the "can we trust AI?" question |

## The demo story (built into the synthetic data)

*Sahyadri Bank* (a fictional mid-size private bank with a ₹93,000 Cr book across 10 products) loosened its personal loan cut-off from 700 to 680 in Feb 2026.

0. **Whole portfolio** (the default view): 30+ DPD rose **+32 bps** (1.91% → 2.24%), double the industry's +16 bps; 52% of it is member-specific. The top contributing segments are all personal loans in UP and Gujarat.
1. **Personal loans**: 30+ DPD rose **+160 bps** (2.36% → 3.96%) vs +60 bps for the industry. Sahyadri is now worse than its PVT peers (3.81%), and on **90+ DPD it has crossed above the industry** (2.14% vs 2.05%). The hotspots are stark: **UP 8.2% vs industry 5.7%**, **Gujarat 6.2% vs 3.6%**. A second story sits in **MSME, Tamil Nadu: 5.9% vs 4.6%** (a collections breakdown).
2. **Why?** 38% mix shift, 14% market, 48% member-specific. It's mostly within the bank's control.
3. **Uttar Pradesh**: the market is deteriorating *and* the bank added risk. **Gujarat**: the market is flat; the deterioration is the bank's own.
4. **Logins**: near-prime and subprime applications in UP & Gujarat are up ~95% in 5 days, with high enquiry intensity. The **last 7 days' logins** carry an expected PD of 5.2% vs 4.6% before (UP personal loans: 8.8%), driven by **already-leveraged applicants** (3+ live loans in the bureau) and **high-risk PIN codes**. Their near-prime and subprime PL tickets are also **1.5× the market's** (UP: ₹2.0 L → ₹2.9 L since Feb). That's the next wave, visible now.
5. **What to do**: restore 700 in UP & Gujarat only (the simulator shows net contribution rises), add checks on the application surge, and audit approvals in Gujarat.
6. **Bring your data**: upload the bank's own approval-route file: near-prime loans in Gujarat that were auto-approved with no manual review run at **2.36×** the market. Root cause found.
7. **Credit cards** are a strength (203 bps better than PVT · Mid-size peers), so there's room to grow.

## Architecture

```text
 Browser (no build step, no external libraries)
 ├── Views: dashboards, simulator, upload, brief ──┐
 ├── AI Analyst (chat) ──► guardrails ──► intent router or approved LLM
 │                                              │ (LLM only picks tools & phrases)
 │                                              ▼
 └────────────────────────────────► Governed semantic layer (semantic.js)
                                      metrics catalogue · peer privacy gate
                                      decomposition · simulator · audit log
                                              ▼
                                     Approved datasets (synthetic here)
 server.js (optional): static files + /api/llm gateway (keeps the key server-side)
```

| File | Role |
|---|---|
| `app/js/data.js` | Seeded synthetic data generator (industry, member, peers, daily logins, score bins) |
| `app/js/semantic.js` | The governed layer: every number goes through it. Metrics, peer privacy gate, decomposition, simulator, alerts, audit |
| `app/js/insights.js` | Recommendation engine and narratives |
| `app/js/charts.js` | Dependency-free SVG charts with hover tooltips and table twins |
| `app/js/agent/engine.js` | AI tools, guardrails, intent router, conversation context |
| `app/js/agent/llm.js` | Approved-LLM tool-use loop |
| `server.js` | Zero-dependency server + LLM gateway (Claude Messages API or any OpenAI-compatible gateway) |

To rename the product or the demo bank, edit `app/js/config.js`.
