/*
 * Synthetic data engine. Everything here is fabricated for demonstration and is
 * deterministic (seeded), so the demo tells the same story every time.
 *
 * Storage: dense "cubes" (typed arrays) so any slice sums fast.
 *  industry : month x product x state x riskBand x lenderCategory
 *  member   : month x product x state x riskBand
 *  peers    : peer x month x product x state            (never shown individually)
 *  logins   : who x day x product x state x riskBand x PIN tier x applicant credit profile (industry + member);
 *             measures apps, approvals, 3+ enquiries in 30d, PD numerator, 2+ enquiries the same day,
 *             amount requested (₹ lakh). Every dimension is derived from bureau enquiry and tradeline data.
 *  industry / member also carry newAcc (new accounts opened) so average ticket size = orig ÷ newAcc.
 *  scores   : product x state x 20-pt score bin (member applications, last 90 days)
 *
 * Amounts are stored as sums (balance, DPD balances, ...) so any slice aggregates
 * correctly: rate = sum(numerator) / sum(denominator).
 *
 * Embedded story (member = Sahyadri Bank, a mid-size private bank, all products):
 *  - PL cut-off loosened 700 -> 680 in Feb 2026; origination mix shifts to near-prime /
 *    subprime, mostly in Uttar Pradesh and Gujarat. PL and MSME also grow faster than the
 *    rest of the book, so the whole portfolio's mix gets riskier.
 *  - Uttar Pradesh: the market itself is deteriorating AND the member added risk.
 *  - Gujarat: the market is benign; the member's deterioration is idiosyncratic (approval process).
 *  - Microfinance: a market-wide stress cycle (strongest in Bihar, Odisha, West Bengal...).
 *  - Last 5 days of logins: near-prime / subprime PL applications in UP & GJ spike, with
 *    high enquiry intensity — an early-warning signal before it shows up in DPD.
 *  - Credit cards: member is better than peers.
 */
