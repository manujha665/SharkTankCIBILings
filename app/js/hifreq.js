/*
 * High-frequency (weekly / fortnightly) submissions — synthetic.
 *
 * Monthly bureau files land 30–45 days after month end. Weekly / fortnightly submissions carry the
 * latest DPD, fresh EMI bounces, repayments against dues, current balances and first-payment
 * defaults, so stress shows up weeks earlier. Weekly figures here are anchored to the monthly
 * cubes (Apr–Aug) and run forward to the latest week, with bounces leading DPD by ~4 weeks.
 *
 * Grain: who (member / industry) × week × product × state × risk band.
 */
(function (root) {
  const PIQ = (root.PIQ = root.PIQ || {});
  const D = PIQ.data, S = PIQ.sem;

  // separate seeded stream so the monthly data never changes
  let seed = 7342;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const jitter = (a) => 1 + (rnd() * 2 - 1) * a;

  const LAST_WEEK = Date.UTC(2026, 8, 20); // Sunday 20 Sep 2026
  const WEEKS = [];
  for (let i = 15; i >= 0; i--) WEEKS.push(new Date(LAST_WEEK - i * 7 * 864e5).toISOString().slice(0, 10));
  const AUG_END = Date.UTC(2026, 7, 31);
  const monthsFromAug = (d) => (Date.parse(d + 'T00:00:00Z') - AUG_END) / (30.44 * 864e5);
  const ANCHOR = [S.monthsAgo(3), S.monthsAgo(2), S.monthsAgo(1), S.latest()]; // May..Aug at x = -3..0
  const BOUNCE_BASE = { SP: 0.012, PP: 0.025, PR: 0.05, NP: 0.1, SB: 0.18 };
  const EMI_PCT = { PL: 0.04, CC: 0.05, HL: 0.01, LAP: 0.015, AL: 0.025, TW: 0.045, GL: 0.02, MSME: 0.025, AGRI: 0.03, MFL: 0.09 };
  const hot = (who, p, s, b) => who === 'mem' && ((p === 'PL' && (s === 'UP' || s === 'GJ') && (b === 'NP' || b === 'SB')) || (p === 'MSME' && s === 'TN'));

  const PIDS = D.PRODUCTS.map((x) => x.id), SIDS = D.STATES.map((x) => x.id), BIDS = D.BANDS.map((x) => x.id);
  const MEAS = ['bal', 'd30', 'emiDue', 'emiB', 'dueAmt', 'paidAmt', 'newAcc', 'fpdN'];
  const cells = new Map(); // who|w|p|s|b -> measures
  ['mem', 'ind'].forEach((who) => {
    const src = who === 'mem' ? 'member' : 'industry';
    PIDS.forEach((p) => SIDS.forEach((s) => BIDS.forEach((b) => {
      const a = ANCHOR.map((m) => S.agg(src, { m, p, s, b }));
      if (!a[3].bal) return;
      const r = a.map((x) => x.d30 / x.bal);
      const slope = (r[3] - r[0]) / 3, gm = (a[3].bal / a[0].bal - 1) / 3;
      const accel = hot(who, p, s, b) ? 1.6 : 1;
      const rateAt = (x) => {
        if (x >= 0) return Math.min(0.5, r[3] + slope * x * accel);
        const k = Math.max(-3, x) + 3, i = Math.min(2, Math.floor(k));
        return r[i] + (r[i + 1] - r[i]) * (k - i);
      };
      const ticket = D.P[p].ticket;
      WEEKS.forEach((w, wi) => {
        const x = monthsFromAug(w);
        const bal = a[3].bal * (1 + gm * x) * jitter(0.004);
        const d30 = bal * rateAt(x) * jitter(0.01);
        // bounces lead DPD by about a month
        const lead = rateAt(x + 1) / Math.max(1e-6, rateAt(-3));
        const bounce = Math.min(0.6, BOUNCE_BASE[b] * Math.pow(D.P[p].risk, 0.8) * Math.pow(lead, 1.3) * jitter(0.03));
        const acc = (bal * 1e7) / (ticket * 1e5);
        const emiDue = acc / 4.345, dueAmt = (bal * EMI_PCT[p]) / 4.345;
        const newAcc = acc * D.P[p].orig / 4.345;
        const fpd = Math.min(0.3, bounce * 0.25 * (hot(who, p, s, b) && x > -2 ? 2.2 : 1));
        cells.set([who, wi, p, s, b].join('|'), { bal, d30, emiDue, emiB: emiDue * bounce, dueAmt, paidAmt: dueAmt * (1 - bounce * 0.75), newAcc, fpdN: newAcc * fpd });
      });
    })));
  });

  const asList = (v, all) => (v == null || v === 'ALL' ? all : Array.isArray(v) ? v : [v]);
  const cache = new Map();
  function sumWeek(who, wi, f) {
    const key = [who, wi, f.p || 'ALL', f.s || 'ALL', [].concat(f.b || 'ALL').join(',')].join('|');
    if (cache.has(key)) return cache.get(key);
    const o = Object.fromEntries(MEAS.map((m) => [m, 0]));
    asList(f.p, PIDS).forEach((p) => asList(f.s, SIDS).forEach((s) => asList(f.b, BIDS).forEach((b) => {
      const c = cells.get([who, wi, p, s, b].join('|'));
      if (c) MEAS.forEach((m) => (o[m] += c[m]));
    })));
    cache.set(key, o);
    return o;
  }
  const ratios = (o) => ({ bal: o.bal, dpd30: o.bal ? o.d30 / o.bal : null, bounce: o.emiDue ? o.emiB / o.emiDue : null, collEff: o.dueAmt ? o.paidAmt / o.dueAmt : null, fpd: o.newAcc ? o.fpdN / o.newAcc : null, freshBounces: o.emiB });
  // Periods: weekly = each week; fortnightly = pairs of weeks (stocks at period end, flows summed)
  function periods(cadence) {
    if (cadence !== 'fortnightly') return WEEKS.map((w, i) => ({ label: w, weeks: [i] }));
    const out = [];
    for (let i = 0; i < WEEKS.length; i += 2) out.push({ label: WEEKS[i + 1], weeks: [i, i + 1] });
    return out;
  }
  function series(who, f, cadence) {
    return periods(cadence).map((pd) => {
      const last = sumWeek(who, pd.weeks[pd.weeks.length - 1], f);
      const flow = pd.weeks.map((wi) => sumWeek(who, wi, f)).reduce((acc, o) => { ['emiDue', 'emiB', 'dueAmt', 'paidAmt', 'newAcc', 'fpdN'].forEach((m) => (acc[m] += o[m])); return acc; }, { emiDue: 0, emiB: 0, dueAmt: 0, paidAmt: 0, newAcc: 0, fpdN: 0 });
      return Object.assign({ x: pd.label }, ratios(Object.assign({}, flow, { bal: last.bal, d30: last.d30 })));
    });
  }
  // Latest period vs the average of the previous four, member and industry
  function latest(f, cadence) {
    const out = {};
    ['mem', 'ind'].forEach((who) => {
      const sr = series(who, f, cadence);
      const now = sr[sr.length - 1], prev = sr.slice(-5, -1);
      const avg = (k) => prev.reduce((a, x) => a + x[k], 0) / prev.length;
      out[who] = { now, prevBounce: avg('bounce'), prevColl: avg('collEff'), prevFpd: avg('fpd'), first: sr[0], series: sr };
    });
    return out;
  }
  // Member cells where fresh bounces jumped most: last 2 weeks vs prior 4 weeks
  function hotspots() {
    const tot = S.value('member', 'bal', { m: S.latest() });
    const n = WEEKS.length, rows = [];
    PIDS.forEach((p) => SIDS.forEach((s) => {
      if (S.value('member', 'bal', { p, s, m: S.latest() }) < tot * 0.004) return;
      const b = (who, ws) => { const o = ws.map((wi) => sumWeek(who, wi, { p, s })).reduce((a, x) => ({ d: a.d + x.emiDue, b: a.b + x.emiB }), { d: 0, b: 0 }); return o.b / o.d; };
      const now = b('mem', [n - 2, n - 1]), was = b('mem', [n - 6, n - 5, n - 4, n - 3]);
      const inow = b('ind', [n - 2, n - 1]), iwas = b('ind', [n - 6, n - 5, n - 4, n - 3]);
      rows.push({ p, s, now, was, change: now / was - 1, indNow: inow, indChange: inow / iwas - 1, bal: S.value('member', 'bal', { p, s, m: S.latest() }) });
    }));
    return rows.sort((a, c) => (c.change - c.indChange) - (a.change - a.indChange));
  }

  S.DATASETS.hifreq = { name: 'Weekly & Fortnightly Submissions', grain: 'week × product × state × risk band', refresh: 'Weekly (T+3) / fortnightly', asOf: 'week ending 20 Sep 2026' };
  PIQ.hf = { WEEKS, series, latest, hotspots, periods };
})(typeof window !== 'undefined' ? window : globalThis);
