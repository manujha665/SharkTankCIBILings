/*
 * Glossary: every term and calculation used in PortfolioIQ, in plain English.
 *  - PIQ.glossary.TERMS: the list (term, other names, group, meaning, how it is worked out)
 *  - PIQ.glossary.decorate(el): marks known terms inside el so hovering shows a short explanation bubble
 *  - the Glossary page (Trust section) lists everything, with search
 */
(function () {
  const PIQ = window.PIQ;
  const T = (term, alias, cat, def, calc) => ({ term, alias: alias || [], cat, def, calc: calc || '' });
  const TERMS = [
    // Delinquency & collections
    T('DPD', ['days past due'], 'Delinquency & collections', 'Days past due: how many days a borrower is late on a payment.', 'Counted from the EMI due date.'),
    T('30+ DPD', ['30+ DPD rate', '30+'], 'Delinquency & collections', 'The share of the loan book where the borrower is at least 30 days late. The earliest standard sign of stress.', 'Balance on loans 30 or more days late ÷ total balance, by value, at month end.'),
    T('90+ DPD', ['90+ DPD rate', '90+'], 'Delinquency & collections', 'The share of the loan book at least 90 days late. At 90 days a loan is usually classed as non-performing (NPA).', 'Balance on loans 90 or more days late ÷ total balance.'),
    T('180+ DPD', ['180+ DPD rate', '180+'], 'Delinquency & collections', 'The share of the book at least 180 days late: deep delinquency, close to a write-off.', 'Balance on loans 180 or more days late ÷ total balance.'),
    T('Delinquency', ['delinquency rate'], 'Delinquency & collections', 'Borrowers falling behind on payments. On these screens it means the 30+, 90+ or 180+ DPD rate you pick in the filter bar.'),
    T('Cure rate', ['collection cure rate', 'cure'], 'Delinquency & collections', 'Of the borrowers who were 30–89 days late last month, the share who caught up and became current this month. Higher is better: it shows collections are working.', 'Accounts that returned to current ÷ accounts that were 30–89 DPD a month earlier.'),
    T('Roll-forward', ['roll rate', '90+ ÷ 30+'], 'Delinquency & collections', 'How much of the early delinquency has already slipped into later buckets. A high number means collections are not curing accounts early.', '90+ DPD balance ÷ 30+ DPD balance.'),
    T('NPA', ['non-performing asset'], 'Delinquency & collections', 'A loan that has stopped earning: generally 90 or more days overdue under RBI rules.'),
    T('SMA-0', [], 'Delinquency & collections', 'Special Mention Account 0: a commercial loan 1–30 days overdue. The first early-warning stage before NPA.'),
    T('SMA-1', [], 'Delinquency & collections', 'Special Mention Account 1: a commercial loan 31–60 days overdue.'),
    T('SMA-2', [], 'Delinquency & collections', 'Special Mention Account 2: a commercial loan 61–90 days overdue, the last stop before NPA. A rising SMA-2 book means next quarter\'s NPAs.'),
    T('PAR 30', ['PAR30'], 'Delinquency & collections', 'Portfolio at risk, 30 days: the share of a microfinance portfolio with a payment 30+ days late. The microfinance version of 30+ DPD.', 'Outstanding of loans 30+ days late ÷ gross loan portfolio.'),
    T('PAR 90', ['PAR90'], 'Delinquency & collections', 'Portfolio at risk, 90 days: the share of a microfinance portfolio 90+ days late.'),
    T('EMI bounce', ['bounce rate', 'fresh bounces', 'bounces'], 'Delinquency & collections', 'An EMI that failed to collect (cheque, mandate or auto-debit returned). Bounces show up in weekly data weeks before they become 30+ DPD.', 'Bounced EMIs ÷ EMIs due in the week.'),
    T('First-payment default', ['FPD'], 'Delinquency & collections', 'A new loan whose very first EMI is missed. Often a sign of fraud or a badly sourced loan rather than hardship.'),
    // "Is it me or the market?"
    T('Mix shift', ['mix effect', 'riskier mix'], 'Why did it change?', 'The part of a change in delinquency caused by your book moving towards riskier segments (for example more near-prime loans), even if each segment performed the same.', 'Change in each segment\'s share × its delinquency rate, summed over segments.'),
    T('Market-wide', ['market effect', 'market-wide change', 'market-wide deterioration'], 'Why did it change?', 'The part of the change that would have happened anyway, because the same segments got worse across the whole market.', 'Your starting rate × how much the industry rate moved in the same product, state and risk band.'),
    T('Member-specific', ['member-specific performance', 'own effect'], 'Why did it change?', 'The part of the change that is yours alone: your loans did worse than other lenders\' loans in exactly the same segments. This is the part you can fix.', 'Total change − mix shift − market-wide effect.'),
    T('Decomposition', ['mix / market / member-specific'], 'Why did it change?', 'Splitting a change in delinquency into three causes: mix shift, market-wide and member-specific. Answers "is it me or the market?"'),
    T('bps', ['basis points', 'basis point'], 'Why did it change?', 'Basis points. 100 bps = 1 percentage point. A move from 2.00% to 2.32% is +32 bps.'),
    T('Percentage points', ['pp'], 'Why did it change?', 'The plain difference between two percentages. 30% to 34% is +4 percentage points (not +4%).'),
    // Risk & scores
    T('Risk band', ['score band', 'risk bands'], 'Risk & scores', 'Borrowers grouped by bureau score: Super-prime, Prime-plus, Prime, Near-prime and Subprime.'),
    T('Super-prime', [], 'Risk & scores', 'Bureau score 791 and above: the lowest-risk borrowers.'),
    T('Prime-plus', [], 'Risk & scores', 'Bureau score 761–790: very low risk.'),
    T('Prime', [], 'Risk & scores', 'Bureau score 721–760: low risk.'),
    T('Near-prime', [], 'Risk & scores', 'Bureau score 681–720: moderate risk.'),
    T('Subprime', [], 'Risk & scores', 'Bureau score 680 and below: the highest-risk borrowers.'),
    T('Probability of default', ['PD', 'expected PD', 'expected probability of default'], 'Risk & scores', 'The chance a borrower goes 90+ days late within 12 months. Used to judge how risky new applications are before they are booked.', 'In the prototype: score-band default rate × PIN-code tier × bureau credit profile. In production, the bureau\'s own scorecards.'),
    T('PIN-code risk tier', ['PIN-code risk', 'high-risk PIN codes', 'medium-risk PIN codes', 'low-risk PIN codes', 'PIN tier'], 'Risk & scores', 'Every PIN code graded high, medium or low risk from its bureau-wide 90+ DPD history. Shows whether a lender is lending more in riskier localities.'),
    T('Score cut-off', ['cut-off', 'cutoff'], 'Risk & scores', 'The minimum bureau score a lender accepts for a product. Raising it cuts risk and volume; lowering it does the opposite.'),
    T('Bad rate', ['expected bad rate'], 'Risk & scores', 'The share of approved loans expected to go 90+ days late within 12 months.'),
    // Applications
    T('Logins', ['login', 'applications'], 'Applications & enquiries', 'Loan applications, seen through the credit enquiries lenders make at the bureau when someone applies.'),
    T('Enquiry', ['enquiries', 'credit enquiry'], 'Applications & enquiries', 'A check a lender runs on the bureau when someone applies for credit. Many enquiries in a short time can signal credit hunger.'),
    T('3+ enquiries', ['3+ enquiries in 30d', 'enquiry intensity'], 'Applications & enquiries', 'Applicants who made three or more credit enquiries in the last 30 days.'),
    T('Same-day enquiries', ['more than one enquiry on the same day', 'same-day 2+ enq.'], 'Applications & enquiries', 'Applicants who made two or more credit enquiries on the same day, at any lender: a sign of rate-shopping or of stacking several loans before the bureau updates.'),
    T('Approval rate', [], 'Applications & enquiries', 'The share of applications that were approved.', 'Approved applications ÷ applications.'),
    T('Bureau credit profile', ['credit profile'], 'Applications & enquiries', 'What the applicant\'s bureau record looks like at the time of applying: new to credit, thin file, established, already leveraged, or an existing customer.'),
    T('New to credit', ['NTC'], 'Applications & enquiries', 'An applicant with no credit history in the bureau.'),
    T('Thin file', [], 'Applications & enquiries', 'An applicant with only one or two accounts in the bureau.'),
    T('Established', [], 'Applications & enquiries', 'An applicant with three or more accounts and at most two live loans.'),
    T('Already leveraged', ['leveraged'], 'Applications & enquiries', 'An applicant who already has three or more live loans in the bureau.'),
    T('Existing customer', [], 'Applications & enquiries', 'An applicant who already has a live loan with you, as you report it to the bureau.'),
    T('Weekday-adjusted', ['weekday-matched baseline'], 'Applications & enquiries', 'Comparing each day with the same weekday in earlier weeks, so a quiet Sunday is not mistaken for a drop.'),
    // Ticket size & book
    T('Average ticket size', ['ticket size', 'avg ticket', 'ticket'], 'Ticket size & book', 'The average loan amount at the time a loan is opened. Bigger loans to riskier borrowers raise the loss on every default.', 'Value disbursed ÷ number of new accounts opened, as reported to the bureau. Cards use the sanctioned limit.'),
    T('Amount asked', ['amount requested', 'avg loan amount requested'], 'Ticket size & book', 'The loan amount an applicant asked for, as stated in the credit enquiry.'),
    T('Recent disbursements', ['disbursed in the last', 'vintage'], 'Ticket size & book', 'A filter that shows only loans disbursed in the last 3, 6, 9 or 12 months, so you can see how new lending performs compared with the whole book.', 'Each month\'s disbursals, reduced for repayments; young loans have had less time to go late, which the figures reflect.'),
    T('Outstanding balance', ['balance'], 'Ticket size & book', 'The total principal still owed on live loans at month end.'),
    T('Originations', ['disbursals', 'disbursed', 'monthly originations'], 'Ticket size & book', 'New loans disbursed (or new cards issued) in the month, by value.'),
    T('Market share', [], 'Ticket size & book', 'Your outstanding balance as a share of the whole market\'s, for the same product and state.'),
    T('Active accounts', ['live accounts'], 'Ticket size & book', 'Open accounts with a balance or activity in the month.'),
    // Benchmarking
    T('Industry', ['industry rate', 'the market'], 'Benchmarking', 'All lenders reporting to the bureau, added together. Never shows any single lender.'),
    T('Peer group', ['peers'], 'Benchmarking', 'An anonymous group of lenders similar to you, for example private banks of a similar size. Shown only as a combined figure.'),
    T('Peer privacy rule', ['privacy rule', 'privacy check'], 'Benchmarking', 'A peer figure appears only if the group has at least 5 lenders and no single lender is more than 25% of it, so no one can be identified.'),
    T('Like for like', ['like-for-like'], 'Benchmarking', 'Comparing the same product, state and risk band, so differences in mix do not distort the comparison.'),
    T('PSU', [], 'Benchmarking', 'Public sector banks.'),
    T('PVT', [], 'Benchmarking', 'Private sector banks.'),
    T('NBFC', [], 'Benchmarking', 'Non-banking financial companies.'),
    T('Fintech', [], 'Benchmarking', 'Fintech lenders.'),
    T('SFB', [], 'Benchmarking', 'Small finance banks.'),
    T('MFI', ['microfinance institution'], 'Benchmarking', 'Microfinance institutions (and microfinance lending in general).'),
    T('RRB/DCCB', [], 'Benchmarking', 'Regional rural banks and district central co-operative banks.'),
    T('HFC', [], 'Benchmarking', 'Housing finance companies.'),
    // Overlaps & PR
    T('Live-to-live', ['live-to-live overlap'], 'Overlaps & Portfolio Reviews', 'A borrower repaying a microfinance loan and a retail loan at the same time.'),
    T('Retail footprint', ['consumer footprint', 'consumer-credit footprint'], 'Overlaps & Portfolio Reviews', 'A microfinance borrower who also appears in retail credit: an enquiry, a live loan or a closed loan.'),
    T('Graduation pool', [], 'Overlaps & Portfolio Reviews', 'Microfinance borrowers with a clean record and no retail loans yet: ready for a first gold loan, two-wheeler or small personal loan.'),
    T('CMR', ['CIBIL MSME Rank', 'CMR band'], 'Overlaps & Portfolio Reviews', 'CIBIL MSME Rank: a 1–10 risk rank for businesses. CMR-1 is the lowest risk, CMR-10 the highest.'),
    T('Portfolio Review', ['PR'], 'Overlaps & Portfolio Reviews', 'The bureau\'s Portfolio Review report on a lender\'s book. Upload it on Bring Your Data (Consumer, Commercial, Microfinance or MFI + Consumer) to get its story in seconds.'),
    T('Promoter', ['promoters', 'directors'], 'Overlaps & Portfolio Reviews', 'The owners, directors or partners of a business. Their personal credit often slips before the business does.'),
    T('Weekly submissions', ['weekly data', 'fortnightly submissions', 'weekly / fortnightly'], 'Overlaps & Portfolio Reviews', 'Lenders sending updates to the bureau every week or fortnight instead of monthly, so stress shows up weeks earlier.'),
    // Policy & economics
    T('Net contribution', [], 'Policy & money', 'What a lending policy earns after funding cost, running cost and expected credit loss, per month.', 'Disbursal × (yield − cost of funds − opex) − expected credit loss.'),
    T('Expected credit loss', ['expected loss', 'exp. loss'], 'Policy & money', 'The money a lender expects to lose on loans that go bad.', 'Disbursal × bad rate × loss given default.'),
    T('Loss given default', ['LGD'], 'Policy & money', 'The share of a defaulted loan that is never recovered.'),
    T('Yield', [], 'Policy & money', 'The annual interest a loan earns, as a percentage of the amount lent.'),
    T('Cost of funds', [], 'Policy & money', 'What the lender pays to borrow the money it lends out.'),
    T('Opex', [], 'Policy & money', 'Operating expenses: the cost of running the lending business.'),
    // Data & governance
    T('Tenant isolation', [], 'Data & trust', 'Each lender can only ever see its own data. Enforced in the data layer, so no screen or AI question can reach another lender\'s numbers.'),
    T('Synthetic data', ['synthetic demo data'], 'Data & trust', 'Made-up data that behaves like real data. Everything in this prototype is synthetic; no real borrower or lender data is used.'),
    T('Governed tools', ['governed engine'], 'Data & trust', 'The fixed set of approved calculations the AI analyst is allowed to use. The AI picks a tool and explains the result; it never invents numbers.'),
    T('Audit trail', [], 'Data & trust', 'A log of every question asked and every calculation run, by a person or by the AI.'),
    T('Action Board', [], 'Data & trust', 'Your to-do list of things spotted on any page, with owner, priority, due date and status.')
  ];

  // ---------- term lookup ----------
  const byKey = new Map();
  const names = [];
  TERMS.forEach((t, i) => { t.id = 'g' + i; [t.term].concat(t.alias).forEach((n) => { const k = n.toLowerCase(); if (!byKey.has(k)) { byKey.set(k, t); names.push(n); } }); });
  // ambiguous short words only when written exactly (case-sensitive)
  const EXACT = new Set(['PR', 'PD', 'MFI', 'PSU', 'PVT', 'NBFC', 'SFB', 'HFC', 'NPA', 'CMR', 'NTC', 'LGD', 'FPD', 'DPD', 'bps', 'RRB/DCCB']);
  const SKIP_ALONE = new Set(['pp', 'ticket', 'balance', 'industry', 'peers', 'applications', 'login', 'disbursed', 'leveraged', 'established', 'prime', 'cure', 'cutoff', '30+', '90+', '180+', 'directors', 'promoters', 'vintage', 'the market', 'bounces', 'expected loss', 'enquiries', 'logins']);
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  const ordered = names.filter((n) => !SKIP_ALONE.has(n.toLowerCase())).sort((a, b) => b.length - a.length);
  const ci = ordered.filter((n) => !EXACT.has(n)), cs = ordered.filter((n) => EXACT.has(n));
  const RE_CI = new RegExp('(?<![\\w+-])(' + ci.map(esc).join('|') + ')(?![\\w+-])', 'gi');
  const RE_CS = new RegExp('(?<![\\w+/-])(' + cs.map(esc).join('|') + ')(?![\\w/-])', 'g');
  const lookup = (txt) => byKey.get(txt.toLowerCase());

  // ---------- decorate: wrap known terms so hovering explains them ----------
  const SKIP = 'button, a, input, textarea, select, option, svg, script, style, code, .gl, .nav, .side, .tour-box, .chat-input, .bubble-gl, .brand, .filters label, .glossary-page .gl-term, .gl-alias, .sev-label, .tag, .pill, .badge, .src-chip, .seg';
  function decorate(root) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (!n.nodeValue.trim() || (n.parentElement && n.parentElement.closest(SKIP)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const text = node.nodeValue, ownCard = node.parentElement && node.parentElement.closest('.gl-card');
      const hits = [];
      [RE_CI, RE_CS].forEach((re) => { re.lastIndex = 0; let m; while ((m = re.exec(text))) hits.push({ i: m.index, s: m[0] }); });
      if (!hits.length) return;
      hits.sort((a, b) => a.i - b.i || b.s.length - a.s.length);
      const frag = document.createDocumentFragment();
      let pos = 0;
      hits.forEach((h) => {
        if (h.i < pos) return; // overlapping match
        const t = lookup(h.s);
        if (!t || (ownCard && ownCard.id === 'gl-' + t.id)) return; // no self-links inside a glossary card
        if (h.i > pos) frag.appendChild(document.createTextNode(text.slice(pos, h.i)));
        const span = document.createElement('span');
        span.className = 'gl';
        span.dataset.term = t.id;
        span.textContent = h.s;
        frag.appendChild(span);
        pos = h.i + h.s.length;
      });
      if (!pos) return;
      if (pos < text.length) frag.appendChild(document.createTextNode(text.slice(pos)));
      node.parentNode.replaceChild(frag, node);
    });
  }

  // ---------- hover bubble ----------
  let bubble = null, hideTimer = null, current = null;
  const byId = new Map(TERMS.map((t) => [t.id, t]));
  function ensureBubble() {
    if (bubble) return bubble;
    bubble = document.createElement('div');
    bubble.className = 'bubble-gl';
    bubble.setAttribute('role', 'tooltip');
    document.body.appendChild(bubble);
    bubble.addEventListener('mouseenter', () => clearTimeout(hideTimer));
    bubble.addEventListener('mouseleave', scheduleHide);
    return bubble;
  }
  function show(el) {
    const t = byId.get(el.dataset.term);
    if (!t) return;
    clearTimeout(hideTimer);
    const b = ensureBubble();
    b.innerHTML = '';
    const h = document.createElement('div'); h.className = 'bg-term'; h.textContent = t.term; b.appendChild(h);
    const p = document.createElement('div'); p.className = 'bg-def'; p.textContent = t.def; b.appendChild(p);
    if (t.calc) { const c = document.createElement('div'); c.className = 'bg-calc'; c.textContent = 'How it\'s worked out: ' + t.calc; b.appendChild(c); }
    const a = document.createElement('button'); a.type = 'button'; a.className = 'bg-more'; a.textContent = 'Open in glossary →';
    a.addEventListener('click', () => { hide(true); PIQ.go('glossary', { term: t.id }); });
    b.appendChild(a);
    b.classList.add('on');
    const r = el.getBoundingClientRect(), bw = Math.min(340, window.innerWidth - 24);
    b.style.width = bw + 'px';
    let left = r.left + r.width / 2 - bw / 2;
    left = Math.max(12, Math.min(window.innerWidth - bw - 12, left));
    b.style.left = left + 'px';
    const below = r.bottom + 10, bh = b.offsetHeight;
    b.style.top = (below + bh > window.innerHeight - 8 ? Math.max(8, r.top - bh - 10) : below) + 'px';
    current = el;
  }
  function scheduleHide() { clearTimeout(hideTimer); hideTimer = setTimeout(() => hide(), 220); }
  function hide(now) { if (!bubble) return; bubble.classList.remove('on'); current = null; if (now) clearTimeout(hideTimer); }
  document.addEventListener('mouseover', (e) => { const el = e.target.closest && e.target.closest('.gl'); if (el && el !== current) show(el); else if (el) clearTimeout(hideTimer); });
  document.addEventListener('mouseout', (e) => { const el = e.target.closest && e.target.closest('.gl'); if (el && !(e.relatedTarget && (e.relatedTarget.closest('.bubble-gl') || e.relatedTarget.closest('.gl') === el))) scheduleHide(); });
  document.addEventListener('focusin', (e) => { if (e.target.classList && e.target.classList.contains('gl')) show(e.target); });
  window.addEventListener('scroll', () => hide(true), true);

  // ---------- Glossary page ----------
  let query = '';
  function render(root, params) {
    const { h, pageHead } = PIQ.ui;
    pageHead(root, 'Glossary', 'Every term and calculation used in PortfolioIQ, in plain English. Hover over a dotted-underlined term anywhere in the app to see its meaning without leaving the page.');
    const wrap = h('div', 'glossary-page', root);
    const bar = h('div', 'gl-search', wrap);
    const inp = h('input', null, bar);
    inp.type = 'search'; inp.placeholder = 'Search a term, e.g. cure rate, ticket size, SMA-2…'; inp.value = query;
    inp.setAttribute('aria-label', 'Search the glossary');
    const count = h('span', 'small muted', bar);
    const list = h('div', null, wrap);
    const cats = [...new Set(TERMS.map((t) => t.cat))];
    const draw = () => {
      list.innerHTML = '';
      const q = query.trim().toLowerCase();
      const match = (t) => !q || [t.term].concat(t.alias).some((n) => n.toLowerCase().includes(q)) || t.def.toLowerCase().includes(q);
      let n = 0;
      cats.forEach((c) => {
        const items = TERMS.filter((t) => t.cat === c && match(t));
        if (!items.length) return;
        n += items.length;
        h('div', 'section-title', list, c);
        const g = h('div', 'gl-grid', list);
        items.forEach((t) => {
          const card = h('div', 'card gl-card', g);
          card.id = 'gl-' + t.id;
          h('div', 'gl-term', card, t.term);
          if (t.alias.length) h('div', 'small muted gl-alias', card, 'Also: ' + t.alias.join(', '));
          h('p', 'gl-def', card, t.def);
          if (t.calc) { const c2 = h('p', 'gl-calc', card); h('strong', null, c2, 'How it\'s worked out: '); c2.appendChild(document.createTextNode(t.calc)); }
        });
      });
      count.textContent = `${n} of ${TERMS.length} terms`;
      if (!n) h('p', 'muted', list, 'No term matches. Try a shorter word.');
    };
    inp.addEventListener('input', () => { query = inp.value; draw(); });
    draw();
    if (params && params.term) {
      query = ''; inp.value = ''; draw();
      setTimeout(() => { const el = document.getElementById('gl-' + params.term); if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 2200); } }, 50);
    }
  }

  PIQ.glossary = { TERMS, decorate, lookup };
  PIQ.views = PIQ.views || {};
  PIQ.views.glossary = { title: 'Glossary', render };
})();
