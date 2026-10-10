/*
 * Guided demo tour. Walks through the pitch story: navigates, sets filters, spotlights the element
 * to look at and shows the talking points. Numbers are computed live, so the script never goes stale.
 * Keys: → / Space next, ← back, Esc exit, P play / pause.
 */
(function () {
  const PIQ = window.PIQ;
  const S = PIQ.sem, D = PIQ.data, C = PIQ.config;
  const pct = (x, d) => (x * 100).toFixed(d == null ? 2 : d) + '%';
  const bps = (x) => Math.round(x * 1e4) + ' bps';
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const byTitle = (t) => [...document.querySelectorAll('#view .card')].find((c) => { const h = c.querySelector('h3, h4'); return h && h.textContent.includes(t); });
  const q = (sel) => document.querySelector(sel);
  const clickText = (t) => { const b = [...document.querySelectorAll('#view button')].find((x) => x.textContent.includes(t)); if (b) b.click(); };

  function numbers() {
    const t = S.latest(), t0 = C.policyChangeMonth;
    const all = S.decompose({ p: 'ALL', s: 'ALL', t0, t1: t });
    const pl = S.decompose({ p: 'PL', s: 'ALL', t0, t1: t, dim: 'sb' });
    const gj = S.decompose({ p: 'PL', s: 'GJ', t0, t1: t, dim: 'b' });
    const v = (src, p, s, m) => S.value(src, m || 'dpd30', { p, s, m: t });
    const hf = PIQ.hf.latest({ p: 'PL', s: 'UP' }, 'weekly');
    const lq = S.loginQuality7({});
    const up = S.loginCompare({ p: 'PL', s: 'UP', b: ['NP', 'SB'] }, 5);
    const ov = PIQ.overlap.retailMfi(), ms = PIQ.overlap.msmeRetail();
    const share = (x) => { const T = Math.abs(x.mix) + Math.abs(x.market) + Math.abs(x.own); return [x.mix, x.market, x.own].map((y) => Math.round((Math.abs(y) / T) * 100)); };
    const simA = S.simulate('PL', 'UP', 680), simB = S.simulate('PL', 'UP', 700), simG0 = S.simulate('PL', 'GJ', 680), simG1 = S.simulate('PL', 'GJ', 700);
    return {
      all, pl, gj, allSplit: share(all), plSplit: share(pl), gjSplit: share(gj),
      plPeer: S.peerValue('mid-pvt', 'dpd30', { p: 'PL' }), pl90: v('member', 'PL', 'ALL', 'dpd90'), ind90: v('industry', 'PL', 'ALL', 'dpd90'),
      up: v('member', 'PL', 'UP'), upInd: v('industry', 'PL', 'UP'), tn: v('member', 'MSME', 'TN'), tnInd: v('industry', 'MSME', 'TN'),
      hf, monthlyUP: v('member', 'PL', 'UP'), lq, upSurge: up,
      simGain: simB.netCr - simA.netCr + simG1.netCr - simG0.netCr, simLoss: simA.expLossCr - simB.expLossCr + simG0.expLossCr - simG1.expLossCr,
      ov, ms, cc: S.peerValue('mid-pvt', 'dpd30', { p: 'CC' }) - v('member', 'CC', 'ALL')
    };
  }

  function steps(N) {
    const worstProf = N.lq.mem.profiles.map((x, i) => ({ x, pr: N.lq.memPrior.profiles[i] })).sort((a, b) => (b.x.pd - b.pr.pd) * b.x.share - (a.x.pd - a.pr.pd) * a.x.share)[0];
    const S = PIQ.sem, F = PIQ.ui.fmt, tt = S.latest(), W = ['NP', 'SB'];
    const tk = (src, ff, m) => S.value(src, 'ats', Object.assign({ p: 'PL' }, ff, { m }));
    const upW0 = tk('member', { s: 'UP', b: W }, PIQ.config.policyChangeMonth), upW1 = tk('member', { s: 'UP', b: W }, tt), upWi = tk('industry', { s: 'UP', b: W }, tt);
    const wR = tk('member', { b: W }, tt) / tk('industry', { b: W }, tt);
    return [
      { view: 'overview', state: { p: 'ALL', s: 'ALL', dpd: 'dpd30', measure: 'dpd' }, target: () => q('.split-bar') && q('.split-bar').closest('.card'),
        title: 'The Monday-morning question',
        say: `"It's Monday, 9am. Priya, CRO of ${C.member.name}, opens one screen. Her whole ₹${Math.round(S.value('member', 'bal', { m: S.latest() })).toLocaleString('en-IN')} Cr book: 30+ DPD is ${pct(N.all.R1)}, up ${bps(N.all.delta)} since February, double the industry's ${bps(N.all.indDelta)}."`,
        tip: 'Start on the whole portfolio: all products, all states. That is the default view.' },
      { view: 'overview', target: () => q('.callout.insight'),
        title: 'Is it me or the market?',
        say: `"The platform answers the first question for her: mostly you. ${N.allSplit[0]}% of the rise is a riskier mix, ${N.allSplit[1]}% the market, ${N.allSplit[2]}% her own loans doing worse than the same loans elsewhere."`,
        tip: 'Point at the three-colour bar: blue = mix, green = market, orange = member-specific.' },
      { view: 'overview', target: () => q('.alerts-hero'),
        title: 'Early-warning alerts, nobody had to ask',
        say: `"Three critical alerts found themselves: personal loans in Uttar Pradesh at ${pct(N.up)} vs ${pct(N.upInd)} for the market, Gujarat rising while its market is flat, and MSME in Tamil Nadu at ${pct(N.tn)} vs ${pct(N.tnInd)}. Plus weekly bounces, application surges and ticket-size jumps. This panel is the first thing she sees."`,
        tip: 'Each alert has Open (go to the analysis) and 📌 (send to the Action Board).' },
      { view: 'overview', state: { p: 'PL' }, target: () => q('.split-bar') && q('.split-bar').closest('.card').querySelector('.viz'),
        title: 'Personal loans crossed the line',
        say: `"Switch to personal loans: ${pct(N.pl.R1)}, up ${bps(N.pl.delta)} vs ${bps(N.pl.indDelta)} for the industry. Sahyadri used to beat its peers comfortably. The blue line has now crossed above them (${pct(N.plPeer)}), and on 90+ it is already worse than the whole industry (${pct(N.pl90)} vs ${pct(N.ind90)})."`,
        tip: 'Point at where the blue line crosses the orange peer line after the dotted "PL cut-off loosened" marker.' },
      { view: 'why', state: { p: 'PL', s: 'ALL' }, target: () => byTitle('DPD rate: from'),
        title: 'Why did it change? The hero feature',
        say: `"Here's the waterfall. Start at ${pct(N.pl.R0)}. The riskier mix added ${bps(N.pl.mix)}, the market ${bps(N.pl.market)}, Sahyadri's own segments ${bps(N.pl.own)}. They add up exactly to ${pct(N.pl.R1)}. Only a bureau can calculate the market leg, because it sees every lender's loans in the same segment."`,
        tip: 'If asked "how": share × rate decomposition; market = industry change in the same product-state-band.' },
      { view: 'why', state: { p: 'PL', s: 'GJ' }, target: () => q('#view .grid.g-2-1 > .card:nth-child(2)'),
        title: 'Same symptom, different disease',
        say: `"Now Gujarat: ${pct(N.gj.R0)} to ${pct(N.gj.R1)}, while the Gujarat market moved just ${bps(N.gj.indDelta)}. ${N.gjSplit[2]}% is member-specific. The economy didn't do this; the way these loans were approved did."`,
        tip: 'Contrast with Uttar Pradesh, where the market is also deteriorating: two states, two different fixes.' },
      { view: 'why', state: { p: 'PL', s: 'ALL' }, target: () => q('.reco'),
        title: 'What should I do?',
        say: '"Every insight ends in a ranked, quantified action, and each one opens the simulation that backs it."',
        tip: 'Click 📌 Add to actions on one of these live; it lands on the Action Board.' },
      { view: 'simulator', state: { p: 'PL', s: 'ALL' }, target: () => byTitle('Surgical'),
        title: 'Surgical, not blanket',
        say: `"A blanket move back to a 700 cut-off costs money. Tightening only in Uttar Pradesh and Gujarat adds about ₹${N.simGain.toFixed(2)} Cr a month in net contribution and cuts expected losses by ₹${N.simLoss.toFixed(2)} Cr a month."`,
        tip: 'Drag the cut-off slider live; the curves and the table update instantly.' },
      { view: 'logins', state: { p: 'ALL', s: 'ALL' }, target: () => q('.callout.danger'),
        title: 'The next wave, visible today',
        say: `"Delinquency lags. Applications don't. Weak-band personal loan applications in Uttar Pradesh are up ${Math.round(N.upSurge.mem.change * 100)}% in five days vs ${Math.round(N.upSurge.ind.change * 100)}% for the market. Across the book, last week's logins carry an expected probability of default of ${pct(N.lq.mem.pd, 1)} vs ${pct(N.lq.memPrior.pd, 1)} before, driven by ${worstProf.x.name.split(' (')[0].toLowerCase()} applicants and high-risk PIN codes. Every one of these signals comes from bureau enquiry data, nothing extra to submit."`,
        tip: 'Scroll to show same-day multiple enquiries, score banding, PD distribution, PIN-code risk tiers and the bureau credit-profile table. Switch the Logins dropdown to 15 or 30 days.' },
      { view: 'overview', state: { p: 'PL', s: 'ALL', measure: 'ats' }, target: () => q('.ticket-risk') && q('.ticket-risk').closest('.card'),
        title: 'Bigger loans to riskier borrowers',
        say: `"Ticket size is the variable everyone forgets. Sahyadri's near-prime and subprime personal loans are ${wR.toFixed(2)}× the market's ticket size. In Uttar Pradesh they went from ${F.inr(upW0)} to ${F.inr(upW1)} since February, while the market sits at ${F.inr(upWi)}. Riskier borrowers, bigger loans: the loss per default goes up too."`,
        tip: 'Ticket size is a measure, not a page: flip Measure → Ticket size in the filter bar on the Command Centre, Industry Intelligence or Peer Benchmarking. It also raises its own early-warning alerts.' },
      { view: 'fresh', state: { p: 'PL', s: 'UP', measure: 'dpd' }, target: () => q('.callout'),
        title: 'Weekly beats monthly',
        say: `"The August monthly file says ${pct(N.monthlyUP)} in Uttar Pradesh. Weekly submissions say ${pct(N.hf.mem.now.dpd30)} as of last Sunday, with fresh EMI bounces at ${pct(N.hf.mem.now.bounce, 1)} and climbing. Next month's file is already written; weekly data lets you act now."`,
        tip: 'Toggle Weekly / Fortnightly. Mention the uses: collections, fraud, underwriting, treasury.' },
      { view: 'overlaps', setup: () => { if (!q('#view')) return; }, target: () => byTitle('The overlap funnel'),
        title: 'Only a bureau sees this: Retail × Microfinance',
        say: `"Of ${N.ov.base.toFixed(0)} crore live microfinance borrowers, half already show up in retail credit and a quarter are servicing an MFI loan and a retail loan at the same time. Their retail delinquency is ${(N.ov.del.retailOverlap / N.ov.del.retailOthers).toFixed(1)}× everyone else's, and MFI stress spills into retail about a quarter later."`,
        tip: 'Scroll to Sahyadri\'s own exposure table at the bottom.' },
      { view: 'overlaps', setup: async () => { clickText('Commercial × Retail'); await wait(250); }, target: () => byTitle('promoters slipped'),
        title: 'MSME promoters slip first',
        say: `"Directors and partners borrow personally. In ${pct(N.ms.stats.precededPct, 0)} of MSME defaults, a promoter slipped on a personal loan or card first, about ${N.ms.stats.medianLeadMonths} months earlier. Tamil Nadu tops Sahyadri's watchlist, which is exactly where its MSME book broke."`,
        tip: 'Connects back to the Tamil Nadu alert on the Command Centre.' },
      { view: 'upload', setup: async () => { PIQ.views.upload.demo('custom'); await wait(300); }, target: () => q('.callout.danger'),
        title: 'Bring your own data',
        say: '"Which credit desk approved a loan isn\'t bureau data. The bank uploads it, the platform joins it to the market like-for-like, and there\'s the root cause for Gujarat: loans auto-approved with no manual review. The file never leaves the bank\'s tenant."',
        tip: 'The sample file is built in, so there is no need to carry a CSV.' },
      { view: 'analyst', setup: async () => {
          for (const x of ['What is happening in personal loans?', 'Compare that with Gujarat.', 'Now compare it with my portfolio.', "Show me HDFC's delinquency"]) { PIQ.chatUI.ask(x); await wait(900); }
        }, target: () => q('.chat-main'),
        title: 'Ask in plain English, safely',
        say: '"The analyst keeps context across follow-ups and shows the source, filters and tool behind every number. It never invents one. And when asked about another lender, it refuses: tenant isolation is enforced in the data layer, not just the screen."',
        tip: 'Also available as ✦ Ask PortfolioIQ on every page. 67 ready-made questions on the right.' },
      { view: 'actions', setup: () => { PIQ.insights.recommendations('ALL').slice(0, 3).forEach((r, i) => PIQ.actions.add(r.title, r.why, { view: r.action.view, viewTitle: 'Recommendation', priority: i < 2 ? 'High' : 'Medium' })); }, target: () => q('.action-board'),
        title: 'Insight to action in one click',
        say: '"Everything I pinned across the screens (📌 or right-click → Send to Action Board) lands here with where it came from. Assign an owner and a date, export it, and it flows into the board pack."',
        tip: 'Before a live demo, clear the board so it fills up as you go.' },
      { view: 'governance', target: () => q('.guard') && q('.guard').closest('.card'),
        title: 'Trust is the product',
        say: '"Tenant isolation, peer-privacy rules (at least 5 institutions, none above 25%), no borrower-level data, one metric catalogue and a full audit trail of every query, human or AI."',
        tip: 'Answers the "can we trust AI with bureau data?" question before it is asked.' },
      { view: 'brief', target: () => q('.brief'),
        title: 'Close',
        say: `"And the monthly deck writes itself. No new data: the same bureau data, made self-serve, explainable, governed and conversational, across every product, state and lender we already serve."`,
        tip: 'End on the one-liner: "Bloomberg for credit". Then take questions.' }
    ];
  }

  // ---------- overlay ----------
  let ov, ring, box, idx = 0, list = [], playing = false, timer = null, active = false;
  function build() {
    ring = document.createElement('div'); ring.className = 'tour-ring'; document.body.appendChild(ring);
    box = document.createElement('div'); box.className = 'tour-box'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Demo tour'); document.body.appendChild(box);
    const reposition = () => place();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    document.addEventListener('keydown', (e) => {
      if (!active) return;
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
      if (e.key === 'Escape') stop();
      if (e.key.toLowerCase() === 'p') toggle();
    });
  }
  let target = null;
  function place() {
    if (!active || !ring) return;
    if (target && target.isConnected) {
      const r = target.getBoundingClientRect();
      Object.assign(ring.style, { display: 'block', left: r.left - 6 + 'px', top: r.top - 6 + 'px', width: r.width + 12 + 'px', height: Math.min(r.height, window.innerHeight - 40) + 12 + 'px' });
      const low = r.top + Math.min(r.height, 300) / 2 > window.innerHeight * 0.55;
      box.classList.toggle('top', low);
    } else ring.style.display = 'none';
  }
  function h(tag, cls, parent, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; parent.appendChild(e); return e; }
  let seq = 0;
  async function show(i) {
    const my = ++seq; // a newer step cancels an older one still loading
    idx = Math.max(0, Math.min(list.length - 1, i));
    const st = list[idx];
    clearTimeout(timer);
    if (st.state) Object.assign(PIQ.ui.state, st.state);
    PIQ.go(st.view, st.state || {});
    document.getElementById('drawer').classList.remove('open');
    await wait(120);
    if (my !== seq) return;
    if (st.setup) await st.setup();
    await wait(80);
    if (my !== seq) return;
    target = st.target ? st.target() : null;
    if (target) target.scrollIntoView({ block: 'center' });
    await wait(60);
    if (my !== seq) return;
    box.innerHTML = '';
    const hd = h('div', 'tour-head', box);
    h('span', 'tour-step', hd, `${idx + 1} / ${list.length}`);
    h('strong', null, hd, st.title);
    h('p', 'tour-say', box, st.say);
    if (st.tip) h('p', 'tour-tip', box, '💡 ' + st.tip);
    const bar = h('div', 'tour-btns', box);
    const b = (label, fn, cls) => { const x = h('button', 'btn sm' + (cls ? ' ' + cls : ''), bar, label); x.type = 'button'; x.addEventListener('click', fn); return x; };
    b('← Back', prev).disabled = idx === 0;
    b(playing ? '❚❚ Pause' : '▶ Auto-play', toggle);
    b(idx === list.length - 1 ? 'Finish' : 'Next →', idx === list.length - 1 ? stop : next, 'primary');
    b('✕', stop).title = 'Exit tour (Esc)';
    box.style.display = 'block';
    place();
    if (playing) timer = setTimeout(() => (idx < list.length - 1 ? next() : stop()), Math.max(PIQ.tourPace || 9000, st.say.length * (PIQ.tourMsPerChar || 55)));
  }
  const next = () => show(idx + 1);
  const prev = () => show(idx - 1);
  function toggle() { playing = !playing; show(idx); }
  function stop() { active = false; playing = false; clearTimeout(timer); if (box) box.style.display = 'none'; if (ring) ring.style.display = 'none'; document.body.classList.remove('touring'); }
  function start(opts) {
    if (!box) build();
    list = steps(numbers());
    active = true;
    playing = !!(opts && opts.autoplay);
    document.body.classList.add('touring');
    show((opts && opts.from) || 0);
  }
  PIQ.tour = { start, stop, next, prev };
})();
