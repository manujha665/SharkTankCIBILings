# How to demo and explain PortfolioIQ

**Start here:** open `PortfolioIQ.html` (double-click, no internet needed) and press **▶ Demo tour** in the top bar.
The tour clicks through the whole story, spotlights what to look at and shows what to say. Keys: **→** next, **←** back, **P** auto-play, **Esc** exit.
To learn the demo, run the tour two or three times on auto-play, then present it yourself. No laptop handy? Watch the recorded run: `docs/demo/PortfolioIQ-tour.webm` (about 3 minutes; open in Chrome, Edge or VLC).

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
| 1 | Command Centre (All products) | 30+ DPD **2.24%, +32 bps** vs industry **+16 bps** | "Her whole book, one screen." |
| 2 | Verdict + split bar | **Mostly you**: 36% mix · 13% market · 52% own | "The first question answered for her." |
| 3 | Alerts | PL **UP 8.2% vs 5.7%**, PL **Gujarat rising, market flat**, **MSME Tamil Nadu 5.9% vs 4.6%** | "Nobody had to ask." |
| 4 | Product = Personal Loan | **3.96%, +160 bps** vs +60; blue line **crosses above peers**; 90+ above industry | "They used to beat their peers." |
| 5 | Why did it change? | Waterfall: 2.36% → +60 mix → +23 market → +77 own → 3.96% | "Only a bureau can calculate the market leg." |
| 6 | Why · Gujarat | **2.1% → 6.2%**, market +35 bps, 61% member-specific | "Same symptom, different disease." |
| 7 | What should I do? | Ranked, quantified actions | "Every insight ends in an action." |
| 8 | Policy Simulator | Tighten only UP & Gujarat: **~+₹0.45 Cr/month**; blanket tightening loses money | "Surgical, not blanket." |
| 9 | Login & Application Pulse | Weak-band PL apps in UP **+95% in 5 days** vs +5%; last-7-day expected PD **5.2% vs 4.6%**; already-leveraged applicants + high-risk PIN codes (all bureau data) | "The next wave, visible today." |
| 9b | Command Centre · Measure → Ticket size | Near-prime & subprime PL tickets **1.5× the market's**; UP ₹2.0 L → ₹2.9 L since Feb | "Bigger loans to riskier borrowers." |
| 10 | Fresh Signals (PL, UP) | Monthly file **8.2%**, weekly **9.4%**; bounces **14.9%** | "Weekly beats monthly." |
| 11 | Overlap · Retail × MFI | **8 Cr** MFI borrowers → **50%** retail footprint → **25%** live-to-live; retail DPD **2.7×** | "Only a bureau sees this." |
| 12 | Overlap · MSME promoters | **41%** of MSME defaults preceded by a promoter's retail slip, **~4 months** earlier; Tamil Nadu tops the watchlist | "Promoters slip first." |
| 13 | Bring Your Data | Auto-approved near-prime loans in Gujarat (bank's own approval-route file) at **2.36×** the market | "Root cause found." |
| 14 | AI Analyst | Follow-ups keep context; the **HDFC question is refused** | "Plain English, safely." |
| 15 | Action Board | Everything pinned, with owner and date | "Insight to action in one click." |
| 16 | Governance | Tenant isolation, peer privacy, audit trail | "Trust is the product." |
| 17 | Board Brief | Auto-written monthly pack | "The deck writes itself." |

**Time guide:** steps 1–8 in 4 minutes is the core pitch. Steps 9–17 are for a longer demo or Q&A. Skip 11–13 if short on time.

---

## 3. Explaining the key ideas in plain words

**"Is it me or the market?" (mix / market / member-specific)**
Think of a cricket team whose average score drops. Either you picked more tail-enders (**mix**), the pitch got harder for every team (**market**), or your batsmen scored less than other teams' batsmen on the same pitch (**member-specific**). Each has a different fix: team selection, patience, or coaching.

**Why weekly data matters**
A monthly bureau file is like last month's bank statement. Weekly submissions are like the SMS alerts: you see a bounced EMI in days, not six weeks.

**Why overlaps matter**
A lender sees only its own borrowers. The bureau sees the same person holding a microfinance loan, a gold loan and a phone EMI, or a business owner whose personal card is slipping before the business does.

**Why the AI is safe**
The AI doesn't calculate or invent numbers. It chooses from a fixed set of approved "tools" that do the maths, and it shows its source every time. Questions about other lenders are blocked before the AI even sees them.

---

## 4. Tailor it to the audience

| Audience | Lead with | Go deep on |
|---|---|---|
| Judges / leadership | The 30-second pitch, then steps 1–8 | Business model, scalability, why only a bureau can build it |
| Risk / credit teams | Why did it change + Simulator | Method (mix/rate split), PD model, PIN tiers |
| Business / sales | Command Centre + Overlaps (growth pools) | Graduation pipeline, cross-sell, CC headroom (**203 bps** better than peers) |
| Tech / IT | Governance + AI Analyst | Governed tools, tenant isolation, no dependencies, pluggable approved LLM |
| Compliance | Governance | Peer privacy rules (≥5 institutions, ≤25% share), no borrower-level data, audit trail |

---

## 5. Likely questions (short answers)

- **Is this real data?** No, it's fully synthetic and says so on every screen. The logic runs unchanged on real data.
- **Can the AI hallucinate?** It can only call governed tools that return the numbers; every answer shows its source. No tool fits = "not in the approved data".
- **How is privacy protected?** Tenant isolation in the data layer, anonymised peers with minimum-size and dominance rules, no borrower-level data, a full audit log.
- **Is it feasible?** The data exists; the prototype needs no installation; the AI layer is provider-agnostic (any approved LLM).
- **How does it make money?** Tiered subscription (Standard / Pro / Enterprise) plus usage-based AI queries.
- **What's the PD model?** Illustrative: score-band default rate × PIN-code tier × the applicant's bureau credit profile. In production, the bureau's own scorecards.
- **Where do the MFI overlap numbers come from?** 8 Cr base, 50% footprint, 25% live-to-live are the team's working estimates; other overlap figures are illustrative.

---

## 6. Presenting tips

- Press **F11** for full screen; use light mode on projectors.
- Before presenting: open **Action Board** and clear it, so it fills up live as you pin things.
- If anything goes wrong, press **▶ Demo tour** and let it carry you.
- Keep a copy of `PortfolioIQ.html` on a USB stick and in your email.
- Practise the 30-second pitch until you can say it without the screen.
