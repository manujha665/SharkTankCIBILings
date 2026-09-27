/* Board Brief — auto-generated one-pager that replaces the monthly static deck. */
(function () {
  const PIQ = window.PIQ;
  const { h, fmt, ml, card } = PIQ.ui;
  const S = PIQ.sem, D = PIQ.data, C = PIQ.config;

  function render(root) {
    const bar = h('div', 'no-print', root);
    bar.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;margin-bottom:14px';
    const pr = h('button', 'btn primary', bar, '⎙ Print / save as PDF');
    pr.addEventListener('click', () => window.print());

    const b = h('div', 'brief', root);
    const t = S.latest();
    h('div', 'muted small', b, `${C.productName} · Portfolio Intelligence Brief · generated automatically`);
    h('h1', null, b, `${C.member.name}: Retail Unsecured Portfolio, ${ml(t)}`);
    h('p', 'muted', b, `Prepared for the Risk Management Committee · ${C.member.user}, ${C.member.role} · Data as of ${C.dataAsOf}; applications to ${C.loginsAsOf}.`);

    const pl = PIQ.insights.snapshot('PL', 'ALL'), cc = PIQ.insights.snapshot('CC', 'ALL');
    const dPL = S.decompose({ p: 'PL', s: 'ALL', t0: C.policyChangeMonth, t1: t, dim: 'sb' });
    const nar = PIQ.insights.narrateDecomposition(dPL);

    h('h2', null, b, '1. Headlines');
    const ul = h('ul', null, b);
    [
      `Personal loan 30+ DPD is ${fmt.pct(pl.dpd30)}, ${fmt.bps(dPL.delta)} since the ${ml(C.policyChangeMonth)} cut-off change, against ${fmt.bps(dPL.indDelta)} for the industry. ${nar.verdict}`,
      `Mix shift explains ${fmt.bps(dPL.mix)}, market-wide deterioration ${fmt.bps(dPL.market)}, member-specific performance ${fmt.bps(dPL.own)}. The pressure is concentrated in Uttar Pradesh and Gujarat near-prime / subprime.`,
      `Credit cards remain a strength: 30+ DPD ${fmt.pct(cc.dpd30)} vs ${fmt.pct(cc.peer30)} for PVT · Mid-size peers.`,
      `Balances grew ${fmt.chg(pl.growth)} (PL) and ${fmt.chg(cc.growth)} (CC) year on year vs industry ${fmt.chg(pl.indGrowth)} / ${fmt.chg(cc.indGrowth)}; 6-state PL market share ${fmt.pct(pl.share, 2)}.`
    ].forEach((x) => h('li', null, ul, x));

    const g = h('div', 'grid g2', b);
    const c1 = card(g, { title: 'PL 30+ DPD: you vs peers vs industry', source: PIQ.ui.sourceText(['member', 'peers', 'industry']) });
    PIQ.charts.line(c1.viz, {
      series: [
        { name: C.member.name, color: 'var(--s1)', points: S.series('member', 'dpd30', { p: 'PL' }) },
        { name: 'Peers', color: 'var(--s2)', points: S.peerSeries('mid-pvt', 'dpd30', { p: 'PL' }).points },
        { name: 'Industry', color: 'var(--s3)', points: S.series('industry', 'dpd30', { p: 'PL' }) }
      ], xLabel: ml, yFmt: (v) => fmt.pct(v), yTickFmt: fmt.metricTick('dpd30'), height: 220, endLabels: true
    });
    const c2 = card(g, { title: 'What drove the change', source: PIQ.ui.sourceText(['member', 'industry']) });
    PIQ.charts.waterfall(c2.viz, {
      start: { label: ml(C.policyChangeMonth), value: dPL.R0 },
      steps: [{ label: 'Mix shift', value: dPL.mix }, { label: 'Market', value: dPL.market }, { label: 'Member-specific', value: dPL.own }],
      end: { label: ml(t), value: dPL.R1 }, fmt: (v) => fmt.pct(v), deltaFmt: (v) => Math.round(v * 10000) + ' bps', upIsBad: true, height: 220
    });

    h('h2', null, b, '2. Early-warning signals');
    const ul2 = h('ul', null, b);
    S.alerts().filter((a) => a.sev !== 'good').forEach((a) => { const li = h('li', null, ul2); h('strong', null, li, a.title + '. '); h('span', null, li, a.detail); });

    h('h2', null, b, '3. Recommended actions');
    const ol = h('ol', null, b);
    PIQ.insights.recommendations('PL').forEach((r) => {
      const li = h('li', null, ol);
      h('strong', null, li, r.title + '. ');
      h('span', null, li, r.why + ' ');
      h('em', null, li, 'Impact: ' + r.impact.map(([k, v]) => k + ' ' + v).join('; ') + '.');
    });

    h('h2', null, b, '4. Method & sources');
    h('p', 'small', b, 'All figures come from the governed semantic layer: Industry Credit Dataset, Member Portfolio Dataset, Anonymised Peer Aggregates (min. 5 institutions, max. 25% single-institution share) and the Enquiry & Application Feed. The decomposition uses a midpoint mix/rate split; the market effect applies the industry\'s relative change in each segment. This brief was generated automatically. No analyst time was needed. Synthetic demo data.');
  }
  PIQ.views.brief = { title: 'Board Brief', render };
})();
