/* Command Centre — the Monday-morning view: what changed, is it me or the market, what to do. */
(function () {
  const PIQ = window.PIQ;
  const { h, fmt, ml, state, card, stat, tone, sourceText, pageHead, productStateFilters, stateName, prodName, prodLong } = PIQ.ui;
  const S = PIQ.sem, D = PIQ.data, C = PIQ.config;
  PIQ.views = PIQ.views || {};

  function render(root) {
    const p = state.p, s = state.s, met = state.dpd, MS = S.METRICS[met].short;
    const snap = PIQ.insights.snapshot(p, s, met);
    pageHead(root, `Good morning, ${C.member.user.split(' ')[0]}`, `Here's what changed in your ${p === 'ALL' ? 'entire portfolio' : prodLong(p).toLowerCase() + ' book'}, whether it's you or the market, and what to do about it.`);
    productStateFilters(root, { dpd: true });

    // Hero: the one number
    const dec = S.decompose({ p, s, t0: C.policyChangeMonth, t1: S.latest(), metric: met });
    const nar = PIQ.insights.narrateDecomposition(dec);
    const hero = h('div', 'grid g-2-1', root);
    const hc = h('div', 'card', hero);
    h('div', 'stat-label', hc, `${MS} · ${prodName(p)} · ${stateName(s)} · ${ml(S.latest())}`);
    const hr = h('div', null, hc);
    hr.style.cssText = 'display:flex;align-items:flex-end;gap:18px;flex-wrap:wrap;margin:6px 0 10px';
    h('div', 'hero', hr, fmt.pct(snap.dpd));
    const dd = h('div', null, hr);
    h('div', 'stat-delta ' + tone(met, dec.delta), dd, fmt.bps(dec.delta) + ' since ' + ml(C.policyChangeMonth));
    h('div', 'stat-delta muted', dd, 'Industry ' + fmt.bps(dec.indDelta) + (snap.peer != null ? ' · Peers ' + fmt.bps(snap.peer - snap.peer6) + ' (6m)' : ''));
    const call = h('div', 'callout insight', hc);
    h('h4', null, call, nar.verdict);
    h('p', null, call, nar.drivers);
    // split bar
    const tot = Math.abs(dec.mix) + Math.abs(dec.market) + Math.abs(dec.own) || 1;
    const sb = h('div', 'split-bar', hc);
    [['Mix shift', dec.mix, 'var(--s1)'], ['Market', dec.market, 'var(--s3)'], ['Member-specific', dec.own, 'var(--s2)']].forEach(([n, v, c]) => {
      const seg = h('div', null, sb, Math.abs(v) / tot > 0.12 ? Math.round((Math.abs(v) / tot) * 100) + '%' : '');
      seg.style.cssText = `flex:${Math.abs(v) / tot};background:${c}`;
      seg.title = n + ': ' + fmt.bps(v);
    });
    const lg = h('div', 'split-legend', hc);
    [['Mix shift', dec.mix, 'var(--s1)'], ['Market', dec.market, 'var(--s3)'], ['Member-specific', dec.own, 'var(--s2)']].forEach(([n, v, c]) => {
      const it = h('span', null, lg, `${n} ${fmt.bps(v)}`);
      it.style.setProperty('--c', c);
    });
    const go = h('div', null, hc);
    go.style.cssText = 'display:flex;gap:8px;margin-top:14px;flex-wrap:wrap';
    const b1 = h('button', 'btn primary', go, 'Why did it change? →');
    b1.addEventListener('click', () => PIQ.go('why'));
    const b2 = h('button', 'btn', go, '✦ Ask the AI analyst');
    b2.addEventListener('click', () => PIQ.openDrawer(`Why did my ${p === 'ALL' ? 'portfolio' : D.P[p].name.toLowerCase()} delinquency go up${s !== 'ALL' ? ' in ' + D.S[s].name : ''}?`));
    const mS = S.series('member', met, { p, s });
    const iS = S.series('industry', met, { p, s });
    const pS = S.peerSeries(state.peer, met, { p, s });
    const tv = h('div', 'viz', hc);
    tv.style.marginTop = '18px';
    PIQ.charts.line(tv, {
      series: [{ name: C.member.name, color: 'var(--s1)', points: mS }, { name: 'Peers (' + (S.PEER_GROUPS.find((g) => g.id === state.peer) || S.PEER_GROUPS[0]).name + ')', color: 'var(--s2)', points: pS.points }, { name: 'Industry', color: 'var(--s3)', points: iS }],
      xLabel: ml, yFmt: (v) => fmt.pct(v), yTickFmt: fmt.metricTick(met), endLabels: true, height: 230,
      annotations: p === 'PL' || p === 'ALL' ? [{ x: C.policyChangeMonth, label: p === 'PL' ? `Cut-off ${C.previousCutoff.PL}→${C.currentCutoff.PL}` : 'PL cut-off loosened' }] : []
    });
    h('div', 'source', hc, sourceText(['member', 'peers', 'industry'], 'mix / market / member-specific decomposition'));

    // Alerts
    const ac = h('div', 'card', hero);
    const ah = h('div', 'card-head', ac);
    const at = h('div', null, ah);
    h('h3', null, at, 'Early-warning alerts');
    h('div', 'sub', at, 'Detected automatically on 30+ DPD, weekly bounces and daily applications — nobody had to ask');
    S.alerts().slice(0, 6).forEach((a) => {
      const row = h('div', 'alert', ac);
      h('div', 'sev ' + a.sev, row, a.sev === 'good' ? '✓' : '!');
      const tx = h('div', null, row);
      h('div', 'sev-label', tx, a.sev === 'good' ? 'Opportunity' : a.sev + ' · ' + (a.kind === 'logins' ? 'applications' : a.kind === 'fresh' ? 'weekly data' : 'portfolio'));
      h('div', 'alert-title', tx, a.title);
      h('div', 'alert-detail', tx, a.detail);
      const ab = h('div', null, row); ab.style.cssText = 'display:flex;flex-direction:column;gap:4px';
      const btn = h('button', 'btn sm', ab, 'Open');
      PIQ.actions.pinButton(ab, () => ({ text: a.title, detail: a.detail, extra: { p: a.p || 'ALL', s: a.s || 'ALL', priority: a.sev === 'critical' ? 'High' : 'Medium' } }));
      btn.addEventListener('click', () => PIQ.go(a.kind === 'logins' ? 'logins' : a.kind === 'fresh' ? 'fresh' : a.kind === 'positive' ? 'benchmark' : 'why', { p: a.p, s: a.s || undefined }));
    });

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
      const pc = card(g2, {
        title: `${MS} by product`, sub: `${ml(t)} · tick = industry for the same product`, source: sourceText(['member', 'industry']),
        table: () => ({ cols: [{ name: 'Product' }, { name: 'Balance', r: 1 }, { name: 'You', r: 1 }, { name: 'Industry', r: 1 }], rows: items.map((x) => [x.label, fmt.cr(x.bal), fmt.pct(x.value), fmt.pct(x.ref)]) })
      });
      PIQ.charts.bars(pc.viz, { items, fmt: (v) => fmt.pct(v), color: 'var(--s1)', valueName: 'You', refName: 'Industry' });
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
      const go = h('button', 'btn sm', tk.body, 'Open Ticket Size →');
      go.style.marginTop = '10px';
      go.addEventListener('click', () => PIQ.go('tickets'));
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
      const btn = h('button', 'btn sm', box, { simulator: 'Simulate →', upload: 'Check channel data →', logins: 'See applications →', benchmark: 'Benchmark →' }[r.action.view] || 'Open →');
      const rowb = h('div', null, box); rowb.style.cssText = 'margin-top:auto;display:flex;gap:6px';
      rowb.appendChild(btn);
      PIQ.actions.pinButton(rowb, () => ({ text: r.title, detail: r.why + ' Impact: ' + r.impact.map(([k, v]) => k + ' ' + v).join('; '), extra: { priority: i < 2 ? 'High' : 'Medium' } }), '📌 Add to actions');
      btn.addEventListener('click', () => PIQ.go(r.action.view, r.action.params));
    });
  }

  PIQ.views.overview = { title: 'Command Centre', render };
})();
