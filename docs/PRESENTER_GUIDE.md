# How to demo and explain PortfolioIQ

**Start here:** open `PortfolioIQ.html` (double-click, no internet needed) and press **▶ Demo tour** in the top bar.
The tour clicks through the whole story, spotlights what to look at and shows what to say. Keys: **→** next, **←** back, **P** auto-play, **Esc** exit.
To learn the demo, run the tour two or three times on auto-play, then present it yourself. No laptop handy? Watch the recorded run: `docs/demo/PortfolioIQ-tour.webm` (about 4 minutes; open in Chrome, Edge or VLC).

All numbers below are from the synthetic demo data and are also computed live inside the tour.

---

## 1. The 30-second explanation (use this with anyone)

> "Lenders have plenty of credit data but get their intelligence as static Excel files and decks, weeks late. PortfolioIQ turns the bureau's data into one self-serve platform that answers three questions every CRO asks: **What changed? Is it me or the market? What should I do?** It has an AI analyst that answers in plain English, only from approved data, and it can't leak another lender's numbers."

**Why only a bureau can build it:** the "is it me or the market" answer needs *every lender's* loans in the same segment, and so do overlaps like microfinance × retail. That's the moat.

---

## 2. The story (one bank, one bad decision)

*Sahyadri Bank* (fictional, mid-size private bank, ₹93,000 Cr book across 10 products) loosened its personal-loan score cut-off from **700 to 680 in Feb 2026**. The platform shows the consequences before the monthly file does, explains them and recommends a fix.

