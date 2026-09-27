/*
 * Synthetic data engine. Everything here is fabricated for demonstration and is
 * deterministic (seeded), so the demo tells the same story every time.
 *
 * Grain
 *  industry : month x product x state x riskBand x lenderType
 *  member   : month x product x state x riskBand
 *  peers    : peer x month x product x state            (never shown individually)
 *  logins   : day x product x state x riskBand  (industry + member)
 *  scores   : product x state x 20-pt score bin (member applications, last 90 days)
 *
 * Amounts are stored as sums (balance, 30+ DPD balance, ...) so any slice aggregates
 * correctly: rate = sum(numerator) / sum(denominator).
 *
 * Embedded story (member = Sahyadri Bank):
 *  - PL cut-off loosened 700 -> 680 in Feb 2026; origination mix shifts to near-prime /
 *    subprime, mostly in Uttar Pradesh and Gujarat.
 *  - Uttar Pradesh: the market itself is deteriorating (market effect) AND the member added risk.
 *  - Gujarat: the market is benign; the member's deterioration is idiosyncratic (DSA sourcing).
 *  - Last 5 days of logins: near-prime / subprime applications in UP & GJ spike, with
 *    high enquiry intensity - an early-warning signal before it shows up in DPD.
 *  - Credit cards: member is in line with / slightly better than peers.
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

  const MONTHS = [];
  for (let i = 0; i < 24; i++) {
    const d = new Date(Date.UTC(2024, 8 + i, 1));
    MONTHS.push(d.toISOString().slice(0, 7));
  }
  const monthLabel = (m) => {
    const [y, mo] = m.split('-');
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+mo - 1] + ' ' + y.slice(2);
  };

  const PRODUCTS = [
    { id: 'PL', name: 'Personal Loan', long: 'Unsecured Personal Loan', base: 900000, growth: 0.13, ticket: 2.4, orig: 0.075 },
    { id: 'CC', name: 'Credit Card', long: 'Credit Card', base: 190000, growth: 0.15, ticket: 0.45, orig: 0.11 }
  ];
  // Top retail-credit states (illustrative weights, not official figures)
  const STATES = [
    { id: 'MH', name: 'Maharashtra', w: 0.27, risk: 0.97, trend: 0.8 },
    { id: 'TN', name: 'Tamil Nadu', w: 0.18, risk: 1.02, trend: 0.9 },
    { id: 'KA', name: 'Karnataka', w: 0.17, risk: 0.93, trend: 0.8 },
    { id: 'UP', name: 'Uttar Pradesh', w: 0.14, risk: 1.2, trend: 1.9 },
    { id: 'GJ', name: 'Gujarat', w: 0.12, risk: 0.9, trend: 0.5 },
    { id: 'TG', name: 'Telangana', w: 0.12, risk: 1.08, trend: 1.3 }
  ];
  const BANDS = [
    { id: 'SP', name: 'Super-prime', range: '791+', lo: 791, sens: 0.2, cure: 0.62 },
    { id: 'PP', name: 'Prime-plus', range: '761–790', lo: 761, sens: 0.4, cure: 0.55 },
    { id: 'PR', name: 'Prime', range: '721–760', lo: 721, sens: 0.7, cure: 0.48 },
    { id: 'NP', name: 'Near-prime', range: '681–720', lo: 681, sens: 1.0, cure: 0.4 },
    { id: 'SB', name: 'Subprime', range: '≤680', lo: 300, sens: 1.35, cure: 0.31 }
  ];
  const LENDERS = [
    { id: 'PSU', name: 'PSU Banks', risk: 1.05, trend: 0.7 },
    { id: 'PVT', name: 'Private Banks', risk: 0.86, trend: 0.9 },
    { id: 'NBFC', name: 'NBFCs', risk: 1.14, trend: 1.1 },
    { id: 'FIN', name: 'Fintech Lenders', risk: 1.38, trend: 1.6 }
  ];
  const bandShare = {
    PL: { SP: 0.3, PP: 0.22, PR: 0.22, NP: 0.15, SB: 0.11 },
    CC: { SP: 0.34, PP: 0.22, PR: 0.2, NP: 0.14, SB: 0.1 }
  };
  const lenderShare = {
    PL: { PSU: 0.22, PVT: 0.4, NBFC: 0.26, FIN: 0.12 },
    CC: { PSU: 0.12, PVT: 0.72, NBFC: 0.08, FIN: 0.08 }
  };
  const baseDpd = {
    PL: { SP: 0.006, PP: 0.013, PR: 0.026, NP: 0.052, SB: 0.095 },
    CC: { SP: 0.009, PP: 0.02, PR: 0.038, NP: 0.075, SB: 0.13 }
  };

  // Industry deterioration curve: PL turns from Nov 2025 (t=14); CC drifts up throughout.
  function trendFactor(p, t, band, state, lender) {
    let x;
    if (p === 'PL') x = t < 14 ? 0.004 * (t - 14) * 0.2 : 0.014 * (t - 14);
    else x = 0.0065 * t;
    return 1 + x * band.sens * state.trend * lender.trend;
  }

  const byId = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));
  const P = byId(PRODUCTS), S = byId(STATES), B = byId(BANDS), L = byId(LENDERS);

  // ---------------- Industry ----------------
  const industry = [];
  MONTHS.forEach((m, t) => {
    PRODUCTS.forEach((prod) => {
      const total = prod.base * Math.pow(1 + prod.growth * (1 - t / 60), t / 12);
      STATES.forEach((st) => {
        BANDS.forEach((bd) => {
          LENDERS.forEach((ld) => {
            // fintechs push near-prime/subprime share up slowly
            const tilt = ld.id === 'FIN' && (bd.id === 'NP' || bd.id === 'SB') ? 1 + 0.01 * t : 1;
            const bal = total * st.w * bandShare[prod.id][bd.id] * lenderShare[prod.id][ld.id] * tilt * noise(0.02);
            const tf = trendFactor(prod.id, t, bd, st, ld);
            const d30 = Math.min(0.4, baseDpd[prod.id][bd.id] * st.risk * ld.risk * tf * noise(0.035));
            const acc = (bal * 1e7) / (prod.ticket * 1e5);
            const cureDen = acc * d30 * 0.62;
            const cure = Math.max(0.12, bd.cure / Math.pow(tf, 1.1)) * noise(0.03);
            industry.push({
              m, p: prod.id, s: st.id, b: bd.id, l: ld.id,
              bal, acc,
              orig: bal * prod.orig * noise(0.05),
              d30: bal * d30,
              d90: bal * d30 * 0.46 * noise(0.04),
              cureN: cureDen * cure,
              cureD: cureDen
            });
          });
        });
      });
    });
  });

  // ---------------- Member (Sahyadri Bank) ----------------
  const memberBand = {
    PL: { SP: 0.36, PP: 0.26, PR: 0.22, NP: 0.1, SB: 0.06 },
    CC: { SP: 0.38, PP: 0.24, PR: 0.2, NP: 0.11, SB: 0.07 }
  };
  const memberState = { MH: 0.34, TN: 0.12, KA: 0.14, UP: 0.14, GJ: 0.16, TG: 0.1 };
  const memberBase = { PL: 9200, CC: 1850 };
  const POLICY_T = MONTHS.indexOf('2026-02');
  const member = [];
  // industry private-bank rate lookup for member baseline
  const indIdx = {};
  industry.forEach((r) => { indIdx[[r.m, r.p, r.s, r.b, r.l].join('|')] = r; });

  MONTHS.forEach((m, t) => {
    PRODUCTS.forEach((prod) => {
      const total = memberBase[prod.id] * Math.pow(1 + 0.16, t / 12);
      const since = Math.max(0, t - POLICY_T + 1); // months since loosening
      STATES.forEach((st) => {
        // mix shift after loosening (PL only), concentrated in UP / GJ
        const hot = st.id === 'UP' || st.id === 'GJ';
        const shares = Object.assign({}, memberBand[prod.id]);
        if (prod.id === 'PL' && since > 0) {
          const k = Math.min(since, 7) / 7;
          const npUp = (hot ? 0.075 : 0.022) * k, sbUp = (hot ? 0.06 : 0.016) * k;
          shares.NP += npUp; shares.SB += sbUp;
          shares.SP -= (npUp + sbUp) * 0.55; shares.PP -= (npUp + sbUp) * 0.3; shares.PR -= (npUp + sbUp) * 0.15;
        }
        BANDS.forEach((bd) => {
          const ir = indIdx[[m, prod.id, st.id, bd.id, 'PVT'].join('|')];
          const indRate = ir.d30 / ir.bal;
          let mult = prod.id === 'CC' ? 0.93 : 1.04;
          // idiosyncratic deterioration: loosened-policy vintages seasoning in UP/GJ near-prime & subprime
          if (prod.id === 'PL' && since > 2 && (bd.id === 'NP' || bd.id === 'SB')) {
            const k = Math.min(since - 2, 5) / 5;
            mult *= 1 + k * (st.id === 'GJ' ? 0.42 : st.id === 'UP' ? 0.26 : 0.06);
          }
          const bal = total * memberState[st.id] * shares[bd.id] * noise(0.02);
          const d30 = Math.min(0.4, indRate * mult * noise(0.03));
          const acc = (bal * 1e7) / (prod.ticket * 1e5);
          const cureDen = acc * d30 * 0.62;
          const cure = (ir.cureN / ir.cureD) * (mult > 1.1 ? 0.88 : 1.03) * noise(0.03);
          member.push({
            m, p: prod.id, s: st.id, b: bd.id,
            bal, acc,
            orig: bal * prod.orig * (prod.id === 'PL' && since > 0 && (bd.id === 'NP' || bd.id === 'SB') ? 1.35 : 1) * noise(0.05),
            d30: bal * d30, d90: bal * d30 * 0.45 * noise(0.04),
            cureN: cureDen * cure, cureD: cureDen
          });
        });
      });
    });
  });

  // ---------------- Peers (anonymised; only aggregates ever leave the engine) ----------------
  const PEER_DEFS = [];
  const types = [
    ['PVT', 'Mid', 7], ['PVT', 'Large', 4], ['NBFC', 'Mid', 6], ['NBFC', 'Large', 3],
    ['FIN', 'Mid', 5], ['PSU', 'Large', 5], ['PSU', 'Mid', 3]
  ];
  let pc = 0;
  types.forEach(([lt, size, n]) => {
    for (let i = 0; i < n; i++) {
      pc++;
      const scale = size === 'Large' ? 3 + rng() * 5 : 0.6 + rng() * 1.1;
      PEER_DEFS.push({
        id: 'P' + String(pc).padStart(2, '0'), type: lt, size,
        scale, mult: 0.85 + rng() * 0.35,
        // one mid-size private bank dominates by design (tests the max-share rule in custom groups)
        dominant: false
      });
    }
  });
  PEER_DEFS.find((d) => d.type === 'NBFC' && d.size === 'Large').scale = 14; // makes 'Large NBFC' groups dominated
  const peers = [];
  // industry lender-type rate by m|p|s (aggregate over bands) for peer baselines
  const ltAgg = {};
  industry.forEach((r) => {
    const k = [r.m, r.p, r.s, r.l].join('|');
    const a = (ltAgg[k] = ltAgg[k] || { bal: 0, d30: 0, d90: 0, cureN: 0, cureD: 0 });
    a.bal += r.bal; a.d30 += r.d30; a.d90 += r.d90; a.cureN += r.cureN; a.cureD += r.cureD;
  });
  PEER_DEFS.forEach((pd) => {
    const drift = (rng() - 0.5) * 0.01;
    MONTHS.forEach((m, t) => {
      PRODUCTS.forEach((prod) => {
        if (prod.id === 'CC' && pd.type === 'NBFC' && rng() < 0.0) return;
        STATES.forEach((st) => {
          const a = ltAgg[[m, prod.id, st.id, pd.type].join('|')];
          const bal = memberBase[prod.id] * pd.scale * st.w * Math.pow(1.14, t / 12) * noise(0.03);
          const rate = (a.d30 / a.bal) * pd.mult * (1 + drift * t) * noise(0.04);
          peers.push({
            peer: pd.id, m, p: prod.id, s: st.id, bal,
            d30: bal * rate, d90: bal * rate * 0.46,
            cureN: (a.cureN / a.cureD) * 100 * noise(0.03), cureD: 100
          });
        });
      });
    });
  });

  // ---------------- Logins / applications (daily, last 30 days) ----------------
  const DAYS = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.UTC(2026, 8, 26 - i));
    DAYS.push(d.toISOString().slice(0, 10));
  }
  const appBand = { SP: 0.22, PP: 0.2, PR: 0.24, NP: 0.19, SB: 0.15 };
  const approvalByBand = { SP: 0.86, PP: 0.8, PR: 0.66, NP: 0.42, SB: 0.14 };
  const highEnqByBand = { SP: 0.05, PP: 0.08, PR: 0.13, NP: 0.22, SB: 0.34 };
  const logins = [];
  DAYS.forEach((d, i) => {
    const dow = new Date(d + 'T00:00:00Z').getUTCDay();
    const season = dow === 0 ? 0.55 : dow === 6 ? 0.8 : 1;
    const recent = i >= 25; // last 5 days
    PRODUCTS.forEach((prod) => {
      const indBase = prod.id === 'PL' ? 185000 : 120000;
      const memBase = prod.id === 'PL' ? 2600 : 1400;
      STATES.forEach((st) => {
        BANDS.forEach((bd) => {
          const indApps = indBase * st.w * appBand[bd.id] * season * (recent ? 1.04 : 1) * (1 + 0.002 * i) * noise(0.06);
          const surge = prod.id === 'PL' && recent && (st.id === 'UP' || st.id === 'GJ') && (bd.id === 'NP' || bd.id === 'SB');
          const memShift = prod.id === 'PL' && (bd.id === 'NP' || bd.id === 'SB') ? 1.15 : 1;
          const memApps = memBase * memberState[st.id] * appBand[bd.id] * memShift * season * (surge ? 1.95 : 1) * noise(0.08);
          const indAppr = approvalByBand[bd.id] * (bd.id === 'NP' || bd.id === 'SB' ? 0.97 : 1) * noise(0.03);
          const memAppr = approvalByBand[bd.id] * (prod.id === 'PL' && (bd.id === 'NP' || bd.id === 'SB') ? 1.22 : 1) * noise(0.04);
          logins.push({ who: 'ind', d, p: prod.id, s: st.id, b: bd.id, apps: indApps, appr: indApps * indAppr, hiEnq: indApps * highEnqByBand[bd.id] * noise(0.05) });
          logins.push({ who: 'mem', d, p: prod.id, s: st.id, b: bd.id, apps: memApps, appr: memApps * Math.min(0.95, memAppr), hiEnq: memApps * highEnqByBand[bd.id] * (surge ? 1.75 : 1) * noise(0.06) });
        });
      });
    });
  });

  // ---------------- Score distribution for simulator (member apps, last 90 days) ----------------
  const SCORE_BINS = [];
  for (let s = 600; s < 900; s += 20) SCORE_BINS.push(s);
  const stateBadMult = { MH: 1.0, TN: 1.03, KA: 0.95, UP: 1.28, GJ: 0.93, TG: 1.12 };
  const memberBadMult = { MH: 1.0, TN: 1.0, KA: 1.0, UP: 1.1, GJ: 1.35, TG: 1.02 }; // idiosyncratic
  function badRate(score, p) {
    // odds of 90+ DPD in 12m double every 30 points below 700 (PL: 5% at 700)
    const base = p === 'PL' ? 0.0526 : 0.075;
    const odds = base * Math.pow(2, (700 - score) / 30);
    return odds / (1 + odds);
  }
  const scores = [];
  PRODUCTS.forEach((prod) => {
    const vol90 = (prod.id === 'PL' ? 2600 : 1400) * 78;
    const mean = prod.id === 'PL' ? 728 : 742, sd = 58;
    STATES.forEach((st) => {
      const bins = [{ lo: 300, hi: 600 }].concat(SCORE_BINS.map((s) => ({ lo: s, hi: s + 20 })));
      const pdf = (x) => Math.exp(-0.5 * Math.pow((x - mean) / sd, 2));
      const weights = bins.map((b) => (b.lo === 300 ? 0.035 * 20 : pdf(b.lo + 10)) * noise(0.04));
      const wsum = weights.reduce((a, b) => a + b, 0);
      bins.forEach((b, i) => {
        const mid = b.lo === 300 ? 580 : b.lo + 10;
        scores.push({
          p: prod.id, s: st.id, lo: b.lo, hi: b.hi,
          apps: (vol90 * memberState[st.id] * weights[i]) / wsum,
          badInd: Math.min(0.6, badRate(mid, prod.id) * stateBadMult[st.id]),
          badMem: Math.min(0.6, badRate(mid, prod.id) * stateBadMult[st.id] * (mid < 720 ? memberBadMult[st.id] : 1))
        });
      });
    });
  });

  PIQ.data = {
    MONTHS, DAYS, PRODUCTS, STATES, BANDS, LENDERS, PEER_DEFS, SCORE_BINS,
    P, S, B, L, monthLabel,
    industry, member, peers, logins, scores
  };
})(typeof window !== 'undefined' ? window : globalThis);
