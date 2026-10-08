/* Logins Pulse — near-real-time benchmark of the member's applications vs industry. */
(function () {
  const PIQ = window.PIQ;
  const { h, fmt, state, card, stat, sourceText, pageHead, productStateFilters, seg, stateName } = PIQ.ui;
  const S = PIQ.sem, D = PIQ.data, C = PIQ.config;
  let bands = 'NPSB', win = 7;

  function render(root, params) {
    if (params && [7, 15, 30].includes(+params.win)) win = +params.win;
    const p = state.p, s = state.s;
    pageHead(root, 'Logins Pulse', `Your last 30 days of applications against the whole market, refreshed daily (T-1, to ${C.loginsAsOf}). This is the earliest signal a lender gets: it shows up months before delinquency does.`);
    const bar = productStateFilters(root, { scope: 'apps' });
    seg(bar, 'Risk bands', [{ id: 'ALL', name: 'All bands' }, { id: 'NPSB', name: 'Near-prime + Subprime' }], bands, (v) => { bands = v; PIQ.go('logins'); });
    PIQ.ui.select(bar, 'Logins', S.LOGIN_WINDOWS.map((n) => ({ id: String(n), name: `Last ${n} days` })), String(win), (v) => { win = +v; PIQ.go('logins'); }).setAttribute('aria-label', 'Login window');
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
      h('p', null, cl, gap > 0 ? `Market demand explains only ${fmt.chg(c.ind.change, 0)}. Check for a new campaign or organised applications, and make sure the extra volume isn't concentrated in weaker bands or already-leveraged applicants (see below).` : 'Check if competitors are pricing more aggressively in your segments.');
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

    // ---------- Logins in the selected window: same-day enquiries + quality check ----------
    const q = S.loginQualityWin({ p, s }, win);
    S.log('loginQualityWin', { p, s, days: win });
    const winTxt = `last ${win} days`, winShort = `last ${win}d`;
    const hasPrior = !!q.memPrior, priorTxt = hasPrior ? `prior ${q.priorDays} days` : '', priorShort = hasPrior ? `prior ${q.priorDays}d` : '';
    const QP = hasPrior ? q.memPrior : null;
    const pp = (x, d) => fmt.pct(x, d == null ? 1 : d);
    const vsPrior = (fmtd) => (hasPrior ? 'Prior ' + fmtd + ' · ' : '');
    const qs = h('div', 'section-title', root, `Logins in the ${winTxt} · quality check (${fmt.day(q.days[0])} – ${fmt.day(q.days[q.days.length - 1])}, all risk bands)`);
    qs.style.marginTop = '26px';

    // Same-day multiple enquiries: applicants with more than one enquiry on the same day
    const sd = card(root, {
      title: `Applicants with more than one enquiry on the same day · ${winTxt}`,
      sub: `Same applicant, 2+ credit enquiries on one calendar day, at any lender. A rate-shopping and loan-stacking signal · ${stateName(s)} · ${PIQ.ui.prodName(p)}`,
      source: sourceText(['logins'], 'enquiries matched across all lenders on the same day'),
      pinDetail: () => `${fmt.int(q.mem.sameDayCount)} applicants (${pp(q.mem.sameDay)}) in the ${winTxt}; industry ${pp(q.ind.sameDay)}`,
      table: () => ({ cols: [{ name: 'Bureau credit profile' }, { name: 'Applicants (you)', r: 1 }, { name: 'Share of the profile\'s logins', r: 1 }].concat(hasPrior ? [{ name: 'Share, ' + priorShort, r: 1 }] : []).concat([{ name: 'Industry share', r: 1 }]),
        rows: q.mem.profiles.map((x, i) => [x.name, fmt.int(x.sameDay * x.apps), pp(x.sameDay)].concat(hasPrior ? [pp(QP.profiles[i].sameDay)] : []).concat([pp(q.ind.profiles[i].sameDay)])) })
    });
    const sdg = h('div', 'grid g3', sd.viz);
    const tile = (label, value, note, bad) => { const t = h('div', 'stat', sdg); h('div', 'stat-label', t, label); h('div', 'stat-value', t, value); const d = h('div', 'stat-delta ' + (bad ? 'bad' : ''), t, note); return d; };
    tile(`Count · ${winTxt}`, fmt.int(q.mem.sameDayCount), `${fmt.int(q.mem.sameDayCount / win)} a day · of ${fmt.int(q.mem.apps)} applicants`, false);
    tile('Share of your applicants', pp(q.mem.sameDay), vsPrior(pp(QP ? QP.sameDay : 0)) + 'industry ' + pp(q.ind.sameDay), q.mem.sameDay > q.ind.sameDay * 1.2);
    const sdTop = q.mem.profiles.slice().sort((a, b) => b.sameDay * b.apps - a.sameDay * a.apps)[0];
    tile('Most common profile', sdTop.name.split(' (')[0], `${fmt.int(sdTop.sameDay * sdTop.apps)} applicants · ${pp(sdTop.sameDay)} of that profile`, sdTop.sameDay > q.ind.sameDay * 1.3);
    if (q.mem.sameDay > q.ind.sameDay * 1.2) {
      const cl = h('div', 'callout danger', sd.body);
      cl.style.marginTop = '12px';
      h('h4', null, cl, `${pp(q.mem.sameDay)} of your applicants enquired more than once on the same day, vs ${pp(q.ind.sameDay)} for the market`);
      h('p', null, cl, `Same-day multiple enquiries usually mean an applicant is shopping the same loan with several lenders, or stacking loans before the bureau reflects them. Hold disbursal on these ${fmt.int(q.mem.sameDayCount)} applicants until a fresh bureau pull confirms no new loans; ${sdTop.name.split(' (')[0].toLowerCase()} applicants first.`);
    }

    const qt = h('div', 'grid g4', root);
    qt.style.marginTop = '16px';
    stat(qt, { label: 'Expected probability of default', value: pp(q.mem.pd), delta: vsPrior(pp(QP ? QP.pd : 0)) + 'industry ' + pp(q.ind.pd), deltaTone: q.mem.pd > q.ind.pd * 1.1 ? 'bad' : '' });
    stat(qt, { label: 'From high-risk PIN codes', value: pp(q.mem.pins[0].share, 0), delta: vsPrior(pp(QP ? QP.pins[0].share : 0, 0)) + 'industry ' + pp(q.ind.pins[0].share, 0), deltaTone: q.mem.pins[0].share > q.ind.pins[0].share * 1.15 ? 'bad' : '' });
    const weak = (o) => o.bands[3].share + o.bands[4].share;
    stat(qt, { label: 'Near-prime + subprime logins', value: pp(weak(q.mem), 0), delta: vsPrior(pp(QP ? weak(QP) : 0, 0)) + 'industry ' + pp(weak(q.ind), 0), deltaTone: weak(q.mem) > weak(q.ind) * 1.15 ? 'bad' : '' });
    stat(qt, { label: 'Avg loan amount requested', value: fmt.inr(q.mem.ticket), delta: vsPrior(fmt.inr(QP ? QP.ticket : 0)) + 'industry ' + fmt.inr(q.ind.ticket), deltaTone: p !== 'ALL' && q.mem.ticket > q.ind.ticket * 1.2 ? 'bad' : '' });

    // compare with the member's prior period when there is one, else with the industry
    const ref = QP || q.ind, refName = hasPrior ? `the ${priorTxt}` : 'the industry';
    const worst = q.mem.profiles.map((x, i) => ({ x, prior: ref.profiles[i] })).sort((a, b) => (b.x.pd - b.prior.pd) * b.x.share - (a.x.pd - a.prior.pd) * a.x.share)[0];
    if (q.mem.pd > ref.pd * 1.08) {
      const cl = h('div', 'callout danger', root);
      cl.style.marginTop = '16px';
      h('h4', null, cl, `Recent logins are riskier: expected PD ${pp(q.mem.pd)} vs ${pp(ref.pd)} in ${refName}${hasPrior ? ` (industry ${pp(q.ind.pd)})` : ''}`);
      h('p', null, cl, `The biggest contributor is ${worst.x.name.split(' (')[0].toLowerCase()} applicants (${worst.x.name.split(' (')[1].replace(')', '')}): ${pp(worst.x.share, 0)} of logins (${refName}: ${pp(worst.prior.share, 0)}), expected PD ${pp(worst.x.pd)} (${refName}: ${pp(worst.prior.pd)}), asking for ${fmt.inr(worst.x.ticket)} on average, and ${pp(worst.x.highPin, 0)} from high-risk PIN codes. Review these approvals before they book.`);
    }

    const g2 = h('div', 'grid g2', root);
    g2.style.marginTop = '16px';
    const bandRows = D.BANDS.map((b, i) => ({ label: `${b.name} (${b.range})`, values: Object.assign({ m: q.mem.bands[i].share, ind: q.ind.bands[i].share }, QP ? { pr: QP.bands[i].share } : {}) }));
    const cb = card(g2, {
      title: 'Score banding of logins', sub: 'Share of applications by bureau score band',
      source: sourceText(['logins']),
      table: () => ({ cols: [{ name: 'Score band' }, { name: 'You · ' + winShort, r: 1 }].concat(QP ? [{ name: 'You · ' + priorShort, r: 1 }] : []).concat([{ name: 'Industry · ' + winShort, r: 1 }, { name: 'Your expected PD', r: 1 }, { name: 'Amount asked (you)', r: 1 }, { name: 'Amount asked (industry)', r: 1 }]), rows: D.BANDS.map((b, i) => [`${b.name} (${b.range})`, pp(q.mem.bands[i].share)].concat(QP ? [pp(QP.bands[i].share)] : []).concat([pp(q.ind.bands[i].share), pp(q.mem.bands[i].pd), fmt.inr(q.mem.bands[i].ticket), fmt.inr(q.ind.bands[i].ticket)])) })
    });
    PIQ.charts.dots(cb.viz, { rows: bandRows, series: [{ key: 'm', name: 'You · ' + winTxt, color: 'var(--s1)' }].concat(QP ? [{ key: 'pr', name: 'You · ' + priorTxt, color: 'var(--s2)' }] : []).concat([{ key: 'ind', name: 'Industry · ' + winTxt, color: 'var(--s3)' }]), fmt: (v) => fmt.pct(v, 0) });

    const cp = card(g2, {
      title: `Probability of default: distribution of the ${winTxt}' logins`, sub: 'Share of applications by expected 12-month PD (90+) · tick = industry',
      source: sourceText(['logins', 'scores'], 'PD from score band, PIN-code risk tier and bureau credit profile'),
      table: () => ({ cols: [{ name: 'PD bucket' }, { name: 'You · ' + winShort, r: 1 }].concat(QP ? [{ name: 'You · ' + priorShort, r: 1 }] : []).concat([{ name: 'Industry · ' + winShort, r: 1 }]), rows: q.mem.pdBuckets.map((k, i) => [k.label, pp(k.share)].concat(QP ? [pp(QP.pdBuckets[i].share)] : []).concat([pp(q.ind.pdBuckets[i].share)])) })
    });
    PIQ.charts.bars(cp.viz, { items: q.mem.pdBuckets.map((k, i) => ({ label: 'PD ' + k.label, value: k.share, ref: q.ind.pdBuckets[i].share })), fmt: (v) => fmt.pct(v, 0), color: 'var(--s1)', valueName: 'You · ' + winTxt, refName: 'Industry' });

    const cpin = card(g2, {
      title: 'Where logins come from: PIN-code risk tier', sub: 'PIN codes graded by the locality\'s bureau delinquency history · tick = industry',
      source: sourceText(['logins'], 'PIN-code risk tiers from bureau-wide 90+ rates'),
      table: () => ({ cols: [{ name: 'PIN tier' }, { name: 'You · ' + winShort, r: 1 }].concat(QP ? [{ name: 'You · ' + priorShort, r: 1 }] : []).concat([{ name: 'Industry · ' + winShort, r: 1 }, { name: 'Your expected PD', r: 1 }]), rows: D.PINS.map((x, i) => [x.name, pp(q.mem.pins[i].share)].concat(QP ? [pp(QP.pins[i].share)] : []).concat([pp(q.ind.pins[i].share), pp(q.mem.pins[i].pd)])) })
    });
    PIQ.charts.bars(cpin.viz, { items: D.PINS.map((x, i) => ({ label: x.name, value: q.mem.pins[i].share, ref: q.ind.pins[i].share })), fmt: (v) => fmt.pct(v, 0), color: 'var(--s1)', valueName: 'You · ' + winTxt, refName: 'Industry' });
    const pinNote = h('div', 'small muted', cpin.body, (QP ? `Your ${priorTxt}: ${D.PINS.map((x, i) => x.name.replace(' PIN codes', '') + ' ' + pp(QP.pins[i].share, 0)).join(' · ')}. ` : '') + `Expected PD by tier (you, ${winTxt}): ${D.PINS.map((x, i) => x.name.replace(' PIN codes', '') + ' ' + pp(q.mem.pins[i].pd)).join(' · ')}.`);
    pinNote.style.marginTop = '8px';

    const cpool = card(g2, { title: 'Who is applying? Bureau credit profile', pin: true, sub: 'Profile from the applicant\'s bureau record at enquiry: accounts, live loans, a live loan with you · ' + (QP ? `${winTxt.replace(/^./, (c) => c.toUpperCase())} vs your ${priorTxt} (in brackets) and the industry · ⚠ = expected PD up 20%+` : `${winTxt.replace(/^./, (c) => c.toUpperCase())} vs the industry (in brackets) · ⚠ = expected PD 20%+ above the industry`), source: sourceText(['logins']) });
    const pt = h('table', 'tbl', h('div', 'table-wrap', cpool.viz));
    const ph = h('tr', null, h('thead', null, pt));
    ['Profile', QP ? 'Share (prior)' : 'Share', 'Industry', QP ? 'Exp. PD (prior)' : 'Exp. PD (industry)', 'Avg amount asked', 'High-risk PIN', 'Same-day 2+ enq.'].forEach((x, i) => h('th', i ? 'r' : '', ph, x));
    const pb = h('tbody', null, pt);
    q.mem.profiles.forEach((x, i) => {
      const ind = q.ind.profiles[i], pr = QP ? QP.profiles[i] : ind;
      const r = h('tr', null, pb);
      const nm = h('td', null, r, (x.pd > pr.pd * 1.2 && x.share > 0.1 ? '⚠ ' : '') + x.name.split(' (')[0].replace('Existing customer', 'Existing cust.'));
      nm.title = x.name;
      if (x.pd > pr.pd * 1.2 && x.share > 0.1) nm.className = 'bad';
      h('td', 'r', r, pp(x.share, 0) + (QP ? ' (' + pp(pr.share, 0) + ')' : ''));
      h('td', 'r', r, pp(ind.share, 0));
      h('td', 'r ' + (x.pd > pr.pd * 1.2 ? 'bad' : ''), r, pp(x.pd) + ' (' + pp(pr.pd) + ')');
      h('td', 'r ' + (p !== 'ALL' && x.ticket > ind.ticket * 1.25 ? 'bad' : ''), r, fmt.inr(x.ticket)).title = 'Industry: ' + fmt.inr(ind.ticket) + (p === 'ALL' ? ' (all products: reflects your product mix)' : '');
      h('td', 'r ' + (x.highPin > ind.highPin * 1.25 ? 'bad' : ''), r, pp(x.highPin, 0));
      h('td', 'r ' + (x.sameDay > ind.sameDay * 1.3 ? 'bad' : ''), r, pp(x.sameDay));
    });

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
  PIQ.views.logins = { title: 'Logins Pulse', render };
})();
