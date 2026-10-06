/*
 * Insight & recommendation engine: turns governed metrics into "what changed, why, and what to do".
 * All outputs carry the numbers they were derived from, so the UI and AI can cite them.
 * Works for a single product or the whole portfolio (p = 'ALL').
 */
(function (root) {
  const PIQ = (root.PIQ = root.PIQ || {});
  const S = PIQ.sem, D = PIQ.data, C = PIQ.config;
  const F = () => PIQ.ui.fmt;
  const pName = (p) => (!p || p === 'ALL' ? 'Total portfolio' : D.P[p].name);

  // Summary of member vs market for a product/state and a delinquency metric
  function snapshot(p, s, metric) {
    metric = metric || 'dpd30';
    const t = S.latest(), t6 = S.monthsAgo(6), t12 = S.monthsAgo(12);
    const f = { p, s };
    const m = (src, met, month) => S.value(src, met, Object.assign({}, f, { m: month }));
    const peer = (PIQ.ui && PIQ.ui.state.peer) || 'mid-pvt';
    const out = {
      p, s, t, t6, metric,
      bal: m('member', 'bal', t), bal12: m('member', 'bal', t12),
      indBal: m('industry', 'bal', t), indBal12: m('industry', 'bal', t12),
      dpd: m('member', metric, t), dpd6: m('member', metric, t6),
      ind: m('industry', metric, t), ind6: m('industry', metric, t6),
      dpd30: m('member', 'dpd30', t), dpd90: m('member', 'dpd90', t), dpd180: m('member', 'dpd180', t),
      ind90: m('industry', 'dpd90', t),
      cure: m('member', 'cure', t), cure6: m('member', 'cure', t6), indCure: m('industry', 'cure', t),
      peer: S.peerValue(peer, metric, { p, s, m: t }), peer6: S.peerValue(peer, metric, { p, s, m: t6 }),
      peer30: S.peerValue(peer, 'dpd30', { p, s, m: t })
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

  // Recommendations for one product
  function productRecs(p) {
    const recs = [];
    const P = D.P[p];
    const CO = PIQ.cutoffs, cur = CO.def(p); // product default; states may differ (policy grid)
    const t = S.latest();
    const prodBal = S.value('member', 'bal', { p, m: t });
    const material = (s) => S.value('member', 'bal', { p, s, m: t }) >= prodBal * 0.03;
    const states = D.STATES.filter((st) => material(st.id));
    // 1) state-level cut-off optimisation where the book has deteriorated
    const perState = states.map((st) => {
      const dec = S.decompose({ p, s: st.id, t0: C.policyChangeMonth, t1: t, dim: 'b' });
      const c0 = CO.get(p, st.id);
      const a = S.simulate(p, st.id, c0);
      let best = a;
      if (dec.mix + dec.own > 0.002)
        for (let c = c0 - 20; c <= c0 + 40; c += 10) { const r = S.simulate(p, st.id, c); if (r.netCr > best.netCr + Math.max(0.05, Math.abs(a.netCr) * 0.02)) best = r; }
      return { st, cur: a, best, dec, c0 };
    });
    const tighten = perState.filter((x) => x.best.cutoff > x.c0);
    if (tighten.length) {
      const gain = tighten.reduce((acc, x) => acc + (x.best.netCr - x.cur.netCr), 0);
      const lossCut = tighten.reduce((acc, x) => acc + (x.cur.expLossCr - x.best.expLossCr), 0);
      const volCut = tighten.reduce((acc, x) => acc + (x.cur.approvedPerMonth - x.best.approvedPerMonth), 0);
      const totalAppr = S.simulate(p, 'ALL', CO.fn(p)).approvedPerMonth;
      const loosened = C.previousCutoff[p] !== cur;
      recs.push({
        id: 'cutoff-' + p, priority: 1, kind: 'policy', p,
        title: `${loosened ? 'Restore' : 'Raise to'} a ${tighten[0].best.cutoff} cut-off for ${P.name}s in ${tighten.map((x) => x.st.name).join(' & ')} only`,
        why: loosened
          ? `Since the ${C.previousCutoff[p]}→${cur} loosening, these states added near-prime/subprime mix and are deteriorating faster than the market. Everywhere else, ${cur} remains the profit-maximising cut-off.`
          : `These states have deteriorated more than the market; a tighter cut-off there improves risk-adjusted profit. Elsewhere ${cur} stays optimal.`,
        impact: [
          ['Net contribution', '+' + F().cr(gain) + ' / month', 'good'],
          ['Expected credit loss', '−' + F().cr(lossCut) + ' / month', 'good'],
          ['Approvals', '−' + ((volCut / totalAppr) * 100).toFixed(1) + '% of ' + P.name + ' volume', 'bad']
        ],
        action: { view: 'simulator', params: { p, s: tighten[0].st.id, cutoff: tighten[0].best.cutoff } },
        states: tighten.map((x) => x.st.id), score: gain
      });
    }
    // 2) idiosyncratic deterioration with a flat market -> approvals audit
    perState.filter((x) => x.dec.own > 0.003 && Math.abs(x.dec.indDelta) < 0.002 && Math.abs(x.dec.market) < x.dec.own).forEach((x) => {
      recs.push({
        id: 'sourcing-' + p + '-' + x.st.id, priority: 2, kind: 'operations', p,
        title: `Audit ${P.name} approvals in ${x.st.name}: the market is flat, your book isn't`,
        why: `Industry ${P.name} 30+ DPD in ${x.st.name} moved only ${F().bps(x.dec.indDelta)} since ${D.monthLabel(C.policyChangeMonth)}; yours rose ${F().bps(x.dec.delta)}, of which ${F().bps(x.dec.own)} is member-specific (same segments, worse performance). This points to underwriting or approval execution, not the economy.`,
        impact: [['Member-specific effect', F().bps(x.dec.own), 'bad'], ['Market effect', F().bps(x.dec.market), '']],
        action: { view: 'upload', params: {} },
        states: [x.st.id], score: x.dec.own * 100
      });
    });
    // 3) application surge -> verification
    const surge = states.map((st) => ({ st, c: S.loginCompare({ p, s: st.id, b: ['NP', 'SB'] }, 5) }))
      .filter((x) => x.c.mem.change > 0.4 && x.c.mem.change - x.c.ind.change > 0.3);
    if (surge.length) {
      const perDay = surge.reduce((a, x) => a + (x.c.mem.recent.perDay - x.c.mem.prior.perDay), 0);
      recs.push({
        id: 'logins-' + p, priority: 1, kind: 'early-warning', p,
        title: `Add enhanced checks on near-prime & subprime ${P.name} applications in ${surge.map((x) => x.st.name).join(' & ')} this week`,
        why: `Applications in these segments are up ${surge.map((x) => F().chg(x.c.mem.change, 0)).join(' / ')} in 5 days while industry moved ${surge.map((x) => F().chg(x.c.ind.change, 0)).join(' / ')}. ${F().pct(surge[0].c.mem.recent.hiEnqShare, 0)} of them made 3+ enquiries in 30 days (industry ${F().pct(surge[0].c.ind.recent.hiEnqShare, 0)}) — a classic pattern of credit-hungry or organised applications, visible weeks before it shows up as delinquency.`,
        impact: [['Excess applications', '~' + Math.round(perDay) + ' / day', 'bad'], ['Signal lead time', '3–6 months before DPD', '']],
        action: { view: 'logins', params: { p, s: surge[0].st.id } },
        states: surge.map((x) => x.st.id), score: 1
      });
    }
    // 4) collections: cure rate falling faster than the market
    const cureDrop = states.map((st) => {
      const now = S.value('member', 'cure', { p, s: st.id, m: t }), was = S.value('member', 'cure', { p, s: st.id, m: S.monthsAgo(6) });
      const ind = S.value('industry', 'cure', { p, s: st.id, m: t }), indWas = S.value('industry', 'cure', { p, s: st.id, m: S.monthsAgo(6) });
      return { st, now, was, ind, drop: was - now - (indWas - ind) };
    }).sort((a, b) => b.drop - a.drop)[0];
    if (cureDrop && cureDrop.drop > 0.02) {
      recs.push({
        id: 'collections-' + p, priority: 3, kind: 'collections', p,
        title: `Shift early-bucket ${P.name} collections capacity to ${cureDrop.st.name}`,
        why: `Cure rate from 30–89 DPD fell from ${F().pct(cureDrop.was, 1)} to ${F().pct(cureDrop.now, 1)} in 6 months (industry now ${F().pct(cureDrop.ind, 1)}). Each point of cure recovered keeps accounts out of 90+.`,
        impact: [['Cure-rate gap to industry', F().pp(cureDrop.now - cureDrop.ind, 1), 'bad']],
        action: { view: 'benchmark', params: { p, metric: 'cure' } },
        states: [cureDrop.st.id], score: cureDrop.drop
      });
    }
    return recs;
  }

  function growthRec() {
    const t = S.latest();
    const ccM = S.value('member', 'dpd30', { p: 'CC', m: t }), ccP = S.peerValue('mid-pvt', 'dpd30', { p: 'CC', m: t });
    if (!(ccP && ccM < ccP - 0.003)) return null;
    const sh = S.value('member', 'bal', { p: 'CC', m: t }) / S.value('industry', 'bal', { p: 'CC', m: t });
    return {
      id: 'cc-growth', priority: 4, kind: 'growth', p: 'CC',
      title: 'Grow credit cards in prime segments — you are outperforming peers on risk',
      why: `Card 30+ DPD is ${F().pct(ccM)} vs ${F().pct(ccP)} for PVT · Mid-size peers, yet your share of the card market is only ${F().pct(sh, 2)}. Risk headroom can fund growth.`,
      impact: [['Risk headroom vs peers', F().bps(ccP - ccM).replace('+', ''), 'good']],
      action: { view: 'benchmark', params: { p: 'CC' } },
      states: [], score: 0
    };
  }

  // Ranked recommendations for a product, or across the whole portfolio (p = 'ALL')
  const recCache = new Map();
  if (PIQ.cutoffs) PIQ.cutoffs.onChange(() => recCache.clear()); // a new policy grid changes the advice
  function recommendations(p) {
    p = p || 'ALL';
    if (recCache.has(p)) return recCache.get(p);
    let recs = p === 'ALL' ? D.PRODUCTS.flatMap((x) => productRecs(x.id)) : productRecs(p);
    const g = growthRec();
    if (g && (p === 'ALL' || p === 'CC' || p === 'PL')) recs.push(g);
    recs = recs.sort((a, b) => a.priority - b.priority || b.score - a.score);
    recCache.set(p, recs);
    return recs;
  }

  // Plain-English narrative of a decomposition
  function narrateDecomposition(d) {
    const place = d.s && d.s !== 'ALL' ? D.S[d.s].name : 'all states';
    const tot = Math.abs(d.mix) + Math.abs(d.market) + Math.abs(d.own) || 1;
    const share = (x) => Math.round((Math.abs(x) / tot) * 100) + '%';
    const lead = [['a riskier portfolio mix', d.mix], ['market-wide deterioration', d.market], ['your own segments performing worse than the market', d.own]].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    const top = d.segments.slice(0, 3).map((s) => s.label).join('; ');
    return {
      headline: `${pName(d.p)} ${S.METRICS[d.metric].short} across ${place} ${d.delta >= 0 ? 'rose' : 'fell'} ${F().bps(d.delta).replace('+', '')} (${F().pct(d.R0)} → ${F().pct(d.R1)}) between ${D.monthLabel(d.t0)} and ${D.monthLabel(d.t1)}. The industry moved ${F().bps(d.indDelta)}.`,
      drivers: `Mix shift explains ${share(d.mix)}, market-wide deterioration ${share(d.market)}, and member-specific performance ${share(d.own)}. The biggest driver is ${lead[0][0]}.`,
      segments: `Largest contributing segments: ${top}.`,
      verdict: Math.abs(d.market) > Math.abs(d.mix) + Math.abs(d.own) ? 'Mostly the market — you are moving with the industry.' : 'Mostly you — this is within your control.'
    };
  }

  PIQ.insights = { snapshot, recommendations, narrateDecomposition, driverLabel };
})(window);