| Step | Screen | What the audience sees | The line |
|---|---|---|---|
| 1 | Portfolio Pulse (All products) | 30+ DPD **2.24%, +32 bps** vs industry **+16 bps** | "Her whole book, one screen." |
| 2 | Verdict + split bar | **Mostly you**: 36% mix · 13% market · 52% own | "The first question answered for her." |
| 3 | Early-warning alerts | PL **UP 8.2% vs 5.7%**, PL **Gujarat rising, market flat**, **MSME Tamil Nadu 5.9% vs 4.6%** | "Nobody had to ask." |
| 4 | Product = Personal Loan | **3.96%, +160 bps** vs +60; blue line **crosses above peers**; 90+ above industry | "They used to beat their peers." |
| 5 | Filters: Recent disbursements = 6 months (+ PIN-code risk = High) | Loans disbursed in the last 6 months at **3.38% vs 2.78%** for the market's loans of the same age; in high-risk PIN codes **7.41% vs 5.54%** | "It's the new loans." |
| 6 | Why did it change? | Waterfall: 2.36% → +60 mix → +23 market → +77 own → 3.96% | "Only a bureau can calculate the market leg." |
| 7 | Why · Gujarat | **2.1% → 6.2%**, market +35 bps, 61% member-specific | "Same symptom, different disease." |
| 8 | What should I do? | Ranked, quantified actions | "Every insight ends in an action." |
| 9 | Policy Simulator | Tighten only UP & Gujarat: **~+₹0.45 Cr/month**; blanket tightening loses money | "Surgical, not blanket." |
| 10 | Logins Pulse | Weak-band PL apps in UP **+95% in 5 days** vs +5%; last-7-day expected PD **5.2% vs 4.6%**; already-leveraged applicants + high-risk PIN codes (all bureau data) | "The next wave, visible today." |
| 11 | Portfolio Pulse · Measure → Ticket size | Near-prime & subprime PL tickets **1.5× the market's**; UP ₹2.0 L → ₹2.9 L since Feb | "Bigger loans to riskier borrowers." |
| 12 | Fresh Signals (PL, UP) | Monthly file **8.2%**, weekly **9.4%**; bounces **14.9%** | "Weekly beats monthly." |
| 13 | Overlap · Retail × MFI | **8 Cr** MFI borrowers → **50%** retail footprint → **25%** live-to-live; retail DPD **2.7×** | "Only a bureau sees this." |
| 14 | Overlap · MSME promoters | **41%** of MSME defaults preceded by a promoter's retail slip, **~4 months** earlier; Tamil Nadu tops the watchlist | "Promoters slip first." |
| 15 | Bring Your Data | Auto-approved near-prime loans in Gujarat (bank's own approval-route file) at **2.36×** the market | "Root cause found." |
| 16 | AI Analyst | Follow-ups keep context; the **HDFC question is refused**; type or 🎤 speak | "Plain English, safely." |
| 17 | Action Board | Everything pinned, with owner and date | "Insight to action in one click." |
| 18 | Governance | Tenant isolation, peer privacy, audit trail | "Trust is the product." |
| 19 | Glossary | **80 terms** in plain English, each with how it's worked out; search filters as you type | "No jargon left unexplained." |
| 20 | Board Brief | Auto-written monthly pack | "The deck writes itself." |

**Time guide:** steps 1–9 in about 4½ minutes is the core pitch. Steps 10–20 are for a longer demo or Q&A. Skip 13–15 if short on time; step 5 (the filters) is worth keeping, it's a 20-second wow.

---

## 3. Explaining the key ideas in plain words

**"Is it me or the market?" (mix / market / member-specific)**
Think of a cricket team whose average score drops. Either you picked more tail-enders (**mix**), the pitch got harder for every team (**market**), or your batsmen scored less than other teams' batsmen on the same pitch (**member-specific**). Each has a different fix: team selection, patience, or coaching.

**Why weekly data matters**
A monthly bureau file is like last month's bank statement. Weekly submissions are like the SMS alerts: you see a bounced EMI in days, not six weeks.

**Why overlaps matter**
A lender sees only its own borrowers. The bureau sees the same person holding a microfinance loan, a gold loan and a phone EMI, or a business owner whose personal card is slipping before the business does.

**Why the two filters matter (Recent disbursements, PIN-code risk)**
A whole loan book mixes five-year-old loans with last month's. If you only look at the total, a bad new policy hides behind a good old book. The **Recent disbursements** filter shows only loans made in the last 3, 6, 9 or 12 months, compared with the market's loans of the same age. Young loans haven't had time to go 90 days late, so the platform adjusts for that and the comparison stays fair. **PIN-code risk** does the same for geography: show only borrowers in high-risk localities and see if you're doing worse than other lenders there.

**Why the AI is safe**
The AI doesn't calculate or invent numbers. It chooses from a fixed set of approved "tools" that do the maths, and it shows its source every time. Questions about other lenders are blocked before the AI even sees them.

---

## 4. Tailor it to the audience

| Audience | Lead with | Go deep on |
|---|---|---|
| Judges / leadership | The 30-second pitch, then steps 1–8 | Business model, scalability, why only a bureau can build it |
| Risk / credit teams | Why did it change + Simulator + the Recent disbursements filter | Method (mix/rate split), vintage seasoning, PD model, PIN tiers |
| Business / sales | Portfolio Pulse + Overlaps (growth pools) | Graduation pipeline, cross-sell, CC headroom (**203 bps** better than peers) |
| Tech / IT | Governance + AI Analyst | Governed tools, tenant isolation, no dependencies, pluggable approved LLM |
| Compliance | Governance | Peer privacy rules (≥5 institutions, ≤25% share), no borrower-level data, audit trail |

---

## 5. Likely questions (short answers)

- **Is this real data?** No, it's fully synthetic and says so on every screen. The logic runs unchanged on real data.
- **Can the AI hallucinate?** It can only call governed tools that return the numbers; every answer shows its source. No tool fits = "not in the approved data".
- **How is privacy protected?** Tenant isolation in the data layer, anonymised peers with minimum-size and dominance rules, no borrower-level data, a full audit log.
- **Is it feasible?** The data exists; the prototype needs no installation; the AI layer is provider-agnostic (any approved LLM).
- **How does it make money?** Tiered subscription (Standard / Pro / Enterprise) plus usage-based AI queries.
- **How do the vintage and PIN filters work?** In production they read the disbursal month and PIN code that lenders already report. In the prototype they're modelled: each month's disbursals reduced for repayments, a seasoning curve for delinquency, and a bureau-wide PIN-code risk grade. Industry and peers are filtered the same way; alerts and the AI analyst always use the whole book.
- **What's the PD model?** Illustrative: score-band default rate × PIN-code tier × the applicant's bureau credit profile. In production, the bureau's own scorecards.
- **Where do the MFI overlap numbers come from?** 8 Cr base, 50% footprint, 25% live-to-live are the team's working estimates; other overlap figures are illustrative.

---

## 6. Presenting tips

- Press **F11** for full screen; use light mode on projectors.
- Charts draw themselves each time you open a page (filter clicks stay instant). Press **M** to switch motion off if the projector stutters.
- Before presenting: open **Action Board** and clear it, so it fills up live as you pin things.
- If anything goes wrong, press **▶ Demo tour** and let it carry you.
- Keep a copy of `PortfolioIQ.html` on a USB stick and in your email.
- Practise the 30-second pitch until you can say it without the screen.
