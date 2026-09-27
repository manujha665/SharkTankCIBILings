/* Login & Application Pulse — near-real-time benchmark of the member's applications vs industry. */
(function () {
  const PIQ = window.PIQ;
  const { h, fmt, state, card, stat, sourceText, pageHead, productStateFilters, seg, stateName } = PIQ.ui;
  const S = PIQ.sem, D = PIQ.data, C = PIQ.config;
  let bands = 'NPSB';

  function render(root) {
    const p = state.p, s = state.s;
    pageHead(root, 'Login & Application Pulse', `Your last 30 days of applications against the whole market, refreshed daily (T-1, to ${C.loginsAsOf}). This is the earliest signal a lender gets: it shows up months before delinquency does.`);
    const bar = productStateFilters(root);
    seg(bar, 'Risk bands', [{ id: 'ALL', name: 'All bands' }, { id: 'NPSB', name: 'Near-prime + Subprime' }], bands, (v) => { bands = v; PIQ.go('logins'); });
    const b = bands === 'NPSB' ? ['NP', 'SB'] : null;
    const f = { p, s, b };
    const c = S.loginCompare(f, 5);
    S.log('loginCompare', f);

    const tiles = h('div', 'grid g4', root);
    stat(tiles, { label: 'Your applications / day (last 5d)', value: fmt.int(c.mem.recent.perDay), delta: fmt.chg(c.mem.change, 0), deltaTone: Math.abs(c.mem.change - c.ind.change) > 0.2 ? 'bad' : '', deltaNote: 'vs prior 25 days' });
    stat(tiles, { label: 'Industry applications / day', value: fmt.count(c.ind.recent.perDay), delta: fmt.chg(c.ind.change, 0), deltaNote: 'vs prior 25 days' });
    stat(tiles, { label: 'Approval rate: you vs industry', value: fmt.pct(c.mem.recent.apprRate, 1), delta: 'Industry ' + fmt.pct(c.ind.recent.apprRate, 1), deltaTone: c.mem.recent.apprRate > c.ind.recent.apprRate + 0.03 ? 'bad' : '' });
    stat(tiles, { label: 'Applicants with 3+ enquiries in 30d', value: fmt.pct(c.mem.recent.hiEnqShare, 0), delta: 'Industry ' + fmt.pct(c.ind.recent.hiEnqShare, 0), deltaTone: c.mem.recent.hiEnqShare > c.ind.recent.hiEnqShare * 1.2 ? 'bad' : '' });

    const gap = c.mem.change - c.ind.change;
    if (Math.abs(gap) > 0.2) {
      const cl = h('div', 'callout ' + (gap > 0 ? 'danger' : 'insight'), root);
      cl.style.marginTop = '16px';
      h('h4', null, cl, gap > 0 ? `Your applications are running ${fmt.chg(gap, 0).replace('+', '')} ahead of the market in the last 5 days` : 'Your application flow is lagging the market');
      h('p', null, cl, gap > 0 ? `Market demand explains only ${fmt.chg(c.ind.change, 0)}. Check for a new sourcing campaign, a DSA push or organised applications, and make sure the extra volume isn't concentrated in weaker bands (see the mix chart below).` : 'Check if competitors are pricing more aggressively or if a sourcing channel has slowed.');
    }

    const g = h('div', 'grid g2', root);
    g.style.marginTop = '16px';
    const mem = S.loginDaily('mem', f), ind = S.loginDaily('ind', f);
    const base = (arr) => arr.slice(0, 25).reduce((a, x) => a + x.apps, 0) / 25;
    const bm = base(mem), bi = base(ind);
    const c1 = card(g, {
      title: 'Daily applications, indexed', sub: 'Prior 25-day average = 100 · one scale, so the gap is real · weekend dips are normal',
      source: sourceText(['logins']),
      table: () => ({ cols: [{ name: 'Day' }, { name: 'You (index)', r: 1 }, { name: 'Industry (index)', r: 1 }, { name: 'Your apps', r: 1 }], rows: mem.map((x, i) => [fmt.day(x.x), (x.apps / bm * 100).toFixed(0), (ind[i].apps / bi * 100).toFixed(0), fmt.int(x.apps)]) })
    });
    PIQ.charts.line(c1.viz, {
      series: [{ name: C.member.name, color: 'var(--s1)', points: mem.map((x) => ({ x: x.x, y: (x.apps / bm) * 100 })) }, { name: 'Industry', color: 'var(--s3)', points: ind.map((x) => ({ x: x.x, y: (x.apps / bi) * 100 })) }],
      xLabel: (x) => fmt.day(x), yFmt: (v) => v.toFixed(0), height: 260, endLabels: true,
      annotations: [{ x: D.DAYS[D.DAYS.length - 5], label: 'Last 5 days' }]
    });

    const recent = D.DAYS.slice(-5), prior = D.DAYS.slice(0, -5);
    const mixRows = D.BANDS.map((bd) => ({ label: bd.name, values: {} }));
    const addMix = (key, who, days) => S.loginMix(who, { p, s }, days).forEach((x, i) => (mixRows[i].values[key] = x.y));
    addMix('memR', 'mem', recent); addMix('memP', 'mem', prior); addMix('indR', 'ind', recent);
    const c2 = card(g, {
      title: 'Application mix by risk band', sub: 'Where is the extra volume coming from?',
      source: sourceText(['logins']),
      table: () => ({ cols: [{ name: 'Band' }, { name: 'You, last 5d', r: 1 }, { name: 'You, prior 25d', r: 1 }, { name: 'Industry, last 5d', r: 1 }], rows: mixRows.map((r) => [r.label, fmt.pct(r.values.memR, 1), fmt.pct(r.values.memP, 1), fmt.pct(r.values.indR, 1)]) })
    });
    PIQ.charts.dots(c2.viz, { rows: mixRows, series: [{ key: 'memR', name: 'You · last 5 days', color: 'var(--s1)' }, { key: 'memP', name: 'You · prior 25 days', color: 'var(--s2)' }, { key: 'indR', name: 'Industry · last 5 days', color: 'var(--s3)' }], fmt: (v) => fmt.pct(v, 0) });

    // State table
    const sc = card(root, { title: 'By state: where is the surge?', sub: 'Last 5 days vs weekday-matched baseline · states where you have volume, biggest gap to market first', source: sourceText(['logins']) });
    sc.el.style.marginTop = '16px';
    const t = h('table', 'tbl', h('div', 'table-wrap', sc.viz));
    const hr = h('tr', null, h('thead', null, t));
    ['State', 'Your apps / day', 'Your change', 'Industry change', 'Your approval rate', 'Industry approval rate', '3+ enquiries (you)', '3+ enquiries (industry)', 'Signal'].forEach((x, i) => h('th', i ? 'r' : '', hr, x));
    const tb = h('tbody', null, t);
    const memDaily = S.loginCompare({ p, b }, 5).mem.recent.perDay;
    D.STATES.map((st) => ({ st, x: S.loginCompare({ p, s: st.id, b }, 5) }))
      .filter((o) => o.x.mem.recent.perDay >= memDaily * 0.01)
      .sort((a, c) => (c.x.mem.change - c.x.ind.change) - (a.x.mem.change - a.x.ind.change))
      .forEach(({ st, x }) => {
      const r = h('tr', null, tb);
      h('td', null, r, st.name);
      h('td', 'r', r, fmt.int(x.mem.recent.perDay));
      h('td', 'r ' + (x.mem.change - x.ind.change > 0.3 ? 'bad' : ''), r, fmt.chg(x.mem.change, 0));
      h('td', 'r', r, fmt.chg(x.ind.change, 0));
      h('td', 'r', r, fmt.pct(x.mem.recent.apprRate, 1));
      h('td', 'r', r, fmt.pct(x.ind.recent.apprRate, 1));
      h('td', 'r ' + (x.mem.recent.hiEnqShare > x.ind.recent.hiEnqShare * 1.3 ? 'bad' : ''), r, fmt.pct(x.mem.recent.hiEnqShare, 0));
      h('td', 'r', r, fmt.pct(x.ind.recent.hiEnqShare, 0));
      const flag = x.mem.change - x.ind.change > 0.3 && x.mem.recent.hiEnqShare > x.ind.recent.hiEnqShare * 1.2;
      const td = h('td', 'r', r);
      if (flag) { const sp = h('span', 'tag own', td, '⚠ Investigate'); sp.title = 'Volume surge + high enquiry intensity'; }
      else h('span', 'muted', td, 'Normal');
    });
    if (s !== 'ALL') h('div', 'small muted', sc.body, 'Showing all states for context; the filter above applies to the charts.');
  }
  PIQ.views.logins = { title: 'Login & Application Pulse', render };
})();