(function (root) {
  const PIQ = (root.PIQ = root.PIQ || {});

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32(20261004);
  const noise = (amp) => 1 + (rng() * 2 - 1) * amp;

  // ---------------- dense cube with cached slice sums ----------------
  // dims: [[key, ids[]], ...]; filters: key -> id | [ids] | 'ALL' | null (unknown keys ignored)
  function Cube(dims, measures) {
    this.keys = dims.map((d) => d[0]);
    this.ids = dims.map((d) => d[1]);
    this.pos = dims.map((d) => new Map(d[1].map((id, i) => [id, i])));
    this.M = measures;
    this.nm = measures.length;
    this.stride = [];
    let s = 1;
    for (let i = dims.length - 1; i >= 0; i--) { this.stride[i] = s; s *= dims[i][1].length; }
    this.data = new Float32Array(s * this.nm);
    this.cache = new Map();
  }
  Cube.prototype.offset = function (c) {
    let o = 0;
    for (let i = 0; i < this.keys.length; i++) o += this.pos[i].get(c[this.keys[i]]) * this.stride[i];
    return o * this.nm;
  };
  Cube.prototype.put = function (c, vals) {
    const o = this.offset(c);
    for (let j = 0; j < this.nm; j++) this.data[o + j] += vals[this.M[j]] || 0;
  };
  Cube.prototype.sum = function (f) {
    f = f || {};
    const lists = this.keys.map((k, i) => {
      const v = f[k];
      if (v == null || v === 'ALL') return null;
      return (Array.isArray(v) ? v : [v]).map((id) => this.pos[i].get(id)).filter((x) => x != null);
    });
    const ck = lists.map((l) => (l ? l.join(',') : '*')).join('|');
    const hit = this.cache.get(ck);
    if (hit) return hit;
    const acc = new Float64Array(this.nm);
    const nd = this.keys.length, data = this.data, nm = this.nm, stride = this.stride, ids = this.ids;
    const rec = (d, off) => {
      if (d === nd) { const o = off * nm; for (let j = 0; j < nm; j++) acc[j] += data[o + j]; return; }
      const l = lists[d];
      if (l) for (let i = 0; i < l.length; i++) rec(d + 1, off + l[i] * stride[d]);
      else for (let i = 0; i < ids[d].length; i++) rec(d + 1, off + i * stride[d]);
    };
    rec(0, 0);
    const out = {};
    this.M.forEach((m, j) => (out[m] = acc[j]));
    if (this.cache.size > 60000) this.cache.clear();
    this.cache.set(ck, out);
    return out;
  };

  const MONTHS = [];
  for (let i = 0; i < 24; i++) MONTHS.push(new Date(Date.UTC(2024, 8 + i, 1)).toISOString().slice(0, 7));
  const monthLabel = (m) => {
    const [y, mo] = m.split('-');
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+mo - 1] + ' ' + y.slice(2);
  };

  // ---------------- dimensions (illustrative, not official figures) ----------------
  // risk: relative delinquency vs PL; trend: shape of the industry cycle
  const PRODUCTS = [
    { id: 'PL', name: 'Personal Loan', long: 'Unsecured Personal Loan', base: 1500000, growth: 0.13, ticket: 2.4, orig: 0.075, risk: 1, trend: 'pl', bands: 'pl' },
    { id: 'CC', name: 'Credit Card', long: 'Credit Card', base: 290000, growth: 0.15, ticket: 0.45, orig: 0.11, risk: 1.45, trend: 'cc', bands: 'cc' },
    { id: 'HL', name: 'Housing Loan', long: 'Housing Loan', base: 3000000, growth: 0.12, ticket: 28, orig: 0.018, risk: 0.35, trend: 'improve', bands: 'secured' },
    { id: 'LAP', name: 'Loan Against Property', long: 'Loan Against Property (LAP)', base: 950000, growth: 0.16, ticket: 35, orig: 0.025, risk: 0.62, trend: 'flat', bands: 'secured' },
    { id: 'AL', name: 'Auto Loan', long: 'Auto Loan', base: 650000, growth: 0.14, ticket: 6, orig: 0.04, risk: 0.7, trend: 'flat', bands: 'mid' },
    { id: 'TW', name: 'Two-Wheeler Loan', long: 'Two-Wheeler Loan', base: 150000, growth: 0.12, ticket: 0.8, orig: 0.06, risk: 1.55, trend: 'mild', bands: 'mass' },
    { id: 'GL', name: 'Gold Loan', long: 'Gold Loan', base: 550000, growth: 0.24, ticket: 1.2, orig: 0.15, risk: 0.45, trend: 'flat', bands: 'mass' },
    { id: 'MSME', name: 'MSME Loan', long: 'MSME Loan', base: 2600000, growth: 0.12, ticket: 15, orig: 0.04, risk: 1.15, trend: 'mild', bands: 'mid' },
    { id: 'AGRI', name: 'Agri Loan', long: 'Agriculture Loan', base: 1900000, growth: 0.1, ticket: 1.8, orig: 0.05, risk: 1.35, trend: 'flat', bands: 'mass' },
    { id: 'MFL', name: 'Microfinance Loan', long: 'Microfinance Loan', base: 420000, growth: 0.04, ticket: 0.45, orig: 0.08, risk: 1.2, trend: 'mf', bands: 'mf' }
  ];
  // All states individually; the 8 north-eastern states grouped; small UTs grouped.
  const STATES = [
    ['AP', 'Andhra Pradesh', 0.05, 1.08, 1.1, 1.0], ['BR', 'Bihar', 0.025, 1.25, 1.2, 1.6], ['CG', 'Chhattisgarh', 0.012, 1.1, 1.0, 1.0],
    ['DL', 'Delhi (NCT)', 0.06, 0.92, 0.9, 0.7], ['GA', 'Goa', 0.006, 0.9, 0.8, 0.7], ['GJ', 'Gujarat', 0.07, 0.9, 0.5, 0.8],
    ['HR', 'Haryana', 0.03, 1.0, 1.0, 0.9], ['HP', 'Himachal Pradesh', 0.006, 0.95, 0.8, 0.8], ['JK', 'Jammu & Kashmir', 0.008, 1.1, 1.0, 0.8],
    ['JH', 'Jharkhand', 0.012, 1.15, 1.1, 1.2], ['KA', 'Karnataka', 0.09, 0.93, 0.8, 1.3], ['KL', 'Kerala', 0.04, 1.0, 0.9, 1.0],
    ['MP', 'Madhya Pradesh', 0.04, 1.12, 1.1, 1.2], ['MH', 'Maharashtra', 0.16, 0.97, 0.8, 1.0], ['OD', 'Odisha', 0.02, 1.1, 1.1, 1.4],
    ['PB', 'Punjab', 0.025, 1.05, 1.0, 0.9], ['RJ', 'Rajasthan', 0.04, 1.1, 1.1, 1.1], ['TN', 'Tamil Nadu', 0.1, 1.02, 0.9, 1.2],
    ['TG', 'Telangana', 0.06, 1.08, 1.3, 1.0], ['UP', 'Uttar Pradesh', 0.08, 1.2, 1.9, 1.3], ['UK', 'Uttarakhand', 0.01, 1.0, 0.9, 0.9],
    ['WB', 'West Bengal', 0.05, 1.08, 1.0, 1.3], ['NE', 'North-East states', 0.02, 1.3, 1.2, 1.3], ['UT', 'Other UTs', 0.012, 1.0, 1.0, 0.9]
  ].map(([id, name, w, risk, trend, mf]) => ({ id, name, w, risk, trend, mf }));
  // Product-specific geographic tilt (e.g. agri in the grain belt, microfinance in the east)
  const tilt = {
    AGRI: { UP: 1.8, MP: 1.8, RJ: 1.6, PB: 1.8, AP: 1.5, HR: 1.5, MH: 0.7, DL: 0.1, GA: 0.2, UT: 0.3, KL: 0.6 },
    MFL: { BR: 3, TN: 2, KA: 1.8, WB: 2, UP: 1.6, OD: 2.4, MP: 1.4, JH: 1.5, MH: 0.8, DL: 0.2, GA: 0.2, HP: 0.4, UT: 0.3, PB: 0.5 },
    HL: { MH: 1.3, KA: 1.2, DL: 1.2, GJ: 1.1, BR: 0.5, NE: 0.5, JH: 0.6 },
    GL: { TN: 2, KL: 2.5, KA: 1.3, AP: 1.5, TG: 1.3, DL: 0.6, PB: 0.6 },
    CC: { MH: 1.3, KA: 1.4, DL: 1.4, TG: 1.2, BR: 0.4, NE: 0.4, JH: 0.5 },
    PL: { UP: 1.2, GJ: 1.1 }
  };
  const BANDS = [
    { id: 'SP', name: 'Super-prime', range: '791+', lo: 791, sens: 0.2, cure: 0.62 },
    { id: 'PP', name: 'Prime-plus', range: '761–790', lo: 761, sens: 0.4, cure: 0.55 },
    { id: 'PR', name: 'Prime', range: '721–760', lo: 721, sens: 0.7, cure: 0.48 },
    { id: 'NP', name: 'Near-prime', range: '681–720', lo: 681, sens: 1.0, cure: 0.4 },
    { id: 'SB', name: 'Subprime', range: '≤680', lo: 300, sens: 1.35, cure: 0.31 }
  ];
  const LENDERS = [
    // Labels are abbreviations only (UI requirement); long form kept for reference.
    { id: 'PSU', name: 'PSU', long: 'Public sector banks', risk: 1.05, trend: 0.7 },
    { id: 'PVT', name: 'PVT', long: 'Private sector banks', risk: 0.86, trend: 0.9 },
    { id: 'NBFC', name: 'NBFC', long: 'Non-banking financial companies', risk: 1.14, trend: 1.1 },
    { id: 'FIN', name: 'Fintech', long: 'Fintech lenders', risk: 1.38, trend: 1.6 },
    { id: 'SFB', name: 'SFB', long: 'Small finance banks', risk: 1.22, trend: 1.2 },
    { id: 'MFI', name: 'MFI', long: 'Microfinance institutions', risk: 1.5, trend: 1.4 },
    { id: 'RRB', name: 'RRB/DCCB', long: 'Regional rural & district co-operative banks', risk: 1.3, trend: 0.9 },
    { id: 'HFC', name: 'HFC', long: 'Housing finance companies', risk: 0.95, trend: 0.8 }
  ];
  const BAND_TEMPLATES = {
    secured: [0.36, 0.24, 0.2, 0.12, 0.08], pl: [0.3, 0.22, 0.22, 0.15, 0.11], cc: [0.34, 0.22, 0.2, 0.14, 0.1],
    mid: [0.28, 0.22, 0.24, 0.15, 0.11], mass: [0.18, 0.18, 0.26, 0.2, 0.18], mf: [0.1, 0.14, 0.26, 0.26, 0.24]
  };
  const LT = ['PSU', 'PVT', 'NBFC', 'FIN', 'SFB', 'MFI', 'RRB', 'HFC'];
  const LENDER_MIX = {
    PL: [0.2, 0.36, 0.22, 0.1, 0.05, 0.02, 0.03, 0.02], CC: [0.12, 0.69, 0.07, 0.06, 0.03, 0.01, 0.01, 0.01],
    HL: [0.35, 0.3, 0.04, 0, 0.02, 0, 0.03, 0.25], LAP: [0.15, 0.3, 0.3, 0.02, 0.06, 0, 0.02, 0.15],
    AL: [0.2, 0.5, 0.25, 0.01, 0.02, 0, 0.02, 0], TW: [0.05, 0.25, 0.55, 0.1, 0.04, 0.01, 0, 0],
    GL: [0.35, 0.15, 0.4, 0.02, 0.03, 0.01, 0.04, 0], MSME: [0.38, 0.35, 0.15, 0.04, 0.04, 0.01, 0.03, 0],
    AGRI: [0.55, 0.18, 0.03, 0, 0.03, 0.01, 0.2, 0], MFL: [0.02, 0.35, 0.12, 0.01, 0.18, 0.32, 0, 0]
  };
  const BASE_DPD = [0.006, 0.013, 0.026, 0.052, 0.095]; // by band, for risk = 1
  // Monthly drift in industry balance share by band (SP, PP, PR, NP, SB): unsecured and
  // mass-market lending tilts towards weaker bands over 24 months; housing moves the other way.
  const BAND_DRIFT = {
    PL: [-0.009, -0.005, 0, 0.014, 0.022], CC: [-0.007, -0.004, 0, 0.011, 0.018], TW: [-0.006, -0.003, 0, 0.01, 0.016],
    MFL: [-0.004, -0.004, 0, 0.012, 0.02], MSME: [-0.007, -0.004, 0, 0.013, 0.02], GL: [-0.004, -0.002, 0, 0.009, 0.014],
    HL: [0.002, 0.001, 0, -0.002, -0.003], LAP: [-0.002, -0.001, 0, 0.004, 0.006], AL: [-0.002, -0.001, 0, 0.005, 0.008], AGRI: [-0.002, 0, 0, 0.005, 0.009]
  };

  const norm = (o) => { const t = Object.values(o).reduce((a, b) => a + b, 0); const r = {}; for (const k in o) r[k] = o[k] / t; return r; };
  const byId = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));
  const P = byId(PRODUCTS), S = byId(STATES), B = byId(BANDS), L = byId(LENDERS);
  const PIDS = PRODUCTS.map((x) => x.id), SIDS = STATES.map((x) => x.id), BIDS = BANDS.map((x) => x.id), LIDS = LENDERS.map((x) => x.id);
  // state weights per product, normalised
  const stW = {};
  PRODUCTS.forEach((p) => { const o = {}; STATES.forEach((s) => (o[s.id] = s.w * ((tilt[p.id] || {})[s.id] || 1))); stW[p.id] = norm(o); });
  const lenderW = {};
  PRODUCTS.forEach((p) => { const o = {}; LT.forEach((l, i) => (o[l] = Math.max(0.005, LENDER_MIX[p.id][i]))); lenderW[p.id] = norm(o); });
  const bandW = {};
  PRODUCTS.forEach((p) => { const o = {}; BIDS.forEach((b, i) => (o[b] = BAND_TEMPLATES[p.bands][i])); bandW[p.id] = o; });

  // Industry cycle by product (x > 0 = deterioration)
  function cycle(p, t, st) {
    switch (P[p].trend) {
      case 'pl': return (t < 14 ? 0.0008 * (t - 14) : 0.014 * (t - 14)) * st.trend;
      case 'cc': return 0.0065 * t * st.trend;
      case 'mf': return (t < 5 ? 0 : t < 17 ? 0.05 * (t - 5) : 0.6 - 0.02 * (t - 17)) * st.mf;
      case 'mild': return 0.004 * t * st.trend;
      case 'improve': return -0.004 * t;
      default: return 0.001 * t * st.trend;
    }
  }

  // ---------------- Ticket size (new loans) ----------------
  // Average ticket = product base ticket × risk band × state × lender category × ticket inflation.
  // Deterministic (no random draws), so adding it leaves every other number unchanged.
  const TK_BAND = { pl: [1.4, 1.18, 1, 0.84, 0.7], cc: [1.5, 1.2, 1, 0.8, 0.62], secured: [1.22, 1.1, 1, 0.9, 0.8], mid: [1.2, 1.08, 1, 0.92, 0.85], mass: [1.06, 1.03, 1, 0.97, 0.94], mf: [1.04, 1.02, 1, 0.98, 0.96] };
  const TK_STATE = { MH: 1.25, DL: 1.3, KA: 1.2, TG: 1.15, TN: 1.1, GJ: 1.1, HR: 1.12, KL: 1.05, GA: 1.15, PB: 1.05, AP: 1, WB: 0.92, RJ: 0.9, MP: 0.86, UP: 0.86, BR: 0.76, OD: 0.8, JH: 0.8, CG: 0.82, UK: 0.95, HP: 0.95, JK: 0.92, NE: 0.85, UT: 1.05 };
  const TK_LENDER = { PSU: 1.05, PVT: 1.12, NBFC: 0.95, FIN: 0.55, SFB: 0.78, MFI: 0.9, RRB: 0.72, HFC: 1.0 };
  const ticketL = (prod, bi, s, l, t) => prod.ticket * TK_BAND[prod.bands][bi] * (TK_STATE[s] || 1) * (TK_LENDER[l] || 1) * (1 + 0.006 * t); // ₹ lakh

  // ---------------- Industry ----------------
  const MEAS = ['bal', 'acc', 'orig', 'd30', 'd90', 'd180', 'cureN', 'cureD', 'newAcc'];
  const industry = new Cube([['m', MONTHS], ['p', PIDS], ['s', SIDS], ['b', BIDS], ['l', LIDS]], MEAS);
  const NP_ = PIDS.length, NS_ = SIDS.length, NB_ = BIDS.length, NL_ = LIDS.length;
  const ltAcc = new Float64Array(MONTHS.length * NP_ * NS_ * NL_ * 6); // m,p,s,l totals for peer baselines
  const pvtRate = new Float64Array(MONTHS.length * NP_ * NS_ * NB_ * 2); // PVT d30, cure by m,p,s,b
  MONTHS.forEach((m, t) => {
    PRODUCTS.forEach((prod, pi) => {
      const total = prod.base * Math.pow(1 + prod.growth * (1 - t / 60), t / 12);
      STATES.forEach((st, si) => {
        const cyc = cycle(prod.id, t, st);
        BANDS.forEach((bd, bi) => {
          LENDERS.forEach((ld, li) => {
            const tl = ld.id === 'FIN' && (bd.id === 'NP' || bd.id === 'SB') ? 1 + 0.01 * t : 1;
            const drift = Math.max(0.3, 1 + BAND_DRIFT[prod.id][bi] * t);
            const bal = total * stW[prod.id][st.id] * bandW[prod.id][bd.id] * drift * lenderW[prod.id][ld.id] * tl * noise(0.02);
            const tf = Math.max(0.5, 1 + cyc * bd.sens * ld.trend);
            const d30 = Math.min(0.45, BASE_DPD[bi] * prod.risk * st.risk * ld.risk * tf * noise(0.035));
            const acc = (bal * 1e7) / (prod.ticket * 1e5);
            const cureDen = acc * d30 * 0.62;
            const cure = Math.min(0.9, Math.max(0.1, bd.cure / Math.pow(tf, 1.1)) * noise(0.03));
            const d90 = d30 * 0.46 * noise(0.04);
            const orig = bal * prod.orig * noise(0.05);
            industry.put({ m, p: prod.id, s: st.id, b: bd.id, l: ld.id }, {
              bal, acc, orig, d30: bal * d30, d90: bal * d90, d180: bal * d90 * 0.55 * noise(0.04),
              cureN: cureDen * cure, cureD: cureDen, newAcc: (orig * 100) / ticketL(prod, bi, st.id, ld.id, t)
            });
            if (ld.id === 'PVT') { const o = (((t * NP_ + pi) * NS_ + si) * NB_ + bi) * 2; pvtRate[o] = d30; pvtRate[o + 1] = cure; }
            const lo = (((t * NP_ + pi) * NS_ + si) * NL_ + li) * 6;
            ltAcc[lo] += bal; ltAcc[lo + 1] += bal * d30; ltAcc[lo + 2] += bal * d90; ltAcc[lo + 3] += bal * d90 * 0.55; ltAcc[lo + 4] += cureDen * cure; ltAcc[lo + 5] += cureDen;
          });
        });
      });
    });
  });

  // ---------------- Member (Sahyadri Bank) ----------------
  const memberBase = { HL: 22000, LAP: 9000, AL: 6000, TW: 1500, PL: 12000, CC: 2400, GL: 3500, MSME: 11000, AGRI: 4000, MFL: 1800 };
  const memberGrowth = { PL: 0.2, MSME: 0.17, CC: 0.16, GL: 0.15, LAP: 0.13, HL: 0.11, AL: 0.11, TW: 0.1, AGRI: 0.08, MFL: 0.01 };
  const memberMult = { HL: 0.9, LAP: 1.0, AL: 0.95, TW: 1.05, PL: 1.0, CC: 0.9, GL: 0.9, MSME: 1.0, AGRI: 1.0, MFL: 1.08 };
  const footprint = norm({ MH: 0.3, GJ: 0.12, KA: 0.08, TN: 0.06, UP: 0.09, TG: 0.05, DL: 0.05, RJ: 0.04, MP: 0.04, KL: 0.02, AP: 0.03, WB: 0.02, HR: 0.02, PB: 0.01, BR: 0.01, OD: 0.01, CG: 0.01, JH: 0.005, UK: 0.005, HP: 0.002, GA: 0.01, JK: 0.003, NE: 0.005, UT: 0.005 });
  const memW = {};
  PRODUCTS.forEach((p) => { const o = {}; SIDS.forEach((s) => (o[s] = footprint[s] * ((tilt[p.id] || {})[s] || 1))); memW[p.id] = norm(o); });
  const POLICY_T = MONTHS.indexOf('2026-02');
  const member = new Cube([['m', MONTHS], ['p', PIDS], ['s', SIDS], ['b', BIDS]], MEAS);
  MONTHS.forEach((m, t) => {
    PRODUCTS.forEach((prod, pi) => {
      const total = memberBase[prod.id] * Math.pow(1 + memberGrowth[prod.id], t / 12);
      const since = Math.max(0, t - POLICY_T + 1);
      STATES.forEach((st, si) => {
        const hot = st.id === 'UP' || st.id === 'GJ';
        const bw = BAND_TEMPLATES[prod.bands];
        const shares = { SP: bw[0] + 0.04, PP: bw[1] + 0.01, PR: bw[2], NP: bw[3] - 0.03, SB: bw[4] - 0.02 };
        if (prod.id === 'PL' && since > 0) {
          const k = Math.min(since, 7) / 7;
          const npUp = (hot ? 0.11 : 0.03) * k, sbUp = (hot ? 0.09 : 0.022) * k;
          shares.NP += npUp; shares.SB += sbUp;
          shares.SP -= (npUp + sbUp) * 0.55; shares.PP -= (npUp + sbUp) * 0.3; shares.PR -= (npUp + sbUp) * 0.15;
        }
        BANDS.forEach((bd, bi) => {
          const ro = (((t * NP_ + pi) * NS_ + si) * NB_ + bi) * 2;
          const ir = { d30: pvtRate[ro], cure: pvtRate[ro + 1] };
          let mult = memberMult[prod.id];
          if (prod.id === 'PL' && since > 2 && (bd.id === 'NP' || bd.id === 'SB')) {
            const k = Math.min(since - 2, 5) / 5;
            mult *= 1 + k * (st.id === 'GJ' ? 1.35 : st.id === 'UP' ? 0.95 : 0.15);
          }
          // second story: MSME in Tamil Nadu — collections / servicing breakdown from May 2026, all bands
          const msmeTN = prod.id === 'MSME' && st.id === 'TN' && t >= POLICY_T + 3;
          if (msmeTN) {
            const k = Math.min(t - POLICY_T - 2, 4) / 4;
            mult *= 1 + 1.1 * k;
          }
          const bal = total * memW[prod.id][st.id] * Math.max(0.01, shares[bd.id]) * noise(0.02);
          const d30 = Math.min(0.45, ir.d30 * mult * noise(0.03));
          const acc = (bal * 1e7) / (prod.ticket * 1e5);
          const cureDen = acc * d30 * 0.62;
          const cure = ir.cure * (msmeTN ? 0.72 : mult > 1.1 ? 0.84 : 1.03) * noise(0.03);
          // weak vintages roll forward faster: 90+ share of 30+ rises in the stressed segments
          const roll = mult > 1.3 ? 0.62 : mult > 1.1 ? 0.52 : 0.45;
          const d90 = d30 * roll * noise(0.04);
          const orig = bal * prod.orig * (prod.id === 'PL' && since > 0 && (bd.id === 'NP' || bd.id === 'SB') ? 1.35 : 1) * noise(0.05);
          // ticket-size story: after the Feb loosening, near-prime / subprime personal loans got bigger,
          // most in Uttar Pradesh and Gujarat (bigger loans to riskier borrowers)
          const tkUp = prod.id === 'PL' && since > 0 && (bd.id === 'NP' || bd.id === 'SB') ? 1 + (hot ? 0.065 : 0.02) * Math.min(since, 7) : 1;
          member.put({ m, p: prod.id, s: st.id, b: bd.id }, {
            bal, acc, orig,
            d30: bal * d30, d90: bal * d90, d180: bal * d90 * 0.55 * noise(0.04),
            cureN: cureDen * cure, cureD: cureDen, newAcc: (orig * 100) / (ticketL(prod, bi, st.id, 'PVT', t) * 0.97 * tkUp)
          });
        });
      });
    });
  });

  // ---------------- Peers (anonymised; only aggregates ever leave the engine) ----------------
  const PEER_DEFS = [];
  [
    ['PVT', 'Mid', 7], ['PVT', 'Large', 4], ['NBFC', 'Mid', 6], ['NBFC', 'Large', 3],
    ['FIN', 'Mid', 5], ['PSU', 'Large', 5], ['PSU', 'Mid', 3], ['SFB', 'Mid', 6], ['MFI', 'Mid', 5],
    ['RRB', 'Mid', 8], ['HFC', 'Mid', 6]
  ].forEach(([lt, size, n]) => {
    for (let i = 0; i < n; i++) {
      PEER_DEFS.push({
        id: 'P' + String(PEER_DEFS.length + 1).padStart(2, '0'), type: lt, size,
        scale: size === 'Large' ? 3 + rng() * 2 : 0.9 + rng() * 0.25, mult: 0.85 + rng() * 0.35
      });
    }
  });
  PEER_DEFS.find((d) => d.type === 'NBFC' && d.size === 'Large').scale = 14; // makes NBFC groups dominated (privacy demo)
  const PMEAS = ['bal', 'd30', 'd90', 'd180', 'cureN', 'cureD'];
  const peers = new Cube([['peer', PEER_DEFS.map((d) => d.id)], ['m', MONTHS], ['p', PIDS], ['s', SIDS]], PMEAS);
  PEER_DEFS.forEach((pd, qi) => {
    const drift = (rng() - 0.5) * 0.01;
    const li = LIDS.indexOf(pd.type);
    MONTHS.forEach((m, t) => {
      PRODUCTS.forEach((prod, pi) => {
        const focus = Math.min(3, lenderW[prod.id][pd.type] * 6);
        SIDS.forEach((s, si) => {
          const lo = (((t * NP_ + pi) * NS_ + si) * NL_ + li) * 6, lb = ltAcc[lo];
          const bal = memberBase[prod.id] * pd.scale * focus * stW[prod.id][s] * Math.pow(1.14, t / 12) * noise(0.03);
          const k = pd.mult * (1 + drift * t) * noise(0.04);
          const o = (((qi * MONTHS.length + t) * NP_ + pi) * NS_ + si) * 6, dd = peers.data;
          dd[o] = bal; dd[o + 1] = bal * (ltAcc[lo + 1] / lb) * k; dd[o + 2] = bal * (ltAcc[lo + 2] / lb) * k; dd[o + 3] = bal * (ltAcc[lo + 3] / lb) * k;
          dd[o + 4] = (ltAcc[lo + 4] / ltAcc[lo + 5]) * 100 * noise(0.03); dd[o + 5] = 100;
        });
      });
    });
  });

  // ---------------- Logins / applications (daily, last 30 days) ----------------
  const DAYS = [];
  for (let i = 29; i >= 0; i--) DAYS.push(new Date(Date.UTC(2026, 8, 26 - i)).toISOString().slice(0, 10));
  const IND_APPS = { PL: 300000, CC: 200000, HL: 40000, LAP: 20000, AL: 60000, TW: 90000, GL: 150000, MSME: 50000, AGRI: 80000, MFL: 120000 };
  const MEM_APPS = { PL: 3200, CC: 1500, HL: 600, LAP: 250, AL: 500, TW: 300, GL: 700, MSME: 450, AGRI: 400, MFL: 300 };
  const appBand = { SP: 0.22, PP: 0.2, PR: 0.24, NP: 0.19, SB: 0.15 };
  const approvalByBand = { SP: 0.86, PP: 0.8, PR: 0.66, NP: 0.42, SB: 0.14 };
  const highEnqByBand = { SP: 0.05, PP: 0.08, PR: 0.13, NP: 0.22, SB: 0.34 };
  // Applications are split by PIN-code risk tier and by the applicant's credit profile as seen in the
  // bureau at the time of the enquiry (all bureau-derived, nothing the lender has to report separately).
  // Each cell carries an expected probability of default (12-month 90+): any slice's PD = pdN / apps.
  const PINS = [
    { id: 'H', name: 'High-risk PIN codes', pd: 1.45 }, { id: 'M', name: 'Medium-risk PIN codes', pd: 1.0 }, { id: 'L', name: 'Low-risk PIN codes', pd: 0.8 }
  ];
  const PROFILES = [
    { id: 'EST', name: 'Established (3+ accounts, ≤2 live loans)', pd: 0.95 }, { id: 'LEV', name: 'Already leveraged (3+ live loans)', pd: 1.2 },
    { id: 'THIN', name: 'Thin file (1–2 accounts)', pd: 1.0 }, { id: 'NTC', name: 'New to credit (no bureau history)', pd: 1.15 },
    { id: 'ETB', name: 'Existing customer (live loan with you)', pd: 0.6 }
  ];
  const PIN_BY_BAND = { SP: [0.08, 0.32, 0.6], PP: [0.1, 0.34, 0.56], PR: [0.14, 0.36, 0.5], NP: [0.2, 0.38, 0.42], SB: [0.28, 0.4, 0.32] };
  const PIN_SURGE = [0.5, 0.33, 0.17];
  const PROF_TILT = [[1, 1, 1, 1, 1.6], [1, 1, 1, 1, 1.3], [1, 1, 1, 1, 1], [1, 1.2, 1, 1.1, 0.6], [1, 1.4, 1, 1.2, 0.3]]; // by band
  const PROF_IND = [0.25, 0.3, 0.22, 0.13, 0.1], PROF_MEM = [0.3, 0.25, 0.2, 0.08, 0.17], PROF_SURGE = [0.08, 0.62, 0.08, 0.18, 0.04];
  const PD_BY_BAND = [0.004, 0.01, 0.025, 0.06, 0.14];
  const splitProf = (base, bi) => { const w = base.map((x, j) => x * PROF_TILT[bi][j]); const t = w.reduce((a, b) => a + b, 0); return w.map((x) => x / t); };
  const logins = new Cube([['who', ['ind', 'mem']], ['d', DAYS], ['p', PIDS], ['s', SIDS], ['b', BIDS], ['pin', PINS.map((x) => x.id)], ['prof', PROFILES.map((x) => x.id)]], ['apps', 'appr', 'hiEnq', 'pdN', 'sameDay', 'amt']);
  const LD = logins.data, LS = logins.stride, NPIN = PINS.length, NSRC = PROFILES.length;
  const putSplit = (wi, di, pi, si, bi, tot, apprRate, enqRate, pinW, poolW, pdBase, surge, tkReq) => {
    const base = wi * LS[0] + di * LS[1] + pi * LS[2] + si * LS[3] + bi * LS[4];
    for (let a = 0; a < NPIN; a++) for (let c = 0; c < NSRC; c++) {
      const apps = tot * pinW[a] * poolW[c];
      const risky = (a === 0 ? 1.25 : 1) * (c === 1 || c === 3 ? 1.3 : 1);
      const o = (base + a * LS[5] + c * LS[6]) * 6;
      LD[o] += apps; LD[o + 1] += apps * apprRate; LD[o + 2] += apps * Math.min(0.9, enqRate * risky);
      LD[o + 3] += apps * Math.min(0.6, pdBase * PINS[a].pd * PROFILES[c].pd * (surge ? 1.25 : 1));
      // applicants who made more than one enquiry on the same day (rate-shopping or loan stacking);
      // deterministic share of the high-enquiry rate, higher in surges and for leveraged / new-to-credit applicants
      LD[o + 4] += apps * Math.min(0.5, enqRate * risky * (surge ? 0.62 : 0.4) + 0.012);
      // loan amount requested in the enquiry (₹ lakh); leveraged and surge applicants ask for more
      LD[o + 5] += apps * tkReq * (c === 1 ? 1.12 : c === 3 ? 0.8 : c === 4 ? 1.08 : 1) * (surge ? 1.3 : 1);
    }
  };
  DAYS.forEach((d, i) => {
    const dow = new Date(d + 'T00:00:00Z').getUTCDay();
    const season = dow === 0 ? 0.55 : dow === 6 ? 0.8 : 1;
    const recent = i >= 25; // last 5 days
    PRODUCTS.forEach((prod, pi) => {
      SIDS.forEach((s, si) => {
        BANDS.forEach((bd, bi) => {
          const weak = bd.id === 'NP' || bd.id === 'SB';
          const indApps = IND_APPS[prod.id] * stW[prod.id][s] * appBand[bd.id] * season * (recent ? 1.04 : 1) * (1 + 0.002 * i) * noise(0.06);
          const surge = prod.id === 'PL' && recent && (s === 'UP' || s === 'GJ') && weak;
          const memApps = MEM_APPS[prod.id] * memW[prod.id][s] * appBand[bd.id] * (prod.id === 'PL' && weak ? 1.15 : 1) * season * (surge ? 1.95 : 1) * noise(0.08);
          const indAppr = approvalByBand[bd.id] * (weak ? 0.97 : 1) * noise(0.03);
          const memAppr = Math.min(0.95, approvalByBand[bd.id] * (prod.id === 'PL' && weak ? 1.22 : 1) * noise(0.04));
          const pdBase = Math.min(0.4, PD_BY_BAND[bi] * prod.risk * S[s].risk);
          // riskier states have more applications from high-risk PIN codes
          const r = S[s].risk, pw = PIN_BY_BAND[bd.id], pwt = [pw[0] * r * r, pw[1], pw[2] / r], pws = pwt[0] + pwt[1] + pwt[2];
          const pinW = pwt.map((x) => x / pws);
          const tkI = ticketL(prod, bi, s, 'ALL', 0) * 1.08, tkM = ticketL(prod, bi, s, 'PVT', 0) * (prod.id === 'PL' && weak ? 1.18 : 1);
          putSplit(0, i, pi, si, bi, indApps, indAppr, highEnqByBand[bd.id] * noise(0.05), pinW, splitProf(PROF_IND, bi), pdBase, false, tkI);
          if (surge) {
            // the surge: normal flow plus an extra wave of already-leveraged and new-to-credit applicants from high-risk PIN codes
            const normal = memApps / 1.95;
            putSplit(1, i, pi, si, bi, normal, memAppr, highEnqByBand[bd.id], pinW, splitProf(PROF_MEM, bi), pdBase, false, tkM);
            putSplit(1, i, pi, si, bi, memApps - normal, memAppr, highEnqByBand[bd.id] * 2.4, PIN_SURGE, PROF_SURGE, pdBase, true, tkM);
          } else {
            putSplit(1, i, pi, si, bi, memApps, memAppr, highEnqByBand[bd.id] * noise(0.06), pinW, splitProf(PROF_MEM, bi), pdBase, false, tkM);
            // milder book-wide wave: in the last 7 days more already-leveraged weak-band PL applicants log in everywhere
            if (prod.id === 'PL' && weak && i >= 23) putSplit(1, i, pi, si, bi, memApps * 0.28, memAppr, highEnqByBand[bd.id] * 2, PIN_SURGE, PROF_SURGE, pdBase, true, tkM);
          }
        });
      });
    });
  });

  // ---------------- Score distribution for simulator (member apps, last 90 days) ----------------
  const SCORE_BINS = [];
  for (let s = 600; s < 900; s += 20) SCORE_BINS.push(s);
  const stateBadMult = { MH: 1.0, TN: 1.03, KA: 0.95, UP: 1.28, GJ: 0.93, TG: 1.12, BR: 1.1, NE: 1.1 };
  const memberBadMult = { UP: 1.1, GJ: 1.35, TG: 1.02 }; // idiosyncratic
  const BAD_AT_700 = { PL: 0.0526, CC: 0.075, HL: 0.015, LAP: 0.03, AL: 0.03, TW: 0.08, GL: 0.02, MSME: 0.05, AGRI: 0.06, MFL: 0.06 };
  const MEAN_SCORE = { PL: 728, CC: 742, HL: 760, LAP: 740, AL: 745, TW: 715, GL: 715, MSME: 725, AGRI: 700, MFL: 690 };
  function badRate(score, p) {
    // odds of 90+ DPD in 12m double every 30 points below 700
    const odds = (BAD_AT_700[p] / (1 - BAD_AT_700[p])) * Math.pow(2, (700 - score) / 30);
    return odds / (1 + odds);
  }
  const scores = [];
  PRODUCTS.forEach((prod) => {
    const vol90 = MEM_APPS[prod.id] * 78;
    const mean = MEAN_SCORE[prod.id], sd = 58;
    SIDS.forEach((s) => {
      const bins = [{ lo: 300, hi: 600 }].concat(SCORE_BINS.map((x) => ({ lo: x, hi: x + 20 })));
      const pdf = (x) => Math.exp(-0.5 * Math.pow((x - mean) / sd, 2));
      const weights = bins.map((b) => (b.lo === 300 ? 0.035 * 20 : pdf(b.lo + 10)) * noise(0.04));
      const wsum = weights.reduce((a, b) => a + b, 0);
      bins.forEach((b, i) => {
        const mid = b.lo === 300 ? 580 : b.lo + 10;
        const bi = badRate(mid, prod.id) * (stateBadMult[s] || 1);
        const memAdj = prod.id === 'PL' && mid < 720 ? memberBadMult[s] || 1 : 1;
        scores.push({ p: prod.id, s, lo: b.lo, hi: b.hi, apps: (vol90 * memW[prod.id][s] * weights[i]) / wsum, badInd: Math.min(0.6, bi), badMem: Math.min(0.6, bi * memAdj) });
      });
    });
  });

  PIQ.data = {
    MONTHS, DAYS, PRODUCTS, STATES, BANDS, LENDERS, PEER_DEFS, SCORE_BINS, PINS, PROFILES,
    P, S, B, L, monthLabel,
    cube: { industry, member, peers, logins },
    scores
  };
})(typeof window !== 'undefined' ? window : globalThis);
