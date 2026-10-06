/* Command Centre — the Monday-morning view: what changed, is it me or the market, what to do. */
(function () {
  const PIQ = window.PIQ;
  const { h, fmt, ml, state, card, stat, tone, sourceText, pageHead, productStateFilters, stateName, prodName, prodLong } = PIQ.ui;
  const S = PIQ.sem, D = PIQ.data, C = PIQ.config;
  PIQ.views = PIQ.views || {};


  // ---------- Early-warning alerts: the hero of the page ----------
  const ALERT_VIEW = { logins: 'logins', fresh: 'fresh', positive: 'benchmark', ticket: 'overview', risk: 'why' };
  const ALERT_KIND = { logins: 'applications', fresh: 'weekly data', ticket: 'ticket size', risk: 'portfolio', positive: 'portfolio' };
  function alertsBand(root) {
    const all = S.alerts();
    const list = all.slice(0, 9);
    const ac = h('section', 'card alerts-hero', root);
    const ah = h('div', 'alerts-head', ac);
    const at = h('div', null, ah);
    h('h2', null, at, 'Early-warning alerts');
    h('div', 'sub', at, 'Found automatically in 30+ DPD, weekly bounces, daily applications and ticket sizes. Nobody had to ask.');
    const counts = h('div', 'alert-counts', ah);
    [['critical', 'critical'], ['serious', 'serious'], ['good', 'opportunity']].forEach(([k, label]) => {
      const n = all.filter((x) => x.sev === k).length;
      if (n) h('span', 'count ' + k, counts, `${n} ${label}${n > 1 && k !== 'good' ? '' : ''}`);
    });
    const grid = h('div', 'alert-grid', ac);
    list.forEach((a) => {
      const row = h('article', 'alert-tile ' + a.sev, grid);
      const top = h('div', 'alert-top', row);
      h('span', 'sev ' + a.sev, top, a.sev === 'good' ? '✓' : '!');
      h('span', 'sev-label', top, (a.sev === 'good' ? 'Opportunity' : a.sev) + ' · ' + (ALERT_KIND[a.kind] || 'portfolio'));
      h('div', 'alert-title', row, a.title);
      h('div', 'alert-detail', row, a.detail);
      const ab = h('div', 'alert-actions', row);
      const btn = h('button', 'btn sm primary', ab, 'Open →');
      PIQ.actions.pinButton(ab, () => ({ text: a.title, detail: a.detail, extra: { p: a.p || 'ALL', s: a.s || 'ALL', priority: a.sev === 'critical' ? 'High' : 'Medium' } }));
      btn.addEventListener('click', () => PIQ.go(ALERT_VIEW[a.kind] || 'why', Object.assign({ p: a.p, s: a.s || undefined }, a.kind === 'ticket' ? { measure: 'ats' } : {})));
    });
    if (all.length > list.length) h('div', 'small muted', ac, `+ ${all.length - list.length} more · ask the AI analyst "show me the early-warning alerts" for the full list`).style.marginTop = '10px';
  }

  // ---------- Hero, delinquency measure: the one number and is it me or the market ----------
  function dpdHero(root, p, s, met, MS, snap) {
    const dec = S.decompose({ p, s, t0: C.policyChangeMonth, t1: S.latest(), metric: met });
    const nar = PIQ.insights.narrateDecomposition(dec);
    const hc = h('div', 'card hero-card', root);
    const hg = h('div', 'grid g2', hc);
    const left = h('div', null, hg), right = h('div', null, hg);
    h('div', 'stat-label', left, `${MS} · ${prodName(p)} · ${stateName(s)} · ${ml(S.latest())}`);
    const hr = h('div', null, left);
    hr.style.cssText = 'display:flex;align-items:flex-end;gap:18px;flex-wrap:wrap;margin:6px 0 10px';
    h('div', 'hero', hr, fmt.pct(snap.dpd));
    const dd = h('div', null, hr);
    h('div', 'stat-delta ' + tone(met, dec.delta), dd, fmt.bps(dec.delta) + ' since ' + ml(C.policyChangeMonth));
    h('div', 'stat-delta muted', dd, 'Industry ' + fmt.bps(dec.indDelta) + (snap.peer != null ? ' · Peers ' + fmt.bps(snap.peer - snap.peer6) + ' (6m)' : ''));
    const call = h('div', 'callout insight', left);
    h('h4', null, call, nar.verdict);
    h('p', null, call, nar.drivers);
    const tot = Math.abs(dec.mix) + Math.abs(dec.market) + Math.abs(dec.own) || 1;
    const sb = h('div', 'split-bar', left);
    [['Mix shift', dec.mix, 'var(--s1)'], ['Market', dec.market, 'var(--s3)'], ['Member-specific', dec.own, 'var(--s2)']].forEach(([n, v, c]) => {
      const seg = h('div', null, sb, Math.abs(v) / tot > 0.12 ? Math.round((Math.abs(v) / tot) * 100) + '%' : '');
      seg.style.cssText = `flex:${Math.abs(v) / tot};background:${c}`;
      seg.title = n + ': ' + fmt.bps(v);
    });
    const lg = h('div', 'split-legend', left);
    [['Mix shift', dec.mix, 'var(--s1)'], ['Market', dec.market, 'var(--s3)'], ['Member-specific', dec.own, 'var(--s2)']].forEach(([n, v, c]) => {
      const it = h('span', null, lg, `${n} ${fmt.bps(v)}`);
      it.style.setProperty('--c', c);
    });
    const go = h('div', null, left);
    go.style.cssText = 'display:flex;gap:8px;margin-top:14px;flex-wrap:wrap';
    const b1 = h('button', 'btn primary', go, 'Why did it change? →');
    b1.addEventListener('click', () => PIQ.go('why'));
    const b2 = h('button', 'btn', go, '✦ Ask the AI analyst');
    b2.addEventListener('click', () => PIQ.openDrawer(`Why did my ${p === 'ALL' ? 'portfolio' : D.P[p].name.toLowerCase()} delinquency go up${s !== 'ALL' ? ' in ' + D.S[s].name : ''}?`));
    const tv = h('div', 'viz', right);
    PIQ.charts.line(tv, {
      series: [{ name: C.member.name, color: 'var(--s1)', points: S.series('member', met, { p, s }) }, { name: 'Peers (' + (S.PEER_GROUPS.find((g) => g.id === state.peer) || S.PEER_GROUPS[0]).name + ')', color: 'var(--s2)', points: S.peerSeries(state.peer, met, { p, s }).points }, { name: 'Industry', color: 'var(--s3)', points: S.series('industry', met, { p, s }) }],
      xLabel: ml, yFmt: (v) => fmt.pct(v), yTickFmt: fmt.metricTick(met), endLabels: true, height: 260,
      annotations: p === 'PL' || p === 'ALL' ? [{ x: C.policyChangeMonth, label: p === 'PL' ? `Cut-off ${C.previousCutoff.PL}→${C.currentCutoff.PL}` : 'PL cut-off loosened' }] : []
    });
    h('div', 'source', hc, sourceText(['member', 'peers', 'industry'], 'mix / market / member-specific decomposition'));
  }

  // ---------- Hero, ticket-size measure: are bigger loans going to riskier borrowers? ----------
  const WEAK = ['NP', 'SB'], PRIME = ['SP', 'PP', 'PR'];
  function ticketRisk(p, s) {
    const t = S.latest(), t0 = C.policyChangeMonth;
    const v = (src, b, m) => S.value(src, 'ats', { p, s, b, m });
    const wR = v('member', WEAK, t) / v('industry', WEAK, t), sR = v('member', PRIME, t) / v('industry', PRIME, t);
    const wM = v('member', WEAK, t) / v('member', WEAK, t0) - 1, wI = v('industry', WEAK, t) / v('industry', WEAK, t0) - 1;
    return { p, wR, sR, wM, wI, flag: wR > sR * 1.12 && wM > wI + 0.05 };
  }
  function ticketHero(root, p, s) {
    const t = S.latest(), t12 = S.monthsAgo(12), t0 = C.policyChangeMonth;
    // with all products selected, the risk check runs on the product where the gap is widest
    const rp = p !== 'ALL' ? p : D.PRODUCTS.map((x) => ticketRisk(x.id, s)).sort((a, b) => b.wR / b.sR - a.wR / a.sR)[0].p;
    const r = ticketRisk(rp, s);
    const f = { p, s };
    const mv = S.value('member', 'ats', Object.assign({ m: t }, f)), mv12 = S.value('member', 'ats', Object.assign({ m: t12 }, f));
    const iv = S.value('industry', 'ats', Object.assign({ m: t }, f)), iv12 = S.value('industry', 'ats', Object.assign({ m: t12 }, f));
    const group = S.PEER_GROUPS.find((g) => g.id === state.peer) || S.PEER_GROUPS[0];
    const pv = S.peerValue(group.id, 'ats', Object.assign({ m: t }, f));
    const hc = h('div', 'card hero-card', root);
    const hg = h('div', 'grid g2', hc);
    const left = h('div', null, hg), right = h('div', null, hg);
    h('div', 'stat-label', left, `Average ticket size · new loans · ${prodName(p)} · ${stateName(s)} · ${ml(t)}`);
    const hr = h('div', null, left);
    hr.style.cssText = 'display:flex;align-items:flex-end;gap:18px;flex-wrap:wrap;margin:6px 0 10px';
    h('div', 'hero', hr, fmt.inr(mv));
    const dd = h('div', null, hr);
    h('div', 'stat-delta', dd, fmt.chg(mv / mv12 - 1) + ' in a year');
    h('div', 'stat-delta muted', dd, 'Industry ' + fmt.inr(iv) + ' (' + fmt.chg(iv / iv12 - 1) + ')' + (pv != null ? ' · Peers ' + fmt.inr(pv) : ''));
    const cl = h('div', 'callout ' + (r.flag ? 'danger' : 'insight') + ' ticket-risk', left);
    const ch = h('div', null, cl); ch.style.cssText = 'display:flex;gap:10px;justify-content:space-between;align-items:flex-start';
    const title = r.flag ? `Bigger loans to riskier borrowers: ${prodName(rp)} near-prime & subprime tickets are ${r.wR.toFixed(2)}× the market's` : `${prodName(rp)}: ticket sizes track the market across risk bands`;
    const body = r.flag
      ? `Against ${r.sR.toFixed(2)}× in prime bands. Since ${ml(t0)} your weak-band ticket grew ${fmt.chg(r.wM, 0)} while the market's grew ${fmt.chg(r.wI, 0)}. Bigger loans to riskier borrowers raise the loss on every default: consider a ticket cap by score band alongside the cut-off.`
      : `${r.sR.toFixed(2)}× the market in prime bands and ${r.wR.toFixed(2)}× in near-prime & subprime. A gap that is the same across bands usually reflects your customer mix, not extra risk.`;
    h('h4', null, ch, title);
    PIQ.actions.pinButton(ch, () => ({ text: title, detail: body }));
    h('p', null, cl, body);
    const go = h('div', null, left);
    go.style.cssText = 'display:flex;gap:8px;margin-top:14px;flex-wrap:wrap';
    const b2 = h('button', 'btn primary', go, '✦ Ask the AI analyst');
    b2.addEventListener('click', () => PIQ.openDrawer(`What is my average ${prodName(rp).toLowerCase()} ticket size vs the market?`));
    const b3 = h('button', 'btn', go, 'Compare with peers →');
    b3.addEventListener('click', () => PIQ.go('benchmark', { p: rp, measure: 'ats' }));
    const ps = S.peerSeries(group, 'ats', f);
    const tv = h('div', 'viz', right);
    PIQ.charts.line(tv, {
      series: [{ name: C.member.name, color: 'var(--s1)', points: S.series('member', 'ats', f) }].concat(ps.suppressed ? [] : [{ name: 'Peers (' + group.name + ')', color: 'var(--s2)', points: ps.points }]).concat([{ name: 'Industry', color: 'var(--s3)', points: S.series('industry', 'ats', f) }]),
      xLabel: ml, yFmt: fmt.inr, yTickFmt: fmt.metricTick('ats'), endLabels: true, height: 260,
      annotations: [{ x: t0, label: rp === 'PL' ? `PL cut-off ${C.previousCutoff.PL}→${C.currentCutoff.PL}` : 'Feb 26' }]
    });
    h('div', 'source', hc, sourceText(['member', 'peers', 'industry'], 'ticket = value disbursed ÷ new accounts, bureau-reported at opening'));

    // ticket-size dashboards on this page
    const g = h('div', 'grid g2', root);
    g.style.marginTop = '16px';
    const bands = D.BANDS.map((b) => ({ b, m: S.value('member', 'ats', { p: rp, s, b: b.id, m: t }), i: S.value('industry', 'ats', { p: rp, s, b: b.id, m: t }), md: S.value('member', 'dpd30', { p: rp, s, b: b.id, m: t }) }));
    const c1 = card(g, {
      title: `Ticket size by risk band · ${prodName(rp)}`, sub: `${ml(t)} · you vs industry (tick) · the gap should not widen as risk rises`,
      source: sourceText(['member', 'industry']),
      table: () => ({ cols: [{ name: 'Band' }, { name: 'Your ticket', r: 1 }, { name: 'Industry', r: 1 }, { name: 'You ÷ market', r: 1 }, { name: 'Your 30+ DPD', r: 1 }], rows: bands.map((x) => [`${x.b.name} (${x.b.range})`, fmt.inr(x.m), fmt.inr(x.i), (x.m / x.i).toFixed(2) + '×', fmt.pct(x.md)]) })
    });
    PIQ.charts.bars(c1.viz, { items: bands.map((x) => ({ label: x.b.name, value: x.m, ref: x.i })), fmt: fmt.inr, color: 'var(--s1)', valueName: 'You', refName: 'Industry' });
    if (s === 'ALL') {
      const sts = D.STATES.map((x) => ({ x, o: S.value('member', 'orig', { p: rp, s: x.id, m: t }), m: S.value('member', 'ats', { p: rp, s: x.id, b: WEAK, m: t }), m0: S.value('member', 'ats', { p: rp, s: x.id, b: WEAK, m: t0 }), i: S.value('industry', 'ats', { p: rp, s: x.id, b: WEAK, m: t }) }));
      const tot = sts.reduce((a, x) => a + x.o, 0);
      const rows = sts.filter((x) => x.o >= tot * 0.02 && x.m && x.m0).sort((a, b) => b.m / b.m0 - a.m / a.m0).slice(0, 10);
      const c2 = card(g, {
        title: `Near-prime & subprime tickets by state · ${prodName(rp)}`, sub: `${ml(t)} vs ${ml(t0)} (tick) · states with 2%+ of your disbursal · fastest growth first`,
        source: sourceText(['member', 'industry']),
        table: () => ({ cols: [{ name: 'State' }, { name: ml(t0), r: 1 }, { name: ml(t), r: 1 }, { name: 'Growth', r: 1 }, { name: 'Market now', r: 1 }], rows: rows.map((x) => [x.x.name, fmt.inr(x.m0), fmt.inr(x.m), fmt.chg(x.m / x.m0 - 1), fmt.inr(x.i)]) })
      });
      PIQ.charts.bars(c2.viz, { items: rows.map((x) => ({ label: x.x.name, value: x.m, ref: x.m0 })), fmt: fmt.inr, color: 'var(--s2)', valueName: ml(t), refName: ml(t0) });
    }
  }

  function render(root) {
    const p = state.p, s = state.s, met = state.dpd, MS = S.METRICS[met].short;
    const snap = PIQ.insights.snapshot(p, s, met);
    pageHead(root, `Good morning, ${C.member.user.split(' ')[0]}`, `Here's what changed in your ${p === 'ALL' ? 'entire portfolio' : prodLong(p).toLowerCase() + ' book'}, whether it's you or the market, and what to do about it.`);
    productStateFilters(root, { dpd: true, measure: true });

    alertsBand(root);
    if (state.measure === 'ats') ticketHero(root, p, s); else dpdHero(root, p, s, met, MS, snap);

    // KPI tiles
    h('div', 'section-title', root, 'Portfolio at a glance');
    const tiles = h('div', 'grid g4', root);
    const sp = (src, metric) => S.series(src, metric, { p, s }).slice(-12).map((x) => x.y);
    stat(tiles, { label: 'Outstanding balance', value: fmt.cr(snap.bal), delta: fmt.chg(snap.growth), deltaTone: 'good', deltaNote: 'YoY · industry ' + fmt.chg(snap.indGrowth), spark: sp('member', 'bal') });
    stat(tiles, { label: 'Market share', value: fmt.pct(snap.share, 2), delta: fmt.pp(snap.share - snap.share12, 2), deltaTone: snap.share >= snap.share12 ? 'good' : 'bad', deltaNote: 'vs 12m ago', spark: S.series('member', 'bal', { p, s }).slice(-12).map((x, i) => x.y / S.series('industry', 'bal', { p, s }).slice(-12)[i].y) });
    stat(tiles, { label: 'Delinquency buckets', value: '90+ ' + fmt.pct(snap.dpd90), delta: '30+ ' + fmt.pct(snap.dpd30) + ' · 180+ ' + fmt.pct(snap.dpd180), deltaTone: '', spark: sp('member', 'dpd90') });
    stat(tiles, { label: 'Collection cure rate', value: fmt.pct(snap.cure, 1), delta: fmt.pp(snap.cure - snap.cure6, 1), deltaTone: tone('cure', snap.cure - snap.cure6), deltaNote: '6m · industry ' + fmt.pct(snap.indCure, 1), spark: sp('member', 'cure') });

    // Portfolio by product (whole-book view)
    if (p === 'ALL') {
      const t = S.latest();
      const items = D.PRODUCTS.map((x) => ({ label: x.name, value: S.value('member', met, { p: x.id, s, m: t }), ref: S.value('industry', met, { p: x.id, s, m: t }), bal: S.value('member', 'bal', { p: x.id, s, m: t }) })).sort((a, b) => b.bal - a.bal);
      const g2 = h('div', 'grid g2', root);
      g2.style.marginTop = '16px';
      if (state.measure === 'ats') {
        const ti = D.PRODUCTS.map((x) => { const m = S.value('member', 'ats', { p: x.id, s, m: t }), i = S.value('industry', 'ats', { p: x.id, s, m: t }); return { label: x.name, value: m / i, m, i }; }).sort((a, b) => b.value - a.value);
        const pc = card(g2, {
          title: 'Your ticket size ÷ market, by product', sub: `${ml(t)} · 1.00× = same as the market · each product compared like for like`, source: sourceText(['member', 'industry']),
          table: () => ({ cols: [{ name: 'Product' }, { name: 'Your ticket', r: 1 }, { name: 'Industry', r: 1 }, { name: 'You ÷ market', r: 1 }], rows: ti.map((x) => [x.label, fmt.inr(x.m), fmt.inr(x.i), x.value.toFixed(2) + '×']) })
        });
        PIQ.charts.bars(pc.viz, { items: ti.map((x) => ({ label: x.label, value: x.value })), fmt: (v) => v.toFixed(2) + '×', color: 'var(--s1)' });
      } else {
        const pc = card(g2, {
          title: `${MS} by product`, sub: `${ml(t)} · tick = industry for the same product`, source: sourceText(['member', 'industry']),
          table: () => ({ cols: [{ name: 'Product' }, { name: 'Balance', r: 1 }, { name: 'You', r: 1 }, { name: 'Industry', r: 1 }], rows: items.map((x) => [x.label, fmt.cr(x.bal), fmt.pct(x.value), fmt.pct(x.ref)]) })
        });
        PIQ.charts.bars(pc.viz, { items, fmt: (v) => fmt.pct(v), color: 'var(--s1)', valueName: 'You', refName: 'Industry' });
      }
      const tot = items.reduce((a, x) => a + x.bal, 0);
      const bc = card(g2, { title: 'Where your book is', sub: 'Share of outstanding balance by product', source: sourceText(['member']) });
      PIQ.charts.bars(bc.viz, { items: items.map((x) => ({ label: x.label, value: x.bal / tot })), fmt: (v) => fmt.pct(v, 1), color: 'var(--s1)' });
      // average ticket size: one bureau variable that belongs on every front page
      const tk = card(root, { title: 'Average ticket size by product', sub: `New loans opened in ${ml(t)} · you vs industry · YoY = vs ${ml(S.monthsAgo(12))}`, source: sourceText(['member', 'industry'], 'ticket = value disbursed ÷ new accounts') });
      tk.el.style.marginTop = '16px';
      const tt = h('table', 'tbl', h('div', 'table-wrap', tk.viz));
      const th = h('tr', null, h('thead', null, tt));
      ['Product', 'Your ticket', 'Industry', 'You ÷ market', 'Your YoY', 'Market YoY'].forEach((x, i) => h('th', i ? 'r' : '', th, x));
      const tbd = h('tbody', null, tt);
      const t12 = S.monthsAgo(12);
      items.forEach((x) => {
        const pid = D.PRODUCTS.find((q) => q.name === x.label).id, ff = { p: pid, s };
        const m1 = S.value('member', 'ats', Object.assign({ m: t }, ff)), m0 = S.value('member', 'ats', Object.assign({ m: t12 }, ff));
        const i1 = S.value('industry', 'ats', Object.assign({ m: t }, ff)), i0 = S.value('industry', 'ats', Object.assign({ m: t12 }, ff));
        if (!m1 || !i1) return;
        const r = h('tr', null, tbd);
        h('td', null, r, x.label);
        h('td', 'r', r, fmt.inr(m1)); h('td', 'r', r, fmt.inr(i1)); h('td', 'r', r, (m1 / i1).toFixed(2) + '×');
        h('td', 'r ' + (m1 / m0 - 1 > i1 / i0 - 1 + 0.03 ? 'bad' : ''), r, fmt.chg(m1 / m0 - 1)); h('td', 'r', r, fmt.chg(i1 / i0 - 1));
      });
      const go = h('button', 'btn sm', tk.body, 'Switch the page to ticket size →');
      go.style.marginTop = '10px';
      go.addEventListener('click', () => PIQ.ui.setState({ measure: 'ats' }));
    }

    // What to do this week — full width
    h('div', 'section-title', root, 'What to do this week · ranked by impact, each backed by a simulation');
    const rg = h('div', 'grid g3', root);
    PIQ.insights.recommendations(p).slice(0, 3).forEach((r, i) => {
      const box = h('div', 'card', rg);
      box.style.cssText = 'display:flex;flex-direction:column;gap:8px';
      const hd = h('div', null, box); hd.style.cssText = 'display:flex;gap:10px;align-items:flex-start';
      h('div', 'reco-n', hd, String(i + 1)).style.flex = 'none';
      h('h4', null, hd, r.title).style.fontSize = '14px';
      const im = h('div', 'impact', box);
      im.style.cssText = 'display:flex;flex-direction:column;gap:3px;font-size:12.5px';
      r.impact.forEach(([k, v, t]) => { const s1 = h('span', null, im); h('span', 'muted', s1, k + ': '); h('strong', t, s1, v); });
      const btn = h('button', 'btn sm', box, { simulator: 'Simulate →', upload: 'Check your own data →', logins: 'See applications →', benchmark: 'Benchmark →' }[r.action.view] || 'Open →');
      const rowb = h('div', null, box); rowb.style.cssText = 'margin-top:auto;display:flex;gap:6px';
      rowb.appendChild(btn);
      PIQ.actions.pinButton(rowb, () => ({ text: r.title, detail: r.why + ' Impact: ' + r.impact.map(([k, v]) => k + ' ' + v).join('; '), extra: { priority: i < 2 ? 'High' : 'Medium' } }), '📌 Add to actions');
      btn.addEventListener('click', () => PIQ.go(r.action.view, r.action.params));
    });
  }

  PIQ.views.overview = { title: 'Command Centre', render };
})();
