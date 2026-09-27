/*
 * Governed semantic layer. Every number on screen and every AI answer goes through
 * these functions — this is the "approved dataset" boundary. Nothing else touches raw data.
 * Filters: { m, p, s, b, l } where each is an id, an array of ids, or 'ALL' / null (= everything).
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
      def: 'Balance 90 or more days past due ÷ total balance, by value, at month end (the NPA threshold).' },
    dpd180: { id: 'dpd180', name: '180+ DPD rate', short: '180+ DPD', unit: 'pct', kind: 'ratio', num: 'd180', den: 'bal', bad: true,
      def: 'Balance 180 or more days past due ÷ total balance, by value, at month end — deep delinquency, close to loss.' },
    cure: { id: 'cure', name: 'Collection cure rate', short: 'Cure rate', unit: 'pct', kind: 'ratio', num: 'cureN', den: 'cureD', bad: false,
      def: 'Share of accounts 30–89 DPD last month that returned to current this month — a collections effectiveness measure.' }
  };
  const DPD_METRICS = ['dpd30', 'dpd90', 'dpd180'];

  const DATASETS = {
    industry: { name: 'Industry Credit Dataset', grain: 'month × product (10) × state (24) × risk band × lender category (8)', refresh: 'Monthly', asOf: C.dataAsOf },
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
  // array helpers (used for the small score table)
  function filter(rows, f) {
    const conds = Object.keys(f).map((k) => [k, asList(f[k])]).filter(([, v]) => v);
    return rows.filter((r) => conds.every(([k, v]) => v.includes(r[k])));
  }
  function metricOf(agg, metric) {
    const M = METRICS[metric];
    if (M.kind === 'sum') return agg[M.field];
    return agg[M.den] ? agg[M.num] / agg[M.den] : null;
  }
  const cube = (source) => {
    const c = D.cube[source];
    if (!c) throw new Error('Unknown source ' + source);
    return c;
  };
  const agg = (source, f) => cube(source).sum(f);
  function series(source, metric, f) {
    return D.MONTHS.map((m) => ({ x: m, y: metricOf(agg(source, Object.assign({}, f, { m })), metric) }));
  }
  function value(source, metric, f) {
    return metricOf(agg(source, f), metric);
  }
  function breakdown(source, metric, f, dim) {
    const list = { s: D.STATES, b: D.BANDS, l: D.LENDERS, p: D.PRODUCTS }[dim];
    return list.map((it) => ({ key: it.id, name: it.name, y: value(source, metric, Object.assign({}, f, { [dim]: it.id })) }));
  }
  const latest = () => D.MONTHS[D.MONTHS.length - 1];
  const monthsAgo = (n) => D.MONTHS[D.MONTHS.length - 1 - n];

  // ---------------- peer groups with privacy guardrails ----------------
  const PEER_GROUPS = [
    { id: 'mid-pvt', name: 'PVT · Mid-size', types: ['PVT'], sizes: ['Mid'] },
    { id: 'all-pvt', name: 'PVT · All', types: ['PVT'], sizes: ['Mid', 'Large'] },
    { id: 'large-pvt', name: 'PVT · Large', types: ['PVT'], sizes: ['Large'] },
    { id: 'psu', name: 'PSU', types: ['PSU'], sizes: ['Large'] },
    { id: 'nbfc', name: 'NBFC', types: ['NBFC'], sizes: ['Mid', 'Large'] },
    { id: 'fin', name: 'Fintech', types: ['FIN'], sizes: ['Mid', 'Large'] },
    { id: 'sfb', name: 'SFB', types: ['SFB'], sizes: ['Mid', 'Large'] },
    { id: 'mfi', name: 'MFI', types: ['MFI'], sizes: ['Mid', 'Large'] },
    { id: 'rrb', name: 'RRB/DCCB', types: ['RRB'], sizes: ['Mid', 'Large'] },
    { id: 'hfc', name: 'HFC', types: ['HFC'], sizes: ['Mid', 'Large'] }
  ];
  function peerMembers(types, sizes) {
    return D.PEER_DEFS.filter((d) => types.includes(d.type) && sizes.includes(d.size));
  }
  const peerF = (f) => ({ p: f && f.p, s: f && f.s });
  // Returns { ok, reason, n, maxShare } — the privacy gate
  function peerCheck(types, sizes, f) {
    const ids = peerMembers(types, sizes).map((d) => d.id);
    const n = ids.length;
    if (n < C.privacy.minPeers)
      return { ok: false, n, reason: `Only ${n} institution${n === 1 ? '' : 's'} in this group. A peer benchmark needs at least ${C.privacy.minPeers}, so no single lender can be inferred.` };
    const m = f && f.m ? f.m : latest();
    const bals = ids.map((id) => agg('peers', Object.assign(peerF(f), { peer: id, m })).bal);
    const tot = bals.reduce((a, b) => a + b, 0);
    const maxShare = Math.max(...bals) / tot;
    if (maxShare > C.privacy.maxShare)
      return { ok: false, n, maxShare, reason: `One institution is ${(maxShare * 100).toFixed(0)}% of this group's balance (limit ${C.privacy.maxShare * 100}%). Its numbers would leak through the average.` };
    return { ok: true, n, maxShare };
  }
  const groupOf = (g) => (typeof g === 'string' ? PEER_GROUPS.find((x) => x.id === g) || PEER_GROUPS[0] : g);
  function peerSeries(groupOrSpec, metric, f) {
    const g = groupOf(groupOrSpec);
    const chk = peerCheck(g.types, g.sizes, f);
    if (!chk.ok) return { suppressed: true, check: chk, points: [] };
    const ids = peerMembers(g.types, g.sizes).map((d) => d.id);
    return { suppressed: false, check: chk, points: D.MONTHS.map((m) => ({ x: m, y: metricOf(agg('peers', Object.assign(peerF(f), { peer: ids, m })), metric) })) };
  }
  function peerValue(groupId, metric, f) {
    const g = groupOf(groupId);
    const chk = peerCheck(g.types, g.sizes, f);
    if (!chk.ok) return null;
    const ids = peerMembers(g.types, g.sizes).map((d) => d.id);
    return metricOf(agg('peers', Object.assign(peerF(f), { peer: ids, m: (f && f.m) || latest() })), metric);
  }

  // ---------------- "Why did it change?" decomposition ----------------
  // Midpoint (symmetric) mix/rate split: exact, order-independent.
  // Rate effect is further split into market-driven (industry moved the same segment by the
  // same relative amount) and member-specific (the rest).
  // dim: any combination of p / s / b, e.g. 'psb', 'sb', 'p', 's', 'b'
  function decompose(opts) {
    const { t0, t1 } = opts;
    const p = opts.p || 'ALL', s = opts.s || 'ALL';
    const metric = opts.metric || 'dpd30';
    const dim = opts.dim || (p === 'ALL' ? 'psb' : 'sb');
    const M = METRICS[metric];
    const vals = {
      p: dim.includes('p') ? (p === 'ALL' ? D.PRODUCTS.map((x) => x.id) : [p]) : [null],
      s: dim.includes('s') ? (s === 'ALL' ? D.STATES.map((x) => x.id) : [s]) : [null],
      b: dim.includes('b') ? D.BANDS.map((x) => x.id) : [null]
    };
    const base = { p, s };
    const tot0 = agg('member', Object.assign({}, base, { m: t0 })), tot1 = agg('member', Object.assign({}, base, { m: t1 }));
    const R0 = metricOf(tot0, metric), R1 = metricOf(tot1, metric);
    const segs = [];
    vals.p.forEach((kp) => vals.s.forEach((ks) => vals.b.forEach((kb) => {
      const f = { p: kp || p, s: ks || s, b: kb };
      const a0 = agg('member', Object.assign({}, f, { m: t0 })), a1 = agg('member', Object.assign({}, f, { m: t1 }));
      if (!a0[M.den] && !a1[M.den]) return;
      const i0 = agg('industry', Object.assign({}, f, { m: t0 })), i1 = agg('industry', Object.assign({}, f, { m: t1 }));
      const w0 = a0[M.den] / tot0[M.den], w1 = a1[M.den] / tot1[M.den];
      const r0 = metricOf(a0, metric) || 0, r1 = metricOf(a1, metric) || 0;
      const ir0 = metricOf(i0, metric), ir1 = metricOf(i1, metric);
      const mix = (w1 - w0) * (r0 + r1) / 2;
      const rate = (r1 - r0) * (w0 + w1) / 2;
      const market = ir0 ? r0 * (ir1 / ir0 - 1) * (w0 + w1) / 2 : 0;
      const label = [kp ? D.P[kp].name : null, ks ? D.S[ks].name : null, kb ? D.B[kb].name : null].filter(Boolean).join(' · ');
      segs.push({ key: [kp, ks, kb].filter(Boolean).join('-'), p: kp, s: ks, b: kb, label, w0, w1, r0, r1, ir0, ir1, mix, rate, market, own: rate - market, total: mix + rate });
    })));
    const tot = (k) => segs.reduce((a, x) => a + x[k], 0);
    const indR0 = value('industry', metric, Object.assign({}, base, { m: t0 }));
    const indR1 = value('industry', metric, Object.assign({}, base, { m: t1 }));
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
    CC: { ticket: 1.1, yield: 0.24, cof: 0.075, opex: 0.05, lgd: 0.78, otherPass: 0.78 },
    HL: { ticket: 30, yield: 0.09, cof: 0.07, opex: 0.005, lgd: 0.25, otherPass: 0.85 },
    LAP: { ticket: 35, yield: 0.105, cof: 0.07, opex: 0.01, lgd: 0.35, otherPass: 0.8 },
    AL: { ticket: 7, yield: 0.1, cof: 0.07, opex: 0.015, lgd: 0.45, otherPass: 0.82 },
    TW: { ticket: 0.9, yield: 0.18, cof: 0.075, opex: 0.04, lgd: 0.7, otherPass: 0.78 },
    GL: { ticket: 1.3, yield: 0.12, cof: 0.07, opex: 0.02, lgd: 0.15, otherPass: 0.9 },
    MSME: { ticket: 18, yield: 0.12, cof: 0.075, opex: 0.015, lgd: 0.55, otherPass: 0.75 },
    AGRI: { ticket: 2, yield: 0.11, cof: 0.055, opex: 0.02, lgd: 0.3, otherPass: 0.8 },
    MFL: { ticket: 0.5, yield: 0.24, cof: 0.09, opex: 0.06, lgd: 0.6, otherPass: 0.85 }
  };
  const scoreIdx = {};
  D.scores.forEach((r) => { (scoreIdx[r.p + '|' + r.s] = scoreIdx[r.p + '|' + r.s] || []).push(r); });
  function simulate(p, s, cutoff, assumptions) {
    const A = Object.assign({}, DEFAULT_ASSUMPTIONS[p], assumptions || {});
    const states = !s || s === 'ALL' ? D.STATES.map((x) => x.id) : [s];
    let apps = 0, approved = 0, bad = 0, badInd = 0;
    states.forEach((st) => (scoreIdx[p + '|' + st] || []).forEach((r) => {
      apps += r.apps;
      const pass = r.lo >= cutoff ? 1 : r.hi > cutoff ? (r.hi - cutoff) / (r.hi - r.lo) : 0;
      const a = r.apps * pass * A.otherPass;
      approved += a; bad += a * r.badMem; badInd += a * r.badInd;
    }));
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
    return D.DAYS.map((d) => {
      const a = agg('logins', Object.assign({}, f, { who, d }));
      return { x: d, apps: a.apps, appr: a.appr, hiEnq: a.hiEnq };
    });
  }
  // Last N days vs a weekday-matched baseline from the prior window
  function loginCompare(f, recentDays) {
    const n = recentDays || 5;
    const recent = D.DAYS.slice(-n), prior = D.DAYS.slice(0, -n);
    const dow = (d) => new Date(d + 'T00:00:00Z').getUTCDay();
    const calc = (who, days) => {
      const a = agg('logins', Object.assign({}, f, { who, d: days }));
      return { perDay: a.apps / days.length, apprRate: a.apps ? a.appr / a.apps : 0, hiEnqShare: a.apps ? a.hiEnq / a.apps : 0, apps: a.apps };
    };
    const baseline = (who) => {
      let tot = 0;
      recent.forEach((d) => {
        const same = prior.filter((x) => dow(x) === dow(d));
        tot += agg('logins', Object.assign({}, f, { who, d: same })).apps / same.length;
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
    const tot = agg('logins', Object.assign({}, f, { who, d: days })).apps;
    return D.BANDS.map((b) => ({ key: b.id, name: b.name, y: agg('logins', Object.assign({}, f, { who, d: days, b: b.id })).apps / tot }));
  }

  // Quality of recent logins: score bands, expected PD, PIN-code risk tier and sourcing pool.
  // who: 'mem' | 'ind'; days: array of dates. PD = expected 12-month 90+ probability (apps-weighted).
  const PD_BUCKETS = [[0, 0.01, '< 1%'], [0.01, 0.03, '1–3%'], [0.03, 0.06, '3–6%'], [0.06, 0.1, '6–10%'], [0.1, 1, '10%+']];
  function loginQuality(who, f, days) {
    const base = Object.assign({}, f, { who, d: days });
    const tot = agg('logins', base);
    const part = (key, id) => { const a = agg('logins', Object.assign({}, base, { [key]: id })); return { apps: a.apps, share: a.apps / tot.apps, pd: a.apps ? a.pdN / a.apps : 0, hiEnq: a.apps ? a.hiEnq / a.apps : 0, appr: a.apps ? a.appr / a.apps : 0 }; };
    const buckets = PD_BUCKETS.map(([lo, hi, label]) => ({ label, lo, hi, apps: 0 }));
    D.BANDS.forEach((b) => D.PINS.forEach((pn) => D.POOLS.forEach((pl) => {
      const a = agg('logins', Object.assign({}, base, { b: b.id, pin: pn.id, src: pl.id }));
      if (!a.apps) return;
      const pd = a.pdN / a.apps;
      buckets.find((k) => pd >= k.lo && pd < k.hi).apps += a.apps;
    })));
    buckets.forEach((k) => (k.share = k.apps / tot.apps));
    return {
      who, days: days.length, apps: tot.apps, perDay: tot.apps / days.length,
      pd: tot.apps ? tot.pdN / tot.apps : 0, hiEnq: tot.apps ? tot.hiEnq / tot.apps : 0, appr: tot.apps ? tot.appr / tot.apps : 0,
      bands: D.BANDS.map((b) => Object.assign({ id: b.id, name: b.name, range: b.range }, part('b', b.id))),
      pins: D.PINS.map((x) => Object.assign({ id: x.id, name: x.name }, part('pin', x.id))),
      pools: D.POOLS.map((x) => {
        const o = Object.assign({ id: x.id, name: x.name }, part('src', x.id));
        const hp = agg('logins', Object.assign({}, base, { src: x.id, pin: 'H' })).apps;
        o.highPin = o.apps ? hp / o.apps : 0;
        return o;
      }),
      pdBuckets: buckets
    };
  }
  // Convenience: last 7 days vs the prior 23 days for the member, and the industry's last 7 days
  function loginQuality7(f) {
    const last = D.DAYS.slice(-7), prior = D.DAYS.slice(0, -7);
    return { mem: loginQuality('mem', f, last), memPrior: loginQuality('mem', f, prior), ind: loginQuality('ind', f, last) };
  }

  // ---------------- Alerts (early warning runs on 30+ DPD, the earliest bucket) ----------------
  let alertCache = null;
  function alerts() {
    if (alertCache) return alertCache;
    const out = [];
    const t = latest(), t3 = monthsAgo(3);
    const memTot = value('member', 'bal', { m: t });
    D.PRODUCTS.forEach((pd) => {
      const p = pd.id;
      D.STATES.forEach((st) => {
        const bal = value('member', 'bal', { p, s: st.id, m: t });
        if (bal < memTot * 0.004) return; // materiality: ignore tiny slices
        const m1 = value('member', 'dpd30', { p, s: st.id, m: t }), m0 = value('member', 'dpd30', { p, s: st.id, m: t3 });
        const i1 = value('industry', 'dpd30', { p, s: st.id, m: t }), i0 = value('industry', 'dpd30', { p, s: st.id, m: t3 });
        const md = m1 - m0, id = i1 - i0;
        if (md > 0.004 && md - id > 0.003 && md > id * 1.6) {
          out.push({
            sev: md > 0.006 ? 'critical' : 'serious', kind: 'risk', p, s: st.id,
            title: id > 0.001
              ? `${pd.name} 30+ DPD in ${st.name} is rising ${(md / id).toFixed(1)}× faster than the market`
              : `${pd.name} 30+ DPD in ${st.name} is rising while the market is flat`,
            detail: `Up ${(md * 100).toFixed(2)} pp over 3 months to ${(m1 * 100).toFixed(2)}% vs industry ${id >= 0 ? '+' : ''}${(id * 100).toFixed(2)} pp.`,
            score: md
          });
        }
      });
    });
    D.PRODUCTS.forEach((pd) => D.STATES.forEach((st) => {
      if (value('member', 'bal', { p: pd.id, s: st.id, m: t }) < memTot * 0.004) return;
      const c = loginCompare({ p: pd.id, s: st.id, b: ['NP', 'SB'] }, 5);
      if (c.mem.change > 0.4 && c.mem.change - c.ind.change > 0.3) {
        out.push({
          sev: 'serious', kind: 'logins', p: pd.id, s: st.id,
          title: `Near-prime & subprime ${pd.name} applications in ${st.name} up ${(c.mem.change * 100).toFixed(0)}% in the last 5 days`,
          detail: (() => {
            const q = loginQuality7({ p: pd.id, s: st.id, b: ['NP', 'SB'] });
            const hp = (x) => (x.pins[0].share * 100).toFixed(0) + '%';
            return `Industry moved ${(c.ind.change * 100).toFixed(0)}%. ${(c.mem.recent.hiEnqShare * 100).toFixed(0)}% made 3+ enquiries in 30 days (industry ${(c.ind.recent.hiEnqShare * 100).toFixed(0)}%); ${hp(q.mem)} come from high-risk PIN codes (industry ${hp(q.ind)}); expected PD ${(q.mem.pd * 100).toFixed(1)}% vs ${(q.ind.pd * 100).toFixed(1)}%.`;
          })(),
          score: c.mem.change / 20
        });
      }
    }));
    // weekly / fortnightly submissions: fresh bounces jumping ahead of the monthly file
    if (PIQ.hf) PIQ.hf.hotspots().filter((r) => r.change - r.indChange > 0.1).slice(0, 2).forEach((r) => {
      out.push({
        sev: 'serious', kind: 'fresh', p: r.p, s: r.s,
        title: `Fresh EMI bounces on ${D.P[r.p].name} in ${D.S[r.s].name} up ${(r.change * 100).toFixed(0)}% in the last 2 weeks`,
        detail: `Weekly data: bounce rate ${(r.was * 100).toFixed(1)}% → ${(r.now * 100).toFixed(1)}% while the industry moved ${(r.indChange * 100).toFixed(0)}%. This will reach the next monthly file as higher DPD.`,
        score: r.change / 2
      });
    });
    const ccM = value('member', 'dpd30', { p: 'CC', m: t }), ccP = peerValue('mid-pvt', 'dpd30', { p: 'CC', m: t });
    if (ccP && ccM < ccP) out.push({ sev: 'good', kind: 'positive', p: 'CC', s: null, title: 'Credit card 30+ DPD is better than PVT · Mid-size peers', detail: `${(ccM * 100).toFixed(2)}% vs peer ${(ccP * 100).toFixed(2)}% — room to grow share selectively.`, score: 0 });
    const rank = { critical: 0, serious: 1, warning: 2, good: 3 };
    alertCache = out.sort((a, b) => rank[a.sev] - rank[b.sev] || b.score - a.score);
    return alertCache;
  }

  PIQ.sem = {
    METRICS, DPD_METRICS, DATASETS, PEER_GROUPS, DEFAULT_ASSUMPTIONS, audit, log,
    filter, agg, metricOf, series, value, breakdown, latest, monthsAgo,
    peerMembers, peerCheck, peerSeries, peerValue,
    decompose, simulate, simulateCurve,
    loginDaily, loginCompare, loginMix, loginQuality, loginQuality7, PD_BUCKETS, alerts
  };
})(typeof window !== 'undefined' ? window : globalThis);
