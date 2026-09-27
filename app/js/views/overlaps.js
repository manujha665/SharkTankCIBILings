/* Overlap Intelligence — borrowers seen across microfinance, retail and commercial files. */
(function () {
  const PIQ = window.PIQ;
  const { h, fmt, ml, card, stat, sourceText, pageHead, seg } = PIQ.ui;
  const S = PIQ.sem, D = PIQ.data, C = PIQ.config;
  let tab = 'mfi';

  const crore = (v) => (v >= 1 ? v.toFixed(2) + ' Cr' : (v * 100).toFixed(1) + ' L') + ' borrowers';
  function uses(root, list) {
    h('div', 'section-title', root, 'How to use this overlap');
    const g = h('div', 'grid g3', root);
    list.forEach(([ico, t, d]) => { const c = h('div', 'card', g); const hd = h('div', null, c); hd.style.cssText = 'display:flex;gap:10px;align-items:center;margin-bottom:6px'; h('span', 'guard-ico', hd, ico); h('h4', null, hd, t); h('p', 'small', c, d).style.color = 'var(--ink-2)'; });
  }
  function funnel(parent, rows, total, unit, note) {
    const c = card(parent, {
      title: 'The overlap funnel', sub: `Base: ${total} ${unit}`, source: sourceText(['overlap']),
      table: () => ({ cols: [{ name: 'Stage' }, { name: 'Borrowers', r: 1 }, { name: '% of base', r: 1 }], rows: rows.map((x) => [x.label, x.cr.toFixed(2) + ' Cr', fmt.pct(x.pct, 0)]) })
    });
    PIQ.charts.bars(c.viz, { items: rows.map((x) => ({ label: x.label, value: x.pct })), fmt: (v) => fmt.pct(v, 0) + ' · ' + (v * rows[0].cr).toFixed(1) + ' Cr', color: 'var(--s1)' });
    h('p', 'small muted', c.body, note).style.marginTop = '6px';
    return c;
  }

  function renderMfi(root) {
    const r = PIQ.overlap.retailMfi();
    S.log('overlap.retailMfi', {});
    const tiles = h('div', 'grid g4', root);
    stat(tiles, { label: 'Live MFI borrowers with a retail footprint', value: fmt.pct(r.funnel[1].pct, 0), delta: crore(r.funnel[1].cr) + ' · enquiries, live or closed retail trade lines' });
    stat(tiles, { label: 'Live-to-live overlap', value: fmt.pct(r.funnel[2].pct, 0), delta: crore(r.funnel[2].cr) + ' hold a live MFI and a live retail loan' });
    stat(tiles, { label: 'Retail 30+ DPD: overlap vs other borrowers', value: fmt.pct(r.del.retailOverlap, 1), delta: `vs ${fmt.pct(r.del.retailOthers, 1)} — ${(r.del.retailOverlap / r.del.retailOthers).toFixed(1)}× riskier`, deltaTone: 'bad' });
    stat(tiles, { label: 'MFI 30+ DPD: overlap vs MFI-only', value: fmt.pct(r.del.mfiOverlap, 1), delta: `vs ${fmt.pct(r.del.mfiOnly, 1)} — stretched on both sides`, deltaTone: 'bad' });

    const cl = h('div', 'callout insight', root);
    cl.style.marginTop = '16px';
    h('h4', null, cl, `Half of India's ${r.base.toFixed(0)} crore microfinance borrowers are already visible in retail credit, and a quarter are servicing both at once`);
    h('p', null, cl, 'Only a bureau can see this. For a retail lender it is a hidden leverage risk (a borrower\'s MFI repayments compete with your EMI) and an opportunity (MFI borrowers with clean records are ready to graduate to retail).');

    const g = h('div', 'grid g2', root);
    g.style.marginTop = '16px';
    funnel(g, r.funnel, r.base.toFixed(1) + ' crore', 'live microfinance borrowers', 'Retail footprint = retail enquiries, live or closed retail trade lines. Live-to-live = a live MFI loan and a live retail loan at the same time.');
    const fp = card(g, { title: 'What "retail footprint" means', sub: 'Share of the live MFI base by the strongest retail link', source: sourceText(['overlap']) });
    PIQ.charts.bars(fp.viz, { items: r.footprint.map((x) => ({ label: x.label, value: x.pct })), fmt: (v) => fmt.pct(v, 0), color: 'var(--s1)' });

    const cp = card(g, {
      title: 'Which retail products they hold', sub: 'Share of live-to-live overlap borrowers holding each product (can hold several)', source: sourceText(['overlap']),
      table: () => ({ cols: [{ name: 'Product' }, { name: 'Share', r: 1 }, { name: 'Borrowers', r: 1 }], rows: r.products.map((x) => [x.name, fmt.pct(x.share, 0), (x.share * r.funnel[2].cr).toFixed(2) + ' Cr']) })
    });
    PIQ.charts.bars(cp.viz, { items: r.products.map((x) => ({ label: x.name, value: x.share })), fmt: (v) => fmt.pct(v, 0), color: 'var(--s1)' });

    const top = r.states.slice(0, 12);
    const cs = card(g, {
      title: 'Where the overlap is highest', sub: 'Live-to-live overlap as % of the state\'s MFI borrowers · top 12 states · tick = national', source: sourceText(['overlap']),
      table: () => ({ cols: [{ name: 'State' }, { name: 'Overlap', r: 1 }], rows: r.states.map((x) => [x.name, fmt.pct(x.rate, 1)]) })
    });
    PIQ.charts.bars(cs.viz, { items: top.map((x) => ({ label: x.name, value: x.rate, ref: C.overlap.mfiLiveLivePct })), fmt: (v) => fmt.pct(v, 0), color: 'var(--s1)', valueName: 'State', refName: 'National' });

    const cll = card(g, {
      title: 'MFI stress spills into retail, about 3 months later', sub: '30+ DPD of the same overlap borrowers on their MFI loans vs their retail loans', source: sourceText(['overlap', 'industry']),
      table: () => ({ cols: [{ name: 'Month' }, { name: 'MFI 30+', r: 1 }, { name: 'Retail 30+', r: 1 }], rows: r.lead.map((x) => [ml(x.x), fmt.pct(x.mfi, 1), fmt.pct(x.retail, 1)]) })
    });
    PIQ.charts.line(cll.viz, { series: [{ name: 'On their MFI loans', color: 'var(--s2)', points: r.lead.map((x) => ({ x: x.x, y: x.mfi })) }, { name: 'On their retail loans', color: 'var(--s1)', points: r.lead.map((x) => ({ x: x.x, y: x.retail })) }], xLabel: ml, yFmt: (v) => fmt.pct(v, 1), yTickFmt: (v) => (v * 100).toFixed(0) + '%', height: 230, endLabels: true });

    const cln = card(g, { title: 'Over-leverage: number of MFI lenders', sub: 'Overlap borrowers vs MFI-only borrowers', source: sourceText(['overlap']) });
    PIQ.charts.dots(cln.viz, { rows: r.lenders.labels.map((l, k) => ({ label: l, values: { o: r.lenders.overlap[k], m: r.lenders.mfiOnly[k] } })), series: [{ key: 'o', name: 'Overlap borrowers', color: 'var(--s1)' }, { key: 'm', name: 'MFI-only', color: 'var(--s2)' }], fmt: (v) => fmt.pct(v, 0) });

    // Member lens
    const mc = card(root, { title: `${C.member.name}: your retail borrowers who also hold a live MFI loan`, sub: 'Your exposure to the overlap and how it performs', source: sourceText(['overlap', 'member']) });
    mc.el.style.marginTop = '16px';
    const t = h('table', 'tbl', h('div', 'table-wrap', mc.viz));
    const hr = h('tr', null, h('thead', null, t));
    ['Your product', 'Share of borrowers with a live MFI loan', 'Borrowers', 'Exposure', '30+ DPD (overlap)', '30+ DPD (others)', 'Multiple'].forEach((x, k) => h('th', k ? 'r' : '', hr, x));
    const tb = h('tbody', null, t);
    r.member.forEach((x) => {
      const row = h('tr', null, tb);
      h('td', null, row, x.name);
      h('td', 'r', row, fmt.pct(x.share, 1));
      h('td', 'r', row, fmt.int(x.borrowers));
      h('td', 'r', row, fmt.cr(x.exposure));
      h('td', 'r bad', row, fmt.pct(x.dpdOverlap));
      h('td', 'r', row, fmt.pct(x.dpdOthers));
      h('td', 'r', row, (x.dpdOverlap / x.dpdOthers).toFixed(1) + '×');
    });
    const tot = r.member.reduce((a, x) => a + x.exposure, 0);
    h('p', 'small muted', mc.body, `Total exposure to live MFI borrowers: ${fmt.cr(tot)}. Suggested actions: add an MFI-indebtedness check (number of MFI lenders, total obligations vs household income) to retail underwriting; put overlap borrowers in high-stress MFI states on a collections watchlist.`).style.marginTop = '8px';

    uses(root, [
      ['✅', 'Underwriting guardrail', 'Before a gold loan, two-wheeler or personal loan, check the applicant\'s live MFI loans and lender count. Three or more MFI lenders is a red flag for over-indebtedness.'],
      ['⚠', 'Early warning', 'MFI delinquency moves first; the same borrowers\' retail loans follow about a quarter later. Watch MFI stress by state to protect the retail book.'],
      ['🎯', 'Graduation opportunity', 'MFI borrowers with long, clean repayment records and no retail loan yet are a ready, bureau-verified pipeline for a first retail product.'],
      ['📞', 'Collections priority', 'When an overlap borrower slips on either side, reach them early: their repayment capacity is being contested by several lenders.'],
      ['📊', 'Portfolio exposure map', 'Know how much of your book sits with MFI borrowers, by product and state, and price or cap it deliberately.'],
      ['🏛', 'Policy & guardrails', 'Aggregate overlap trends help industry bodies and regulators track household indebtedness in near real time.']
    ]);
  }

  function renderMsme(root) {
    const r = PIQ.overlap.msmeRetail();
    S.log('overlap.msmeRetail', {});
    const tiles = h('div', 'grid g4', root);
    stat(tiles, { label: 'MSMEs linked to individuals', value: fmt.pct(r.funnel[1].pct, 0), delta: 'Directors, partners, proprietors, guarantors matched to consumer records' });
    stat(tiles, { label: 'A promoter holds a live retail loan', value: fmt.pct(r.funnel[2].pct, 0), delta: (r.funnel[2].cr * 100).toFixed(0) + ' lakh MSME borrowers' });
    stat(tiles, { label: 'Promoter retail slip before entity default', value: fmt.pct(r.stats.precededPct, 0), delta: `of MSMEs that turned 90+ · median lead ${r.stats.medianLeadMonths} months`, deltaTone: 'bad' });
    stat(tiles, { label: 'Promoter retail 30+ when entity is 90+', value: fmt.pct(r.byStatus[3].rate, 1), delta: `vs ${fmt.pct(r.byStatus[0].rate, 1)} when the entity is current — ${r.stats.multiple.toFixed(1)}×`, deltaTone: 'bad' });

    const cl = h('div', 'callout insight', root);
    cl.style.marginTop = '16px';
    h('h4', null, cl, 'A small business and its owners share one wallet: stress on one side shows up on the other, and the retail side often moves first');
    h('p', null, cl, 'Directors and partners borrow in their personal capacity through cards, personal loans and LAP, often to fund the business. Linking commercial and consumer records turns promoters\' retail behaviour into an early-warning signal for the MSME book.');

    const g = h('div', 'grid g2', root);
    g.style.marginTop = '16px';
    funnel(g, r.funnel, (r.base * 100).toFixed(0) + ' lakh', 'live MSME borrowers (illustrative)', 'Promoters = directors, partners, proprietors and guarantors matched to consumer records.');
    const cp = card(g, { title: 'Retail products held by promoters', sub: 'Share of linked MSMEs where a promoter holds each product', source: sourceText(['overlap']) });
    PIQ.charts.bars(cp.viz, { items: r.products.map((x) => ({ label: x.name, value: x.share })), fmt: (v) => fmt.pct(v, 0), color: 'var(--s1)' });

    const cc = card(g, {
      title: 'Promoters slip first', sub: 'MSMEs that turned 90+ in month 0: their promoters\' retail 30+ DPD rate in the 12 months before', source: sourceText(['overlap']),
      table: () => ({ cols: [{ name: 'Months to entity 90+' }, { name: 'Promoter retail 30+', r: 1 }, { name: 'Entities 30+', r: 1 }], rows: r.cohort.map((x) => [String(x.x), fmt.pct(x.promoter, 1), fmt.pct(x.entity, 0)]) })
    });
    PIQ.charts.line(cc.viz, { series: [{ name: 'Promoters\' retail loans 30+', color: 'var(--s1)', points: r.cohort.map((x) => ({ x: x.x, y: x.promoter })) }], xNumeric: true, xLabel: (x) => (x === 0 ? 'Default' : x + 'm'), yFmt: (v) => fmt.pct(v, 1), yTickFmt: (v) => (v * 100).toFixed(0) + '%', height: 220, endLabels: true, annotations: [{ x: -4, label: 'Median lead: 4 months' }] });
    const cs = card(g, { title: 'Promoters\' retail 30+ DPD by entity status', sub: 'The worse the business, the worse the owners\' personal credit', source: sourceText(['overlap']) });
    PIQ.charts.bars(cs.viz, { items: r.byStatus.map((x) => ({ label: 'Entity ' + x.label, value: x.rate })), fmt: (v) => fmt.pct(v, 1), color: 'var(--s1)' });

    const mc = card(root, { title: `${C.member.name}: MSME borrowers whose promoters slipped on retail credit in the last 90 days`, sub: 'Early-warning watchlist by state · states with at least 2% of your MSME book', source: sourceText(['overlap', 'member']) });
    mc.el.style.marginTop = '16px';
    const t = h('table', 'tbl', h('div', 'table-wrap', mc.viz));
    const hr = h('tr', null, h('thead', null, t));
    ['State', 'MSME borrowers', 'Promoter retail slip (90d)', 'Flagged borrowers', 'Exposure flagged', 'Your MSME 30+ DPD', ''].forEach((x, k) => h('th', k && k < 6 ? 'r' : '', hr, x));
    const tb = h('tbody', null, t);
    const avg = r.member.reduce((a, x) => a + x.flagged, 0) / r.member.reduce((a, x) => a + x.entities, 0);
    r.member.forEach((x) => {
      const row = h('tr', null, tb);
      h('td', null, row, x.name);
      h('td', 'r', row, fmt.int(x.entities));
      h('td', 'r ' + (x.pct > avg * 1.6 ? 'bad' : ''), row, fmt.pct(x.pct, 1));
      h('td', 'r', row, fmt.int(x.flagged));
      h('td', 'r', row, fmt.cr(x.exposure));
      h('td', 'r', row, fmt.pct(x.dpd));
      const td = h('td', null, row);
      if (x.pct > avg * 1.6) { const b = h('button', 'btn sm', td, 'Why? →'); b.addEventListener('click', () => PIQ.go('why', { p: 'MSME', s: x.s })); }
    });
    h('p', 'small muted', mc.body, 'In Tamil Nadu, promoters\' retail slips ran well ahead of your MSME deterioration there. A promoter-level watchlist would have flagged it months earlier.').style.marginTop = '8px';

    uses(root, [
      ['⚠', 'MSME early warning', 'Monitor promoters\' personal loans and cards monthly (weekly where available). A fresh slip triggers a review of the business account before it defaults.'],
      ['✅', 'Underwriting the whole group', 'Assess the entity and its promoters together: personal leverage, cards used for working capital, LAP secured on the owner\'s home.'],
      ['🔗', 'Related-party & group exposure', 'Map connected borrowers across commercial and retail books to see true concentration on a family or group.'],
      ['📞', 'Collections strategy', 'When the business is stressed, coordinate retail and commercial collections on the same promoter instead of competing for the same rupee.'],
      ['🎯', 'Cross-sell', 'Promoters of healthy MSMEs with clean personal credit are prime candidates for cards, home loans and wealth products.'],
      ['🛡', 'Fraud & diversion', 'Spot funds moving between the business and personal accounts, and guarantors stretched across many entities.']
    ]);
  }

  function render(root) {
    pageHead(root, 'Overlap Intelligence', 'Only a bureau sees the same borrower across microfinance, retail and commercial credit. These overlaps reveal hidden leverage, early warnings and ready-made growth pools.', (r) => {
      seg(r, null, [{ id: 'mfi', name: 'Retail × Microfinance' }, { id: 'msme', name: 'Commercial × Retail (MSME promoters)' }], tab, (v) => { tab = v; PIQ.go('overlaps'); });
    });
    const note = h('div', 'pill', root, tab === 'mfi' ? `Base: ${C.overlap.mfiLiveBorrowersCr} Cr live MFI borrowers · 50% any retail footprint · 25% live-to-live (team working estimate) · bureau-wide, all states` : 'Base figures illustrative · bureau-wide, all states');
    note.style.cssText = 'margin-bottom:14px;white-space:normal;border-radius:10px';
    if (tab === 'mfi') renderMfi(root); else renderMsme(root);
  }
  PIQ.views.overlaps = { title: 'Overlap Intelligence', render };
})();
