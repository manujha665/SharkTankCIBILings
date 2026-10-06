/*
 * Governed AI analyst engine.
 *
 * Two layers:
 *  1. TOOLS — the only way the analyst can touch data. Each returns an answer (text + chart +
 *     sources) and `facts` (a compact, pre-formatted summary that an LLM may phrase, never compute).
 *  2. A deterministic intent router — understands the question, applies guardrails, keeps
 *     conversational context, and calls the tools. Works fully offline. When an approved LLM is
 *     connected (see llm.js), the LLM chooses the tools instead, but the guardrails still run first.
 */
(function () {
  const PIQ = window.PIQ;
  const S = PIQ.sem, D = PIQ.data, C = PIQ.config;
  const F = () => PIQ.ui.fmt;
  const ml = (m) => D.monthLabel(m);
  const sName = (s) => (!s || s === 'ALL' ? 'all states' : D.S[s].name);
  const pName = (p) => (!p || p === 'ALL' ? 'total portfolio' : D.P[p].name.toLowerCase());
  const pTitle = (p) => (!p || p === 'ALL' ? 'All products' : D.P[p].name);
  const pLong = (p) => (!p || p === 'ALL' ? 'Total portfolio (all products)' : D.P[p].long);
  const mName = (m) => S.METRICS[m].name;
  const mLow = (m) => mName(m).replace(/^[A-Z][a-z]/, (c) => c.toLowerCase());
  // change in a metric: bps for delinquency, pp for cure rate, % for amounts
  const dfmt = (m, now, was) => (S.METRICS[m].unit !== 'pct' ? F().chg(now / was - 1) : m === 'cure' ? F().pp(now - was, 1) : F().bps(now - was));
  const fmtM = (m, v) => F().metric(m, v);
  const src = (...k) => k.map((x) => S.DATASETS[x].name);

  // ---------------- tools ----------------
  const tools = {};
  function def(name, description, props, required, fn) {
    tools[name] = { name, description, schema: { type: 'object', properties: props, required: required || [], additionalProperties: false }, run: fn };
  }
  const P_PRODUCT = { type: 'string', enum: ['ALL'].concat(D.PRODUCTS.map((x) => x.id)), description: 'ALL = whole portfolio; ' + D.PRODUCTS.map((x) => x.id + ' = ' + x.long).join('; ') };
  const P_STATE = { type: 'string', enum: ['ALL'].concat(D.STATES.map((x) => x.id)), description: 'ALL or a state code: ' + D.STATES.map((x) => x.id + ' = ' + x.name).join('; ') };
  const P_METRIC = { type: 'string', enum: Object.keys(S.METRICS), description: 'bal, acc, orig, dpd30, dpd90, cure' };

  def('trend', 'Monthly trend of a metric for the industry and/or the member, optionally for one or more states, a risk band or a lender type.', {
    metric: P_METRIC, product: P_PRODUCT, states: { type: 'array', items: P_STATE }, band: { type: 'string', enum: ['SP', 'PP', 'PR', 'NP', 'SB'] },
    lender: { type: 'string', enum: D.LENDERS.map((l) => l.id), description: 'Lender category: ' + D.LENDERS.map((l) => l.id + ' = ' + l.long).join('; ') }, who: { type: 'string', enum: ['industry', 'member', 'both'] }
  }, ['metric', 'product'], (a) => {
    const metric = a.metric || 'dpd30', p = a.product || 'ALL';
    const states = a.states && a.states.length ? a.states : ['ALL'];
    const who = a.who || 'industry';
    const t = S.latest(), t12 = S.monthsAgo(12), t6 = S.monthsAgo(6);
    const series = [], facts = { metric: mName(metric), product: pLong(p), asOf: ml(t) };
    const colors = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)'];
    const paras = [];
    let ci = 0;
    const band = a.band ? D.B[a.band].name + ' ' : '';
    const lender = a.lender ? D.L[a.lender].name + ' ' : '';
    states.forEach((s) => {
      const f = { p, s, b: a.band || null, l: a.lender || null };
      if (who !== 'member') {
        const pts = S.series('industry', metric, f);
        const now = pts[pts.length - 1].y, y12 = pts[pts.length - 13].y, y6 = pts[pts.length - 7].y;
        const label = (states.length > 1 ? sName(s).replace('all states', 'All states') : 'Industry') + (who === 'both' && states.length > 1 ? ' (industry)' : '');
        series.push({ name: label, color: who === 'both' && states.length === 1 ? 'var(--s3)' : colors[ci++ % 4], points: pts });
        const ch = dfmt(metric, now, y12);
        const ch6 = dfmt(metric, now, y6);
        paras.push(`**${lender}${band}${pTitle(p)} · ${sName(s)}**: industry ${mLow(metric)} is **${fmtM(metric, now)}** in ${ml(t)}, ${ch} year-on-year (${ch6} over 6 months).`);
        facts['industry_' + s] = { now: fmtM(metric, now), yoy: ch, sixMonth: ch6 };
      }
      if (who !== 'industry') {
        const pts = S.series('member', metric, { p, s, b: a.band || null });
        const now = pts[pts.length - 1].y, y12 = pts[pts.length - 13].y;
        series.unshift({ name: C.member.name + (states.length > 1 ? ' · ' + sName(s) : ''), color: states.length > 1 ? colors[ci++ % 4] : 'var(--s1)', points: pts });
        const ch = dfmt(metric, now, y12);
        paras.push(`**${C.member.name} · ${sName(s)}**: ${fmtM(metric, now)}, ${ch} year-on-year.`);
        facts['member_' + s] = { now: fmtM(metric, now), yoy: ch };
      }
    });
    if (metric === 'bal' && who !== 'member') {
      const g = D.STATES.map((x) => ({ n: x.name, g: S.value('industry', 'bal', { p, s: x.id, m: t }) / S.value('industry', 'bal', { p, s: x.id, m: t12 }) - 1 })).sort((x, y) => y.g - x.g);
      paras.push(`Fastest-growing state: **${g[0].n}** (${F().chg(g[0].g)}); slowest: ${g[g.length - 1].n} (${F().chg(g[g.length - 1].g)}).`);
    }
    return {
      answer: {
        paras,
        chart: (el) => PIQ.charts.line(el, { series, xLabel: ml, yFmt: (v) => fmtM(metric, v), yTickFmt: F().metricTick(metric), height: 220, endLabels: series.length <= 3, zero: S.METRICS[metric].unit !== 'pct' }),
        sources: src(who === 'industry' ? 'industry' : 'member', 'industry'),
        filters: `${pLong(p)} · ${states.map(sName).join(' vs ')}${band ? ' · ' + band : ''}${lender ? ' · ' + lender : ''} · ${ml(D.MONTHS[0])}–${ml(t)}`,
        followups: who === 'industry'
          ? ['Now compare it with my portfolio', 'Which state has the highest ' + (metric === 'bal' ? 'growth' : 'delinquency') + '?', 'Why did my ' + pName(p) + ' delinquency go up?']
          : ['Why did it change?', 'How do I compare with peers?', 'What should I do about it?']
      },
      facts
    };
  });

  def('rank_states', 'Rank all states on a metric (latest month), for the industry or the member, with the change over 12 months.', {
    metric: P_METRIC, product: P_PRODUCT, who: { type: 'string', enum: ['industry', 'member'] }, growth: { type: 'boolean', description: 'rank by YoY growth instead of level' }, band: { type: 'string', enum: ['SP', 'PP', 'PR', 'NP', 'SB'] }
  }, ['metric', 'product'], (a) => {
    const metric = a.metric || 'dpd30', p = a.product || 'ALL', who = a.who || 'industry';
    const t = S.latest(), t12 = S.monthsAgo(12);
    const rows = D.STATES.map((x) => {
      const now = S.value(who, metric, { p, s: x.id, b: a.band || null, m: t }), was = S.value(who, metric, { p, s: x.id, b: a.band || null, m: t12 });
      return { s: x, now, was, g: now / was - 1, d: now - was };
    });
    const key = a.growth ? 'g' : 'now';
    rows.sort((x, y) => y[key] - x[key]);
    const f = (r) => (a.growth ? F().chg(r.g) : fmtM(metric, r.now));
    const top = rows[0], bot = rows[rows.length - 1];
    const what = (a.growth ? mLow(metric) + ' growth' : mLow(metric)) + (a.band ? ' (' + D.B[a.band].name + ')' : '');
    return {
      answer: {
        paras: [`Highest ${what}: **${top.s.name}** at **${f(top)}**. Lowest: **${bot.s.name}** at ${f(bot)}.`,
          S.METRICS[metric].unit === 'pct' && metric !== 'cure' ? `The biggest 12-month move was in **${rows.slice().sort((x, y) => Math.abs(y.d) - Math.abs(x.d))[0].s.name}** (${F().bps(rows.slice().sort((x, y) => Math.abs(y.d) - Math.abs(x.d))[0].d)}).` : ''].filter(Boolean),
        chart: (el) => PIQ.charts.bars(el, { items: rows.map((r) => ({ label: r.s.name, value: a.growth ? r.g : r.now })), fmt: a.growth ? (v) => F().chg(v) : (v) => fmtM(metric, v), color: 'var(--s1)' }),
        sources: src(who),
        filters: `${pLong(p)} · ${who === 'member' ? C.member.name : 'industry'} · ${ml(t)}`,
        followups: [`What is driving the change in ${top.s.name}?`, `What is happening in ${top.s.name}?`, 'How do I compare with peers?']
      },
      facts: { ranking: rows.map((r) => ({ state: r.s.name, value: f(r) })) }
    };
  });

  def('lender_types', 'Compare the 8 lender categories (' + D.LENDERS.map((l) => l.name).join(', ') + ') on a metric in the industry.', { metric: P_METRIC, product: P_PRODUCT, state: P_STATE }, ['metric', 'product'], (a) => {
    const metric = a.metric || 'dpd30', p = a.product || 'ALL', s = a.state || 'ALL';
    const colors = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)'];
    const series = D.LENDERS.map((l, i) => ({ name: l.name, color: colors[i], points: S.series('industry', metric, { p, s, l: l.id }) }));
    const now = series.map((x) => ({ n: x.name, v: x.points[x.points.length - 1].y, v12: x.points[x.points.length - 13].y }));
    const unit = S.METRICS[metric].unit;
    return {
      answer: {
        paras: [now.map((x) => `**${x.n}** ${fmtM(metric, x.v)} (${dfmt(metric, x.v, x.v12)} YoY)`).join(' · '),
          (() => { const by = now.slice().sort((x, y) => y.v - x.v); const hi = S.METRICS[metric].bad ? by[0] : by[by.length - 1], lo = S.METRICS[metric].bad ? by[by.length - 1] : by[0]; return metric.startsWith('dpd') || metric === 'cure' ? `Weakest: **${hi.n}**. Strongest: **${lo.n}**.` : ''; })()].filter(Boolean),
        chart: (el) => PIQ.charts.line(el, { series, xLabel: ml, yFmt: (v) => fmtM(metric, v), yTickFmt: F().metricTick(metric), height: 220 }),
        sources: src('industry'), filters: `${pLong(p)} · ${sName(s)} · by lender type`,
        followups: ['How do I compare with PVT mid-size peers?', 'Is the industry taking more risk in personal loans?']
      },
      facts: { byLender: now.map((x) => ({ lender: x.n, value: fmtM(metric, x.v) })) }
    };
  });

  def('band_mix', 'Balance mix by risk band over time for the industry or the member.', { product: P_PRODUCT, state: P_STATE, who: { type: 'string', enum: ['industry', 'member'] } }, ['product'], (a) => {
    const p = a.product || 'ALL', s = a.state || 'ALL', who = a.who || 'industry';
    const months = D.MONTHS.filter((_, i) => i % 3 === 2);
    const cols = ['var(--r1)', 'var(--r2)', 'var(--r3)', 'var(--r4)', 'var(--r5)'];
    const stacks = D.BANDS.map((b, i) => ({ name: b.name, color: cols[i], values: months.map((m) => S.value(who, 'bal', { p, s, b: b.id, m })) }));
    const share = (m, ids) => ids.reduce((acc, id) => acc + S.value(who, 'bal', { p, s, b: id, m }), 0) / S.value(who, 'bal', { p, s, m });
    const now = share(S.latest(), ['NP', 'SB']), was = share(S.monthsAgo(12), ['NP', 'SB']);
    return {
      answer: {
        paras: [`Near-prime + subprime make up **${F().pct(now, 1)}** of ${who === 'member' ? 'your' : 'industry'} ${pName(p)} balance in ${sName(s)}, versus ${F().pct(was, 1)} a year ago (${F().pp(now - was, 1)}).`,
          now - was > 0.01 ? 'Risk appetite has increased: the mix is tilting towards weaker bands.' : 'The risk mix is broadly stable.'],
        chart: (el) => PIQ.charts.stacked(el, { x: months, xLabel: ml, stacks, height: 200 }),
        sources: src(who), filters: `${pLong(p)} · ${sName(s)}`,
        followups: ['How is subprime performing in personal loans?', 'Is the rise in my delinquency me or the market?']
      },
      facts: { nearPrimeSubprimeShareNow: F().pct(now, 1), yearAgo: F().pct(was, 1) }
    };
  });

  const peerFromText = (id) => S.PEER_GROUPS.find((g) => g.id === id) || S.PEER_GROUPS[0];
  def('benchmark', 'Compare the member with a peer group and the industry on a metric. Peer groups are privacy-checked (min 5 institutions, no institution above 25%).', {
    metric: P_METRIC, product: P_PRODUCT, state: P_STATE, peer_group: { type: 'string', enum: S.PEER_GROUPS.map((g) => g.id) }
  }, ['product'], (a) => {
    const metric = a.metric || 'dpd30', p = a.product || 'ALL', s = a.state || 'ALL';
    const g = peerFromText(a.peer_group || PIQ.ui.state.peer);
    const f = { p, s };
    const mS = S.series('member', metric, f), iS = S.series('industry', metric, f), pS = S.peerSeries(g.id, metric, f);
    const m = mS[mS.length - 1].y, i = iS[iS.length - 1].y, pv = pS.suppressed ? null : pS.points[pS.points.length - 1].y;
    const m6 = mS[mS.length - 7].y, i6 = iS[iS.length - 7].y, p6 = pS.suppressed ? null : pS.points[pS.points.length - 7].y;
    const bad = S.METRICS[metric].bad;
    const better = (x, y) => (bad ? x < y : x > y);
    const paras = [`Your ${pName(p)} ${mLow(metric)} in ${sName(s)} is **${fmtM(metric, m)}** (${dfmt(metric, m, m6)} in 6 months).`];
    if (pS.suppressed) paras.push(`⚠ The **${g.name}** benchmark is suppressed: ${pS.check.reason}`);
    const gap = (x, y) => (metric === 'cure' ? Math.abs((x - y) * 100).toFixed(1) + ' pp' : Math.abs(Math.round((x - y) * 10000)) + ' bps');
    if (!pS.suppressed) paras.push(`**${g.name}** (${pS.check.n} institutions): ${fmtM(metric, pv)} (${dfmt(metric, pv, p6)}). You are **${gap(m, pv)} ${better(m, pv) ? 'better' : 'worse'}** than peers.`);
    paras.push(`Industry: ${fmtM(metric, i)} (${dfmt(metric, i, i6)}). You are ${better(m, i) ? 'better' : 'worse'} than the market by ${gap(m, i)}.`);
    if (!pS.suppressed && Math.abs(m - m6) > Math.abs(pv - p6) * 1.8 && m > m6 && bad) paras.push(`Your trend is the issue: you are deteriorating **${((m - m6) / Math.max(pv - p6, 0.0001)).toFixed(1)}× faster** than peers.`);
    return {
      answer: {
        paras,
        chart: (el) => PIQ.charts.line(el, { series: [{ name: C.member.name, color: 'var(--s1)', points: mS }, { name: 'Peers', color: 'var(--s2)', points: pS.points }, { name: 'Industry', color: 'var(--s3)', points: iS }], xLabel: ml, yFmt: (v) => fmtM(metric, v), yTickFmt: F().metricTick(metric), height: 220, endLabels: true }),
        sources: src('member', 'peers', 'industry'), filters: `${pLong(p)} · ${sName(s)} · peer group: ${g.name}`,
        followups: ['Why did it change?', 'Where am I worse than the market?', 'What should I do about it?'],
        refusal: false
      },
      facts: { member: fmtM(metric, m), peers: pS.suppressed ? 'suppressed: ' + pS.check.reason : fmtM(metric, pv), industry: fmtM(metric, i), member6mChange: dfmt(metric, m, m6), peer6mChange: pS.suppressed ? null : dfmt(metric, pv, p6) }
    };
  });

  def('where_differ', 'Find the state × risk band cells where the member performs better or worse than the industry, like for like.', {
    product: P_PRODUCT, metric: P_METRIC, direction: { type: 'string', enum: ['better', 'worse'] }
  }, ['product'], (a) => {
    const p = a.product || 'ALL', metric = a.metric || 'dpd30', dir = a.direction || 'worse';
    const t = S.latest();
    const cells = [];
    D.STATES.forEach((x) => D.BANDS.forEach((b) => {
      const m = S.value('member', metric, { p, s: x.id, b: b.id, m: t }), i = S.value('industry', metric, { p, s: x.id, b: b.id, m: t });
      cells.push({ label: x.name + ' · ' + b.name, m, i, r: m / i, bal: S.value('member', 'bal', { p, s: x.id, b: b.id, m: t }) });
    }));
    const bad = S.METRICS[metric].bad;
    cells.sort((x, y) => ((dir === 'worse') === bad ? y.r - x.r : x.r - y.r));
    const top = cells.slice(0, 5);
    return {
      answer: {
        paras: [`Where you are **${dir}** than the market (${mLow(metric)}, same state and risk band, ${ml(t)}):`],
        bullets: top.map((c) => `**${c.label}**: ${fmtM(metric, c.m)} vs industry ${fmtM(metric, c.i)} (${c.r.toFixed(2)}×) on ${F().cr(c.bal)}`),
        chart: (el) => PIQ.charts.bars(el, { items: top.map((c) => ({ label: c.label, value: c.m, ref: c.i })), fmt: (v) => fmtM(metric, v), color: 'var(--s1)', valueName: 'You', refName: 'Industry' }),
        sources: src('member', 'industry'), filters: `${pLong(p)} · like-for-like cells`,
        followups: ['Why did it change?', 'What should I do about it?']
      },
      facts: { cells: top.map((c) => ({ cell: c.label, member: fmtM(metric, c.m), industry: fmtM(metric, c.i) })) }
    };
  });

  def('explain_change', 'Decompose the change in the member\'s delinquency into mix shift, market-wide change and member-specific performance, with top contributing segments.', {
    product: P_PRODUCT, state: P_STATE, metric: { type: 'string', enum: S.DPD_METRICS }, from_month: { type: 'string', description: 'YYYY-MM, default 2026-02 (policy change)' }
  }, ['product'], (a) => {
    const p = a.product || 'ALL', s = a.state || 'ALL', metric = a.metric || 'dpd30';
    const t0 = D.MONTHS.includes(a.from_month) ? a.from_month : C.policyChangeMonth;
    const d = S.decompose({ p, s, t0, t1: S.latest(), dim: (p === 'ALL' ? 'p' : '') + (s === 'ALL' ? 'sb' : 'b'), metric });
    const n = PIQ.insights.narrateDecomposition(d);
    return {
      answer: {
        paras: [n.headline, `**${n.verdict}** ${n.drivers}`, n.segments],
        chart: (el) => PIQ.charts.waterfall(el, { start: { label: ml(t0), value: d.R0 }, steps: [{ label: 'Mix shift', value: d.mix }, { label: 'Market', value: d.market }, { label: 'Member-specific', value: d.own }], end: { label: ml(S.latest()), value: d.R1 }, fmt: (v) => F().pct(v), deltaFmt: (v) => Math.round(v * 10000) + ' bps', upIsBad: true, height: 230 }),
        sources: src('member', 'industry'), filters: `${pLong(p)} · ${sName(s)} · ${ml(t0)} → ${ml(S.latest())}`,
        followups: ['What should I do about it?', s === 'ALL' ? 'What is driving the change in Gujarat?' : 'What if I raise my cut-off to 700 in ' + D.S[s].name + '?', ],
        link: { view: 'why', params: { p, s } }
      },
      facts: { from: ml(t0), to: ml(S.latest()), start: F().pct(d.R0), end: F().pct(d.R1), change: F().bps(d.delta), industryChange: F().bps(d.indDelta), mixEffect: F().bps(d.mix), marketEffect: F().bps(d.market), memberSpecificEffect: F().bps(d.own), verdict: n.verdict, topSegments: d.segments.slice(0, 3).map((x) => x.label) }
    };
  });

  def('recommend', 'Ranked, quantified recommended actions (cut-off changes, sourcing audits, early-warning checks, collections, growth).', {
    product: P_PRODUCT, state: P_STATE, focus: { type: 'string', enum: ['all', 'collections', 'growth', 'policy'] }
  }, [], (a) => {
    const p = a.product || 'ALL', s = a.state || 'ALL', focus = a.focus || 'all';
    let recs = PIQ.insights.recommendations(p);
    if (s !== 'ALL') recs = recs.filter((r) => !r.states.length || r.states.includes(s));
    if (focus === 'collections') recs = recs.filter((r) => r.kind === 'collections').concat(recs.filter((r) => r.kind !== 'collections')).slice(0, 2);
    if (focus === 'growth') recs = recs.filter((r) => r.kind === 'growth').concat(recs.filter((r) => r.kind !== 'growth')).slice(0, 2);
    return {
      answer: {
        paras: [recs.length ? `Here's what I'd do, ranked by impact:` : 'No action needed: performance is in line with the market.'],
        bullets: recs.map((r, i) => `**${i + 1}. ${r.title}.** ${r.impact.map(([k, v]) => k + ': ' + v).join(' · ')}`),
        sources: src('member', 'industry', 'scores', 'logins'), filters: `${pLong(p)} · ${sName(s)}`,
        followups: ['What if I raise my cut-off to 700 in Uttar Pradesh?', 'What is happening with my applications this week?', 'Give me a summary for my board'],
        actions: recs.slice(0, 3).map((r) => ({ label: r.title.split(':')[0].slice(0, 48) + (r.title.length > 48 ? '…' : ''), view: r.action.view, params: r.action.params }))
      },
      facts: { recommendations: recs.map((r) => ({ title: r.title, why: r.why, impact: r.impact.map(([k, v]) => k + ' ' + v) })) }
    };
  });

  def('simulate_cutoff', 'Simulate a score cut-off: approval rate, approvals, expected bad rate, expected loss and net contribution vs the current policy. Use cutoff 0 to find the profit-maximising cut-off.', {
    product: P_PRODUCT, state: P_STATE, cutoff: { type: 'integer', description: '600–800; 0 = find best' }
  }, ['product'], (a) => {
    const p = !a.product || a.product === 'ALL' ? 'PL' : a.product, s = a.state || 'ALL'; // cut-offs are product-specific
    // current policy comes from the member's product × state grid (Policy Simulator page)
    const CO = PIQ.cutoffs, curFn = s === 'ALL' && CO.varies(p) ? CO.fn(p) : CO.get(p, s);
    const cur = typeof curFn === 'function' ? 'your state-wise grid' : curFn;
    let c = a.cutoff || 0;
    if (!c) { const curve = S.simulateCurve(p, s); c = curve.reduce((m, r) => (r.netCr > m.netCr ? r : m), curve[0]).cutoff; }
    c = Math.max(600, Math.min(800, Math.round(c / 10) * 10));
    const A = S.simulate(p, s, curFn), B = S.simulate(p, s, c);
    S.log('simulate', { p, s, cutoff: c }, 'ai');
    const gain = B.netCr - A.netCr;
    const curve = S.simulateCurve(p, s);
    return {
      answer: {
        paras: [`Moving the ${pName(p)} cut-off in **${sName(s)}** from ${cur} to **${c}**:`, a.cutoff ? '' : `(${c} is the profit-maximising cut-off for this slice.)`].filter(Boolean),
        bullets: [
          `Approval rate ${F().pct(A.approvalRate, 1)} → **${F().pct(B.approvalRate, 1)}** (${F().chg(B.approvedPerMonth / A.approvedPerMonth - 1)} approvals)`,
          `Expected bad rate ${F().pct(A.badRate)} → **${F().pct(B.badRate)}**`,
          `Expected credit loss ${F().cr(A.expLossCr)} → **${F().cr(B.expLossCr)}** a month`,
          `Net contribution ${F().cr(A.netCr)} → **${F().cr(B.netCr)}** a month (${gain >= 0 ? '+' : '−'}${F().cr(Math.abs(gain))})`
        ],
        chart: (el) => PIQ.charts.line(el, { series: [{ name: 'Net contribution (₹ Cr / month)', color: 'var(--s1)', points: curve.map((r) => ({ x: r.cutoff, y: r.netCr })), marks: [c] }], xNumeric: true, xLabel: (x) => String(x), yFmt: F().cr, yTickFmt: (v) => v.toFixed(0), height: 190, area: true, annotations: [{ x: cur, label: 'Current ' + cur }] }),
        sources: src('scores'), filters: `${pLong(p)} · ${sName(s)} · last 90 days of applications`,
        followups: s === 'ALL' ? ['What is the best cut-off for Gujarat?', 'What if I raise my cut-off to 700 in Uttar Pradesh?'] : ['What is the best cut-off for Maharashtra?', 'What should I do about it?'],
        link: { view: 'simulator', params: { p, s, cutoff: c } }
      },
      facts: { current: { cutoff: cur, approvalRate: F().pct(A.approvalRate, 1), badRate: F().pct(A.badRate), expLossPerMonth: F().cr(A.expLossCr), netPerMonth: F().cr(A.netCr) }, proposed: { cutoff: c, approvalRate: F().pct(B.approvalRate, 1), badRate: F().pct(B.badRate), expLossPerMonth: F().cr(B.expLossCr), netPerMonth: F().cr(B.netCr) } }
    };
  });

  def('application_pulse', 'Last 5 days vs prior 25 days of the member\'s applications/logins vs the industry: volume change, approval rate, share of applicants with 3+ enquiries, and where any surge comes from.', {
    product: P_PRODUCT, state: P_STATE, bands: { type: 'string', enum: ['all', 'near_prime_subprime'] }
  }, ['product'], (a) => {
    const p = a.product || 'ALL', s = a.state || 'ALL';
    const b = a.bands === 'near_prime_subprime' ? ['NP', 'SB'] : null;
    const c = S.loginCompare({ p, s, b }, 5);
    const mem = S.loginDaily('mem', { p, s, b }), ind = S.loginDaily('ind', { p, s, b });
    const bm = mem.slice(0, 25).reduce((x, y) => x + y.apps, 0) / 25, bi = ind.slice(0, 25).reduce((x, y) => x + y.apps, 0) / 25;
    const hot = D.STATES.map((st) => ({ st, c: S.loginCompare({ p, s: st.id, b: ['NP', 'SB'] }, 5) })).filter((x) => x.c.mem.change - x.c.ind.change > 0.3);
    const paras = [`Your ${pName(p)} applications in ${sName(s)} are **${F().chg(c.mem.change, 0)}** in the last 5 days vs the prior 25-day run-rate; the industry moved **${F().chg(c.ind.change, 0)}**.`,
      `Approval rate: you ${F().pct(c.mem.recent.apprRate, 1)} vs industry ${F().pct(c.ind.recent.apprRate, 1)}. Applicants with 3+ enquiries in 30 days: you **${F().pct(c.mem.recent.hiEnqShare, 0)}** vs industry ${F().pct(c.ind.recent.hiEnqShare, 0)}.`];
    if (hot.length) paras.push(`⚠ The surge is concentrated in **near-prime & subprime in ${hot.map((x) => x.st.name).join(' and ')}** (${hot.map((x) => F().chg(x.c.mem.change, 0)).join(', ')} vs market ${hot.map((x) => F().chg(x.c.ind.change, 0)).join(', ')}), with high enquiry intensity. That's an early-warning pattern worth checking before these loans season.`);
    return {
      answer: {
        paras,
        chart: (el) => PIQ.charts.line(el, { series: [{ name: C.member.name, color: 'var(--s1)', points: mem.map((x) => ({ x: x.x, y: (x.apps / bm) * 100 })) }, { name: 'Industry', color: 'var(--s3)', points: ind.map((x) => ({ x: x.x, y: (x.apps / bi) * 100 })) }], xLabel: (x) => F().day(x), yFmt: (v) => v.toFixed(0), height: 200, endLabels: true, annotations: [{ x: D.DAYS[D.DAYS.length - 5], label: 'Last 5 days' }] }),
        sources: src('logins'), filters: `${pLong(p)} · ${sName(s)} · index, prior 25-day avg = 100 · to ${C.loginsAsOf}`,
        followups: ['Where is the surge in applications coming from?', 'What should I do about it?', 'Show me the early-warning alerts'],
        link: { view: 'logins', params: { p, s } }
      },
      facts: { memberChange: F().chg(c.mem.change, 0), industryChange: F().chg(c.ind.change, 0), memberApproval: F().pct(c.mem.recent.apprRate, 1), industryApproval: F().pct(c.ind.recent.apprRate, 1), memberHighEnquiry: F().pct(c.mem.recent.hiEnqShare, 0), industryHighEnquiry: F().pct(c.ind.recent.hiEnqShare, 0), surgeIn: hot.map((x) => x.st.name) }
    };
  });

  def('same_day_enquiries', 'Count of the member\'s applicants who made more than one credit enquiry on the same day (a rate-shopping / loan-stacking signal) over the last 7, 15 or 30 days, vs the member\'s prior period and the industry share, by the applicant\'s bureau credit profile (new to credit, thin file, established, already leveraged, existing customer).', {
    product: P_PRODUCT, state: P_STATE, days: { type: 'integer', enum: [7, 15, 30], description: 'login window in days' }
  }, [], (a) => {
    const p = a.product || 'ALL', s = a.state || 'ALL', n = [7, 15, 30].includes(+a.days) ? +a.days : 7;
    const q = S.loginQualityWin({ p, s }, n);
    S.log('loginQualityWin', { p, s, days: n }, 'ai');
    const pp = (x, d) => F().pct(x, d == null ? 1 : d);
    const pools = q.mem.profiles.slice().sort((u, v) => v.sameDay * v.apps - u.sameDay * u.apps);
    const paras = [`In the last ${n} days, **${F().int(q.mem.sameDayCount)}** of your ${pName(p)} applicants in ${sName(s)} made more than one enquiry on the same day: **${pp(q.mem.sameDay)}** of applicants, against ${pp(q.ind.sameDay)} across the industry${q.memPrior ? ` and ${pp(q.memPrior.sameDay)} in your prior ${q.priorDays} days` : ''}.`];
    if (q.mem.sameDay > q.ind.sameDay * 1.2) paras.push('That is well above the market. Same-day multiple enquiries often mean rate-shopping with several lenders, or loans being stacked before the bureau updates, so check these applications before disbursal.');
    return {
      answer: {
        paras,
        bullets: pools.slice(0, 3).map((x) => `**${x.name}**: ${F().int(x.sameDay * x.apps)} applicants (${pp(x.sameDay)} of that profile's logins)`),
        chart: (el) => PIQ.charts.bars(el, { items: pools.map((x) => ({ label: x.name.split(' (')[0], value: x.sameDay, ref: q.ind.profiles.find((y) => y.id === x.id).sameDay })), fmt: (v) => F().pct(v, 1), color: 'var(--s1)', valueName: `You · last ${n}d`, refName: 'Industry' }),
        sources: src('logins'), filters: `${pLong(p)} · ${sName(s)} · last ${n} days · to ${C.loginsAsOf}`,
        followups: n === 7 ? ['How many applicants had more than one enquiry on the same day in the last 30 days?', 'What is the credit profile of my recent applicants?'] : ['What is the quality of my last 7 days of logins?', 'What should I do about it?'],
        link: { view: 'logins', params: { p, s, win: n } }
      },
      facts: { days: n, memberCount: Math.round(q.mem.sameDayCount), memberShare: pp(q.mem.sameDay), industryShare: pp(q.ind.sameDay), priorShare: q.memPrior ? pp(q.memPrior.sameDay) : null }
    };
  });

  def('ticket_size', 'Average ticket size of new loans (value disbursed ÷ new accounts, bureau-reported at opening) for the member vs peers and the industry, by risk band and state, plus the loan amount applicants request in their enquiries.', {
    product: P_PRODUCT, state: P_STATE
  }, [], (a) => {
    const p = !a.product || a.product === 'ALL' ? 'PL' : a.product, s = a.state || 'ALL';
    const t = S.latest(), t12 = S.monthsAgo(12), t0 = C.policyChangeMonth, f = { p, s };
    const v = (src, ff, m) => S.value(src, 'ats', Object.assign({}, f, ff, { m }));
    const m1 = v('member', {}, t), m0 = v('member', {}, t12), i1 = v('industry', {}, t), i0 = v('industry', {}, t12);
    const W = ['NP', 'SB'], ST = ['SP', 'PP', 'PR'];
    const wR = v('member', { b: W }, t) / v('industry', { b: W }, t), sR = v('member', { b: ST }, t) / v('industry', { b: ST }, t);
    const wM = v('member', { b: W }, t) / v('member', { b: W }, t0) - 1, wI = v('industry', { b: W }, t) / v('industry', { b: W }, t0) - 1;
    const lq = S.loginQualityWin(f, 30);
    S.log('ticketSize', f, 'ai');
    const paras = [`Your average ${pName(p)} ticket in ${sName(s)} is **${F().inr(m1)}** (${ml(t)}), ${F().chg(m1 / m0 - 1)} in a year, against **${F().inr(i1)}** for the industry (${F().chg(i1 / i0 - 1)}).`];
    if (wR > sR * 1.12 && wM > wI + 0.05) paras.push(`The gap is widest where risk is highest: near-prime & subprime tickets are **${wR.toFixed(2)}×** the market's vs ${sR.toFixed(2)}× in prime bands, and they grew ${F().chg(wM, 0)} since ${ml(t0)} vs ${F().chg(wI, 0)} for the market. Bigger loans to riskier borrowers: consider a ticket cap by score band.`);
    else paras.push(`The gap is similar across bands (${sR.toFixed(2)}× in prime, ${wR.toFixed(2)}× in near-prime & subprime), which points to customer mix rather than extra risk.`);
    return {
      answer: {
        paras,
        bullets: D.BANDS.map((b) => `**${b.name}:** ${F().inr(v('member', { b: b.id }, t))} vs market ${F().inr(v('industry', { b: b.id }, t))}`).concat([`**Amount asked in enquiries (30 days):** ${F().inr(lq.mem.ticket)} vs ${F().inr(lq.ind.ticket)} for the industry`]),
        chart: (el) => PIQ.charts.line(el, { series: [{ name: C.member.name, color: 'var(--s1)', points: S.series('member', 'ats', f) }, { name: 'Industry', color: 'var(--s3)', points: S.series('industry', 'ats', f) }], xLabel: ml, yFmt: F().inr, yTickFmt: F().metricTick('ats'), height: 200, endLabels: true }),
        sources: src('member', 'industry', 'logins'), filters: `${pLong(p)} · ${sName(s)} · ${ml(t)}`,
        followups: ['Where are my tickets biggest vs the market?', 'What is the credit profile of my recent applicants?', 'What should I do about it?'],
        link: { view: 'tickets', params: {} }
      },
      facts: { member: F().inr(m1), industry: F().inr(i1), memberYoY: F().chg(m1 / m0 - 1), industryYoY: F().chg(i1 / i0 - 1), weakBandRatio: wR.toFixed(2), primeBandRatio: sR.toFixed(2), amountAsked: F().inr(lq.mem.ticket), industryAmountAsked: F().inr(lq.ind.ticket) }
    };
  });

  def('login_quality', 'Quality of the member\'s last 7 days of logins vs its prior 23 days and the industry: score banding, expected probability of default (12-month 90+), share from high/medium/low-risk PIN codes, the applicant\'s bureau credit profile (new to credit, thin file, established, already leveraged, existing customer) and the loan amount requested.', {
    product: P_PRODUCT, state: P_STATE, focus: { type: 'string', enum: ['all', 'pd', 'pin', 'profile', 'score'] }
  }, [], (a) => {
    const p = a.product || 'ALL', s = a.state || 'ALL', focus = a.focus || 'all';
    const q = S.loginQuality7({ p, s });
    const pp = (x, d) => F().pct(x, d == null ? 1 : d);
    const paras = [`Last 7 days of ${pName(p)} logins in ${sName(s)}: expected PD **${pp(q.mem.pd)}** vs ${pp(q.memPrior.pd)} in your prior 23 days and ${pp(q.ind.pd)} for the industry.`];
    const bullets = [];
    let chart = null;
    if (focus === 'all' || focus === 'pin') {
      bullets.push(`**PIN-code risk:** ${D.PINS.map((x, i) => `${x.name.replace(' PIN codes', '')} ${pp(q.mem.pins[i].share, 0)}`).join(' · ')} (industry high-risk ${pp(q.ind.pins[0].share, 0)}, your prior ${pp(q.memPrior.pins[0].share, 0)})`);
      if (focus === 'pin') chart = (el) => PIQ.charts.dots(el, { rows: D.PINS.map((x, i) => ({ label: x.name, values: { m: q.mem.pins[i].share, pr: q.memPrior.pins[i].share, ind: q.ind.pins[i].share } })), series: [{ key: 'm', name: 'You · 7d', color: 'var(--s1)' }, { key: 'pr', name: 'You · prior', color: 'var(--s2)' }, { key: 'ind', name: 'Industry', color: 'var(--s3)' }], fmt: (v) => F().pct(v, 0) });
    }
    if (focus === 'all' || focus === 'score') {
      bullets.push(`**Score bands:** ${q.mem.bands.map((b) => `${b.name} ${pp(b.share, 0)}`).join(' · ')} (near-prime + subprime ${pp(q.mem.bands[3].share + q.mem.bands[4].share, 0)} vs industry ${pp(q.ind.bands[3].share + q.ind.bands[4].share, 0)})`);
      if (focus === 'score') chart = (el) => PIQ.charts.dots(el, { rows: D.BANDS.map((b, i) => ({ label: `${b.name} (${b.range})`, values: { m: q.mem.bands[i].share, pr: q.memPrior.bands[i].share, ind: q.ind.bands[i].share } })), series: [{ key: 'm', name: 'You · 7d', color: 'var(--s1)' }, { key: 'pr', name: 'You · prior', color: 'var(--s2)' }, { key: 'ind', name: 'Industry', color: 'var(--s3)' }], fmt: (v) => F().pct(v, 0) });
    }
    if (focus === 'all' || focus === 'profile') {
      const profs = q.mem.profiles.map((x, i) => ({ x, pr: q.memPrior.profiles[i] })).sort((u, v) => v.x.share - u.x.share);
      bullets.push(`**Bureau credit profile:** ${profs.map(({ x, pr }) => `${x.name.split(' (')[0]} ${pp(x.share, 0)} (PD ${pp(x.pd)}${x.pd > pr.pd * 1.2 ? ' ⚠ up from ' + pp(pr.pd) : ''}, asking ${F().inr(x.ticket)})`).join(' · ')}`);
      bullets.push(`**Amount requested:** ${F().inr(q.mem.ticket)} on average vs ${F().inr(q.memPrior.ticket)} in your prior 23 days and ${F().inr(q.ind.ticket)} for the industry`);
      if (focus === 'profile') chart = (el) => PIQ.charts.bars(el, { items: profs.map(({ x }) => ({ label: x.name.split(' (')[0], value: x.share, ref: q.ind.profiles.find((y) => y.id === x.id).share })), fmt: (v) => F().pct(v, 0), color: 'var(--s1)', valueName: 'You · 7d', refName: 'Industry' });
    }
    if (focus === 'all' || focus === 'pd') {
      bullets.push(`**PD distribution:** ${q.mem.pdBuckets.map((k) => `${k.label} ${pp(k.share, 0)}`).join(' · ')} (PD above 10%: industry ${pp(q.ind.pdBuckets[4].share, 0)})`);
      if (focus === 'pd' || focus === 'all') chart = chart || ((el) => PIQ.charts.bars(el, { items: q.mem.pdBuckets.map((k, i) => ({ label: 'PD ' + k.label, value: k.share, ref: q.ind.pdBuckets[i].share })), fmt: (v) => F().pct(v, 0), color: 'var(--s1)', valueName: 'You · 7d', refName: 'Industry' }));
    }
    return {
      answer: {
        paras, bullets, chart,
        sources: src('logins', 'scores'), filters: `${pLong(p)} · ${sName(s)} · last 7 days vs prior 23 days · to ${C.loginsAsOf}`,
        followups: ['What is the credit profile of my recent applicants?', 'How many applications came from high-risk PIN codes?', 'What is my average ticket size vs the market?'],
        link: { view: 'logins', params: { p, s } }
      },
      facts: { memberPD7d: pp(q.mem.pd), memberPDPrior: pp(q.memPrior.pd), industryPD7d: pp(q.ind.pd), highRiskPin: pp(q.mem.pins[0].share, 0), industryHighRiskPin: pp(q.ind.pins[0].share, 0), profiles: q.mem.profiles.map((x) => ({ profile: x.name, share: pp(x.share, 0), pd: pp(x.pd), amountAsked: F().inr(x.ticket) })), amountAsked: F().inr(q.mem.ticket), industryAmountAsked: F().inr(q.ind.ticket), scoreBands: q.mem.bands.map((b) => ({ band: b.name, share: pp(b.share, 0) })) }
    };
  });

  def('fresh_signals', 'Weekly / fortnightly submission data: latest 30+ DPD vs the last monthly file, fresh EMI bounce rate, repayments vs dues, first-payment default on new loans, current balance trend, and fresh-bounce hotspots.', {
    product: P_PRODUCT, state: P_STATE, cadence: { type: 'string', enum: ['weekly', 'fortnightly'] }
  }, [], (a) => {
    const p = a.product || 'ALL', s = a.state || 'ALL', cadence = a.cadence || 'weekly';
    const L = PIQ.hf.latest({ p, s }, cadence), m = L.mem, i = L.ind;
    const monthly = S.value('member', 'dpd30', { p, s, m: S.latest() });
    const per = cadence === 'weekly' ? 'week' : 'fortnight';
    const hs = PIQ.hf.hotspots().filter((r) => r.change - r.indChange > 0.08).slice(0, 3);
    return {
      answer: {
        paras: [`${cadence === 'weekly' ? 'Weekly' : 'Fortnightly'} data for your ${pName(p)} in ${sName(s)} (to ${F().day(m.now.x)}): 30+ DPD is **${F().pct(m.now.dpd30)}**, against **${F().pct(monthly)}** in the ${C.dataAsOf} monthly file.`],
        bullets: [
          `Fresh EMI bounce rate **${F().pct(m.now.bounce, 1)}** this ${per} vs ${F().pct(m.prevBounce, 1)} over the prior four (industry ${F().pct(i.now.bounce, 1)}).`,
          `Repayments vs dues **${F().pct(m.now.collEff, 1)}** (prior ${F().pct(m.prevColl, 1)}); first-payment default on new loans ${F().pct(m.now.fpd, 1)} (industry ${F().pct(i.now.fpd, 1)}).`,
          hs.length ? `Fresh-bounce hotspots: ${hs.map((r) => `${D.P[r.p].name} · ${D.S[r.s].name} (${F().chg(r.change, 0)} vs market ${F().chg(r.indChange, 0)})`).join('; ')}.` : 'No fresh-bounce hotspots versus the market.'
        ],
        chart: (el) => PIQ.charts.line(el, { series: [{ name: C.member.name, color: 'var(--s1)', points: m.series.map((x) => ({ x: x.x, y: x.bounce })) }, { name: 'Industry', color: 'var(--s3)', points: i.series.map((x) => ({ x: x.x, y: x.bounce })) }], xLabel: (x) => F().day(x), yFmt: (v) => F().pct(v, 1), yTickFmt: (v) => (v * 100).toFixed(0) + '%', height: 200, endLabels: true }),
        sources: src('hifreq', 'member'), filters: `${pLong(p)} · ${sName(s)} · ${cadence} · fresh EMI bounce rate`,
        followups: ['Why did my personal loan delinquency go up in Uttar Pradesh?', 'What should I do about it?'],
        link: { view: 'fresh', params: { p, s } }
      },
      facts: { latestDpd30: F().pct(m.now.dpd30), monthlyFileDpd30: F().pct(monthly), bounceNow: F().pct(m.now.bounce, 1), bouncePrior: F().pct(m.prevBounce, 1), industryBounce: F().pct(i.now.bounce, 1), collectionEfficiency: F().pct(m.now.collEff, 1), fpd: F().pct(m.now.fpd, 1), hotspots: hs.map((r) => D.P[r.p].name + ' ' + D.S[r.s].name) }
    };
  });

  def('overlap', 'Cross-segment overlap: (a) retail x microfinance — MFI borrowers with retail footprint / live retail loans, their delinquency, products, states and the member\'s exposure; (b) commercial x retail — MSME promoters holding retail loans and the early-warning lead of their retail slips.', {
    segment: { type: 'string', enum: ['retail_mfi', 'msme_retail'] }
  }, [], (a) => {
    const seg = a.segment || 'retail_mfi';
    if (seg === 'msme_retail') {
      const r = PIQ.overlap.msmeRetail();
      const top = r.member[0];
      return {
        answer: {
          paras: [`**${F().pct(r.funnel[1].pct, 0)}** of live MSME borrowers are linked to individuals (directors, partners, proprietors, guarantors), and in **${F().pct(r.funnel[2].pct, 0)}** a promoter holds a live retail loan.`, `Promoters slip first: in **${F().pct(r.stats.precededPct, 0)}** of MSMEs that turned 90+, a promoter's retail loan went 30+ in the prior six months, with a median lead of **${r.stats.medianLeadMonths} months**.`],
          bullets: [`Promoter retail 30+ is ${F().pct(r.byStatus[3].rate, 1)} when the entity is 90+ vs ${F().pct(r.byStatus[0].rate, 1)} when it is current.`, `Your watchlist: **${top.name}** has the highest share of MSME borrowers whose promoters slipped on retail credit in the last 90 days (${F().pct(top.pct, 1)}, ${F().cr(top.exposure)} exposure).`],
          chart: (el) => PIQ.charts.bars(el, { items: r.member.slice(0, 6).map((x) => ({ label: x.name, value: x.pct })), fmt: (v) => F().pct(v, 1), color: 'var(--s1)' }),
          sources: src('overlap', 'member'), filters: 'Commercial × retail · MSME promoters',
          followups: ['What is driving the change in MSME in Tamil Nadu?', 'How many microfinance borrowers also have retail loans?'],
          link: { view: 'overlaps', params: {} }
        },
        facts: { linked: F().pct(r.funnel[1].pct, 0), promoterRetail: F().pct(r.funnel[2].pct, 0), precededDefaults: F().pct(r.stats.precededPct, 0), medianLeadMonths: r.stats.medianLeadMonths, topWatchState: top.name }
      };
    }
    const r = PIQ.overlap.retailMfi();
    const exp = r.member.reduce((acc, x) => acc + x.exposure, 0);
    return {
      answer: {
        paras: [`Of **${r.base.toFixed(0)} crore** live microfinance borrowers, **${F().pct(r.funnel[1].pct, 0)}** (${r.funnel[1].cr.toFixed(1)} Cr) have a retail footprint (enquiries, live or closed retail loans) and **${F().pct(r.funnel[2].pct, 0)}** (${r.funnel[2].cr.toFixed(1)} Cr) hold a live MFI and a live retail loan at the same time.`],
        bullets: [
          `Retail 30+ DPD of overlap borrowers **${F().pct(r.del.retailOverlap, 1)}** vs ${F().pct(r.del.retailOthers, 1)} for other borrowers (${(r.del.retailOverlap / r.del.retailOthers).toFixed(1)}×); their MFI 30+ is ${F().pct(r.del.mfiOverlap, 1)} vs ${F().pct(r.del.mfiOnly, 1)} for MFI-only borrowers.`,
          `Most-held retail products: ${r.products.slice(0, 4).map((x) => x.name + ' ' + F().pct(x.share, 0)).join(', ')}. Highest overlap: ${r.states.slice(0, 3).map((x) => x.name + ' ' + F().pct(x.rate, 0)).join(', ')}.`,
          `Your exposure: **${F().cr(exp)}** of retail lending to live MFI borrowers; their 30+ DPD is 2–3× your other borrowers'.`
        ],
        chart: (el) => PIQ.charts.bars(el, { items: r.funnel.map((x) => ({ label: x.label, value: x.pct })), fmt: (v) => F().pct(v, 0), color: 'var(--s1)' }),
        sources: src('overlap', 'industry', 'member'), filters: 'Retail × microfinance · bureau-wide',
        followups: ['How risky are my retail borrowers who also have MFI loans?', 'Do MSME promoters\' retail loans give early warning?'],
        link: { view: 'overlaps', params: {} }
      },
      facts: { mfiBaseCr: r.base, anyRetailPct: F().pct(r.funnel[1].pct, 0), liveLivePct: F().pct(r.funnel[2].pct, 0), retailDpdOverlap: F().pct(r.del.retailOverlap, 1), retailDpdOthers: F().pct(r.del.retailOthers, 1), memberExposure: F().cr(exp) }
    };
  });

  def('action_board', 'The user\'s Action Board: actions pinned from any module, with priority, owner, due date and status.', {}, [], () => {
    const open = PIQ.actions.all().filter((x) => x.status !== 'Done');
    const order = { High: 0, Medium: 1, Low: 2 };
    open.sort((a, b) => order[a.priority] - order[b.priority]);
    return {
      answer: {
        paras: [open.length ? `You have **${open.length}** open action${open.length === 1 ? '' : 's'} on your Action Board:` : 'Your Action Board is empty. Pin anything with 📌, or right-click a card and choose "Send to Action Board".'],
        bullets: open.slice(0, 8).map((x) => `**${x.priority}** · ${x.text}${x.owner ? ' (owner: ' + x.owner + ')' : ''}${x.due ? ' · due ' + x.due : ''}`),
        sources: ['Action Board'], filters: 'Open and in-progress actions',
        followups: ['What should I do about it?', 'Give me a summary for my board'],
        link: { view: 'actions', params: {} }
      },
      facts: { open: open.map((x) => ({ action: x.text, priority: x.priority, owner: x.owner, due: x.due, status: x.status })) }
    };
  });

  def('alerts', 'Early-warning alerts detected automatically across portfolio and applications.', {}, [], () => {
    const al = S.alerts();
    return {
      answer: {
        paras: [`${al.filter((x) => x.sev !== 'good').length} things need your attention, most urgent first:`],
        bullets: al.map((x) => `${x.sev === 'good' ? '✅' : x.sev === 'critical' ? '🔴' : '🟠'} **${x.title}.** ${x.detail}`),
        sources: src('member', 'industry', 'logins'), filters: 'All products · all states · automatic monitoring',
        followups: ['Why did my personal loan delinquency go up?', 'What is happening with my applications this week?', 'What should I do about it?']
      },
      facts: { alerts: al.map((x) => ({ severity: x.sev, title: x.title, detail: x.detail })) }
    };
  });

  def('market_share', 'The member\'s market share and growth vs the industry, by product (or for the whole portfolio).', { product: P_PRODUCT, state: P_STATE }, [], (a) => {
    const s = a.state || 'ALL';
    const single = a.product && a.product !== 'ALL';
    const rows = (single ? [a.product] : D.PRODUCTS.map((x) => x.id)).map((p) => { const x = PIQ.insights.snapshot(p, s); return { p, x }; })
      .sort((u, v) => (v.x.share - v.x.share12) - (u.x.share - u.x.share12));
    const prods = rows.slice(0, 3).map((r) => r.p);
    const shareSeries = (p) => S.series('member', 'bal', { p, s }).map((pt, i) => ({ x: pt.x, y: pt.y / S.series('industry', 'bal', { p, s })[i].y }));
    return {
      answer: {
        bullets: rows.map(({ p, x }) => `**${D.P[p].name}**: share **${F().pct(x.share, 2)}** (${F().pp(x.share - x.share12, 2)} YoY) · your balance ${F().cr(x.bal)} growing ${F().chg(x.growth)} vs industry ${F().chg(x.indGrowth)}`),
        paras: [rows.length > 1 ? `**${rows[0].x && D.P[rows[0].p].name}** is gaining share fastest; **${D.P[rows[rows.length - 1].p].name}** is losing the most. Ranked by change in share over 12 months${s === 'ALL' ? '' : ' in ' + sName(s)}:` : `In ${sName(s)}:`],
        chart: (el) => PIQ.charts.line(el, { series: prods.map((p, i) => ({ name: D.P[p].name, color: ['var(--s1)', 'var(--s2)', 'var(--s3)'][i], points: shareSeries(p) })), xLabel: ml, yFmt: (v) => F().pct(v, 2), yTickFmt: (v) => (v * 100).toFixed(1) + '%', height: 200, endLabels: true }),
        sources: src('member', 'industry'), filters: `${sName(s)} · market share of balance`,
        followups: ['Which states are growing fastest in personal loans?', 'Where should I grow my credit card book?']
      },
      facts: { shares: rows.map(({ p, x }) => ({ product: D.P[p].name, share: F().pct(x.share, 2), memberGrowth: F().chg(x.growth), industryGrowth: F().chg(x.indGrowth) })) }
    };
  });

  const TERMS = {
    dpd30: S.METRICS.dpd30.def, dpd90: S.METRICS.dpd90.def, cure: S.METRICS.cure.def, bal: S.METRICS.bal.def, orig: S.METRICS.orig.def,
    bands: 'Risk bands group borrowers by bureau score: ' + D.BANDS.map((b) => `${b.name} (${b.range})`).join(', ') + '.',
    mix: 'Mix effect: the change in your overall rate caused only by moving balance between segments with different risk, holding each segment\'s rate constant.',
    market: 'Market effect: the change your segments would have seen if they had moved in line with the industry in the same product, state and risk band.',
    own: 'Member-specific effect: the part of your change that the market does not explain, i.e. your segments performing better or worse than the industry.'
  };
  def('define', 'Definition of a metric or term from the approved metric catalogue.', { term: { type: 'string', enum: Object.keys(TERMS) } }, ['term'], (a) => ({
    answer: { paras: [TERMS[a.term] || 'That term is not in the approved catalogue.'], sources: ['Approved metric catalogue'], filters: 'Definitions', followups: ['What is the trend in 30+ DPD for personal loans?', 'Is the rise in my delinquency me or the market?'] },
    facts: { definition: TERMS[a.term] }
  }));

  def('datasets', 'List the approved datasets the analyst can answer from.', {}, [], () => ({
    answer: {
      paras: ['I only answer from these approved datasets. If something isn\'t in them, I\'ll say so rather than guess:'],
      bullets: Object.values(S.DATASETS).map((d) => `**${d.name}**: ${d.grain} · ${d.refresh} · as of ${d.asOf}`).concat(PIQ.uploaded ? [`**Your uploaded file** (${PIQ.uploaded.name}): private to you`] : []),
      sources: ['Platform catalogue'], filters: '—', followups: ['What should I worry about this week?', 'What is happening in personal loans?']
    },
    facts: { datasets: Object.values(S.DATASETS).map((d) => d.name) }
  }));

  def('uploaded_insight', 'Insights from the file the member uploaded: a Portfolio Review output (Consumer, Commercial, Microfinance or MFI + Consumer PR, analysed on its own) or a custom file (e.g. sourcing channel) joined to industry benchmarks.', {}, [], () => {
    const U = PIQ.uploadedPR;
    if (U && PIQ.lastUpload === 'pr') {
      const A = U.analysis;
      return {
        answer: {
          paras: [`From your uploaded **${U.label}** (${U.name}, ${U.rows.toLocaleString('en-IN')} rows, ${ml(U.months[0])} – ${ml(U.months[U.months.length - 1])}), using that file only:`].concat(A.headline ? [`**${A.headline.title}.** ${A.headline.text}`] : []),
          bullets: A.stats.map((x) => `**${x.label}:** ${x.value} (${x.note})`).concat(A.findings.map((f) => f.title)),
          sources: ['Your uploaded ' + U.label + ' (private)'], filters: U.label + ' · ' + ml(U.months[U.months.length - 1]),
          followups: ['What should I do about it?', 'What should I worry about this week?'],
          link: { view: 'upload', params: {} }
        },
        facts: { type: U.label, summary: A.ai }
      };
    }
    const ins = PIQ.uploadInsights ? PIQ.uploadInsights() : null;
    if (!ins) return {
      answer: { paras: ['You haven\'t uploaded a file yet. On Bring Your Data, upload a Consumer, Commercial, Microfinance or MFI + Consumer PR output and I\'ll summarise what it says, or upload a custom file such as your sourcing-channel split and I\'ll benchmark it against the market.'], sources: [], filters: '—', followups: [], link: { view: 'upload', params: {} } },
      facts: { uploaded: false }
    };
    const dims = Object.keys(ins.byDim);
    const [wd, ws, wb] = ins.worst.k.split('|');
    return {
      answer: {
        paras: [`From **${PIQ.uploaded.name}** (${ml(ins.last)}), joined to industry rates for the same product, state and risk band:`, `The weakest slice is **${wd}-sourced ${wb === 'NPSB' ? 'near-prime & subprime' : 'prime'} in ${D.S[ws].name}**, at **${ins.worst.idx.toFixed(2)}×** the market's delinquency for the same segments.`],
        bullets: dims.map((d) => { const x = ins.byDim[d]; return `**${d}**: 30+ DPD ${F().pct(x.d30 / x.bal)} vs market-expected ${F().pct(x.exp / x.bal)} (${(x.d30 / x.exp).toFixed(2)}×)`; }),
        chart: (el) => PIQ.charts.bars(el, { items: dims.map((d) => ({ label: d, value: ins.byDim[d].d30 / ins.byDim[d].bal, ref: ins.byDim[d].exp / ins.byDim[d].bal })), fmt: (v) => F().pct(v), color: 'var(--s1)', valueName: 'Yours', refName: 'Market-expected' }),
        sources: ['Your uploaded file (private)', S.DATASETS.industry.name], filters: `${PIQ.uploaded.dimName || 'segment'} · ${ml(ins.last)}`,
        followups: ['What should I do about it?', 'What is driving the change in Gujarat?']
      },
      facts: { worst: `${wd} ${wb} ${D.S[ws].name} ${ins.worst.idx.toFixed(2)}x market` }
    };
  });

  def('board_summary', 'A short board-ready summary of the portfolio: headline, drivers, alerts and actions.', {}, [], () => {
    const pl = PIQ.insights.snapshot('PL', 'ALL'), cc = PIQ.insights.snapshot('CC', 'ALL'), all = PIQ.insights.snapshot('ALL', 'ALL');
    const d = S.decompose({ p: 'PL', s: 'ALL', t0: C.policyChangeMonth, t1: S.latest(), dim: 'sb' });
    const dAll = S.decompose({ p: 'ALL', s: 'ALL', t0: C.policyChangeMonth, t1: S.latest() });
    const recs = PIQ.insights.recommendations('ALL');
    return {
      answer: {
        paras: [`**Board summary, ${ml(S.latest())}**`],
        bullets: [
          `Whole book ${F().cr(all.bal)}: 30+ DPD ${F().pct(all.dpd30)} (${F().bps(dAll.delta)} since ${ml(C.policyChangeMonth)} vs industry ${F().bps(dAll.indDelta)}), 90+ ${F().pct(all.dpd90)}, 180+ ${F().pct(all.dpd180)}.`,
          `Personal loan 30+ DPD ${F().pct(pl.dpd30)}, ${F().bps(d.delta)} since ${ml(C.policyChangeMonth)} (industry ${F().bps(d.indDelta)}). ${PIQ.insights.narrateDecomposition(d).verdict}`,
          `Drivers: mix ${F().bps(d.mix)}, market ${F().bps(d.market)}, member-specific ${F().bps(d.own)}; concentrated in Uttar Pradesh and Gujarat.`,
          `Credit cards: 30+ DPD ${F().pct(cc.dpd30)} vs peers ${F().pct(cc.peer30)}, a strength to build on.`,
          `Actions: ${recs.slice(0, 3).map((r) => r.title).join('; ')}.`
        ],
        sources: src('member', 'industry', 'peers', 'logins'), filters: 'Portfolio-wide',
        followups: ['Open the printable board brief'],
        link: { view: 'brief', params: {} }
      },
      facts: { summary: true }
    };
  });

  // ---------------- guardrails ----------------
  const OTHER_LENDERS = /\b(hdfc|icici|sbi|state bank|axis|kotak|bajaj|idfc|yes bank|indusind|federal bank|bank of baroda|\bbob\b|pnb|punjab national|canara|au small|tata capital|paytm|kreditbee|navi|moneyview|competitor'?s?|name (the|my|your) peers|who are (my|the) peers|list (of |the )?peers|which (banks|lenders|nbfcs|institutions) are in)\b/i;
  const PERSONAL = /\b(pan( number)?|aadhaar|aadhar|borrower named|customer named|mobile number|phone number|account number|date of birth|address of)\b/i;
  const OUT_OF_SCOPE = /\b(share price|stock price|stocks?|nifty|sensex|repo rate|inflation|gdp|weather|cricket|bitcoin|crypto|forecast the rbi|election|mutual fund)\b/i;

  function guard(q) {
    if (OTHER_LENDERS.test(q)) return {
      refusal: true, paras: ['I can\'t share data about any named or identifiable lender. Tenant isolation means you can only see **your own portfolio**, **anonymised peer aggregates** (at least 5 institutions, none above 25% of the group) and **industry totals**.', 'I can compare you with an anonymised peer group instead.'],
      sources: ['Governance policy: tenant isolation'], filters: 'Request blocked', followups: ['How do I compare with PVT mid-size peers?', 'Where am I worse than the market?'], guard: 'tenant-isolation'
    };
    if (PERSONAL.test(q)) return {
      refusal: true, paras: ['I don\'t have access to borrower-level or personal information. This platform works only with aggregated, non-personal portfolio and industry data, in line with CICRA and DPDP principles.'],
      sources: ['Governance policy: no personal data'], filters: 'Request blocked', followups: ['Which segments show deterioration?'], guard: 'personal-data'
    };
    if (OUT_OF_SCOPE.test(q)) return {
      refusal: true, paras: ['That\'s outside the approved datasets I can answer from, so I won\'t guess. I cover industry credit data, your portfolio, anonymised peers, applications and score distributions.'],
      sources: ['Scope control'], filters: 'Out of scope', followups: ['Which datasets can you answer from?', 'What is happening in personal loans?'], guard: 'scope'
    };
    return null;
  }

  // ---------------- entity extraction ----------------
  function extract(q) {
    const t = q.toLowerCase();
    const e = {};
    const PRODS = [['PL', /personal loan|\bpl\b|personal/], ['CC', /credit card|\bcards?\b|\bcc\b/],
      ['HL', /home loan|housing loan|\bhl\b|mortgage/], ['LAP', /\blap\b|loan against property|property loan/],
      ['AL', /auto loan|car loan|vehicle loan|\bauto\b/], ['TW', /two.?wheeler|\btw\b|bike loan/], ['GL', /gold/],
      ['MSME', /\bmsmes?\b|\bsmes?\b|small business|business loan/], ['AGRI', /\bagri|farm|kisan|\bkcc\b|crop|tractor/],
      ['MFL', /micro.?finance(?! institution)|micro.?loan|\bjlg\b/]];
    const found = PRODS.filter(([, re]) => re.test(t)).map(([id]) => id);
    if (/\b(products|portfolio|book|overall|whole)\b/.test(t) && !found.length) e.product = 'ALL';
    if (found.length > 1) e.products = found;
    if (found.length) e.product = found[0];
    const states = [];
    D.STATES.forEach((s) => { const n = s.name.toLowerCase().replace(/ \(nct\)| states/g, ''); if (t.includes(n)) states.push({ s: s.id, i: t.indexOf(n) }); });
    [['NE', /north.?east|assam|meghalaya|manipur|mizoram|nagaland|tripura|sikkim|arunachal/], ['DL', /\bdelhi\b|\bncr\b|gurgaon|gurugram/], ['JK', /kashmir|\bj&k\b/],
      ['OD', /orissa/], ['UT', /\buts?\b|union territor|ladakh|andaman|lakshadweep|puducherry|pondicherry|chandigarh/]]
      .forEach(([id, re]) => { const m = t.match(re); if (m && !states.find((x) => x.s === id)) states.push({ s: id, i: m.index }); });
    ['MH', 'TN', 'KA', 'UP', 'GJ', 'TG', 'AP', 'MP', 'WB', 'RJ', 'KL', 'PB', 'DL', 'BR'].map((id) => [id, new RegExp('\\b' + id + '\\b')]).concat([['TG', /\btelengana\b/i]]).forEach(([id, re]) => { const m = q.match(re); if (m && !states.find((x) => x.s === id)) states.push({ s: id, i: m.index }); });
    if (/\bmumbai\b|\bpune\b/.test(t)) states.push({ s: 'MH', i: 0 });
    if (/\bchennai\b/.test(t)) states.push({ s: 'TN', i: 0 });
    if (/\bbengaluru\b|\bbangalore\b/.test(t)) states.push({ s: 'KA', i: 0 });
    if (/\bahmedabad\b|\bsurat\b/.test(t)) states.push({ s: 'GJ', i: 0 });
    if (/\bhyderabad\b/.test(t)) states.push({ s: 'TG', i: 0 });
    if (/\blucknow\b|\bnoida\b/.test(t)) states.push({ s: 'UP', i: 0 });
    e.states = states.sort((a, b) => a.i - b.i).map((x) => x.s);
    if (/national|all states|overall|india|country/.test(t)) e.national = true;
    if (/super.?prime/.test(t)) e.band = 'SP';
    else if (/prime.?plus/.test(t)) e.band = 'PP';
    else if (/near.?prime/.test(t) && /sub.?prime/.test(t)) e.bandPair = true;
    else if (/near.?prime/.test(t)) e.band = 'NP';
    else if (/sub.?prime/.test(t)) e.band = 'SB';
    const LT = [['PSU', /\bpsus?\b|public sector/], ['PVT', /\bpvts?\b|private (sector )?banks?/], ['NBFC', /\bnbfcs?\b/], ['FIN', /fintech/],
      ['SFB', /\bsfbs?\b|small finance/], ['MFI', /\bmfis?\b|micro.?finance institution/], ['RRB', /\brrbs?\b|\bdccbs?\b|regional rural|co-?operative bank/], ['HFC', /\bhfcs?\b|housing finance/]];
    e.lenders = LT.filter(([, re]) => re.test(t)).map(([id]) => id);
    if (/180\+|180 plus|180 dpd|180 days/.test(t)) e.metric = 'dpd180';
    else if (/90\+|90 plus|90 dpd|\bnpa\b/.test(t)) e.metric = 'dpd90';
    else if (/cure|collection/.test(t)) e.metric = 'cure';
    else if (/30\+|delinquen|\bdpd\b|risk|deteriorat|bad rate|stress/.test(t)) e.metric = 'dpd30';
    else if (/originat|disburs/.test(t)) e.metric = 'orig';
    else if (/growth|growing|balance|book size|outstanding|\bsize\b/.test(t)) e.metric = 'bal';
    else if (/accounts/.test(t)) e.metric = 'acc';
    const cm = t.match(/\b(5[5-9]\d|[6-8]\d\d)\b/);
    if (cm) e.cutoff = +cm[1];
    e.self = /\b(my|me|i|mine|our|we|us|i'm|am i|portfolio)\b/.test(t);
    if (/since feb|february/.test(t)) e.from = '2026-02';
    else if (/last (6|six) months/.test(t)) e.from = S.monthsAgo(6);
    else if (/last year|12 months|yoy|this year/.test(t)) e.from = S.monthsAgo(12);
    const pvt = e.lenders.includes('PVT');
    if (pvt && /mid/.test(t)) e.peer = 'mid-pvt';
    else if (pvt && /large/.test(t)) e.peer = 'large-pvt';
    else if (pvt && /\ball\b/.test(t)) e.peer = 'all-pvt';
    else if (e.lenders.length === 1 && /benchmark|peer|against|compare/.test(t)) e.peer = { PVT: 'all-pvt', PSU: 'psu', NBFC: 'nbfc', FIN: 'fin', SFB: 'sfb', MFI: 'mfi', RRB: 'rrb', HFC: 'hfc' }[e.lenders[0]];
    return e;
  }

  // ---------------- intent routing ----------------
  const ctx = { product: 'ALL', state: 'ALL', metric: 'dpd30', intent: null, who: 'industry' };
  function route(q) {
    const t = q.toLowerCase().trim();
    const e = extract(q);
    const followUp = /^(and|now|what about|how about|same|compare (that|it|this)|and for|then)\b/.test(t) || /\b(that|it)\b/.test(t) && t.split(' ').length < 9;
    const p = e.product || (followUp ? ctx.product : 'ALL');
    const st = e.states.length ? e.states[0] : followUp ? ctx.state : 'ALL';
    const metric = e.metric || (followUp ? ctx.metric : null);

    const call = (name, args) => ({ name, args });
    if (/which datasets|what can you|what can i ask|^help\b|what data/.test(t)) return call('datasets', {});
    if (/open the printable|open the board/.test(t)) return { name: 'nav', args: { view: 'brief' } };
    if (!/mix|trend|happening/.test(t) && /defin|meaning|^what('s| is) (a |the )?(30\+|90\+|cure rate|dpd|near.?prime|sub.?prime|super.?prime|prime.?plus|mix effect|market effect|risk band)/.test(t)) {
      const term = /cure/.test(t) ? 'cure' : /90/.test(t) ? 'dpd90' : /30|dpd/.test(t) ? 'dpd30' : /mix/.test(t) ? 'mix' : /market effect/.test(t) ? 'market' : /prime|band/.test(t) ? 'bands' : 'dpd30';
      return call('define', { term });
    }
    if (/upload|my file|sourcing channel|\bchannel|\bdsa\b|\bpr\b|portfolio review/.test(t)) return call('uploaded_insight', {});
    if (/action board|my actions|to.?do list|open actions|action items/.test(t)) return call('action_board', {});
    if (/overlap|also (have|hold)|director|promoter|related part|commercial.*retail|retail.*(microfinance|mfi)|(microfinance|mfi).*(retail|also)/.test(t))
      return call('overlap', { segment: /director|promoter|related part|msme|commercial/.test(t) ? 'msme_retail' : 'retail_mfi' });
    if (/weekly|fortnight|fresh bounce|\bbounces?\b|repayment|first.?payment|\bfpd\b|monthly file|current balance/.test(t))
      return call('fresh_signals', { product: p, state: st, cadence: /fortnight/.test(t) ? 'fortnightly' : 'weekly' });
    if (/worry|alert|early.?warning|attention|concern|red flag/.test(t)) return call('alerts', {});
    if (/board|summary|summari[sz]e|brief/.test(t)) return call('board_summary', {});
    if (/cut.?off|cutoff|what if|simulat|tighten|loosen/.test(t)) return call('simulate_cutoff', { product: p, state: st, cutoff: /best|optimal|optimum|ideal/.test(t) ? 0 : e.cutoff || 0 });
    if (/same.?day|more than (one|1) (enquir|inquir)|multiple (enquir|inquir)|1\+ (enquir|inquir)|loan.?stack|rate.?shop/.test(t))
      return call('same_day_enquiries', { product: p, state: st, days: /30|month/.test(t) ? 30 : /15|fortnight/.test(t) ? 15 : 7 });
    if (/ticket|loan size|size of (the |my )?loans|average loan|amount (asked|requested)|loan amount/.test(t))
      return call('ticket_size', { product: p === 'ALL' ? 'PL' : p, state: st });
    if (/pin.?code|\bpins?\b|probability of default|\bpd\b|credit profile|new.to.credit|thin.file|leveraged|score band|last 7 days|login quality|quality of (my )?(logins|applications)/.test(t))
      return call('login_quality', { product: p, state: st, focus: /pin/.test(t) ? 'pin' : /profile|new.to.credit|thin.file|leveraged/.test(t) ? 'profile' : /score band/.test(t) ? 'score' : /probability|\bpd\b/.test(t) ? 'pd' : 'all' });
    if (/application|login|enquir|inquir|applicant|approval rate|this week/.test(t)) return call('application_pulse', { product: p, state: st, bands: /surge|coming from/.test(t) ? 'near_prime_subprime' : e.bandPair ? 'near_prime_subprime' : 'all' });
    if (/what should i do|recommend|action|what to do|where should|what do you suggest|how (do|can) i fix|\bgrow my/.test(t) || /what should .* do/.test(t))
      return call('recommend', { product: /credit card|card/.test(t) && /grow/.test(t) ? 'CC' : p, state: e.states[0] || 'ALL', focus: /collection/.test(t) ? 'collections' : /grow/.test(t) ? 'growth' : 'all' });
    if (/band mix|risk band mix|risk mix|taking more risk|mix of/.test(t)) return call('band_mix', { product: p, state: st, who: e.self ? 'member' : 'industry' });
    if (/(growth|growing).*(versus|vs|against|compared|than)/.test(t)) return call('market_share', { product: e.product, state: st });
    if (/why|driv|reason|cause|contribut|which segments|me or the market|explain|how much of the change|what changed|open the full analysis/.test(t)) {
      if (/open the full/.test(t)) return { name: 'nav', args: { view: 'why' } };
      return call('explain_change', { product: p, state: st, metric: S.DPD_METRICS.includes(metric) ? metric : 'dpd30', from_month: e.from });
    }
    if (/better than the market|worse than the market|where am i (better|worse)|outperform|underperform/.test(t)) return call('where_differ', { product: p, metric: metric || 'dpd30', direction: /better|outperform/.test(t) ? 'better' : 'worse' });
    if (/market share|gaining share|\bshare\b/.test(t)) return call('market_share', { product: e.products ? undefined : e.product, state: st });
    if (/peer|benchmark|how do i compare|how am i|how is my|performing against|versus the industry|vs (the )?industry|compared? (with|to|it with) my|against the industry|my portfolio|compare my/.test(t) || (followUp && e.self && /compare/.test(t)))
      return call('benchmark', { metric: metric === 'bal' || metric === 'orig' || !metric ? 'dpd30' : metric, product: p, state: st, peer_group: e.peer });
    const lenders = e.lenders;
    if (lenders.length >= 2 || (lenders.length === 1 && /perform|compare|lenders|how are/.test(t) && !e.self)) {
      if (lenders.length === 1) return call('trend', { metric: metric || 'dpd30', product: p, states: [st], lender: lenders[0], who: 'industry' });
      return call('lender_types', { metric: metric || 'dpd30', product: p, state: st });
    }
    if (/which state|which region|states|regions|fastest|highest|lowest|weakest|strongest|rank|significant changes/.test(t) && e.states.length < 2)
      return call('rank_states', { metric: /growth|growing|fastest/.test(t) && !/deteriorat/.test(t) ? 'bal' : metric || 'dpd30', product: p, who: e.self ? 'member' : 'industry', growth: /growth|growing|fastest/.test(t) && !/deteriorat/.test(t), band: e.band });
    // comparisons across states / follow-ups
    if (e.states.length >= 2) return call('trend', { metric: metric || 'dpd30', product: p, states: e.states, who: e.self ? 'member' : 'industry' });
    if (e.states.length === 1 && (e.national || (followUp && /compare/.test(t)))) {
      const base = e.national ? 'ALL' : ctx.state && ctx.state !== e.states[0] ? ctx.state : 'ALL';
      return call('trend', { metric: metric || ctx.metric || 'dpd30', product: p, states: [base, e.states[0]], who: e.self ? 'member' : 'industry' });
    }
    if (e.product || e.products || e.metric || e.states.length || /happening|trend|industry|market|how is|how are/.test(t)) {
      if (e.products && /gaining|share/.test(t)) return call('market_share', { state: st });
      return call('trend', { metric: metric || (/happening|what is going on/.test(t) ? 'dpd30' : 'dpd30'), product: p, states: [st], band: e.band, lender: e.lenders[0], who: e.self ? 'both' : 'industry' });
    }
    if (followUp && ctx.intent) return call(ctx.intent, Object.assign({}, ctx.args || {}));
    return null;
  }

  // ---------------- public API ----------------
  function run(name, args, by) {
    const tool = tools[name];
    if (!tool) throw new Error('Unknown tool ' + name);
    S.log('ai.' + name, args, by || 'ai');
    const out = tool.run(args || {});
    // remember context for follow-ups
    const a = args || {};
    if (a.product) ctx.product = a.product;
    if (a.state) ctx.state = a.state;
    if (a.states && a.states.length) ctx.state = a.states[a.states.length - 1];
    if (a.metric) ctx.metric = a.metric;
    ctx.intent = name; ctx.args = a;
    out.answer.tools = [{ name, args: a }];
    return out;
  }

  function answer(q) {
    const g = guard(q);
    if (g) { S.log('ai.guardrail', { rule: g.guard, q: q.slice(0, 80) }, 'ai'); return { answer: g, facts: { refused: g.guard } }; }
    const r = route(q);
    if (!r) return {
      answer: { paras: ['I\'m not sure I understood. I answer questions about industry credit trends, your portfolio, peer benchmarks, why metrics changed, policy simulations and application trends. Try one of these:'], sources: [], filters: '', followups: ['What should I worry about this week?', 'What is happening in personal loans?', 'Why did my personal loan delinquency go up?'] },
      facts: {}
    };
    if (r.name === 'nav') { PIQ.go(r.args.view); return { answer: { paras: ['Opening the full analysis…'], sources: [], filters: '' }, facts: {} }; }
    return run(r.name, r.args, 'ai');
  }

  PIQ.agent = { tools, answer, run, guard, route, extract, ctx };
})();
