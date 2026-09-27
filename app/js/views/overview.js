/* Command Centre — the Monday-morning view: what changed, is it me or the market, what to do. */
(function () {
  const PIQ = window.PIQ;
  const { h, fmt, ml, state, card, stat, tone, sourceText, pageHead, productStateFilters, stateName } = PIQ.ui;
  const S = PIQ.sem, D = PIQ.data, C = PIQ.config;
  PIQ.views = PIQ.views || {};

  function render(root) {
    const p = state.p, s = state.s;
    const snap = PIQ.insights.snapshot(p, s);
    pageHead(root, `Good morning, ${C.member.user.split(' ')[0]}`, `Here's what changed in your ${D.P[p].long.toLowerCase()} book, whether it's you or the market, and what to do about it.`);
    productStateFilters(root);

    // Hero: the one number
    const dec = S.decompose({ p, s, t0: C.policyChangeMonth, t1: S.latest(), dim: 'sb' });
    const nar = PIQ.insights.narrateDecomposition(dec);
    const hero = h('div', 'grid g-2-1', root);
    const hc = h('div', 'card', hero);
    h('div', 'stat-label', hc, `30+ DPD · ${D.P[p].name} · ${stateName(s)} · ${ml(S.latest())}`);
    const hr = h('div', null, hc);
    hr.style.cssText = 'display:flex;align-items:flex-end;gap:18px;flex-wrap:wrap;margin:6px 0 10px';
    h('div', 'hero', hr, fmt.pct(snap.dpd30));
    const dd = h('div', null, hr);
    h('div', 'stat-delta ' + tone('dpd30', dec.delta), dd, fmt.bps(dec.delta) + ' since ' + ml(C.policyChangeMonth));
    h('div', 'stat-delta muted', dd, 'Industry ' + fmt.bps(dec.indDelta) + (snap.peer30 != null ? ' · Peers ' + fmt.bps(snap.peer30 - snap.peer30_6) + ' (6m)' : ''));
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
    b2.addEventListener('click', () => PIQ.openDrawer(`Why did my ${D.P[p].name.toLowerCase()} delinquency go up${s !== 'ALL' ? ' in ' + D.S[s].name : ''}?`));
    const mS = S.series('member', 'dpd30', { p, s });
    const iS = S.series('industry', 'dpd30', { p, s });
    const pS = S.peerSeries(state.peer, 'dpd30', { p, s });
    const tv = h('div', 'viz', hc);
    tv.style.marginTop = '18px';
    PIQ.charts.line(tv, {
      series: [{ name: C.member.name, color: 'var(--s1)', points: mS }, { name: 'Peers (' + (S.PEER_GROUPS.find((g) => g.id === state.peer) || S.PEER_GROUPS[0]).name + ')', color: 'var(--s2)', points: pS.points }, { name: 'Industry', color: 'var(--s3)', points: iS }],
      xLabel: ml, yFmt: (v) => fmt.pct(v), yTickFmt: fmt.metricTick('dpd30'), endLabels: true, height: 230,
      annotations: p === 'PL' ? [{ x: C.policyChangeMonth, label: `Cut-off ${C.previousCutoff.PL}→${C.currentCutoff.PL}` }] : []
    });
    h('div', 'source', hc, sourceText(['member', 'peers', 'industry'], 'mix / market / member-specific decomposition'));

    // Alerts
    const ac = h('div', 'card', hero);
    const ah = h('div', 'card-head', ac);
    const at = h('div', null, ah);
    h('h3', null, at, 'Early-warning alerts');
    h('div', 'sub', at, 'Detected automatically — nobody had to ask');
    S.alerts().slice(0, 4).forEach((a) => {
      const row = h('div', 'alert', ac);
      h('div', 'sev ' + a.sev, row, a.sev === 'good' ? '✓' : '!');
      const tx = h('div', null, row);
      h('div', 'sev-label', tx, a.sev === 'good' ? 'Opportunity' : a.sev + ' · ' + (a.kind === 'logins' ? 'applications' : 'portfolio'));
      h('div', 'alert-title', tx, a.title);
      h('div', 'alert-detail', tx, a.detail);
      const btn = h('button', 'btn sm', row, 'Open');
      btn.addEventListener('click', () => PIQ.go(a.kind === 'logins' ? 'logins' : a.kind === 'positive' ? 'benchmark' : 'why', { p: a.p, s: a.s || undefined }));
    });

    // KPI tiles
    h('div', 'section-title', root, 'Portfolio at a glance');
    const tiles = h('div', 'grid g4', root);
    const sp = (src, metric) => S.series(src, metric, { p, s }).slice(-12).map((x) => x.y);
    stat(tiles, { label: 'Outstanding balance', value: fmt.cr(snap.bal), delta: fmt.chg(snap.growth), deltaTone: 'good', deltaNote: 'YoY · industry ' + fmt.chg(snap.indGrowth), spark: sp('member', 'bal') });
    stat(tiles, { label: 'Market share (6 states)', value: fmt.pct(snap.share, 2), delta: fmt.pp(snap.share - snap.share12, 2), deltaTone: snap.share >= snap.share12 ? 'good' : 'bad', deltaNote: 'vs 12m ago', spark: S.series('member', 'bal', { p, s }).slice(-12).map((x, i) => x.y / S.series('industry', 'bal', { p, s }).slice(-12)[i].y) });
    stat(tiles, { label: '90+ DPD', value: fmt.pct(snap.dpd90), delta: 'Industry ' + fmt.pct(snap.ind90), deltaTone: '', spark: sp('member', 'dpd90') });
    stat(tiles, { label: 'Collection cure rate', value: fmt.pct(snap.cure, 1), delta: fmt.pp(snap.cure - snap.cure6, 1), deltaTone: tone('cure', snap.cure - snap.cure6), deltaNote: '6m · industry ' + fmt.pct(snap.indCure, 1), spark: sp('member', 'cure') });

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
      btn.style.cssText = 'margin-top:auto;align-self:flex-start';
      btn.addEventListener('click', () => PIQ.go(r.action.view, r.action.params));
    });
  }

  PIQ.views.overview = { title: 'Command Centre', render };
})();
