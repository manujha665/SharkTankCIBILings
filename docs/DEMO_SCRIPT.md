# Demo script: PortfolioIQ (target: 7 minutes)

Before you start: open the app, press **F11** for full screen, stay in light mode (projectors wash out dark), and close the AI drawer. If you're using the server, check the header pill shows the AI mode you expect.

---

## 0:00 — The hook (no clicks, 30 sec)

> "Every Monday, a CRO asks three questions: *What changed? Is it me or the market? What do I do about it?* Today the answers are spread across Excel files, static decks and a two-week wait for the analytics team. We built the Bloomberg terminal for credit, and it answers all three in under a minute."

## 0:30 — Command Centre (60 sec)

- The page opens on the **whole portfolio** (all 10 products, all states). Point at the hero: **2.24%, up 32 bps since February, double the industry's +16 bps.**
- Read the verdict: **"Mostly you — this is within your control."** Point at the "30+ DPD by product" card: personal loans stand out.
- Flip the **30+ / 90+ / 180+** switch once to show the deeper buckets tell the same story.
- Switch **Product** to **Personal Loan**: **3.96%, up 160 bps; industry up 60.** Point at the trend line: *"We used to be 60 bps better than our peers. We've just crossed above them."* Flip to **90+**: already above the industry.
- Point at the alerts: *"Nobody asked for these. The platform found them."* Three are critical: personal loans in UP (8.2% vs 5.7% for the market) and Gujarat (6.2% vs 3.6%), and a different story, MSME in Tamil Nadu (5.9% vs 4.6%). Then call out the application surge in UP and Gujarat.

## 1:30 — Why did it change? The hero feature (75 sec)

- Click **Why did it change? →**
- Walk the waterfall: *"Start at 2.36%. The mix shift added 60 bps. The market added 23. Your own segments added 77. That's where you ended up."*
- Switch **State** to **Gujarat**: *"2.1% to 6.2%, while the market moved 35 bps. Sixty per cent of that is you."* Then switch to **Uttar Pradesh**: *"Here it's both."*
- Line: *"Same symptom, two different diseases, and two different treatments."*

## 2:45 — What should I do? → Simulator (60 sec)

- Scroll to **What should I do?** and click **Simulate →** on recommendation #1.
- Show the **"Surgical, not blanket"** table: *"A blanket move back to 700 costs money. Tighten only in UP and Gujarat and profit goes up while losses fall."*
- Drag the slider live to 720, then back.

## 3:45 — Login & Application Pulse (45 sec)

- *"Delinquency is a lagging indicator. This is the leading one."*
- Show near-prime and subprime applications up ~95% in 5 days vs ~5% for the market, and more than half of those applicants with 3+ enquiries in 30 days.
- Scroll to **Last 7 days' logins**: expected PD is 5.2% vs 4.6% before; the DSA / connector pool's PD jumped from 6.3% to 7.7%, and more logins come from high-risk PIN codes. *"This is what next quarter's delinquency looks like, today."*
- *"No bureau product shows a lender this today. We already receive the enquiries; we just aren't showing them back."*

## Optional (+90 sec) — Fresh Signals and Overlap Intelligence

- **Fresh Signals**, with Product = Personal Loan and State = Uttar Pradesh: *"The monthly file says 8.2%. Weekly submissions say 9.4% as of last Sunday. Fresh bounces are at 14.9% and climbing, so next month's file is already written."* Point at the hotspot table and the "how it gets used" cards.
- **Overlap Intelligence → Retail × Microfinance**: *"Of 8 crore microfinance borrowers, half are already visible in retail credit and a quarter are servicing both. Their retail delinquency is 2.7× everyone else's, and MFI stress reaches retail about a quarter later."* Then point at Sahyadri's own exposure table.
- Switch to **Commercial × Retail**: *"In 41% of MSME defaults, a promoter slipped on a personal loan or card first, about four months earlier. That's how we would have caught Tamil Nadu."*

## 4:30 — AI Analyst (75 sec)

Click **✦ Ask PortfolioIQ** (the drawer works from any page) and ask, in order:
1. *"What is happening in personal loans?"*
2. *"Compare that with Gujarat."* (remembers context)
3. *"Now compare it with my portfolio."* (switches to the member benchmark)
4. *"Show me HDFC's delinquency"* → **blocked.** *"Tenant isolation is built into the data layer, not just the UI. The AI can't leak what it can't reach."*

Point at the **Source / Filters / Tools** chips: *"Every number is traceable. The AI never invents a figure."*

## 5:45 — Bring Your Data (40 sec)

- **Use the sample file** → **Validate** → **Generate insights**.
- *"Sourcing channel isn't bureau data. The member uploads it, we join it to the market, and there's the root cause: DSA-sourced near-prime in Gujarat runs at 2.36× the market."*
- Mention: the file never leaves the member's tenant.

## 6:25 — Board Brief + close (35 sec)

- Open **Board Brief**: *"And the monthly deck writes itself."*
- Close: *"No new data. The same data, served in a new way: self-serve, explainable, governed, and conversational. It scales across every product, every state and every member we already serve."*

---

## Judge Q&A: likely questions

**"Isn't this just a dashboard with a chatbot?"**
No. Three things are new: (1) the decomposition that separates *your* problem from the *market's*, which is only possible because the bureau sees both sides; (2) near-real-time application benchmarking; (3) a governed AI that can only answer from approved tools, so it can't hallucinate numbers or leak another lender's data.

**"How do you stop the AI hallucinating?"**
The LLM never calculates. It picks from 16 governed tools, and the tools return the numbers. Every answer shows its source, filters and tool. If no tool fits, it says "not in the approved datasets." Guardrails run before the LLM is called.

**"How do you protect member confidentiality?"**
There are four layers: tenant isolation in the data layer; peer groups need at least 5 institutions with no single institution above 25% of balance (both demonstrated live: pick "PVT · Large" or "NBFC" in the peer group list); no borrower-level data; and a full audit trail.

**"Is it feasible?"**
The data already exists. The prototype is dependency-free and runs anywhere. The LLM layer is provider-agnostic: Claude or any OpenAI-compatible approved gateway, swapped with one setting. In production the semantic layer sits on the existing platform (OneTru / the modelling platform) and the dashboards reuse existing batch outputs.

**"How does it make money?"**
Tiered subscription: *Standard* (industry intelligence + benchmarks), *Pro* (decomposition, simulator, application pulse, AI analyst), *Enterprise* (data upload, API, custom peer groups). Add usage-based pricing for AI queries above a quota.

**"What's the ROI?"** Fill in the table below with real numbers before the pitch.

| Lever | Formula | Your assumption |
|---|---|---|
| Analyst time saved | custom requests / month × hours per request × cost / hour × % deflected | e.g. __ × __ × ₹__ × 50% |
| Faster decisions | days saved per analysis × number of analyses | "7–10 days → minutes" |
| Subscription revenue | members × adoption % × annual price per tier | __ × __% × ₹__ |
| Retention | churn avoided × average member revenue | |
| Member-side value | the simulator's "net contribution" delta, e.g. +₹0.3 Cr/month for one bank in one decision | shows value to the *customer* |

Keep assumptions conservative. Judges discount aggressive numbers.

---

## Data notes

- The demo covers every state (north-eastern states grouped, small UTs grouped) and 10 products. State and product weights are illustrative. **Check them against the latest published industry reports before quoting any figure. All numbers in the demo are synthetic.**
- Risk bands follow the familiar super-prime → subprime tiers; score ranges are illustrative.
