/*
 * Cross-segment overlap intelligence — synthetic.
 *
 * Only a bureau sees a borrower across consumer, microfinance and commercial files. Two overlaps:
 *  1. Retail × Microfinance: MFI borrowers who also have retail credit (enquiries, live or closed
 *     trade lines). Base figures come from config.overlap (team working estimate: 8 Cr live MFI
 *     borrowers, 50% any retail footprint, 25% live-to-live).
 *  2. Commercial × Retail: MSME entities whose directors / partners / proprietors / guarantors hold
 *     retail loans in their personal capacity.
 * Series are anchored to the industry cubes so the overlap moves with the market cycle.
 */
(function (root) {
  const PIQ = (root.PIQ = root.PIQ || {});
  const D = PIQ.data, S = PIQ.sem, C = PIQ.config;
  const O = C.overlap;
  const t = S.latest();

  function retailMfi() {
    const base = O.mfiLiveBorrowersCr, anyPct = O.mfiAnyRetailPct, livePct = O.mfiLiveLivePct;
    const closedOnly = (anyPct - livePct) * 0.52, enqOnly = anyPct - livePct - closedOnly;
    const funnel = [
      { label: 'Live MFI borrowers', pct: 1 },
      { label: 'Any retail footprint', pct: anyPct },
      { label: 'Live MFI + live retail', pct: livePct },
      { label: '…with 3+ MFI lenders', pct: livePct * 0.32 }
    ].map((x) => Object.assign(x, { cr: base * x.pct }));
    const footprint = [
      { label: 'Live retail loan', pct: livePct }, { label: 'Closed retail loans only', pct: closedOnly },
      { label: 'Retail enquiries only', pct: enqOnly }, { label: 'No retail footprint', pct: 1 - anyPct }
    ];
    // retail products held by live-to-live overlap borrowers (a borrower can hold several)
    const holds = { GL: 0.42, PL: 0.24, AGRI: 0.22, TW: 0.18, CC: 0.06, MSME: 0.05, HL: 0.03, AL: 0.02 };
    const products = Object.entries(holds).map(([p, v]) => ({ p, name: D.P[p].name, share: v }));
    // overlap rate by state, normalised so the MFI-weighted average equals livePct
    const fac = { TN: 1.3, KA: 1.22, KL: 1.2, BR: 1.18, AP: 1.15, OD: 1.12, TG: 1.1, WB: 1.08, MH: 0.95, UP: 0.92, GJ: 0.9, MP: 0.88, RJ: 0.85 };
    const w = D.STATES.map((s) => ({ s, w: S.value('industry', 'bal', { p: 'MFL', s: s.id, m: t }), f: fac[s.id] || 0.8 }));
    const wavg = w.reduce((a, x) => a + x.w * x.f, 0) / w.reduce((a, x) => a + x.w, 0);
    const states = w.map((x) => ({ s: x.s.id, name: x.s.name, rate: (livePct * x.f) / wavg, base: base * x.w / w.reduce((a, y) => a + y.w, 0) }))
      .sort((a, b) => b.rate - a.rate);
    const lenders = { labels: ['1 MFI lender', '2 lenders', '3 lenders', '4+ lenders'], overlap: [0.38, 0.3, 0.18, 0.14], mfiOnly: [0.55, 0.27, 0.11, 0.07] };
    // delinquency: overlap borrowers vs the rest, on both sides
    const mfl = S.series('industry', 'dpd30', { p: 'MFL' });
    const retailMix = ['GL', 'PL', 'AGRI', 'TW'];
    const retailSeries = D.MONTHS.map((m) => {
      const a = S.agg('industry', { p: retailMix, m });
      return a.d30 / a.bal;
    });
    const m0 = mfl[0].y;
    // retail stress of overlap borrowers follows their MFI stress with a ~3-month lag
    const lead = D.MONTHS.map((m, i) => {
      const lag = mfl[Math.max(0, i - 3)].y;
      return { x: m, mfi: mfl[i].y * 1.35, retail: retailSeries[i] * 1.6 * (1 + 0.6 * Math.max(0, lag / m0 - 1)) };
    });
    const now = lead[lead.length - 1];
    const del = {
      mfiOverlap: now.mfi, mfiOnly: mfl[mfl.length - 1].y * 0.85,
      retailOverlap: now.retail, retailOthers: retailSeries[retailSeries.length - 1] * 0.97
    };
    const trend = D.MONTHS.map((m, i) => ({ x: m, y: livePct - 0.04 + (0.04 * i) / (D.MONTHS.length - 1) }));
    // Member lens: Sahyadri retail borrowers who also have a live MFI loan
    const memShare = { GL: 0.09, AGRI: 0.11, TW: 0.08, PL: 0.06, MSME: 0.03, CC: 0.02, AL: 0.015, LAP: 0.01, HL: 0.008 };
    const member = Object.entries(memShare).map(([p, sh]) => {
      const a = S.agg('member', { p, m: t });
      const r = a.d30 / a.bal, ro = Math.min(0.5, r * 2.3), rn = (r - sh * ro) / (1 - sh);
      return { p, name: D.P[p].name, share: sh, borrowers: a.acc * sh, exposure: a.bal * sh * 0.8, dpdOverlap: ro, dpdOthers: rn };
    }).sort((a, b) => b.exposure - a.exposure);
    return { base, funnel, footprint, products, states, lenders, del, lead, trend, member };
  }

  function msmeRetail() {
    const base = O.msmeLiveEntitiesCr, linked = O.msmeLinkedPct, promo = O.msmePromoterRetailPct;
    const funnel = [
      { label: 'Live MSME borrowers', pct: 1 },
      { label: 'Linked to promoters', pct: linked },
      { label: 'Promoter has retail loan', pct: linked * promo },
      { label: '…promoter 30+ in 6 months', pct: linked * promo * 0.09 }
    ].map((x) => Object.assign(x, { cr: base * x.pct }));
    const products = [['CC', 0.46], ['PL', 0.38], ['HL', 0.24], ['LAP', 0.21], ['AL', 0.19], ['GL', 0.09], ['TW', 0.07]].map(([p, v]) => ({ p, name: D.P[p].name, share: v }));
    const byStatus = [['Current', 0.021], ['1–30 DPD', 0.054], ['31–90 DPD', 0.112], ['90+ / NPA', 0.186]].map(([label, v]) => ({ label, rate: v }));
    // cohort of entities that turned 90+ at month 0: promoter retail stress rises months earlier
    const cohort = [];
    for (let k = -12; k <= 0; k++) {
      const promoter = 0.03 + 0.19 / (1 + Math.exp(-(k + 5) / 1.6));
      const entity = k < -3 ? 0 : [0.35, 0.7, 0.9, 1][k + 3];
      cohort.push({ x: k, promoter, entity });
    }
    const stats = { precededPct: 0.41, medianLeadMonths: 4, multiple: 0.186 / 0.021 };
    // Member lens: Sahyadri MSME borrowers whose promoters slipped on retail credit in the last 90 days
    const fac = { TN: 3.6, UP: 1.7, GJ: 1.45, MH: 1.0, KA: 1.1, RJ: 1.2, TG: 1.15, DL: 0.9, MP: 1.2 };
    const tot = S.value('member', 'bal', { p: 'MSME', m: t });
    const member = D.STATES.map((s) => {
      const a = S.agg('member', { p: 'MSME', s: s.id, m: t });
      const pct = 0.031 * (fac[s.id] || 1);
      return { s: s.id, name: s.name, entities: a.acc, pct, flagged: a.acc * pct, exposure: a.bal * pct, bal: a.bal, dpd: a.d30 / a.bal };
    }).filter((x) => x.bal >= tot * 0.02).sort((a, b) => b.pct - a.pct);
    return { base, funnel, products, byStatus, cohort, stats, member };
  }

  S.DATASETS.overlap = { name: 'Cross-segment Overlap (consumer × MFI × commercial)', grain: 'borrower-linked aggregates by segment, product, state', refresh: 'Monthly', asOf: C.dataAsOf };
  PIQ.overlap = { retailMfi, msmeRetail };
})(typeof window !== 'undefined' ? window : globalThis);
