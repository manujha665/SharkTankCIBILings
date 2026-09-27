/* Policy Simulator — what happens to approvals, losses and profit if I move my score cut-off? */
(function () {
  const PIQ = window.PIQ;
  const { h, fmt, state, card, sourceText, pageHead, productStateFilters, stateName } = PIQ.ui;
  const S = PIQ.sem, D = PIQ.data, C = PIQ.config;
  let cutoff = null, lastKey = '';
  const assume = { PL: {}, CC: {} };

  function render(root, params) {
    if (params && params.cutoff) cutoff = params.cutoff;
    const p = state.p === 'ALL' ? 'PL' : state.p, s = state.s;
    const key = p + s;
    if (cutoff == null || (lastKey && lastKey !== key && !(params && params.cutoff))) cutoff = p === 'PL' ? C.previousCutoff.PL : C.currentCutoff[p] + 20;
    lastKey = key;
    const cur = C.currentCutoff[p];
    pageHead(root, 'Policy Simulator', 'Move the score cut-off and see the trade-off between growth and risk before you change policy. Uses your last 90 days of applications and the bad rates observed at each score.');
    const bar = productStateFilters(root, { allProducts: false });
    const sw = h('div', 'slider-wrap', bar);
    const lab = h('label', null, sw);
    lab.style.cssText = 'font-size:11px;color:var(--ink-3);text-transform:uppercase;letter-spacing:.05em';
    lab.textContent = 'Proposed cut-off';
    const row = h('div', null, sw); row.style.cssText = 'display:flex;gap:12px;align-items:center';
    const rng = h('input', null, row);
    Object.assign(rng, { type: 'range', min: 600, max: 800, step: 10, value: cutoff });
    rng.setAttribute('aria-label', 'Proposed score cut-off');
    const out = h('strong', null, row, String(cutoff));
    out.style.cssText = 'font-size:20px;min-width:44px';

    const body = h('div', null, root);
    const draw = () => {
      body.innerHTML = '';
      const A = Object.assign({}, S.DEFAULT_ASSUMPTIONS[p], assume[p]);
      const a = S.simulate(p, s, cur, A), b = S.simulate(p, s, cutoff, A), prev = S.simulate(p, s, C.previousCutoff[p], A);
      S.log('simulate', { p, s, cutoff });
      const g = h('div', 'grid g-1-2', body);
      const kc = h('div', 'card', g);
      h('h3', null, kc, `Current ${cur} vs proposed ${cutoff}`);
      h('div', 'sub muted small', kc, `${D.P[p].long} · ${stateName(s)} · per month`);
      const k = h('div', 'kpi-compare', kc);
      k.style.marginTop = '14px';
      ['', 'Current', 'Proposed', 'Change'].forEach((x) => h('div', 'h' + (x ? ' v' : ''), k, x));
      const line = (name, f, va, vb, goodUp) => {
        h('div', null, k, name);
        h('div', 'v', k, f(va));
        h('div', 'v', k, f(vb));
        const dlt = vb - va;
        const e = h('div', 'v ' + (Math.abs(dlt) < 1e-9 ? '' : (dlt > 0) === goodUp ? 'good' : 'bad'), k, Math.abs(dlt) < 1e-9 ? '—' : (dlt >= 0 ? '+' : '−') + f(Math.abs(dlt)));
        e.style.fontWeight = '600';
      };
      line('Approval rate', (v) => fmt.pct(v, 1), a.approvalRate, b.approvalRate, true);
      line('Approvals', (v) => fmt.int(v), a.approvedPerMonth, b.approvedPerMonth, true);
      line('Disbursal', fmt.cr, a.disbursalCr, b.disbursalCr, true);
      line('Expected bad rate', (v) => fmt.pct(v), a.badRate, b.badRate, false);
      line('Expected credit loss', fmt.cr, a.expLossCr, b.expLossCr, false);
      line('Net contribution', fmt.cr, a.netCr, b.netCr, true);
      const verdict = h('div', 'callout ' + (b.netCr > a.netCr + 0.01 ? 'okay' : b.netCr < a.netCr - 0.01 ? 'danger' : 'insight'), kc);
      verdict.style.marginTop = '14px';
      h('h4', null, verdict, b.netCr > a.netCr + 0.01 ? `Moving to ${cutoff} adds ${fmt.cr(b.netCr - a.netCr)} a month` : b.netCr < a.netCr - 0.01 ? `Moving to ${cutoff} costs ${fmt.cr(a.netCr - b.netCr)} a month` : 'Roughly neutral on profit');
      h('p', null, verdict, `You give up ${fmt.int(Math.max(0, a.approvedPerMonth - b.approvedPerMonth))} approvals and avoid ${fmt.cr(Math.max(0, a.expLossCr - b.expLossCr))} of expected loss. Before the Feb loosening (cut-off ${C.previousCutoff[p]}), net contribution here was ${fmt.cr(prev.netCr)}.`);

      // Curves
      const curve = S.simulateCurve(p, s, A);
      const cc = h('div', 'grid', g);
      const c1 = card(cc, {
        title: 'Net contribution by cut-off', sub: 'Margin after funding, opex and expected credit loss (₹ Cr / month)',
        source: sourceText(['scores'], 'bad rate = 90+ DPD within 12 months, calibrated on industry performance'),
        table: () => ({ cols: [{ name: 'Cut-off' }, { name: 'Approval rate', r: 1 }, { name: 'Bad rate', r: 1 }, { name: 'Exp. loss', r: 1 }, { name: 'Net', r: 1 }], rows: curve.map((r) => [r.cutoff, fmt.pct(r.approvalRate, 1), fmt.pct(r.badRate), fmt.cr(r.expLossCr), fmt.cr(r.netCr)]) })
      });
      const best = curve.reduce((m, r) => (r.netCr > m.netCr ? r : m), curve[0]);
      PIQ.charts.line(c1.viz, {
        series: [{ name: 'Net contribution', color: 'var(--s1)', points: curve.map((r) => ({ x: r.cutoff, y: r.netCr })), marks: [best.cutoff] }],
        xNumeric: true, xLabel: (x) => String(x), yFmt: fmt.cr, yTickFmt: (v) => v.toFixed(0), height: 200, area: true,
        annotations: [{ x: cur, label: 'Current ' + cur }].concat(cutoff !== cur ? [{ x: cutoff, label: 'Proposed ' + cutoff }] : [])
      });
      const note = h('div', 'small muted', c1.body, `Profit-maximising cut-off for this slice: ${best.cutoff} (marked).`);
      note.style.marginTop = '4px';
      const c2 = card(cc, { title: 'Expected bad rate by cut-off', sub: 'Your applicants vs the same scores across the industry', source: sourceText(['scores']) });
      PIQ.charts.line(c2.viz, {
        series: [{ name: 'Your applicants', color: 'var(--s1)', points: curve.map((r) => ({ x: r.cutoff, y: r.badRate })) }, { name: 'Industry at same scores', color: 'var(--s3)', points: curve.map((r) => ({ x: r.cutoff, y: r.badRateInd })) }],
        xNumeric: true, xLabel: (x) => String(x), yFmt: (v) => fmt.pct(v), yTickFmt: (v) => (v * 100).toFixed(1) + '%', height: 200, endLabels: true, zero: true,
        annotations: [{ x: cutoff, label: String(cutoff) }]
      });

      // State-level optimum
      const st = card(body, { title: 'Surgical, not blanket: the best cut-off per state', sub: 'A single national cut-off leaves money on the table · states with at least 2% of your applications', source: sourceText(['scores']) });
      st.el.style.marginTop = '16px';
      const prodApps = S.simulate(p, 'ALL', cur, A).apps;
      const rows = D.STATES.filter((x) => S.simulate(p, x.id, cur, A).apps >= prodApps * 0.02).map((x) => {
        const c0 = S.simulate(p, x.id, cur, A);
        let bb = c0;
        for (let c = 640; c <= 780; c += 10) { const r = S.simulate(p, x.id, c, A); if (r.netCr > bb.netCr + 0.02) bb = r; }
        return { x, c0, bb };
      });
      const t = h('table', 'tbl', h('div', 'table-wrap', st.viz));
      const hr = h('tr', null, h('thead', null, t));
      ['State', 'Current cut-off', 'Best cut-off', 'Approvals change', 'Exp. loss change', 'Net change / month', ''].forEach((c, i) => h('th', i && i < 6 ? 'r' : '', hr, c));
      const tb = h('tbody', null, t);
      rows.forEach(({ x, c0, bb }) => {
        const r = h('tr', null, tb);
        h('td', null, r, x.name);
        h('td', 'r', r, String(cur));
        h('td', 'r', r, String(bb.cutoff)).style.fontWeight = bb.cutoff !== cur ? '700' : '400';
        h('td', 'r', r, fmt.chg(bb.approvedPerMonth / c0.approvedPerMonth - 1));
        h('td', 'r ' + (bb.expLossCr < c0.expLossCr ? 'good' : ''), r, bb.cutoff === cur ? '—' : '−' + fmt.cr(c0.expLossCr - bb.expLossCr));
        h('td', 'r ' + (bb.netCr > c0.netCr + 0.01 ? 'good' : ''), r, bb.cutoff === cur ? '—' : '+' + fmt.cr(bb.netCr - c0.netCr));
        const td = h('td', null, r);
        if (bb.cutoff !== cur) {
          const bt = h('button', 'btn sm', td, 'Apply');
          bt.addEventListener('click', () => PIQ.go('simulator', { p, s: x.id, cutoff: bb.cutoff }));
        }
      });

      // Assumptions
      const as = h('details', 'card', body);
      as.style.marginTop = '16px';
      h('summary', null, as, 'Assumptions (editable)');
      const ag = h('div', null, as);
      ag.style.cssText = 'display:flex;gap:14px;flex-wrap:wrap;margin-top:12px';
      [['ticket', 'Avg ticket (₹ lakh)', 1], ['yield', 'Yield (annual)', 100], ['cof', 'Cost of funds', 100], ['opex', 'Opex', 100], ['lgd', 'Loss given default', 100]].forEach(([k2, name, mult]) => {
        const f = h('div', 'field', ag);
        h('label', null, f, name + (mult === 100 ? ' %' : ''));
        const i = h('input', null, f);
        i.type = 'number'; i.step = mult === 100 ? '0.5' : '0.1'; i.value = +(A[k2] * mult).toFixed(2);
        i.addEventListener('change', () => { assume[p][k2] = +i.value / mult; draw(); });
      });
      h('p', 'small muted', as, 'Simplified 12-month view for decision support: margin = disbursal × (yield − cost of funds − opex); loss = disbursal × bad rate × LGD. Replace with the member\'s own profitability model in production.');
    };
    rng.addEventListener('input', () => { cutoff = +rng.value; out.textContent = rng.value; draw(); });
    draw();
  }
  PIQ.views.simulator = { title: 'Policy Simulator', render };
})();
