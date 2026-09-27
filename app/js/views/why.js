/* Why did it change? — mix / market / member-specific decomposition + What should I do? */
(function () {
  const PIQ = window.PIQ;
  const { h, fmt, ml, state, card, sourceText, pageHead, productStateFilters, select, seg, stateName, prodLong } = PIQ.ui;
  const S = PIQ.sem, D = PIQ.data, C = PIQ.config;
  let t0 = C.policyChangeMonth, dim = null;

  function render(root) {
    const p = state.p, s = state.s, metric = state.dpd;
    const dims = (p === 'ALL' ? [{ id: 'psb', name: 'Product × state × band' }, { id: 'p', name: 'Product' }] : []).concat([{ id: 'sb', name: 'State × band' }, { id: 's', name: 'State' }, { id: 'b', name: 'Risk band' }]);
    if (!dim || !dims.find((x) => x.id === dim)) dim = dims[0].id;
    pageHead(root, 'Why did it change?', 'Every movement in a portfolio metric splits into three causes: you took on a riskier mix, the market got worse, or your own segments did worse than the market. Only the last two need very different responses.');
    const bar = productStateFilters(root, { dpd: true });
    select(bar, 'Compare from', D.MONTHS.slice(0, -1).map((m) => ({ id: m, name: ml(m) + (m === C.policyChangeMonth ? ' (policy change)' : '') })), t0, (v) => { t0 = v; PIQ.go('why'); });
    const tf = h('div', 'field', bar); h('label', null, tf, 'To'); const to = h('div', null, tf, ml(S.latest())); to.style.cssText = 'padding:7px 0;font-weight:600';
    seg(bar, 'Segment by', dims, dim, (v) => { dim = v; PIQ.go('why'); });

    const d = S.decompose({ p, s, t0, t1: S.latest(), dim, metric });
    const nar = PIQ.insights.narrateDecomposition(d);

    const top = h('div', 'grid g-2-1', root);
    const wc = card(top, {
      title: `${S.METRICS[metric].name}: from ${fmt.pct(d.R0)} to ${fmt.pct(d.R1)}`,
      sub: `${prodLong(p)} · ${stateName(s)} · ${ml(t0)} → ${ml(S.latest())}`,
      source: sourceText(['member', 'industry'], 'midpoint mix/rate decomposition; market effect = industry relative change in the same segment'),
      table: () => ({ cols: [{ name: 'Component' }, { name: 'Effect', r: 1 }, { name: 'Share', r: 1 }], rows: [['Start', fmt.pct(d.R0), ''], ['Mix shift', fmt.bps(d.mix), share(d, d.mix)], ['Market-wide change', fmt.bps(d.market), share(d, d.market)], ['Member-specific', fmt.bps(d.own), share(d, d.own)], ['End', fmt.pct(d.R1), '']] })
    });
    PIQ.charts.waterfall(wc.viz, {
      start: { label: ml(t0), value: d.R0 },
      steps: [
        { label: 'Mix shift', value: d.mix, note: 'More balance in riskier segments' },
        { label: 'Market-wide change', value: d.market, note: 'Industry moved the same segments' },
        { label: 'Member-specific', value: d.own, note: 'Your segments vs the market' }
      ],
      end: { label: ml(S.latest()), value: d.R1 },
      fmt: (v) => fmt.pct(v), deltaFmt: (v) => Math.round(v * 10000) + ' bps', upIsBad: true, height: 290
    });

    const nc = h('div', 'card', top);
    h('div', 'stat-label', nc, 'The verdict');
    const v = h('h2', null, nc, nar.verdict);
    v.style.cssText = 'font-size:20px;margin:6px 0 12px;line-height:1.3';
    h('p', null, nc, nar.headline);
    h('p', null, nc, nar.drivers);
    const tot = Math.abs(d.mix) + Math.abs(d.market) + Math.abs(d.own) || 1;
    const sb = h('div', 'split-bar', nc);
    [['Mix', d.mix, 'var(--s1)'], ['Market', d.market, 'var(--s3)'], ['Yours', d.own, 'var(--s2)']].forEach(([n, x, c]) => {
      const sh = Math.abs(x) / tot;
      const segm = h('div', null, sb, sh > 0.3 ? n + ' ' + Math.round(sh * 100) + '%' : sh > 0.1 ? Math.round(sh * 100) + '%' : '');
      segm.title = n;
      segm.style.cssText = `flex:${Math.abs(x) / tot};background:${c}`;
    });
    const how = h('details', null, nc);
    how.style.marginTop = '12px';
    h('summary', 'small muted', how, 'How is this calculated?');
    h('p', 'small muted', how, 'Portfolio rate = Σ (segment share × segment rate). Mix effect = Σ Δshare × average rate. Rate effect = Σ Δrate × average share, then split: "market" is what your segment would have moved had it tracked the industry\'s relative change in that same segment; "member-specific" is the remainder. The three add up exactly to the total change.');
    const ask = h('button', 'btn', nc, '✦ Ask a follow-up');
    ask.style.marginTop = '10px';
    ask.addEventListener('click', () => PIQ.openDrawer(`What is driving the change in ${s === 'ALL' ? 'my portfolio' : D.S[s].name}?`));

    // Segment table
    const segCard = card(root, { title: 'Which segments drove it', sub: 'Top contributors, largest absolute effect first', source: sourceText(['member', 'industry']) });
    segCard.el.style.marginTop = '16px';
    const list = d.segments.slice(0, dim.length > 1 || dim === 's' ? 10 : 6);
    const tw = h('div', 'table-wrap', segCard.viz);
    const t = h('table', 'tbl', tw);
    const hr = h('tr', null, h('thead', null, t));
    ['Segment', 'Share then → now', 'Your rate then → now', 'Industry rate then → now', 'Mix', 'Market', 'Member-specific', 'Total', 'Main driver'].forEach((c, i) => h('th', i ? 'r' : '', hr, c));
    const body = h('tbody', null, t);
    list.forEach((x) => {
      const r = h('tr', null, body);
      h('td', null, r, x.label);
      h('td', 'r', r, fmt.pct(x.w0, 1) + ' → ' + fmt.pct(x.w1, 1));
      h('td', 'r', r, fmt.pct(x.r0) + ' → ' + fmt.pct(x.r1));
      h('td', 'r', r, fmt.pct(x.ir0) + ' → ' + fmt.pct(x.ir1));
      h('td', 'r', r, fmt.bps(x.mix));
      h('td', 'r', r, fmt.bps(x.market));
      h('td', 'r', r, fmt.bps(x.own));
      h('td', 'r', r, fmt.bps(x.total)).style.fontWeight = '600';
      const dl = PIQ.insights.driverLabel(x);
      const td = h('td', 'r', r);
      h('span', 'tag ' + (dl === 'mix' ? 'mix' : dl === 'market' ? 'mkt' : 'own'), td, dl === 'mix' ? 'Mix shift' : dl === 'market' ? 'Market' : 'Member-specific');
    });

    // What should I do?
    h('div', 'section-title', root, 'What should I do?');
    const recs = PIQ.insights.recommendations(p).filter((r) => s === 'ALL' || !r.states.length || r.states.includes(s));
    if (!recs.length) h('div', 'empty card', root, 'No action needed for this slice. Performance is in line with the market.');
    recs.forEach((r, i) => {
      const box = h('div', 'reco', root);
      h('div', 'reco-n', box, String(i + 1));
      const tx = h('div', null, box);
      h('h4', null, tx, r.title);
      h('p', null, tx, r.why);
      const im = h('div', 'impact', tx);
      r.impact.forEach(([k, val, tn]) => { const s1 = h('span', null, im); h('span', 'muted', s1, k + ': '); h('strong', tn, s1, val); });
      const btns = h('div', null, box);
      btns.style.cssText = 'display:flex;flex-direction:column;gap:6px';
      const label = { simulator: 'Simulate →', upload: 'Check channel data →', logins: 'See applications →', benchmark: 'Benchmark →' }[r.action.view] || 'Open →';
      const b = h('button', 'btn primary sm', btns, label);
      b.addEventListener('click', () => PIQ.go(r.action.view, r.action.params));
    });
  }
  function share(d, x) {
    const tot = Math.abs(d.mix) + Math.abs(d.market) + Math.abs(d.own) || 1;
    return Math.round((Math.abs(x) / tot) * 100) + '%';
  }
  PIQ.views.why = { title: 'Why did it change?', render };
})();
