/*
 * Governed semantic layer. Every number on screen and every AI answer goes through
 * these functions — this is the "approved dataset" boundary. Nothing else touches raw data.
 */
(function (root) {
  const PIQ = (root.PIQ = root.PIQ || {});
  const D = PIQ.data;
  const C = PIQ.config;

  const METRICS = {
    bal: { id: 'bal', name: 'Outstanding balance', short: 'Balance', unit: 'cr', kind: 'sum', field: 'bal', bad: false,
      def: 'Sum of principal outstanding on active accounts at month end (₹ crore).' },
    acc: { id: 'acc', name: 'Active accounts', short: 'Accounts', unit: 'count', kind: 'sum', field: 'acc', bad: false,
      def: 'Count of open accounts with a balance or activity in the month.' },
    orig: { id: 'orig', name: 'Originations (value)', short: 'Originations', unit: 'cr', kind: 'sum', field: 'orig', bad: false,
      def: 'Value of new accounts disbursed / cards issued in the month (₹ crore; card = sanctioned limit × utilisation).' },
    dpd30: { id: 'dpd30', name: '30+ DPD rate', short: '30+ DPD', unit: 'pct', kind: 'ratio', num: 'd30', den: 'bal', bad: true,
      def: 'Balance 30 or more days past due ÷ total balance, by value, at month end.' },
    dpd90: { id: 'dpd90', name: '90+ DPD rate', short: '90+ DPD', unit: 'pct', kind: 'ratio', num: 'd90', den: 'bal', bad: true,
      def: 'Balance 90 or more days past due ÷ total balance, by value, at month end.' },
    cure: { id: 'cure', name: 'Collection cure rate', short: 'Cure rate', unit: 'pct', kind: 'ratio', num: 'cureN', den: 'cureD', bad: false,
      def: 'Share of accounts 30–89 DPD last month that returned to current this month — a collections effectiveness measure.' }
  };

  const DATASETS = {
    industry: { name: 'Industry Credit Dataset', grain: 'month × product × state × risk band × lender type', refresh: 'Monthly', asOf: C.dataAsOf },
    member: { name: 'Member Portfolio Dataset', grain: 'month × product × state × risk band', refresh: 'Monthly', asOf: C.dataAsOf },
    peers: { name: 'Anonymised Peer Aggregates', grain: 'peer group × month × product × state', refresh: 'Monthly', asOf: C.dataAsOf },
    logins: { name: 'Enquiry & Application Feed', grain: 'day × product × state × risk band', refresh: 'Daily (T-1)', asOf: C.loginsAsOf },
    scores: { name: 'Application Score Distribution', grain: 'product × state × 20-pt score bin', refresh: 'Weekly', asOf: 'last 90 days' }
  };

  // ---------------- audit ----------------
  const audit = [];
  function log(tool, params, by) {
    audit.unshift({ ts: new Date(), tool, params: JSON.stringify(params), by: by || 'dashboard' });
    if (audit.length > 200) audit.pop();
  }

  // ---------------- core query ----------------
  const asList = (v) => (v == null || v === 'ALL' ? null : Array.isArray(v) ? v : [v]);
  function filter(rows, f) {
    const keys = ['m', 'p', 's', 'b', 'l', 'd', 'who', 'peer'];
    const conds = keys.map((k) => [k, asList(f[k])]).filter(([, v]) => v);
    return rows.filter((r) => conds.every(([k, v]) => v.includes(r[k])));
  }
  function sum(rows) {
    const o = { bal: 0, acc: 0, orig: 0, d30: 0, d90: 0, cureN: 0, cureD: 0, apps: 0, appr: 0, hiEnq: 0 };
    rows.forEach((r) => { for (const k in o) if (r[k] != null) o[k] += r[k]; });
    return o;
  }
  function metricOf(agg, metric) {
    const M = METRICS[metric];
    if (M.kind === 'sum') return agg[M.field];
    return agg[M.den] ? agg[M.num] / agg[M.den] : null;
  }
  function rowsFor(source) {
    if (source === 'industry') return D.industry;
    if (source === 'member') return D.member;
    throw new Error('Unknown source ' + source);
  }
  // Monthly series of a metric for a source and filter
  function series(source, metric, f) {
    const rows = filter(rowsFor(source), Object.assign({}, f, { m: null }));
    const byM = {};
    rows.forEach((r) => { (byM[r.m] = byM[r.m] || []).push(r); });
    return D.MONTHS.map((m) => ({ x: m, y: byM[m] ? metricOf(sum(byM[m]), metric) : null }));
  }
  function value(source, metric, f) {
    return metricOf(sum(filter(rowsFor(source), f)), metric);
  }
  // Break a metric down by a dimension for one month
  function breakdown(source, metric, f, dim) {
    const list = { s: D.STATES, b: D.BANDS, l: D.LENDERS, p: D.PRODUCTS }[dim];
    return list.map((it) => ({ key: it.id, name: it.name, y: value(source, metric, Object.assign({}, f, { [dim]: it.id })) }));
  }
  const latest = () => D.MONTHS[D.MONTHS.length - 1];
  const monthsAgo = (n) => D.MONTHS[D.MONTHS.length - 1 - n];

  // ---------------- peer groups with privacy guardrails ----------------
  const PEER_GROUPS = [
    { id: 'mid-pvt', name: 'Mid-size private banks', types: ['PVT'], sizes: ['Mid'] },
    { id: 'all-pvt', name: 'All private banks', types: ['PVT'], sizes: ['Mid', 'Large'] },
    { id: 'large-pvt', name: 'Large private banks', types: ['PVT'], sizes: ['Large'] },
    { id: 'nbfc', name: 'NBFCs (all)', types: ['NBFC'], sizes: ['Mid', 'Large'] },
    { id: 'fin', name: 'Fintech lenders', types: ['FIN'], sizes: ['Mid'] }
  ];
  function peerMembers(types, sizes) {
    return D.PEER_DEFS.filter((d) => types.includes(d.type) && sizes.includes(d.size));
  }
  // Returns { ok, reason, n, maxShare } — the privacy gate
  function peerCheck(types, sizes, f) {
    const ids = peerMembers(types, sizes).map((d) => d.id);
    const n = ids.length;
    if (n < C.privacy.minPeers)
      return { ok: false, n, reason: `Only ${n} institution${n === 1 ? '' : 's'} in this group. A peer benchmark needs at least ${C.privacy.minPeers}, so no single lender can be inferred.` };
    const rows = filter(D.peers, Object.assign({}, f, { peer: ids, m: f && f.m ? f.m : latest() }));
    const byPeer = {};
    rows.forEach((r) => { byPeer[r.peer] = (byPeer[r.peer] || 0) + r.bal; });
    const tot = Object.values(byPeer).reduce((a, b) => a + b, 0);
    const maxShare = Math.max(...Object.values(byPeer)) / tot;
    if (maxShare > C.privacy.maxShare)
      return { ok: false, n, maxShare, reason: `One institution is ${(maxShare * 100).toFixed(0)}% of this group's balance (limit ${C.privacy.maxShare * 100}%). Its numbers would leak through the average.` };
    return { ok: true, n, maxShare };
  }
  function peerSeries(groupOrSpec, metric, f) {
    const g = typeof groupOrSpec === 'string' ? PEER_GROUPS.find((x) => x.id === groupOrSpec) || PEER_GROUPS[0] : groupOrSpec;
    const chk = peerCheck(g.types, g.sizes, f);
    if (!chk.ok) return { suppressed: true, check: chk, points: [] };
    const ids = peerMembers(g.types, g.sizes).map((d) => d.id);
    const rows = filter(D.peers, Object.assign({}, f, { peer: ids, m: null, b: null, l: null }));
    const byM = {};
    rows.forEach((r) => { (byM[r.m] = byM[r.m] || []).push(r); });
    return { suppressed: false, check: chk, points: D.MONTHS.map((m) => ({ x: m, y: byM[m] ? metricOf(sum(byM[m]), metric) : null })) };
  }
  function peerValue(groupId, metric, f) {
    const s = peerSeries(groupId, metric, f);
    if (s.suppressed) return null;
    const m = (f && f.m) || latest();
    const pt = s.points.find((p) => p.x === m);
    return pt ? pt.y : null;
  }

  // ---------------- "Why did it change?" decomposition ----------------
  // Midpoint (symmetric) mix/rate split: exact, order-independent.
  // Rate effect is further split into market-driven (industry moved the same segment by the
  // same relative amount) and member-specific (the rest).
  function decompose(opts) {
    const { p, s, t0, t1, dim } = opts; // dim: 's' | 'b' | 'sb'
    const metric = opts.metric || 'dpd30';
    const M = METRICS[metric];
    const segs = [];
    const states = s && s !== 'ALL' ? [s] : D.STATES.map((x) => x.id);
    const keys = [];
    if (dim === 's') states.forEach((st) => keys.push({ s: st }));
    else if (dim === 'b') D.BANDS.forEach((b) => keys.push({ b: b.id, s: states }));
    else states.forEach((st) => D.BANDS.forEach((b) => keys.push({ s: st, b: b.id })));

    const tot0 = sum(filter(D.member, { p, s: states, m: t0 }));
    const tot1 = sum(filter(D.member, { p, s: states, m: t1 }));
    const R0 = metricOf(tot0, metric), R1 = metricOf(tot1, metric);
    keys.forEach((k) => {
      const a0 = sum(filter(D.member, Object.assign({ p, m: t0 }, k)));
      const a1 = sum(filter(D.member, Object.assign({ p, m: t1 }, k)));
      const i0 = sum(filter(D.industry, Object.assign({ p, m: t0 }, k)));
      const i1 = sum(filter(D.industry, Object.assign({ p, m: t1 }, k)));
      const w0 = a0[M.den] / tot0[M.den], w1 = a1[M.den] / tot1[M.den];
      const r0 = metricOf(a0, metric), r1 = metricOf(a1, metric);
      const ir0 = metricOf(i0, metric), ir1 = metricOf(i1, metric);
      const mix = (w1 - w0) * (r0 + r1) / 2;
      const rate = (r1 - r0) * (w0 + w1) / 2;
      const mktDelta = r0 * (ir1 / ir0 - 1);
      const market = mktDelta * (w0 + w1) / 2;
      const own = rate - market;
      const label = [k.s && !Array.isArray(k.s) ? D.S[k.s].name : null, k.b ? D.B[k.b].name : null].filter(Boolean).join(' · ');
      segs.push({ key: [Array.isArray(k.s) ? '' : k.s, k.b].filter(Boolean).join('-'), s: Array.isArray(k.s) ? null : k.s, b: k.b || null, label, w0, w1, r0, r1, ir0, ir1, mix, rate, market, own, total: mix + rate });
    });
    const tot = (f) => segs.reduce((a, x) => a + x[f], 0);
    // industry comparison: same product/states, all lenders
    const indR0 = value('industry', metric, { p, s: states, m: t0 });
    const indR1 = value('industry', metric, { p, s: states, m: t1 });
    log('decompose', { p, s, t0, t1, dim, metric });
    return {
      p, s, t0, t1, dim, metric, R0, R1, delta: R1 - R0,
      mix: tot('mix'), rate: tot('rate'), market: tot('market'), own: tot('own'),
      indR0, indR1, indDelta: indR1 - indR0,
      segments: segs.sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
    };
  }

  // ---------------- Policy simulator ----------------
  const DEFAULT_ASSUMPTIONS = {
    PL: { ticket: 3.2, yield: 0.155, cof: 0.075, opex: 0.03, lgd: 0.68, otherPass: 0.8 },
    CC: { ticket: 1.1, yield: 0.24, cof: 0.075, opex: 0.05, lgd: 0.78, otherPass: 0.78 }
  };
  function simulate(p, s, cutoff, assumptions) {
    const A = Object.assign({}, DEFAULT_ASSUMPTIONS[p], assumptions || {});
    const rows = filter(D.scores, { p, s });
    let apps = 0, approved = 0, bad = 0, badInd = 0;
    rows.forEach((r) => {
      apps += r.apps;
      const pass = r.lo >= cutoff ? 1 : r.hi > cutoff ? (r.hi - cutoff) / (r.hi - r.lo) : 0;
      const a = r.apps * pass * A.otherPass;
      approved += a; bad += a * r.badMem; badInd += a * r.badInd;
    });
    const perMonth = approved / 3;
    const disb = (perMonth * A.ticket) / 100; // ₹ crore (ticket in lakh)
    const badRate = approved ? bad / approved : 0;
    const loss = disb * badRate * A.lgd;
    const margin = disb * (A.yield - A.cof - A.opex);
    return {
      p, s, cutoff, apps: apps / 3, approvalRate: apps ? approved / apps : 0,
      approvedPerMonth: perMonth, disbursalCr: disb, badRate, badRateInd: approved ? badInd / approved : 0,
      expLossCr: loss, netCr: margin - loss, assumptions: A
    };
  }
  function simulateCurve(p, s, assumptions) {
    const out = [];
    for (let c = 600; c <= 800; c += 10) out.push(simulate(p, s, c, assumptions));
    return out;
  }

  // ---------------- Logins / applications ----------------
  function loginDaily(who, f) {
    const rows = filter(D.logins, Object.assign({}, f, { who }));
    const byD = {};
    rows.forEach((r) => { (byD[r.d] = byD[r.d] || []).push(r); });
    return D.DAYS.map((d) => {
      const a = sum(byD[d] || []);
      return { x: d, apps: a.apps, appr: a.appr, hiEnq: a.hiEnq };
    });
  }
  // Compare last N days vs the prior window (same length) for a slice
  function loginCompare(f, recentDays) {
    const n = recentDays || 5;
    const recent = D.DAYS.slice(-n), prior = D.DAYS.slice(0, -n);
    const dow = (d) => new Date(d + 'T00:00:00Z').getUTCDay();
    const calc = (who, days) => {
      const a = sum(filter(D.logins, Object.assign({}, f, { who, d: days })));
      return { perDay: a.apps / days.length, apprRate: a.apps ? a.appr / a.apps : 0, hiEnqShare: a.apps ? a.hiEnq / a.apps : 0, apps: a.apps };
    };
    // Baseline = same weekdays in the prior window, so weekends don't distort the comparison
    const baseline = (who) => {
      let tot = 0;
      recent.forEach((d) => {
        const same = prior.filter((x) => dow(x) === dow(d));
        tot += sum(filter(D.logins, Object.assign({}, f, { who, d: same }))).apps / same.length;
      });
      return tot / recent.length;
    };
    const out = {};
    ['mem', 'ind'].forEach((w) => {
      const r = calc(w, recent), pr = calc(w, prior);
      const base = baseline(w);
      out[w] = { recent: r, prior: Object.assign(pr, { perDay: base }), change: base ? r.perDay / base - 1 : 0 };
    });
    return out;
  }
  function loginMix(who, f, days) {
    const rows = filter(D.logins, Object.assign({}, f, { who, d: days }));
    const tot = sum(rows).apps;
    return D.BANDS.map((b) => ({ key: b.id, name: b.name, y: sum(rows.filter((r) => r.b === b.id)).apps / tot }));
  }

  // ---------------- Alerts ----------------
  function alerts() {
    const out = [];
    const t = latest(), t3 = monthsAgo(3);
    ['PL', 'CC'].forEach((p) => {
      D.STATES.forEach((st) => {
        const m1 = value('member', 'dpd30', { p, s: st.id, m: t }), m0 = value('member', 'dpd30', { p, s: st.id, m: t3 });
        const i1 = value('industry', 'dpd30', { p, s: st.id, m: t }), i0 = value('industry', 'dpd30', { p, s: st.id, m: t3 });
        const md = m1 - m0, id = i1 - i0;
        if (md > 0.003 && md > id * 1.6) {
          out.push({
            sev: md > 0.006 ? 'critical' : 'serious', kind: 'risk', p, s: st.id,
            title: id > 0.001
              ? `${D.P[p].name} 30+ DPD in ${st.name} is rising ${(md / id).toFixed(1)}× faster than the market`
              : `${D.P[p].name} 30+ DPD in ${st.name} is rising while the market is flat`,
            detail: `Up ${(md * 100).toFixed(2)} pp over 3 months to ${(m1 * 100).toFixed(2)}% vs industry +${(id * 100).toFixed(2)} pp.`,
            score: md
          });
        }
      });
    });
    ['UP', 'GJ', 'MH', 'TN', 'KA', 'TG'].forEach((s) => {
      const c = loginCompare({ p: 'PL', s, b: ['NP', 'SB'] }, 5);
      if (c.mem.change > 0.4 && c.mem.change - c.ind.change > 0.3) {
        out.push({
          sev: 'serious', kind: 'logins', p: 'PL', s,
          title: `Near-prime & subprime PL applications in ${D.S[s].name} up ${(c.mem.change * 100).toFixed(0)}% in the last 5 days`,
          detail: `Industry moved ${(c.ind.change * 100).toFixed(0)}%. ${(c.mem.recent.hiEnqShare * 100).toFixed(0)}% of these applicants made 3+ enquiries in 30 days (industry ${(c.ind.recent.hiEnqShare * 100).toFixed(0)}%).`,
          score: c.mem.change / 20
        });
      }
    });
    const ccM = value('member', 'dpd30', { p: 'CC', m: t }), ccP = peerValue('mid-pvt', 'dpd30', { p: 'CC', m: t });
    if (ccP && ccM < ccP) out.push({ sev: 'good', kind: 'positive', p: 'CC', s: null, title: 'Credit card 30+ DPD is better than mid-size private bank peers', detail: `${(ccM * 100).toFixed(2)}% vs peer ${(ccP * 100).toFixed(2)}% — room to grow share selectively.`, score: 0 });
    const rank = { critical: 0, serious: 1, warning: 2, good: 3 };
    return out.sort((a, b) => rank[a.sev] - rank[b.sev] || b.score - a.score);
  }

  PIQ.sem = {
    METRICS, DATASETS, PEER_GROUPS, DEFAULT_ASSUMPTIONS, audit, log,
    filter, sum, metricOf, series, value, breakdown, latest, monthsAgo,
    peerMembers, peerCheck, peerSeries, peerValue,
    decompose, simulate, simulateCurve,
    loginDaily, loginCompare, loginMix, alerts
  };
})(typeof window !== 'undefined' ? window : globalThis);
