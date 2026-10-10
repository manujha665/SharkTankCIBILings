/* Policy Simulator — what happens to approvals, losses and profit if I move my score cut-off? */
(function () {
  const PIQ = window.PIQ;
  const { h, fmt, state, card, sourceText, pageHead, productStateFilters, stateName } = PIQ.ui;
  const S = PIQ.sem, D = PIQ.data, C = PIQ.config;
  let cutoff = null, lastKey = '', gridOpen = false, importMsg = null;
  const assume = { PL: {}, CC: {} };
  const CO = PIQ.cutoffs;

  // ---------- current cut-off policy: product × state grid, editable and importable ----------
  function policyCard(root, p, s) {
    const n = CO.count();
    const box = h('details', 'card policy-grid', root);
    box.open = gridOpen;
    box.style.marginTop = '16px';
    box.addEventListener('toggle', () => { gridOpen = box.open; });
    const sm = h('summary', null, box);
    h('strong', null, sm, 'Your current cut-offs by product and state');
    h('span', 'muted small', sm, n ? `  ·  ${n} state-specific cut-off${n > 1 ? 's' : ''} in use · edit or import` : '  ·  one cut-off per product today · enter state-wise cut-offs or import them');
    h('p', 'small muted', box, `Type a cut-off in any cell, or set a product for all states in the first row. Cells you changed are highlighted. Every number on this page, the recommendations and the AI analyst use this grid as your current policy. Range ${CO.MIN}–${CO.MAX}.`);
    const wrap = h('div', 'table-wrap', box);
    const t = h('table', 'tbl cut-grid', wrap);
    const hr = h('tr', null, h('thead', null, t));
    h('th', null, hr, 'State');
    D.PRODUCTS.forEach((pr) => { const th = h('th', 'r' + (pr.id === p ? ' sel' : ''), hr, pr.id); th.title = pr.long; });
    const tb = h('tbody', null, t);
    const input = (td, val, onSet, label, custom) => {
      const i = h('input', 'cut-in' + (custom ? ' custom' : ''), td);
      Object.assign(i, { type: 'number', min: CO.MIN, max: CO.MAX, step: 5, value: val });
      i.setAttribute('aria-label', label);
      i.addEventListener('change', () => {
        if (!onSet(+i.value)) { i.classList.add('err'); i.title = `Enter a number between ${CO.MIN} and ${CO.MAX}`; return; }
        gridOpen = true; PIQ.go('simulator', { p, s });
      });
    };
    const all = h('tr', 'all-row', tb);
    h('td', null, all, 'All states (sets every state)');
    D.PRODUCTS.forEach((pr) => input(h('td', 'r', all), CO.def(pr.id), (v) => CO.setProduct(pr.id, v), `${pr.name} cut-off for all states`, false));
    D.STATES.forEach((st) => {
      const r = h('tr', st.id === s ? 'sel' : '', tb);
      h('td', null, r, st.name);
      D.PRODUCTS.forEach((pr) => input(h('td', 'r', r), CO.get(pr.id, st.id), (v) => CO.set(pr.id, st.id, v), `${pr.name} cut-off in ${st.name}`, CO.isCustom(pr.id, st.id)));
    });

    // import / export
    const im = h('div', 'cut-import', box);
    h('h4', null, im, 'Import cut-offs from your policy file');
    h('p', 'small muted', im, 'Paste or upload a CSV in either layout. Long: product,state,cutoff (state "All" sets every state). Wide: state,PL,CC,HL,… one row per state (the template). Product codes or names and state names or codes both work.');
    const ta = h('textarea', null, im);
    ta.rows = 4;
    ta.placeholder = 'product,state,cutoff\nPL,Uttar Pradesh,700\nPL,Gujarat,700\nCC,All,730';
    ta.setAttribute('aria-label', 'Paste cut-offs CSV');
    const row = h('div', 'btn-row', im);
    const done = (res) => {
      importMsg = res;
      gridOpen = true;
      PIQ.go('simulator', { p, s });
    };
    const bi = h('button', 'btn primary', row, 'Import pasted cut-offs');
    bi.addEventListener('click', () => { if (ta.value.trim()) done(CO.importCSV(ta.value)); });
    const fl = h('label', 'btn', row, 'Upload CSV');
    const fi = h('input', null, fl);
    Object.assign(fi, { type: 'file', accept: '.csv,.txt,text/csv' });
    fi.style.display = 'none';
    fi.addEventListener('change', () => { const f = fi.files[0]; if (f) f.text().then((x) => done(CO.importCSV(x))); });
    const bt = h('button', 'btn', row, 'Download template');
    bt.addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([CO.templateCSV()], { type: 'text/csv' }));
      a.download = 'cutoffs_product_x_state.csv'; a.click();
    });
    const br = h('button', 'btn', row, 'Reset to product defaults');
    br.addEventListener('click', () => { CO.reset(); importMsg = null; gridOpen = true; PIQ.go('simulator', { p, s }); });
    if (importMsg) {
      const m = h('div', 'callout ' + (importMsg.errors.length ? (importMsg.ok ? 'insight' : 'danger') : 'okay'), im);
      m.style.marginTop = '10px';
      h('h4', null, m, importMsg.ok ? `Imported ${importMsg.ok} cut-off${importMsg.ok > 1 ? 's' : ''}` : 'Nothing imported');
      if (importMsg.errors.length) h('p', null, m, importMsg.errors.slice(0, 5).join(' · ') + (importMsg.errors.length > 5 ? ` · and ${importMsg.errors.length - 5} more` : ''));
      importMsg = null;
    }
  }

  function feasibility(parent) {
    const c = card(parent, {
      title: 'Feasibility: taking in the member\'s real cut-offs',
      sub: 'Can every product and state carry its own current cut-off? Yes. Here is how it gets in, and what it takes.',
      source: 'Assessment by the PortfolioIQ team · prototype implements routes 1 and 2'
    });
    c.el.style.marginTop = '16px';
    const t = h('table', 'tbl', h('div', 'table-wrap', c.viz));
    const hr = h('tr', null, h('thead', null, t));
    ['Route', 'How it works', 'Effort', 'When'].forEach((x) => h('th', null, hr, x));
    const tb = h('tbody', null, t);
    [
      ['1. Enter on screen', 'Credit policy team types cut-offs into the product × state grid above. Validated (300–900), changes logged in the audit trail.', 'Low', 'MVP · live in prototype'],
      ['2. Upload the policy matrix', 'CSV / Excel export of the credit policy note, long or wide layout. Unknown products or states are flagged line by line, nothing is guessed.', 'Low', 'MVP · live in prototype'],
      ['3. Pull from LOS / rule engine', 'Nightly API or SFTP feed from the lender\'s loan origination system or business-rules engine, so the grid always matches live policy.', 'Medium · per-lender integration', 'Phase 2'],
      ['4. Infer from bureau data', 'Estimate the effective cut-off from the member\'s own enquiries vs new accounts (the score where approvals drop). Flags gaps between stated and actual policy.', 'Medium · uses data we already hold', 'Phase 2']
    ].forEach((r) => { const tr = h('tr', null, tb); r.forEach((x, i) => { const td = h('td', null, tr, x); if (i === 0) td.style.fontWeight = '600'; if (i > 1) td.style.whiteSpace = 'nowrap'; }); });
    const g = h('div', 'grid g3', c.body);
    g.style.marginTop = '12px';
    [
      ['Data needed', `Cut-off per product × state (${D.PRODUCTS.length} × ${D.STATES.length} = ${D.PRODUCTS.length * D.STATES.length} values), plus an effective date. Optional: by channel or customer segment later.`],
      ['Governance', 'A member\'s policy is confidential: stored in its own tenant, versioned, audit-logged and never used in peer benchmarks.'],
      ['Limits to state openly', 'Real policies also use income, FOIR and bureau vintage rules. The simulator models the score cut-off; other rules enter through the "other pass rate" assumption.']
    ].forEach(([k, v]) => { const d = h('div', 'callout insight', g); h('h4', null, d, k); h('p', null, d, v); });
  }

  function render(root, params) {
    if (params && params.cutoff) cutoff = params.cutoff;
    const p = state.p === 'ALL' ? 'PL' : state.p, s = state.s;
    const key = p + s;
    // current policy: the member's product × state grid. For "All states" with state-wise cut-offs,
    // the current case simulates each state at its own cut-off.
    const gridMode = s === 'ALL' && CO.varies(p);
    const cur = s === 'ALL' ? CO.def(p) : CO.get(p, s);
    const curSim = gridMode ? CO.fn(p) : cur;
    const curName = gridMode ? 'state-wise cut-offs' : String(cur);
    if (cutoff == null || (lastKey && lastKey !== key && !(params && params.cutoff))) cutoff = p === 'PL' && cur === C.currentCutoff.PL ? C.previousCutoff.PL : cur + 20;
    lastKey = key;
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

    policyCard(root, p, s);
    const body = h('div', null, root);
    const draw = () => {
      body.innerHTML = '';
      const A = Object.assign({}, S.DEFAULT_ASSUMPTIONS[p], assume[p]);
      const a = S.simulate(p, s, curSim, A), b = S.simulate(p, s, cutoff, A), prev = S.simulate(p, s, C.previousCutoff[p], A);
      S.log('simulate', { p, s, cutoff });
      const g = h('div', 'grid g-1-2', body);
      const kc = h('div', 'card', g);
      h('h3', null, kc, `Current ${curName} vs proposed ${cutoff}`);
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
        annotations: (gridMode ? [] : [{ x: cur, label: 'Current ' + cur }]).concat(cutoff !== cur || gridMode ? [{ x: cutoff, label: 'Proposed ' + cutoff }] : [])
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
      const prodApps = S.simulate(p, 'ALL', curSim, A).apps;
      const rows = D.STATES.filter((x) => S.simulate(p, x.id, CO.get(p, x.id), A).apps >= prodApps * 0.02).map((x) => {
        const cs = CO.get(p, x.id);
        const c0 = S.simulate(p, x.id, cs, A);
        let bb = c0;
        for (let c = 640; c <= 780; c += 10) { const r = S.simulate(p, x.id, c, A); if (r.netCr > bb.netCr + 0.02) bb = r; }
        return { x, cs, c0, bb };
      });
      const t = h('table', 'tbl', h('div', 'table-wrap', st.viz));
      const hr = h('tr', null, h('thead', null, t));
      ['State', 'Current cut-off', 'Best cut-off', 'Approvals change', 'Exp. loss change', 'Net change / month', ''].forEach((c, i) => h('th', i && i < 6 ? 'r' : '', hr, c));
      const tb = h('tbody', null, t);
      rows.forEach(({ x, cs, c0, bb }) => {
        const r = h('tr', null, tb);
        h('td', null, r, x.name);
        h('td', 'r', r, String(cs) + (CO.isCustom(p, x.id) ? ' ✎' : '')).title = CO.isCustom(p, x.id) ? 'From your cut-off grid' : 'Product default';
        h('td', 'r', r, String(bb.cutoff)).style.fontWeight = bb.cutoff !== cs ? '700' : '400';
        h('td', 'r', r, fmt.chg(bb.approvedPerMonth / c0.approvedPerMonth - 1));
        h('td', 'r ' + (bb.expLossCr < c0.expLossCr ? 'good' : ''), r, bb.cutoff === cs ? '—' : (bb.expLossCr <= c0.expLossCr ? '−' : '+') + fmt.cr(Math.abs(c0.expLossCr - bb.expLossCr)));
        h('td', 'r ' + (bb.netCr > c0.netCr + 0.01 ? 'good' : ''), r, bb.cutoff === cs ? '—' : '+' + fmt.cr(bb.netCr - c0.netCr));
        const td = h('td', null, r);
        td.style.whiteSpace = 'nowrap';
        if (bb.cutoff !== cs) {
          const bt = h('button', 'btn sm', td, 'Simulate');
          bt.addEventListener('click', () => PIQ.go('simulator', { p, s: x.id, cutoff: bb.cutoff }));
          const ad = h('button', 'btn sm', td, 'Adopt');
          ad.title = `Set ${bb.cutoff} as your current ${D.P[p].name} cut-off in ${x.name}`;
          ad.style.marginLeft = '6px';
          ad.addEventListener('click', () => { CO.set(p, x.id, bb.cutoff); PIQ.go('simulator', { p, s }); });
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
      feasibility(body);
    };
    rng.addEventListener('input', () => { cutoff = +rng.value; out.textContent = rng.value; draw(); });
    draw();
  }
  PIQ.views.simulator = { title: 'Policy Simulator', render };
})();
