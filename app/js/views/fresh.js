/* Fresh Signals — what weekly / fortnightly submissions add on top of the monthly bureau file. */
(function () {
  const PIQ = window.PIQ;
  const { h, fmt, ml, state, card, stat, sourceText, pageHead, productStateFilters, seg, stateName, prodLong, prodName } = PIQ.ui;
  const S = PIQ.sem, D = PIQ.data, C = PIQ.config;
  let cadence = 'weekly';

  const USES = [
    ['📞', 'Collections', 'Call a borrower within days of a bounce, not after the month-end file. Fresh bounces are routed to the early-bucket team the same week.'],
    ['🧭', 'Risk & policy', 'See a segment deteriorate in weeks, not quarters. Tighten a cut-off or a channel before a whole vintage is booked.'],
    ['🕵', 'Fraud & first-payment default', 'First-EMI bounces on new loans flag organised or synthetic applications while the sourcing campaign is still live.'],
    ['✅', 'Underwriting', 'A bureau report that reflects last week\'s bounce elsewhere stops you lending to someone already in trouble.'],
    ['💧', 'Treasury & portfolio', 'Current balances, repayments and prepayments give a near-real-time view of run-off and liquidity.'],
    ['🏛', 'Board & regulator', 'A stress picture that is two weeks old instead of six, with the same governed definitions as the monthly view.']
  ];

  function render(root) {
    const p = state.p, s = state.s;
    pageHead(root, 'Fresh Signals: weekly & fortnightly data', `Monthly bureau files land 30–45 days after month end. Weekly and fortnightly submissions carry the latest DPD, fresh EMI bounces, repayments, current balances and first-payment defaults, so stress shows up weeks earlier. Latest week ending ${fmt.day(PIQ.hf.WEEKS[PIQ.hf.WEEKS.length - 1])} 2026; last monthly file: ${C.dataAsOf}.`);
    const bar = productStateFilters(root);
    seg(bar, 'Cadence', [{ id: 'weekly', name: 'Weekly' }, { id: 'fortnightly', name: 'Fortnightly' }], cadence, (v) => { cadence = v; PIQ.go('fresh'); });
    const f = { p, s };
    const L = PIQ.hf.latest(f, cadence);
    S.log('fresh.latest', { p, s, cadence });
    const per = cadence === 'weekly' ? 'week' : 'fortnight';
    const monthly = S.value('member', 'dpd30', { p, s, m: S.latest() });
    const m = L.mem, i = L.ind;

    const tiles = h('div', 'grid g4', root);
    stat(tiles, { label: `Latest 30+ DPD (${fmt.day(m.now.x)})`, value: fmt.pct(m.now.dpd30), delta: `Monthly file (${C.dataAsOf}) said ${fmt.pct(monthly)}`, deltaTone: m.now.dpd30 > monthly + 0.001 ? 'bad' : '' });
    stat(tiles, { label: `Fresh EMI bounce rate (this ${per})`, value: fmt.pct(m.now.bounce, 1), delta: `Prior 4 ${per}s ${fmt.pct(m.prevBounce, 1)} · industry ${fmt.pct(i.now.bounce, 1)}`, deltaTone: m.now.bounce > m.prevBounce * 1.05 ? 'bad' : '' });
    stat(tiles, { label: 'Repayments vs dues (collection efficiency)', value: fmt.pct(m.now.collEff, 1), delta: `Prior 4 ${per}s ${fmt.pct(m.prevColl, 1)} · industry ${fmt.pct(i.now.collEff, 1)}`, deltaTone: m.now.collEff < m.prevColl - 0.003 ? 'bad' : '' });
    stat(tiles, { label: 'First-payment default on new loans', value: fmt.pct(m.now.fpd, 1), delta: `Prior 4 ${per}s ${fmt.pct(m.prevFpd, 1)} · industry ${fmt.pct(i.now.fpd, 1)}`, deltaTone: m.now.fpd > i.now.fpd * 1.2 ? 'bad' : '' });

    const gap = m.now.dpd30 - monthly;
    if (Math.abs(gap) > 0.001) {
      const cl = h('div', 'callout ' + (gap > 0 ? 'danger' : 'okay'), root);
      cl.style.marginTop = '16px';
      h('h4', null, cl, gap > 0 ? `The monthly file is already out of date: 30+ DPD is ${fmt.pct(m.now.dpd30)} this week vs ${fmt.pct(monthly)} in the ${C.dataAsOf} file (${fmt.bps(gap)})` : `Improving since the monthly file: ${fmt.pct(m.now.dpd30)} vs ${fmt.pct(monthly)}`);
      h('p', null, cl, `Fresh bounces are running at ${fmt.pct(m.now.bounce, 1)} against ${fmt.pct(m.prevBounce, 1)} over the prior four ${per}s. Bounces lead 30+ DPD by roughly a month, so the next monthly file will show this, and weekly data lets you act on it now.`);
    }

    const g = h('div', 'grid g2', root);
    g.style.marginTop = '16px';
    const lab = (x) => fmt.day(x);
    const two = (key, fmtv, title, sub, extra) => {
      const c = card(g, {
        title, sub, source: sourceText(['hifreq']),
        table: () => ({ cols: [{ name: 'Period ending' }, { name: 'You', r: 1 }, { name: 'Industry', r: 1 }], rows: m.series.map((x, k) => [lab(x.x), fmtv(x[key]), fmtv(i.series[k][key])]) })
      });
      PIQ.charts.line(c.viz, Object.assign({
        series: [{ name: C.member.name, color: 'var(--s1)', points: m.series.map((x) => ({ x: x.x, y: x[key] })) }, { name: 'Industry', color: 'var(--s3)', points: i.series.map((x) => ({ x: x.x, y: x[key] })) }],
        xLabel: lab, yFmt: fmtv, height: 220, endLabels: true
      }, extra || {}));
      return c;
    };
    const monthEnd = m.series.find((x) => x.x >= '2026-08-30');
    two('dpd30', (v) => fmt.pct(v), 'Latest 30+ DPD, every ' + per, 'The line keeps moving after the last monthly file', { yTickFmt: fmt.metricTick('dpd30'), annotations: monthEnd ? [{ x: monthEnd.x, label: 'Last monthly file' }] : [] });
    two('bounce', (v) => fmt.pct(v, 1), 'Fresh EMI bounce rate', 'EMIs presented that bounced in the ' + per + ' · leads DPD by ~4 weeks', { yTickFmt: (v) => (v * 100).toFixed(0) + '%' });
    two('collEff', (v) => fmt.pct(v, 1), 'Repayments vs dues', 'Amount repaid ÷ amount due in the ' + per, { yTickFmt: (v) => (v * 100).toFixed(0) + '%' });
    // Current balance: index both to 100 so one axis compares growth honestly
    const b0 = m.series[0].bal, ib0 = i.series[0].bal;
    const cb = card(g, { title: 'Current balance trend', sub: `Indexed, first ${per} = 100 · you vs industry`, source: sourceText(['hifreq']) });
    PIQ.charts.line(cb.viz, {
      series: [{ name: C.member.name, color: 'var(--s1)', points: m.series.map((x) => ({ x: x.x, y: (x.bal / b0) * 100 })) }, { name: 'Industry', color: 'var(--s3)', points: i.series.map((x) => ({ x: x.x, y: (x.bal / ib0) * 100 })) }],
      xLabel: lab, yFmt: (v) => v.toFixed(1), height: 220, endLabels: true
    });

    // Fresh-bounce hotspots
    const hs = PIQ.hf.hotspots().slice(0, 8);
    const hc = card(root, { title: 'Fresh-bounce hotspots', sub: 'Your product × state slices where bounces jumped most in the last 2 weeks vs the prior 4, relative to the market', source: sourceText(['hifreq']) });
    hc.el.style.marginTop = '16px';
    const t = h('table', 'tbl', h('div', 'table-wrap', hc.viz));
    const hr = h('tr', null, h('thead', null, t));
    ['Product', 'State', 'Bounce rate (prior 4w → last 2w)', 'Your change', 'Industry change', 'Balance', ''].forEach((x, k) => h('th', k >= 2 && k <= 5 ? 'r' : '', hr, x));
    const tb = h('tbody', null, t);
    hs.forEach((r) => {
      const row = h('tr', null, tb);
      h('td', null, row, D.P[r.p].name);
      h('td', null, row, D.S[r.s].name);
      h('td', 'r', row, fmt.pct(r.was, 1) + ' → ' + fmt.pct(r.now, 1));
      h('td', 'r ' + (r.change - r.indChange > 0.08 ? 'bad' : ''), row, fmt.chg(r.change, 0));
      h('td', 'r', row, fmt.chg(r.indChange, 0));
      h('td', 'r', row, fmt.cr(r.bal));
      const td = h('td', null, row);
      if (r.change - r.indChange > 0.08) { const b = h('button', 'btn sm', td, 'Why? →'); b.addEventListener('click', () => PIQ.go('why', { p: r.p, s: r.s })); }
    });

    h('div', 'section-title', root, 'How weekly & fortnightly submissions get used');
    const ug = h('div', 'grid g3', root);
    USES.forEach(([ico, t2, d]) => { const c = h('div', 'card', ug); const hd = h('div', null, c); hd.style.cssText = 'display:flex;gap:10px;align-items:center;margin-bottom:6px'; h('span', 'guard-ico', hd, ico); h('h4', null, hd, t2); h('p', 'small', c, d).style.color = 'var(--ink-2)'; });
    h('p', 'small muted', root, `Showing ${prodLong(p)} · ${stateName(s)}. Weekly figures are anchored to the monthly file and use the same governed definitions; in production they come from members' weekly / fortnightly bureau submissions.`).style.marginTop = '12px';
  }
  PIQ.views.fresh = { title: 'Fresh Signals', render };
})();
