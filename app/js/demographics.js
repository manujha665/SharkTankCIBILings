/*
 * Borrower demographics (aggregated): gender, age band and income band.
 * For the AI analyst only (no dashboard). In production these come from fields already on bureau
 * records: gender and date of birth on every tradeline, income as declared on the application/enquiry
 * (self-declared, not verified). Here they are synthetic: each segment gets a share of the balance and
 * a relative risk, and every split is normalised so the segments add back exactly to the total the
 * dashboards show (same product, state, month and source).
 */
(function () {
  const PIQ = window.PIQ;
  const D = PIQ.data, S = PIQ.sem;

  const DIMS = {
    gender: { name: 'gender', segs: [{ id: 'F', name: 'Women' }, { id: 'M', name: 'Men' }] },
    age: { name: 'age band', segs: ['18–25', '26–35', '36–45', '46–60', '60+'].map((x) => ({ id: x, name: x + ' yrs' })) },
    income: { name: 'income band (annual, as declared)', segs: ['Under ₹3 L', '₹3–6 L', '₹6–12 L', '₹12–25 L', '₹25 L+'].map((x) => ({ id: x, name: x })) }
  };

  // balance share of each segment, by product (industry); default row for the rest
  const SHARE = {
    gender: { PL: [0.22], CC: [0.26], HL: [0.32], LAP: [0.18], AL: [0.14], TW: [0.2], GL: [0.38], MSME: [0.14], AGRI: [0.16], MFL: [0.97], _: [0.22] },
    age: { PL: [0.14, 0.38, 0.27, 0.17, 0.04], CC: [0.12, 0.4, 0.26, 0.18, 0.04], HL: [0.02, 0.28, 0.38, 0.27, 0.05], GL: [0.06, 0.24, 0.28, 0.3, 0.12], MFL: [0.12, 0.34, 0.3, 0.2, 0.04], AGRI: [0.05, 0.22, 0.3, 0.32, 0.11], _: [0.08, 0.32, 0.3, 0.24, 0.06] },
    income: { PL: [0.18, 0.3, 0.28, 0.16, 0.08], CC: [0.05, 0.2, 0.33, 0.26, 0.16], HL: [0.03, 0.15, 0.32, 0.3, 0.2], LAP: [0.04, 0.16, 0.3, 0.3, 0.2], GL: [0.4, 0.3, 0.18, 0.08, 0.04], AGRI: [0.55, 0.28, 0.12, 0.04, 0.01], TW: [0.35, 0.35, 0.2, 0.08, 0.02], MFL: [0.78, 0.18, 0.04, 0, 0], _: [0.15, 0.28, 0.3, 0.18, 0.09] }
  };
  // relative delinquency risk of each segment (normalised away later, so only the ratios matter)
  const RISK = {
    gender: { MFL: [1, 1], _: [0.84, 1] },
    age: { HL: [1.3, 1.1, 0.95, 0.85, 1], _: [1.45, 1.15, 0.92, 0.82, 0.95] },
    income: { _: [1.5, 1.2, 0.95, 0.75, 0.6] }
  };
  // relative ticket size (income drives it; gender and age only mildly)
  const TICKET = { gender: [0.9, 1.03], age: [0.6, 0.95, 1.12, 1.08, 0.85], income: [0.45, 0.7, 1, 1.6, 2.6] };

  const pick = (tbl, p) => tbl[p] || tbl._;
  // small, stable state-to-state variation so every state isn't identical
  const tilt = (s, k) => { if (!s || s === 'ALL') return 1; let h = 7; for (const c of s + k) h = (h * 31 + c.charCodeAt(0)) % 997; return 1 + ((h % 21) - 10) / 100; };

  function shares(dim, p, s, source) {
    let w = pick(SHARE[dim], p).slice();
    if (dim === 'gender') w = [w[0] * tilt(s, 'g'), 1 - w[0] * tilt(s, 'g')];
    else w = w.map((x, i) => x * tilt(s, dim + i));
    // Sahyadri's personal loans and cards since the 2026 loosening: more young and lower-income borrowers
    if (source === 'member' && (p === 'PL' || p === 'CC') && dim !== 'gender') w = w.map((x, i) => x * (i < 2 ? 1.15 : 0.93));
    const t = w.reduce((a, x) => a + x, 0);
    return w.map((x) => x / t);
  }

  // split one metric by a dimension: rates (dpd30/90/180), ticket size (ats) or balance share (bal)
  function split(source, f, dim, metric) {
    const m = (f && f.m) || S.latest(), s = (f && f.s) || 'ALL', segs = DIMS[dim].segs;
    const prods = !f || !f.p || f.p === 'ALL' ? D.PRODUCTS.map((x) => x.id) : [f.p];
    const num = segs.map(() => 0), den = segs.map(() => 0);
    prods.forEach((p) => {
      const ff = { p, s, m };
      const bal = S.value(source, 'bal', ff);
      if (!bal) return;
      const w = shares(dim, p, s, source);
      if (metric === 'ats') {
        const acc = S.value(source, 'acc', ff), tot = S.value(source, 'ats', ff), t = TICKET[dim], norm = w.reduce((a, x, i) => a + x * t[i], 0);
        w.forEach((x, i) => { num[i] += acc * x * (tot * t[i] / norm); den[i] += acc * x; });
        return;
      }
      if (metric === 'bal') { w.forEach((x, i) => { den[i] += bal * x; }); return; }
      const tot = S.value(source, metric, ff), k = metric === 'dpd30' ? 1 : 1.15;
      const r = pick(RISK[dim], p).map((x) => Math.pow(x, k)), norm = w.reduce((a, x, i) => a + x * r[i], 0);
      w.forEach((x, i) => { num[i] += bal * x * (tot * r[i] / norm); den[i] += bal * x; });
    });
    const dsum = den.reduce((a, x) => a + x, 0);
    return segs.map((g, i) => ({ id: g.id, name: g.name, share: dsum ? den[i] / dsum : 0, value: metric === 'bal' ? (dsum ? den[i] / dsum : 0) : den[i] ? num[i] / den[i] : null }));
  }

  PIQ.demo = { DIMS, split };
})();
