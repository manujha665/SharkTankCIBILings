/* Ticket Size — average loan size at account opening (bureau-reported new accounts) and the amount
   applicants ask for in their enquiries, vs peers and the market. */
(function () {
  const PIQ = window.PIQ;
  const { h, fmt, ml, state, card, stat, sourceText, pageHead, productStateFilters, stateName, prodName, prodLong } = PIQ.ui;
  const S = PIQ.sem, D = PIQ.data, C = PIQ.config;
  const WEAK = ['NP', 'SB'], STRONG = ['SP', 'PP', 'PR'];

  function render(root) {
    const p = state.p === 'ALL' ? 'PL' : state.p, s = state.s;
    pageHead(root, 'Ticket Size', 'Average loan size at account opening, from bureau-reported new accounts, and the amount applicants ask for in their enquiries. Bigger loans going to riskier borrowers is one of the earliest signs of a loosening book.');
    productStateFilters(root, { allProducts: false });
    const t = S.latest(), t12 = S.monthsAgo(12), t0 = C.policyChangeMonth;
    const f = { p, s };
    const ats = (src, ff, m) => S.value(src, 'ats', Object.assign({}, f, ff, { m }));
    const group = S.PEER_GROUPS.find((g) => g.id === state.peer) || S.PEER_GROUPS[0];
    S.log('ticketSize', { p, s });

    // headline: are the bigger tickets going to the weaker bands?
    const wR = ats('member', { b: WEAK }, t) / ats('industry', { b: WEAK }, t);
    const sR = ats('member', { b: STRONG }, t) / ats('industry', { b: STRONG }, t);
    const wM = ats('member', { b: WEAK }, t) / ats('member', { b: WEAK }, t0) - 1;
    const wI = ats('industry', { b: WEAK }, t) / ats('industry', { b: WEAK }, t0) - 1;
    const stRows = D.STATES.map((x) => {
      const mo = S.value('member', 'orig', { p, s: x.id, m: t });
      return { x, mo, m: ats('member', { s: x.id }, t), i: ats('industry', { s: x.id }, t), mw: ats('member', { s: x.id, b: WEAK }, t), mw0: ats('member', { s: x.id, b: WEAK }, t0), iw: ats('industry', { s: x.id, b: WEAK }, t) };
    });
    const totO = stRows.reduce((a, r) => a + r.mo, 0);
    const mat = stRows.filter((r) => r.mo >= totO * 0.02 && r.m && r.i);
    const hot = mat.filter((r) => r.mw && r.mw0).sort((a, b) => b.mw / b.mw0 - a.mw / a.mw0)[0];
    const flag = wR > sR * 1.12 && wM > wI + 0.05;
    const cl = h('div', 'callout ' + (flag ? 'danger' : 'insight'), root);
    const ch = h('div', null, cl); ch.style.cssText = 'display:flex;gap:10px;justify-content:space-between;align-items:flex-start';
    const title = flag
      ? `${prodName(p)}: your near-prime & subprime tickets are ${wR.toFixed(2)}× the market's, against ${sR.toFixed(2)}× in prime bands`
      : `${prodName(p)}: your ticket sizes are ${sR.toFixed(2)}× the market's in prime bands and ${wR.toFixed(2)}× in near-prime & subprime`;
    h('h4', null, ch, title);
    const body = flag
      ? `Since ${ml(t0)}, your weak-band ticket grew ${fmt.chg(wM, 0)} while the market's grew ${fmt.chg(wI, 0)}. Bigger loans to riskier borrowers raise loss given default and repayment burden at the same time.${hot && s === 'ALL' ? ` Steepest in ${hot.x.name}: ${fmt.inr(hot.mw0)} → ${fmt.inr(hot.mw)} (market ${fmt.inr(hot.iw)}).` : ''} Consider a ticket cap by score band alongside the cut-off.`
      : `Ticket sizes move with the market in ${stateName(s)}. A gap that is the same across bands usually reflects your customer mix (metro, salaried), not extra risk.`;
    if (PIQ.actions) PIQ.actions.pinButton(ch, () => ({ text: title, detail: body }));
    h('p', null, cl, body);

    // tiles
    const tiles = h('div', 'grid g4', root);
    tiles.style.marginTop = '16px';
    const mT = ats('member', {}, t), mT12 = ats('member', {}, t12), iT = ats('industry', {}, t), iT12 = ats('industry', {}, t12);
    const pv = S.peerValue(group.id, 'ats', Object.assign({ m: t }, f));
    const lq = S.loginQualityWin({ p, s }, 30);
    stat(tiles, { label: `Your avg ticket · ${ml(t)}`, value: fmt.inr(mT), delta: fmt.chg(mT / mT12 - 1), deltaNote: 'YoY', deltaTone: mT / mT12 - 1 > iT / iT12 - 1 + 0.03 ? 'bad' : '' });
    stat(tiles, { label: 'Industry avg ticket', value: fmt.inr(iT), delta: fmt.chg(iT / iT12 - 1), deltaNote: 'YoY' });
    stat(tiles, { label: `Peers · ${group.name}`, value: pv == null ? 'Suppressed' : fmt.inr(pv), delta: pv == null ? 'privacy rule' : `You ${(mT / pv).toFixed(2)}× peers` });
    stat(tiles, { label: 'Amount asked in enquiries · 30 days', value: fmt.inr(lq.mem.ticket), delta: 'Industry ' + fmt.inr(lq.ind.ticket), deltaTone: lq.mem.ticket > lq.ind.ticket * 1.2 ? 'bad' : '' });

    const g = h('div', 'grid g2', root);
    g.style.marginTop = '16px';
    const ps = S.peerSeries(group, 'ats', f);
    const ser = [
      { name: C.member.name, color: 'var(--s1)', points: S.series('member', 'ats', f) },
      ps.suppressed ? null : { name: 'Peers (' + group.name + ')', color: 'var(--s2)', points: ps.points },
      { name: 'Industry', color: 'var(--s3)', points: S.series('industry', 'ats', f) }
    ].filter(Boolean);
    const c1 = card(g, {
      title: 'Average ticket size, 24 months', sub: `${prodLong(p)} · ${stateName(s)} · new accounts opened each month`,
      source: sourceText(['member', 'industry', 'peers'], 'ticket = value disbursed ÷ new accounts'),
      table: () => ({ cols: [{ name: 'Month' }].concat(ser.map((x) => ({ name: x.name, r: 1 }))), rows: D.MONTHS.map((m, i) => [ml(m)].concat(ser.map((x) => fmt.inr(x.points[i].y)))) })
    });
    PIQ.charts.line(c1.viz, { series: ser, xLabel: ml, yFmt: fmt.inr, yTickFmt: fmt.metricTick('ats'), height: 250, endLabels: true, annotations: [{ x: t0, label: p === 'PL' ? `Cut-off ${C.previousCutoff.PL}→${C.currentCutoff.PL}` : 'Feb 26' }] });

    const bandRows = D.BANDS.map((b) => ({ b, m: ats('member', { b: b.id }, t), i: ats('industry', { b: b.id }, t), md: S.value('member', 'dpd30', Object.assign({ b: b.id, m: t }, f)), id: S.value('industry', 'dpd30', Object.assign({ b: b.id, m: t }, f)) }));
    const c2 = card(g, {
      title: 'Ticket size by risk band', sub: `${ml(t)} · you vs industry (tick) · are bigger loans going to weaker borrowers?`,
      source: sourceText(['member', 'industry']),
      table: () => ({ cols: [{ name: 'Band' }, { name: 'Your ticket', r: 1 }, { name: 'Industry ticket', r: 1 }, { name: 'You ÷ market', r: 1 }, { name: 'Your 30+ DPD', r: 1 }, { name: 'Industry 30+ DPD', r: 1 }], rows: bandRows.map((r) => [`${r.b.name} (${r.b.range})`, fmt.inr(r.m), fmt.inr(r.i), (r.m / r.i).toFixed(2) + '×', fmt.pct(r.md), fmt.pct(r.id)]) })
    });
    PIQ.charts.bars(c2.viz, { items: bandRows.map((r) => ({ label: r.b.name, value: r.m, ref: r.i })), fmt: fmt.inr, color: 'var(--s1)', valueName: 'You', refName: 'Industry' });

    if (s === 'ALL') {
      const rows = mat.slice().sort((a, b) => b.m / b.i - a.m / a.i).slice(0, 12);
      const c3 = card(g, {
        title: 'By state: where are your loans biggest vs the market?', sub: `${ml(t)} · states with at least 2% of your disbursal · tick = industry`,
        source: sourceText(['member', 'industry']),
        table: () => ({ cols: [{ name: 'State' }, { name: 'Your ticket', r: 1 }, { name: 'Industry', r: 1 }, { name: 'You ÷ market', r: 1 }, { name: `Weak bands ${ml(t0)} → ${ml(t)}`, r: 1 }], rows: rows.map((r) => [r.x.name, fmt.inr(r.m), fmt.inr(r.i), (r.m / r.i).toFixed(2) + '×', `${fmt.inr(r.mw0)} → ${fmt.inr(r.mw)}`]) })
      });
      PIQ.charts.bars(c3.viz, { items: rows.map((r) => ({ label: r.x.name, value: r.m, ref: r.i })), fmt: fmt.inr, color: 'var(--s1)', valueName: 'You', refName: 'Industry' });
    }

    const lRows = D.LENDERS.map((l) => ({ l, v: S.value('industry', 'ats', Object.assign({ l: l.id, m: t }, f)), r: S.value('industry', 'ats', Object.assign({ l: l.id, m: t12 }, f)) })).filter((x) => x.v);
    const c4 = card(g, {
      title: 'Market structure: ticket size by lender category', sub: `${ml(t)} · tick = a year ago · anonymised category aggregates`,
      source: sourceText(['industry']),
      table: () => ({ cols: [{ name: 'Lender category' }, { name: ml(t), r: 1 }, { name: ml(t12), r: 1 }, { name: 'YoY', r: 1 }], rows: lRows.map((x) => [x.l.name, fmt.inr(x.v), fmt.inr(x.r), fmt.chg(x.v / x.r - 1)]) })
    });
    PIQ.charts.bars(c4.viz, { items: lRows.map((x) => ({ label: x.l.name, value: x.v, ref: x.r })), fmt: fmt.inr, color: 'var(--s3)', valueName: ml(t), refName: ml(t12) });

    // all products
    const pc = card(root, { title: 'Across your book: ticket size by product', sub: `${ml(t)} · ${stateName(s)} · YoY = change vs ${ml(t12)}`, source: sourceText(['member', 'industry']) });
    pc.el.style.marginTop = '16px';
    const tb = h('table', 'tbl', h('div', 'table-wrap', pc.viz));
    const hr = h('tr', null, h('thead', null, tb));
    ['Product', 'Your ticket', 'Industry', 'You ÷ market', 'Your YoY', 'Market YoY', 'Amount asked (30d, you)'].forEach((x, i) => h('th', i ? 'r' : '', hr, x));
    const bd = h('tbody', null, tb);
    D.PRODUCTS.forEach((pr) => {
      const ff = { p: pr.id, s };
      const m1 = S.value('member', 'ats', Object.assign({ m: t }, ff)), m0 = S.value('member', 'ats', Object.assign({ m: t12 }, ff));
      const i1 = S.value('industry', 'ats', Object.assign({ m: t }, ff)), i0 = S.value('industry', 'ats', Object.assign({ m: t12 }, ff));
      if (!m1 || !i1) return;
      const req = S.loginQualityWin(ff, 30).mem.ticket;
      const r = h('tr', pr.id === p ? 'sel' : '', bd);
      const a = h('td', null, r); const ln = h('a', null, a, pr.name); ln.href = '#'; ln.addEventListener('click', (e) => { e.preventDefault(); PIQ.ui.setState({ p: pr.id }); });
      h('td', 'r', r, fmt.inr(m1));
      h('td', 'r', r, fmt.inr(i1));
      h('td', 'r', r, (m1 / i1).toFixed(2) + '×');
      h('td', 'r ' + (m1 / m0 - 1 > i1 / i0 - 1 + 0.03 ? 'bad' : ''), r, fmt.chg(m1 / m0 - 1));
      h('td', 'r', r, fmt.chg(i1 / i0 - 1));
      h('td', 'r', r, fmt.inr(req));
    });
    h('div', 'small muted', pc.body, 'All figures come from bureau data: new accounts and amounts reported by lenders at opening, and the loan amount stated in each enquiry. Nothing extra needs to be submitted.').style.marginTop = '8px';
  }
  PIQ.views.tickets = { title: 'Ticket Size', render };
})();
