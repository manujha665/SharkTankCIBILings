# SharkTankCIBILings — PortfolioIQ

Our short-term idea of four CIBILians: an AI platform that gives lenders end-to-end portfolio monitoring, industry intelligence, benchmarking and a conversational analyst, in one place.

> **One platform for understanding what is happening in the industry, what is happening in the member's own portfolio, why the two differ, and what to do about it.**

The concept note is in [`portfolio_intelligence_ai_platform.md`](portfolio_intelligence_ai_platform.md). The working prototype is in [`app/`](app/). The demo talk track is in [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md).

⚠️ **All data in this prototype is synthetic.** No real bureau, member or borrower data is used anywhere.

---

## Run the prototype

**Option 0: one file.** [`dist/PortfolioIQ.html`](dist/PortfolioIQ.html) is the whole prototype in a single self-contained HTML file (≈225 KB, no internet needed). Email it, put it on a USB stick, double-click to open. Rebuild it after changes with `node scripts/build-single-html.js`.

**Option 1: no installation (works on locked-down laptops).** Double-click `app/index.html`. Everything works, including the AI Analyst, which runs on the built-in governed engine.

**Option 2: with the local server (needed to connect an approved LLM).**

```bash
node server.js          # Node 18+, no npm install needed
# open http://127.0.0.1:8080
```

To connect the organisation's approved LLM, see [`docs/LLM_SETUP.md`](docs/LLM_SETUP.md). If no LLM is configured, or the LLM fails mid-demo, the analyst falls back to the governed engine automatically, so the demo can't break.

## What's inside (10 modules)

| Module | What it shows | Why it matters in the pitch |
|---|---|---|
| **Command Centre** | Monday-morning view: the headline number, "is it me or the market", auto alerts, top 3 actions | Opens the story in 30 seconds |
| **Industry Intelligence** | Market trends by product, state, lender type and risk band; standard vs self-service modes with saved views | Replaces static industry reports |
| **Peer Benchmarking** | You vs a peer group vs industry; custom peer builder; state × band heatmap | Privacy guardrails enforced live |
| **Why did it change?** ⭐ | Splits any delinquency move into **mix shift / market-wide / member-specific** with a waterfall and segment table | The hero innovation: no bureau offers this self-serve |
| **What should I do?** ⭐ | Ranked, quantified recommendations, each linked to a simulation | Turns insight into decisions |
| **Policy Simulator** | Score cut-off slider → approvals, bad rate, expected loss, net contribution; best cut-off per state | "Surgical, not blanket" policy |
| **Login & Application Pulse** ⭐ | Last 5 days of applications vs the market (weekday-adjusted), risk-band mix, enquiry intensity | Earliest warning signal; no competitor shows it |
| **AI Analyst** | Chat with 67-question library, follow-ups with memory, sources on every answer, guardrails | The new interface to all of the above |
| **Bring Your Data** | Upload a CSV (e.g. sourcing channel), map fields, join to industry, get like-for-like insights | Extends the platform beyond bureau fields |
| **Board Brief** | Auto-generated, printable one-pager | Replaces the monthly deck |
| **Governance & Trust** | Tenant isolation, peer privacy rules, metric catalogue, live audit trail | Answers the "can we trust AI?" question |

## The demo story (built into the synthetic data)

*Sahyadri Bank* (a fictional mid-size private bank) loosened its personal loan cut-off from 700 to 680 in Feb 2026.

1. PL 30+ DPD rose **+77 bps** (2.10% → 2.87%) while the industry rose +28 bps.
2. **Why?** 53% mix shift, 23% market, 24% member-specific. It's mostly within the bank's control.
3. **Uttar Pradesh**: the market is deteriorating *and* the bank added risk. **Gujarat**: the market is flat; the deterioration is the bank's own.
4. **Logins**: near-prime and subprime applications in UP & Gujarat are up ~95% in 5 days, with high enquiry intensity. That's the next wave, visible now.
5. **What to do**: restore 700 in UP & Gujarat only (the simulator shows net contribution rises), add checks on the application surge, and audit sourcing in Gujarat.
6. **Bring your data**: upload the channel file and DSA-sourced near-prime in Gujarat runs at **1.56×** the market. Root cause found.
7. **Credit cards** are a strength (122 bps better than peers), so there's room to grow.

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
