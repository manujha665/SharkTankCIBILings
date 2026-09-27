/* Industry Intelligence — configurable, market-wide view. */
(function () {
  const PIQ = window.PIQ;
  const { h, fmt, ml, state, card, stat, sourceText, pageHead, productStateFilters, select, seg, stateName, prodLong } = PIQ.ui;
  const S = PIQ.sem, D = PIQ.data;
  let metric = 'dpd30', lender = 'ALL', mode = 'standard';

  function render(root) {
    const p = state.p, s = state.s;
    pageHead(root, 'Industry Intelligence', 'What is happening in the market, by product, state, lender type and risk band. Use the standard view or switch to self-service to configure your own.', (r) => {
      seg(r, null, [{ id: 'standard', name: 'Standard view' }, { id: 'custom', name: 'Self-service' }], mode, (v) => { mode = v; PIQ.go('industry'); });
    });
    const bar = productStateFilters(root, { dpd: mode !== 'custom' });
    if (mode === 'custom') {
      select(bar, 'Metric', Object.values(S.METRICS).map((m) => ({ id: m.id, name: m.name })), metric, (v) => { metric = v; PIQ.go('industry'); });
      select(bar, 'Lender category', [{ id: 'ALL', name: 'All' }].concat(D.LENDERS.map((l) => ({ id: l.id, name: l.name }))), lender, (v) => { lender = v; PIQ.go('industry'); });
      const save = h('button', 'btn sm', bar, '☆ Save this view');
      save.style.alignSelf = 'flex-end';
      save.addEventListener('click', () => {
        try { localStorage.setItem('piq-industry-view', JSON.stringify({ p, s, metric, lender })); } catch (e) { /* ignore */ }
        save.textContent = '★ Saved — loads next time';
      });
    } else { metric = state.dpd; lender = 'ALL'; }
    const dm = S.DPD_METRICS.includes(metric) ? metric : state.dpd;
    const f = { p, s, l: lender };
    const t = S.latest(), t12 = S.monthsAgo(12);
    const M = S.METRICS[metric];

    const tiles = h('div', 'grid g4', root);
    const bal = S.value('industry', 'bal', Object.assign({ m: t }, f)), bal12 = S.value('industry', 'bal', Object.assign({ m: t12 }, f));
    const o = S.value('industry', 'orig', Object.assign({ m: t }, f)), o12 = S.value('industry', 'orig', Object.assign({ m: t12 }, f));
    const d30 = S.value('industry', dm, Object.assign({ m: t }, f)), d30b = S.value('industry', dm, Object.assign({ m: t12 }, f));
    const cu = S.value('industry', 'cure', Object.assign({ m: t }, f)), cu12 = S.value('industry', 'cure', Object.assign({ m: t12 }, f));
    const sp = (m) => S.series('industry', m, f).slice(-12).map((x) => x.y);
    stat(tiles, { label: 'Industry balance', value: fmt.cr(bal), delta: fmt.chg(bal / bal12 - 1), deltaTone: 'good', deltaNote: 'YoY', spark: sp('bal') });
    stat(tiles, { label: 'Monthly originations', value: fmt.cr(o), delta: fmt.chg(o / o12 - 1), deltaTone: o >= o12 ? 'good' : 'bad', deltaNote: 'YoY', spark: sp('orig') });
    stat(tiles, { label: S.METRICS[dm].short, value: fmt.pct(d30), delta: fmt.bps(d30 - d30b), deltaTone: d30 > d30b ? 'bad' : 'good', deltaNote: 'YoY', spark: sp(dm) });
    stat(tiles, { label: 'Cure rate (collections)', value: fmt.pct(cu, 1), delta: fmt.pp(cu - cu12, 1), deltaTone: cu >= cu12 ? 'good' : 'bad', deltaNote: 'YoY', spark: sp('cure') });

    const g = h('div', 'grid g2', root);
    g.style.marginTop = '16px';
    if (p === 'ALL') {
      const items = D.PRODUCTS.map((x) => ({ label: x.name, value: S.value('industry', metric, { p: x.id, s, l: lender, m: t }), ref: S.value('industry', metric, { p: x.id, s, l: lender, m: t12 }) }));
      const pc = card(g, {
        cls: 'span2', title: `${M.name} by product`, sub: `${ml(t)} · tick = same month last year`, source: sourceText(['industry']),
        table: () => ({ cols: [{ name: 'Product' }, { name: ml(t), r: 1 }, { name: ml(t12), r: 1 }], rows: items.map((x) => [x.label, fmt.metric(metric, x.value), fmt.metric(metric, x.ref)]) })
      });
      PIQ.charts.bars(pc.viz, { items, fmt: (v) => fmt.metric(metric, v), color: 'var(--s1)', valueName: ml(t), refName: ml(t12) });
    }
    // Trend by lender type
    const colors = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)'];
    const lenders = lender === 'ALL' ? D.LENDERS : D.LENDERS.filter((l) => l.id === lender);
    const ser = lenders.map((l) => ({ name: l.name, color: colors[D.LENDERS.indexOf(l)], points: S.series('industry', metric, { p, s, l: l.id }) }));
    const c1 = card(g, {
      title: `${M.name} by lender category`, sub: `${prodLong(p)} · ${stateName(s)} · 24 months`,
      source: sourceText(['industry']),
      table: () => ({ cols: [{ name: 'Month' }].concat(ser.map((x) => ({ name: x.name, r: 1 }))), rows: D.MONTHS.map((m, i) => [ml(m)].concat(ser.map((x) => fmt.metric(metric, x.points[i].y)))) })
    });
    PIQ.charts.line(c1.viz, { series: ser, xLabel: ml, yFmt: (v) => fmt.metric(metric, v), yTickFmt: fmt.metricTick(metric), height: 260, zero: M.unit !== 'pct' });

    // By state
    const st = D.STATES.map((x) => ({ label: x.name, value: S.value('industry', metric, { p, s: x.id, l: lender, m: t }), ref: S.value('industry', metric, { p, s: x.id, l: lender, m: t12 }) }));
    const c2 = card(g, {
      title: `${M.name} by state`, sub: `${ml(t)} · tick = same month last year`,
      source: sourceText(['industry']),
      table: () => ({ cols: [{ name: 'State' }, { name: ml(t), r: 1 }, { name: ml(t12), r: 1 }, { name: 'Change', r: 1 }], rows: st.map((x) => [x.label, fmt.metric(metric, x.value), fmt.metric(metric, x.ref), fmt.delta(metric, M.unit === 'pct' ? x.value - x.ref : x.value / x.ref - 1)]) })
    });
    PIQ.charts.bars(c2.viz, { items: st, fmt: (v) => fmt.metric(metric, v), color: 'var(--s1)', valueName: ml(t), refName: ml(t12) });

    // Risk-band mix
    const bandColors = ['var(--r1)', 'var(--r2)', 'var(--r3)', 'var(--r4)', 'var(--r5)'];
    const months = D.MONTHS.filter((_, i) => i % 2 === 1);
    const stacks = D.BANDS.map((b, i) => ({ name: b.name, color: bandColors[i], values: months.map((m) => S.value('industry', 'bal', { p, s, l: lender, b: b.id, m })) }));
    const c3 = card(g, {
      title: 'Balance mix by risk band', sub: 'Is the market taking more risk?',
      source: sourceText(['industry']),
      table: () => ({ cols: [{ name: 'Month' }].concat(D.BANDS.map((b) => ({ name: b.name, r: 1 }))), rows: months.map((m, i) => { const tot = stacks.reduce((a, x) => a + x.values[i], 0); return [ml(m)].concat(stacks.map((x) => fmt.pct(x.values[i] / tot, 1))); }) })
    });
    PIQ.charts.stacked(c3.viz, { x: months, xLabel: ml, stacks, height: 240 });

    // Heat table: state x band 30+ DPD
    const c4 = card(g, { title: `${M.short} heatmap: state × risk band`, sub: ml(t) + ' · darker = higher', source: sourceText(['industry']) });
    const vals = [];
    D.STATES.forEach((x) => D.BANDS.forEach((b) => vals.push(S.value('industry', metric, { p, s: x.id, b: b.id, l: lender, m: t }))));
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const tb = h('table', 'tbl heat', h('div', 'table-wrap', c4.viz));
    const hr = h('tr', null, h('thead', null, tb));
    h('th', null, hr, 'State');
    D.BANDS.forEach((b) => { const th = h('th', null, hr, b.name); th.style.textAlign = 'center'; });
    const body = h('tbody', null, tb);
    D.STATES.forEach((x) => {
      const r = h('tr', null, body);
      h('td', null, r, x.name);
      D.BANDS.forEach((b) => {
        const v = S.value('industry', metric, { p, s: x.id, b: b.id, l: lender, m: t });
        const k = Math.sqrt((v - lo) / (hi - lo || 1));
        const td = h('td', 'cell', r, fmt.metric(metric, v));
        td.style.background = `color-mix(in oklab, var(--r5) ${Math.round(k * 100)}%, var(--div-mid))`;
        td.style.color = k > 0.5 ? '#fff' : 'var(--ink)';
      });
    });
  }
  PIQ.views.industry = { title: 'Industry Intelligence', render };
})();
