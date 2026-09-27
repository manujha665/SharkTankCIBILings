/*
 * Insight & recommendation engine: turns governed metrics into "what changed, why, and what to do".
 * All outputs carry the numbers they were derived from, so the UI and AI can cite them.
 */
(function (root) {
  const PIQ = (root.PIQ = root.PIQ || {});
  const S = PIQ.sem, D = PIQ.data, C = PIQ.config;

  // Summary of member vs market for a product/state
  function snapshot(p, s) {
    const t = S.latest(), t6 = S.monthsAgo(6), t12 = S.monthsAgo(12);
    const f = { p, s };
    const m = (src, metric, month) => S.value(src, metric, Object.assign({}, f, { m: month }));
    const out = {
      p, s, t, t6,
      bal: m('member', 'bal', t), bal12: m('member', 'bal', t12),
      indBal: m('industry', 'bal', t), indBal12: m('industry', 'bal', t12),
      dpd30: m('member', 'dpd30', t), dpd30_6: m('member', 'dpd30', t6),
      ind30: m('industry', 'dpd30', t), ind30_6: m('industry', 'dpd30', t6),
      dpd90: m('member', 'dpd90', t), ind90: m('industry', 'dpd90', t),
      cure: m('member', 'cure', t), cure6: m('member', 'cure', t6), indCure: m('industry', 'cure', t),
      peer30: S.peerValue(PIQ.ui ? PIQ.ui.state.peer : 'mid-pvt', 'dpd30', { p, s, m: t }),
      peer30_6: S.peerValue(PIQ.ui ? PIQ.ui.state.peer : 'mid-pvt', 'dpd30', { p, s, m: t6 })
    };
    out.share = out.bal / out.indBal;
    out.share12 = out.bal12 / out.indBal12;
    out.growth = out.bal / out.bal12 - 1;
    out.indGrowth = out.indBal / out.indBal12 - 1;
    return out;
  }

  function driverLabel(seg) {
    const parts = [['mix', Math.abs(seg.mix)], ['market', Math.abs(seg.market)], ['own', Math.abs(seg.own)]].sort((a, b) => b[1] - a[1]);
    return parts[0][0];
  }

  // Recommendations for a product (portfolio-wide), ranked by impact
  function recommendations(p) {
    p = p || 'PL';
    const recs = [];
    const cur = C.currentCutoff[p];
    if (p === 'PL') {
      // 1) state-level cut-off optimisation
      const perState = D.STATES.map((st) => {
        const a = S.simulate(p, st.id, cur);
        let best = a;
        for (let c = cur - 20; c <= cur + 40; c += 10) { const r = S.simulate(p, st.id, c); if (r.netCr > best.netCr + 0.05) best = r; }
        const dec = S.decompose({ p, s: st.id, t0: C.policyChangeMonth, t1: S.latest(), dim: 'b' });
        return { st, cur: a, best, dec };
      });
      const tighten = perState.filter((x) => x.best.cutoff > cur);
      if (tighten.length) {
        const gain = tighten.reduce((a, x) => a + (x.best.netCr - x.cur.netCr), 0);
        const lossCut = tighten.reduce((a, x) => a + (x.cur.expLossCr - x.best.expLossCr), 0);
        const volCut = tighten.reduce((a, x) => a + (x.cur.approvedPerMonth - x.best.approvedPerMonth), 0);
        const totalAppr = S.simulate(p, 'ALL', cur).approvedPerMonth;
        recs.push({
          id: 'cutoff', priority: 1, kind: 'policy',
          title: `Restore a ${tighten[0].best.cutoff} cut-off for Personal Loans in ${tighten.map((x) => x.st.name).join(' & ')} only`,
          why: `Since the ${C.previousCutoff.PL}→${cur} loosening, these states added near-prime/subprime mix and are deteriorating faster than the market. Everywhere else, ${cur} remains the profit-maximising cut-off.`,
          impact: [
            ['Net contribution', '+' + PIQ.ui.fmt.cr(gain) + ' / month', 'good'],
            ['Expected credit loss', '−' + PIQ.ui.fmt.cr(lossCut) + ' / month', 'good'],
            ['Approvals', '−' + ((volCut / totalAppr) * 100).toFixed(1) + '% of portfolio volume', 'bad']
          ],
          action: { view: 'simulator', params: { p, s: tighten[0].st.id, cutoff: tighten[0].best.cutoff } },
          states: tighten.map((x) => x.st.id)
        });
      }
      // 2) idiosyncratic deterioration with a flat market -> sourcing audit
      const idio = perState.filter((x) => x.dec.own > 0.003 && x.dec.indDelta < 0.002);
      idio.forEach((x) => {
        recs.push({
          id: 'sourcing-' + x.st.id, priority: 2, kind: 'operations',
          title: `Audit sourcing quality in ${x.st.name}: the market is flat, your book isn't`,
          why: `Industry 30+ DPD in ${x.st.name} moved only ${PIQ.ui.fmt.bps(x.dec.indDelta)} since ${D.monthLabel(C.policyChangeMonth)}; yours rose ${PIQ.ui.fmt.bps(x.dec.delta)}, of which ${PIQ.ui.fmt.bps(x.dec.own)} is member-specific (same segments, worse performance). This points to channel / DSA or underwriting execution, not the economy.`,
          impact: [
            ['Member-specific effect', PIQ.ui.fmt.bps(x.dec.own), 'bad'],
            ['Market effect', PIQ.ui.fmt.bps(x.dec.market), '']
          ],
          action: { view: 'upload', params: {} },
          states: [x.st.id]
        });
      });
      // 3) login surge -> verification
      const surge = D.STATES.map((st) => ({ st, c: S.loginCompare({ p, s: st.id, b: ['NP', 'SB'] }, 5) }))
        .filter((x) => x.c.mem.change > 0.4 && x.c.mem.change - x.c.ind.change > 0.3);
      if (surge.length) {
        const perDay = surge.reduce((a, x) => a + (x.c.mem.recent.perDay - x.c.mem.prior.perDay), 0);
        recs.push({
          id: 'logins', priority: 1, kind: 'early-warning',
          title: `Add enhanced checks on near-prime & subprime applications in ${surge.map((x) => x.st.name).join(' & ')} this week`,
          why: `Applications in these segments are up ${surge.map((x) => PIQ.ui.fmt.chg(x.c.mem.change, 0)).join(' / ')} in 5 days while industry moved ${surge.map((x) => PIQ.ui.fmt.chg(x.c.ind.change, 0)).join(' / ')}. ${PIQ.ui.fmt.pct(surge[0].c.mem.recent.hiEnqShare, 0)} of them made 3+ enquiries in 30 days (industry ${PIQ.ui.fmt.pct(surge[0].c.ind.recent.hiEnqShare, 0)}) — a classic pattern of credit-hungry or organised applications, visible weeks before it shows up as delinquency.`,
          impact: [
            ['Excess applications', '~' + Math.round(perDay) + ' / day', 'bad'],
            ['Signal lead time', '3–6 months before DPD', '']
          ],
          action: { view: 'logins', params: { p, s: surge[0].st.id } },
          states: surge.map((x) => x.st.id)
        });
      }
      // 4) collections
      const cureDrop = D.STATES.map((st) => {
        const now = S.value('member', 'cure', { p, s: st.id, m: S.latest() }), was = S.value('member', 'cure', { p, s: st.id, m: S.monthsAgo(6) });
        const ind = S.value('industry', 'cure', { p, s: st.id, m: S.latest() });
        return { st, now, was, ind, drop: was - now };
      }).sort((a, b) => b.drop - a.drop)[0];
      if (cureDrop && cureDrop.drop > 0.02) {
        recs.push({
          id: 'collections', priority: 3, kind: 'collections',
          title: `Shift early-bucket collections capacity to ${cureDrop.st.name}`,
          why: `Cure rate from 30–89 DPD fell from ${PIQ.ui.fmt.pct(cureDrop.was, 1)} to ${PIQ.ui.fmt.pct(cureDrop.now, 1)} in 6 months (industry ${PIQ.ui.fmt.pct(cureDrop.ind, 1)}). Each point of cure recovered keeps accounts out of 90+.`,
          impact: [['Cure-rate gap to industry', PIQ.ui.fmt.pp(cureDrop.now - cureDrop.ind, 1), 'bad']],
          action: { view: 'benchmark', params: { p, metric: 'cure' } },
          states: [cureDrop.st.id]
        });
      }
    }
    // Opportunity: CC better than peers
    const ccM = S.value('member', 'dpd30', { p: 'CC', m: S.latest() }), ccP = S.peerValue('mid-pvt', 'dpd30', { p: 'CC', m: S.latest() });
    if (ccP && ccM < ccP - 0.003 && (p === 'CC' || p === 'PL')) {
      const sh = S.value('member', 'bal', { p: 'CC', m: S.latest() }) / S.value('industry', 'bal', { p: 'CC', m: S.latest() });
      recs.push({
        id: 'cc-growth', priority: 4, kind: 'growth',
        title: 'Grow credit cards in prime segments — you are outperforming peers on risk',
        why: `Card 30+ DPD is ${PIQ.ui.fmt.pct(ccM)} vs ${PIQ.ui.fmt.pct(ccP)} for mid-size private bank peers, yet your share of the 6-state card market is only ${PIQ.ui.fmt.pct(sh, 2)}. Risk headroom can fund growth.`,
        impact: [['Risk headroom vs peers', PIQ.ui.fmt.bps(ccP - ccM).replace('+', ''), 'good']],
        action: { view: 'benchmark', params: { p: 'CC' } },
        states: []
      });
    }
    return recs.sort((a, b) => a.priority - b.priority);
  }

  // Plain-English narrative of a decomposition
  function narrateDecomposition(d) {
    const F = PIQ.ui.fmt;
    const place = d.s && d.s !== 'ALL' ? D.S[d.s].name : 'your 6-state book';
    const tot = Math.abs(d.mix) + Math.abs(d.market) + Math.abs(d.own) || 1;
    const share = (x) => Math.round((Math.abs(x) / tot) * 100) + '%';
    const lead = [['a riskier portfolio mix', d.mix], ['market-wide deterioration', d.market], ['your own segments performing worse than the market', d.own]].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    const top = d.segments.slice(0, 3).map((s) => s.label).join(', ');
    return {
      headline: `${D.P[d.p].name} ${S.METRICS[d.metric].short} in ${place} ${d.delta >= 0 ? 'rose' : 'fell'} ${F.bps(d.delta).replace('+', '')} (${F.pct(d.R0)} → ${F.pct(d.R1)}) between ${D.monthLabel(d.t0)} and ${D.monthLabel(d.t1)}. The industry moved ${F.bps(d.indDelta)}.`,
      drivers: `Mix shift explains ${share(d.mix)}, market-wide deterioration ${share(d.market)}, and member-specific performance ${share(d.own)}. The biggest driver is ${lead[0][0]}.`,
      segments: `Largest contributing segments: ${top}.`,
      verdict: Math.abs(d.market) > Math.abs(d.mix) + Math.abs(d.own) ? 'Mostly the market — you are moving with the industry.' : 'Mostly you — this is within your control.'
    };
  }

  PIQ.insights = { snapshot, recommendations, narrateDecomposition, driverLabel };
})(window);
