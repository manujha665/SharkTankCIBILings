/*
 * Portfolio Review (PR) uploads: the member uploads a bureau Portfolio Review output and gets
 * insights computed from that file alone. Four PR types, each with its own layout, sample file
 * and analysis:
 *   consumer     Consumer PR        retail loans & cards by product, state, score band
 *   commercial   Commercial PR      MSME / commercial exposure by segment, sector, state, CMR rank
 *   mfi          Microfinance PR    MFI book by state, number of MFI lenders, ticket size
 *   mfiConsumer  MFI + Consumer PR  the MFI book split by its consumer-credit footprint
 * Sample files are synthetic and deterministic (seeded), with a story built in.
 */
(function () {
  const PIQ = window.PIQ;
  const D = PIQ.data;

  // ---------- shared helpers ----------
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const MONTHS = () => D.MONTHS.slice(-12);
  const nm = (id) => D.S[id].name;
  const csvCell = (v) => (/[",]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v));
  const csv = (head, rows) => [head.join(',')].concat(rows.map((r) => r.map(csvCell).join(','))).join('\n');
  const f2 = (x) => Math.max(0, x).toFixed(2), f3 = (x) => Math.max(0, x).toFixed(3);
  const ml = (m) => D.monthLabel(m);
  const pct = (v, d) => (v == null || !isFinite(v) ? '—' : (v * 100).toFixed(d == null ? 2 : d) + '%');
  const bps = (v) => (v >= 0 ? '+' : '−') + Math.abs(Math.round(v * 10000)) + ' bps';
  const ppt = (v) => (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(1) + ' pp';
  const chg = (v) => (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(1) + '%';
  const cr = (v) => PIQ.ui.fmt.cr(v);
  const cnt = (v) => PIQ.ui.fmt.count(v);
  const sum = (recs, keyFn, fields) => {
    const g = new Map();
    recs.forEach((r) => {
      const k = keyFn(r);
      let a = g.get(k);
      if (!a) { a = { n: 0 }; fields.forEach((f) => (a[f] = 0)); g.set(k, a); }
      a.n++;
      fields.forEach((f) => (a[f] += r[f] || 0));
    });
    return g;
  };
  const one = (recs, fields) => sum(recs, () => 'x', fields).get('x') || Object.fromEntries(fields.map((f) => [f, 0]));
  const div = (a, b) => (b ? a / b : 0);
  const num = (label) => { const m = String(label).match(/\d+/); return m ? +m[0] : 0; };
  // months in the file, plus the first, latest and "3 months ago" reference points
  const timeline = (recs) => {
    const ms = [...new Set(recs.map((r) => r.m))].sort();
    return { ms, F: ms[0], L: ms[ms.length - 1], L3: ms[Math.max(0, ms.length - 4)], first3: ms.slice(0, 3), last3: ms.slice(-3) };
  };

  // ---------- 1. Consumer PR ----------
  const CONSUMER = {
    id: 'consumer', label: 'Consumer PR', icon: '👤', file: 'consumer_pr_output.csv',
    blurb: 'Retail loans and cards: balances, disbursals and 30+ / 90+ delinquency by product, state and score band.',
    fields: [
      { id: 'm', name: 'Month (YYYY-MM)', kind: 'month', req: true, guess: /month|period|date/i },
      { id: 'product', name: 'Product', kind: 'cat', req: true, guess: /product/i },
      { id: 'state', name: 'State', kind: 'state', req: true, guess: /state|region/i },
      { id: 'band', name: 'Score band', kind: 'cat', req: true, guess: /band|score|tier/i },
      { id: 'acc', name: 'Live accounts', kind: 'num', req: true, guess: /account|live/i },
      { id: 'bal', name: 'Balance outstanding (₹ Cr)', kind: 'num', req: true, guess: /^bal|balance|outstanding|pos/i },
      { id: 'disb', name: 'Disbursed in month (₹ Cr)', kind: 'num', req: false, guess: /disb|sanction/i },
      { id: 'd30', name: '30+ DPD balance (₹ Cr)', kind: 'num', req: true, guess: /30/i },
      { id: 'd90', name: '90+ DPD balance (₹ Cr)', kind: 'num', req: true, guess: /90/i }
    ],
    sample() {
      const r = rng(1101);
      const prods = { PL: [16000, 0.025, 3, 0.06], CC: [6000, 0.045, 0.6, 0.1], HL: [30000, 0.008, 30, 0.015], AL: [7000, 0.02, 6, 0.04], TW: [2500, 0.05, 0.8, 0.06], GL: [5000, 0.015, 1, 0.15] };
      const st = { MH: [0.2, 1], UP: [0.15, 1.25], TN: [0.13, 1], KA: [0.12, 0.95], GJ: [0.1, 0.95], BR: [0.1, 1.3], WB: [0.1, 1.05], RJ: [0.1, 1.1] };
      const bandShare = [0.2, 0.22, 0.28, 0.18, 0.12], bandMult = [0.35, 0.6, 1, 1.9, 3.2];
      const rows = [];
      MONTHS().forEach((m, t) => Object.entries(prods).forEach(([p, [base, rate, ticket, disbRate]]) => Object.entries(st).forEach(([s, [w, sm]]) => {
        const hot = p === 'PL' && (s === 'UP' || s === 'BR');
        const sh = bandShare.map((x, i) => x * (hot && i >= 3 ? 1 + 0.06 * t : 1));
        const tot = sh.reduce((a, b) => a + b, 0);
        D.BANDS.forEach((b, i) => {
          const bal = base * w * (sh[i] / tot) * Math.pow(1.012, t) * (0.95 + 0.1 * r());
          const trend = hot ? 1 + 0.045 * t : p === 'CC' ? 1 - 0.015 * t : 1 + 0.005 * t;
          const d30r = Math.min(0.5, rate * bandMult[i] * sm * trend * (0.94 + 0.12 * r()));
          const roll = (hot ? 0.5 + 0.012 * t : p === 'CC' ? 0.38 : 0.44) * (0.95 + 0.1 * r());
          const disb = bal * disbRate * (hot && i >= 3 ? 1 + 0.05 * t : 1) * (0.9 + 0.2 * r());
          rows.push([m, D.P[p].name, nm(s), `${b.name} (${b.range})`, Math.round((bal * 100) / ticket), f2(bal), f2(disb), f3(bal * d30r), f3(bal * d30r * roll)]);
        });
      })));
      return csv(['month', 'product', 'state', 'score_band', 'live_accounts', 'balance_cr', 'disbursed_cr', 'dpd30_balance_cr', 'dpd90_balance_cr'], rows);
    },
    analyse(recs) {
      const T = timeline(recs), F = ['acc', 'bal', 'disb', 'd30', 'd90'];
      const byM = sum(recs, (r) => r.m, F);
      const LT = byM.get(T.L), FT = byM.get(T.F);
      const r30 = (a) => div(a.d30, a.bal), r90 = (a) => div(a.d90, a.bal);
      const prods = [...new Set(recs.map((r) => r.product))];
      const pL = sum(recs.filter((r) => r.m === T.L), (r) => r.product, F), pF = sum(recs.filter((r) => r.m === T.F), (r) => r.product, F);
      const cL = sum(recs.filter((r) => r.m === T.L), (r) => r.product + '|' + r.state, F), cF = sum(recs.filter((r) => r.m === T.F), (r) => r.product + '|' + r.state, F);
      const hot = [...cL.entries()].filter(([k, a]) => a.bal >= LT.bal * 0.01 && cF.get(k)).map(([k, a]) => ({ k, a, was: r30(cF.get(k)), now: r30(a) })).map((x) => Object.assign(x, { d: x.now - x.was })).sort((x, y) => y.d - x.d);
      const bands = [...new Set(recs.map((r) => r.band))];
      const weakRe = /near|sub|<|≤|low|ntc|thin/i;
      const weak = bands.filter((b) => weakRe.test(b));
      const shareOf = (rs, key) => { const tot = one(rs, [key])[key]; return div(rs.filter((r) => weak.includes(r.band)).reduce((a, r) => a + (r[key] || 0), 0), tot); };
      const wF = shareOf(recs.filter((r) => r.m === T.F), 'bal'), wL = shareOf(recs.filter((r) => r.m === T.L), 'bal');
      const dF = shareOf(recs.filter((r) => T.first3.includes(r.m)), 'disb'), dL = shareOf(recs.filter((r) => T.last3.includes(r.m)), 'disb');
      const bL = sum(recs.filter((r) => r.m === T.L), (r) => r.band, F), bF = sum(recs.filter((r) => r.m === T.F), (r) => r.band, F);
      const prodRows = prods.map((p) => ({ p, L: pL.get(p), F: pF.get(p) })).filter((x) => x.L && x.F).sort((a, b) => b.L.bal - a.L.bal);
      const rollTop = prodRows.slice().sort((a, b) => div(b.L.d90, b.L.d30) - div(a.L.d90, a.L.d30))[0];
      const best = prodRows.slice().sort((a, b) => (r30(a.L) - r30(a.F)) - (r30(b.L) - r30(b.F)))[0];
      const w = hot[0];
      const [wp, ws] = w ? w.k.split('|') : ['', ''];
      const findings = [];
      if (weak.length) findings.push({ tone: wL > wF + 0.01 ? 'danger' : 'insight', title: `Weaker score bands are ${wL > wF + 0.005 ? 'growing' : 'stable'}: ${pct(wF, 1)} → ${pct(wL, 1)} of balance`, text: `${weak.join(' and ')} took ${pct(dL, 0)} of disbursals in the last 3 months, against ${pct(dF, 0)} in the first 3 months of the file. New lending is ${dL > dF + 0.01 ? 'drifting down the score curve' : 'holding its risk mix'}.` });
      if (rollTop) findings.push({ tone: div(rollTop.L.d90, rollTop.L.d30) > 0.5 ? 'danger' : 'insight', title: `${rollTop.p}: ${pct(div(rollTop.L.d90, rollTop.L.d30), 0)} of the 30+ book is already 90+`, text: `The highest roll-forward in the file (was ${pct(div(rollTop.F.d90, rollTop.F.d30), 0)} in ${ml(T.F)}). Early-bucket collections on this product are not curing accounts before they reach 90+.` });
      if (best && r30(best.L) < r30(best.F)) findings.push({ tone: 'okay', title: `${best.p} is improving: 30+ DPD ${pct(r30(best.F))} → ${pct(r30(best.L))}`, text: `${bps(r30(best.L) - r30(best.F))} since ${ml(T.F)} on ${cr(best.L.bal)} of balance. A candidate for selective growth.` });
      return {
        headline: w ? { tone: w.d > 0.005 ? 'danger' : 'insight', title: `${wp} in ${ws}: 30+ DPD up ${bps(w.d).replace('+', '')} to ${pct(w.now)} since ${ml(T.F)}`, text: `The fastest-deteriorating product × state in your Consumer PR, ${(w.now / r30(LT)).toFixed(1)}× your book average of ${pct(r30(LT))}, on ${cr(w.a.bal)} of balance (${pct(w.a.bal / LT.bal, 1)} of the book).` } : null,
        stats: [
          { label: `Balance · ${ml(T.L)}`, value: cr(LT.bal), note: `${chg(LT.bal / FT.bal - 1)} since ${ml(T.F)}` },
          { label: '30+ DPD', value: pct(r30(LT)), note: `${bps(r30(LT) - r30(FT))} since ${ml(T.F)}`, bad: r30(LT) - r30(FT) > 0.002 },
          { label: '90+ DPD', value: pct(r90(LT)), note: `${bps(r90(LT) - r90(FT))} since ${ml(T.F)}`, bad: r90(LT) - r90(FT) > 0.001 },
          { label: 'Live accounts', value: cnt(LT.acc), note: `${cr(LT.disb)} disbursed in ${ml(T.L)}` }
        ],
        charts: [
          { type: 'line', title: 'Delinquency trend', sub: '30+ and 90+ DPD as % of balance, whole file', yPct: true, series: [{ name: '30+ DPD', points: T.ms.map((m) => ({ x: m, y: r30(byM.get(m)) })) }, { name: '90+ DPD', points: T.ms.map((m) => ({ x: m, y: r90(byM.get(m)) })) }] },
          { type: 'bars', title: 'Balance mix by score band', sub: `Share of balance · ${ml(T.L)} vs ${ml(T.F)} (tick)`, fmt: 'pct0', valueName: ml(T.L), refName: ml(T.F), items: bands.map((b) => ({ label: b, value: div((bL.get(b) || {}).bal, LT.bal), ref: div((bF.get(b) || {}).bal, FT.bal) })) }
        ],
        tables: [
          { title: 'By product', sub: `${ml(T.L)} · change since ${ml(T.F)}`, cols: ['Product', 'Balance', 'Share', '30+ DPD', 'Change', '90+ DPD', '90+ ÷ 30+'], rows: prodRows.map((x) => [x.p, cr(x.L.bal), pct(x.L.bal / LT.bal, 1), pct(r30(x.L)), { v: bps(r30(x.L) - r30(x.F)), bad: r30(x.L) - r30(x.F) > 0.003, good: r30(x.L) < r30(x.F) }, pct(r90(x.L)), pct(div(x.L.d90, x.L.d30), 0)]) },
          { title: 'Fastest-deteriorating product × state', sub: `Segments with at least 1% of balance · 30+ DPD ${ml(T.F)} → ${ml(T.L)}`, cols: ['Segment', 'Balance', `30+ ${ml(T.F)}`, `30+ ${ml(T.L)}`, 'Change'], rows: hot.slice(0, 6).map((x) => [x.k.replace('|', ' · '), cr(x.a.bal), pct(x.was), pct(x.now), { v: bps(x.d), bad: x.d > 0.003, good: x.d < 0 }]) }
        ],
        findings,
        ai: [w ? `Fastest-deteriorating segment: ${wp} in ${ws}, 30+ DPD ${pct(w.was)} → ${pct(w.now)}` : '', `Book 30+ DPD ${pct(r30(LT))} (${bps(r30(LT) - r30(FT))} since ${ml(T.F)}); 90+ ${pct(r90(LT))}`].concat(findings.map((f) => f.title)).filter(Boolean)
      };
    }
  };

  // ---------- 2. Commercial PR ----------
  const COMMERCIAL = {
    id: 'commercial', label: 'Commercial PR', icon: '🏭', file: 'commercial_pr_output.csv',
    blurb: 'MSME and commercial exposure by borrower segment, sector, state and CIBIL MSME Rank (CMR), with SMA-0/1/2 and NPA.',
    fields: [
      { id: 'm', name: 'Month (YYYY-MM)', kind: 'month', req: true, guess: /month|period|date/i },
      { id: 'seg', name: 'Borrower segment (Micro / Small / Medium)', kind: 'cat', req: true, guess: /segment|size/i },
      { id: 'sector', name: 'Sector', kind: 'cat', req: true, guess: /sector|industry/i },
      { id: 'state', name: 'State', kind: 'state', req: true, guess: /state|region/i },
      { id: 'cmr', name: 'CMR band', kind: 'cat', req: true, guess: /cmr|rank/i },
      { id: 'acc', name: 'Live accounts', kind: 'num', req: true, guess: /account|borrower|live/i },
      { id: 'exp', name: 'Exposure outstanding (₹ Cr)', kind: 'num', req: true, guess: /exposure|balance|outstanding/i },
      { id: 'sma0', name: 'SMA-0 balance (₹ Cr)', kind: 'num', req: true, guess: /sma.?0/i },
      { id: 'sma1', name: 'SMA-1 balance (₹ Cr)', kind: 'num', req: true, guess: /sma.?1/i },
      { id: 'sma2', name: 'SMA-2 balance (₹ Cr)', kind: 'num', req: true, guess: /sma.?2/i },
      { id: 'npa', name: 'NPA balance (₹ Cr)', kind: 'num', req: true, guess: /npa|90/i }
    ],
    sample() {
      const r = rng(2202);
      const segs = { Micro: [4000, 1.4, 0.4], Small: [9000, 1, 2], Medium: [12000, 0.7, 9] };
      const sectors = { Manufacturing: [0.3, 1], Trading: [0.25, 1.2], Services: [0.22, 0.9], Construction: [0.13, 1.3], 'Agri-processing': [0.1, 1.05] };
      const st = { MH: [0.24, 1], TN: [0.2, 1.05], GJ: [0.18, 0.9], KA: [0.14, 0.95], UP: [0.13, 1.15], WB: [0.11, 1.1] };
      const cmrs = ['CMR 1-3', 'CMR 4-6', 'CMR 7-8', 'CMR 9-10'], cmrMult = [0.4, 0.8, 1.6, 3];
      const rows = [];
      MONTHS().forEach((m, t) => Object.entries(segs).forEach(([sg, [base, sgm, ticket]]) => Object.entries(sectors).forEach(([sec, [sw, secm]]) => Object.entries(st).forEach(([s, [w, sm]]) => {
        const sh = [0.35 - 0.006 * t, 0.35 - 0.004 * t, 0.2 + 0.006 * t, 0.1 + 0.004 * t];
        cmrs.forEach((c, i) => {
          const exp = base * sw * w * sh[i] * Math.pow(1.009, t) * (0.93 + 0.14 * r());
          const k = cmrMult[i] * sgm * secm * sm;
          const tradeTN = sec === 'Trading' && s === 'TN' && t >= 7 ? 1 + 0.32 * (t - 6) : 1;
          const consMH = sec === 'Construction' && s === 'MH' ? 1 + 0.03 * t : 1;
          const j = () => 0.92 + 0.16 * r();
          rows.push([m, sg, sec, nm(s), c, Math.round((exp * 100) / ticket), f2(exp), f3(exp * 0.05 * k * j()), f3(exp * 0.025 * k * tradeTN * j()), f3(exp * 0.012 * k * tradeTN * tradeTN * j()), f3(exp * 0.03 * k * consMH * (tradeTN > 1 ? 1 + 0.05 * (t - 6) : 1) * j())]);
        });
      }))));
      return csv(['month', 'borrower_segment', 'sector', 'state', 'cmr_band', 'live_accounts', 'exposure_cr', 'sma0_cr', 'sma1_cr', 'sma2_cr', 'npa_cr'], rows);
    },
    analyse(recs) {
      const T = timeline(recs), F = ['acc', 'exp', 'sma0', 'sma1', 'sma2', 'npa'];
      const byM = sum(recs, (r) => r.m, F);
      const LT = byM.get(T.L), FT = byM.get(T.F), L3T = byM.get(T.L3);
      const rt = (a, k) => div(a[k], a.exp);
      const risky = (r) => num(r.cmr) >= 7;
      const highShare = (m) => div(recs.filter((r) => r.m === m && risky(r)).reduce((a, r) => a + r.exp, 0), byM.get(m).exp);
      const at = (m, key) => sum(recs.filter((r) => r.m === m), key, F);
      const secL = at(T.L, (r) => r.sector), sec3 = at(T.L3, (r) => r.sector);
      const segL = at(T.L, (r) => r.seg);
      const cL = at(T.L, (r) => r.sector + '|' + r.state), c3 = at(T.L3, (r) => r.sector + '|' + r.state);
      const hot = [...cL.entries()].filter(([k, a]) => a.exp >= LT.exp * 0.01 && c3.get(k)).map(([k, a]) => ({ k, a, was: rt(c3.get(k), 'sma2'), now: rt(a, 'sma2') })).map((x) => Object.assign(x, { d: x.now - x.was })).sort((x, y) => y.d - x.d);
      const w = hot[0];
      const [wsec, wst] = w ? w.k.split('|') : ['', ''];
      const secRows = [...secL.entries()].map(([k, a]) => ({ k, a, b: sec3.get(k) })).filter((x) => x.b).sort((x, y) => y.a.exp - x.a.exp);
      const segRows = [...segL.entries()].sort((x, y) => rt(y[1], 'npa') - rt(x[1], 'npa'));
      const hF = highShare(T.F), hL = highShare(T.L);
      const findings = [];
      findings.push({ tone: hL > hF + 0.01 ? 'danger' : 'insight', title: `Exposure to CMR 7–10 borrowers: ${pct(hF, 1)} → ${pct(hL, 1)}`, text: `The riskiest CIBIL MSME Ranks now hold ${cr(hL * LT.exp)} of your exposure. ${hL > hF + 0.01 ? 'New and renewed limits are going to weaker-ranked businesses.' : 'The rank mix is broadly stable.'}` });
      if (segRows.length > 1) { const [hi, lo] = [segRows[0], segRows[segRows.length - 1]]; findings.push({ tone: 'insight', title: `${hi[0]} businesses carry ${(rt(hi[1], 'npa') / Math.max(1e-6, rt(lo[1], 'npa'))).toFixed(1)}× the NPA rate of ${lo[0]}`, text: `NPA ${pct(rt(hi[1], 'npa'))} vs ${pct(rt(lo[1], 'npa'))} in ${ml(T.L)}. Pricing and monitoring intensity should differ by segment.` }); }
      findings.push({ tone: rt(LT, 'sma2') > rt(L3T, 'sma2') * 1.1 ? 'danger' : 'okay', title: `SMA-2 book ${rt(LT, 'sma2') > rt(L3T, 'sma2') ? 'building' : 'easing'}: ${pct(rt(L3T, 'sma2'))} → ${pct(rt(LT, 'sma2'))} in 3 months`, text: `SMA-2 (61–90 days overdue) is the last stop before NPA. ${cr(LT.sma2)} sits there today.` });
      return {
        headline: w ? { tone: w.d > 0.004 ? 'danger' : 'insight', title: `${wsec} in ${wst}: SMA-2 rose from ${pct(w.was)} to ${pct(w.now)} in 3 months`, text: `These are next quarter's NPAs: ${cr(w.a.sma2)} of ${cr(w.a.exp)} exposure is 61–90 days overdue, the fastest build-up of any sector × state in your Commercial PR. Review limits and stock statements now.` } : null,
        stats: [
          { label: `Exposure · ${ml(T.L)}`, value: cr(LT.exp), note: `${chg(LT.exp / FT.exp - 1)} since ${ml(T.F)}` },
          { label: 'SMA-2 (pre-NPA)', value: pct(rt(LT, 'sma2')), note: `${bps(rt(LT, 'sma2') - rt(L3T, 'sma2'))} in 3 months`, bad: rt(LT, 'sma2') > rt(L3T, 'sma2') * 1.1 },
          { label: 'NPA', value: pct(rt(LT, 'npa')), note: `${bps(rt(LT, 'npa') - rt(FT, 'npa'))} since ${ml(T.F)}`, bad: rt(LT, 'npa') > rt(FT, 'npa') + 0.002 },
          { label: 'Exposure in CMR 7–10', value: pct(hL, 1), note: `${ppt(hL - hF)} since ${ml(T.F)}`, bad: hL > hF + 0.01 }
        ],
        charts: [
          { type: 'line', title: 'Stress pipeline', sub: 'SMA-0, SMA-1, SMA-2 and NPA as % of exposure', yPct: true, series: ['sma0', 'sma1', 'sma2', 'npa'].map((k) => ({ name: k === 'npa' ? 'NPA' : k.toUpperCase().replace('SMA', 'SMA-'), points: T.ms.map((m) => ({ x: m, y: rt(byM.get(m), k) })) })) },
          { type: 'bars', title: 'SMA-2 by sector', sub: `${ml(T.L)} vs 3 months earlier (tick)`, fmt: 'pct', valueName: ml(T.L), refName: ml(T.L3), items: secRows.map((x) => ({ label: x.k, value: rt(x.a, 'sma2'), ref: rt(x.b, 'sma2') })) }
        ],
        tables: [
          { title: 'By sector', sub: `${ml(T.L)} · SMA-2 change over 3 months`, cols: ['Sector', 'Exposure', 'Share', 'SMA-2', '3-month change', 'NPA'], rows: secRows.map((x) => [x.k, cr(x.a.exp), pct(x.a.exp / LT.exp, 1), pct(rt(x.a, 'sma2')), { v: bps(rt(x.a, 'sma2') - rt(x.b, 'sma2')), bad: rt(x.a, 'sma2') - rt(x.b, 'sma2') > 0.002 }, pct(rt(x.a, 'npa'))]) },
          { title: 'Fastest SMA-2 build-up: sector × state', sub: `Cells with at least 1% of exposure · ${ml(T.L3)} → ${ml(T.L)}`, cols: ['Segment', 'Exposure', `SMA-2 ${ml(T.L3)}`, `SMA-2 ${ml(T.L)}`, 'Change'], rows: hot.slice(0, 6).map((x) => [x.k.replace('|', ' · '), cr(x.a.exp), pct(x.was), pct(x.now), { v: bps(x.d), bad: x.d > 0.002 }]) },
          { title: 'By borrower segment', sub: ml(T.L), cols: ['Segment', 'Exposure', 'Accounts', 'SMA-2', 'NPA'], rows: segRows.map(([k, a]) => [k, cr(a.exp), cnt(a.acc), pct(rt(a, 'sma2')), pct(rt(a, 'npa'))]) }
        ],
        findings,
        ai: [w ? `Fastest SMA-2 build-up: ${wsec} in ${wst}, ${pct(w.was)} → ${pct(w.now)} in 3 months` : '', `SMA-2 ${pct(rt(LT, 'sma2'))}, NPA ${pct(rt(LT, 'npa'))} of ${cr(LT.exp)} exposure`].concat(findings.map((f) => f.title)).filter(Boolean)
      };
    }
  };

  // ---------- 3. Microfinance PR ----------
  const MFI = {
    id: 'mfi', label: 'Microfinance PR', icon: '🤝', file: 'microfinance_pr_output.csv',
    blurb: 'Your microfinance book by state, number of MFI lenders per borrower and ticket size, with PAR 30 / PAR 90.',
    fields: [
      { id: 'm', name: 'Month (YYYY-MM)', kind: 'month', req: true, guess: /month|period|date/i },
      { id: 'state', name: 'State', kind: 'state', req: true, guess: /state|region/i },
      { id: 'lenders', name: 'MFI lenders per borrower (1, 2, 3, 4+)', kind: 'cat', req: true, guess: /lender/i },
      { id: 'ticket', name: 'Ticket-size bucket', kind: 'cat', req: true, guess: /ticket/i },
      { id: 'borrowers', name: 'Live borrowers', kind: 'num', req: true, guess: /borrower|live/i },
      { id: 'glp', name: 'Gross loan portfolio (₹ Cr)', kind: 'num', req: true, guess: /glp|gross|portfolio|balance/i },
      { id: 'disb', name: 'Disbursed in month (₹ Cr)', kind: 'num', req: false, guess: /disb/i },
      { id: 'par30', name: 'PAR 30 balance (₹ Cr)', kind: 'num', req: true, guess: /par.?30|30/i },
      { id: 'par90', name: 'PAR 90 balance (₹ Cr)', kind: 'num', req: true, guess: /par.?90|90/i }
    ],
    sample() {
      const r = rng(3303);
      const st = { BR: [0.18, 1.2], UP: [0.16, 1.15], TN: [0.14, 0.9], KA: [0.12, 0.85], WB: [0.12, 1], MH: [0.1, 0.95], OD: [0.1, 1.05], MP: [0.08, 1.1] };
      const lenders = ['1', '2', '3', '4+'], lMult = [1, 1.4, 2.1, 3.4];
      const tickets = [['<30K', 25000, 0.9], ['30–50K', 40000, 1], ['50K+', 62000, 1.3]];
      const rows = [];
      MONTHS().forEach((m, t) => Object.entries(st).forEach(([s, [w, sm]]) => {
        const lsh = [0.45 - 0.004 * t, 0.28, 0.15, 0.12 + 0.004 * t];
        const tsh = [0.4 - 0.006 * t, 0.4, 0.2 + 0.006 * t];
        lenders.forEach((l, li) => tickets.forEach(([tk, avg, tm], ti) => {
          const bor = 4000000 * w * lsh[li] * tsh[ti] * Math.pow(1.006, t) * (0.94 + 0.12 * r());
          const glp = (bor * avg * 0.62) / 1e7;
          const stress = (s === 'BR' || s === 'UP' ? 1 + 0.06 * t : 1) * (s === 'MP' && t >= 9 ? 1.5 : 1);
          const par30 = Math.min(0.5, 0.02 * lMult[li] * tm * sm * stress * (0.92 + 0.16 * r()));
          rows.push([m, nm(s), l, tk, Math.round(bor), f2(glp), f2(glp * 0.09 * (0.9 + 0.2 * r())), f3(glp * par30), f3(glp * par30 * (0.5 + 0.1 * r()))]);
        }));
      }));
      return csv(['month', 'state', 'mfi_lenders', 'ticket_bucket', 'live_borrowers', 'glp_cr', 'disbursed_cr', 'par30_cr', 'par90_cr'], rows);
    },
    analyse(recs) {
      const T = timeline(recs), F = ['borrowers', 'glp', 'disb', 'par30', 'par90'];
      const byM = sum(recs, (r) => r.m, F);
      const LT = byM.get(T.L), FT = byM.get(T.F);
      const p30 = (a) => div(a.par30, a.glp), p90 = (a) => div(a.par90, a.glp);
      const lBuckets = [...new Set(recs.map((r) => r.lenders))].sort((a, b) => num(a) - num(b));
      const top = lBuckets[lBuckets.length - 1], low = lBuckets[0];
      const at = (m, key) => sum(recs.filter((r) => r.m === m), key, F);
      const lL = at(T.L, (r) => r.lenders), lF = at(T.F, (r) => r.lenders);
      const topShare = (m) => div((at(m, (r) => r.lenders).get(top) || {}).borrowers, byM.get(m).borrowers);
      const sL = at(T.L, (r) => r.state), sF = at(T.F, (r) => r.state);
      const stRows = [...sL.entries()].map(([k, a]) => ({ k, a, b: sF.get(k), top4: div(recs.filter((r) => r.m === T.L && r.state === k && r.lenders === top).reduce((x, r) => x + r.borrowers, 0), a.borrowers) })).filter((x) => x.b).sort((x, y) => (p30(y.a) - p30(y.b)) - (p30(x.a) - p30(x.b)));
      const w = stRows[0];
      const tks = [...new Set(recs.map((r) => r.ticket))];
      const bigT = tks.slice().sort((a, b) => num(b.replace(/[<]/, '')) - num(a.replace(/[<]/, '')))[0];
      const tShare = (ms) => { const rs = recs.filter((r) => ms.includes(r.m)); return div(rs.filter((r) => r.ticket === bigT).reduce((a, r) => a + (r.disb || 0), 0), rs.reduce((a, r) => a + (r.disb || 0), 0)); };
      const tF = tShare(T.first3), tL = tShare(T.last3);
      const multi = div(p30(lL.get(top)), p30(lL.get(low)));
      const findings = [
        { tone: multi > 2 ? 'danger' : 'insight', title: `Borrowers with ${top} MFI lenders: PAR 30 ${pct(p30(lL.get(top)))}, ${multi.toFixed(1)}× single-lender borrowers`, text: `They are ${pct(topShare(T.L), 1)} of your live borrowers (${ppt(topShare(T.L) - topShare(T.F))} since ${ml(T.F)}) and hold ${cr(lL.get(top).glp)}. Over-indebtedness is where the stress sits: cap exposure where a borrower already has ${top} lenders.` },
        { tone: tL > tF + 0.02 ? 'danger' : 'insight', title: `Bigger tickets: ${bigT} loans are ${pct(tL, 0)} of recent disbursals (was ${pct(tF, 0)})`, text: `Ticket sizes are ${tL > tF + 0.02 ? 'creeping up while repayment capacity stays the same, a classic precursor of MFI stress' : 'stable'}. Their PAR 30 is ${pct(p30(at(T.L, (r) => r.ticket).get(bigT)))}.` }
      ];
      return {
        headline: w ? { tone: p30(w.a) - p30(w.b) > 0.01 ? 'danger' : 'insight', title: `${w.k}: PAR 30 up from ${pct(w.b ? p30(w.b) : 0)} to ${pct(p30(w.a))} since ${ml(T.F)}`, text: `The sharpest deterioration of any state in your Microfinance PR, on ${cr(w.a.glp)} of portfolio. ${pct(w.top4, 0)} of borrowers there have ${top} MFI lenders.` } : null,
        stats: [
          { label: `Gross loan portfolio · ${ml(T.L)}`, value: cr(LT.glp), note: `${chg(LT.glp / FT.glp - 1)} since ${ml(T.F)}` },
          { label: 'PAR 30', value: pct(p30(LT)), note: `${bps(p30(LT) - p30(FT))} since ${ml(T.F)}`, bad: p30(LT) > p30(FT) + 0.003 },
          { label: 'PAR 90', value: pct(p90(LT)), note: `${bps(p90(LT) - p90(FT))} since ${ml(T.F)}`, bad: p90(LT) > p90(FT) + 0.002 },
          { label: `Borrowers with ${top} MFI lenders`, value: pct(topShare(T.L), 1), note: `${ppt(topShare(T.L) - topShare(T.F))} since ${ml(T.F)} · ${cnt(LT.borrowers)} live borrowers`, bad: topShare(T.L) > topShare(T.F) + 0.01 }
        ],
        charts: [
          { type: 'line', title: 'Portfolio at risk', sub: 'PAR 30 and PAR 90 as % of gross loan portfolio', yPct: true, series: [{ name: 'PAR 30', points: T.ms.map((m) => ({ x: m, y: p30(byM.get(m)) })) }, { name: 'PAR 90', points: T.ms.map((m) => ({ x: m, y: p90(byM.get(m)) })) }] },
          { type: 'bars', title: 'PAR 30 by number of MFI lenders', sub: `${ml(T.L)} vs ${ml(T.F)} (tick) · more lenders, more stress`, fmt: 'pct', valueName: ml(T.L), refName: ml(T.F), items: lBuckets.map((l) => ({ label: l + (l === '1' ? ' lender' : ' lenders'), value: p30(lL.get(l)), ref: lF.get(l) ? p30(lF.get(l)) : null })) }
        ],
        tables: [
          { title: 'By state', sub: `${ml(T.L)} · worst change first`, cols: ['State', 'Portfolio', 'Borrowers', 'PAR 30', 'Change', `${top} lenders`], rows: stRows.map((x) => [x.k, cr(x.a.glp), cnt(x.a.borrowers), pct(p30(x.a)), { v: bps(p30(x.a) - p30(x.b)), bad: p30(x.a) - p30(x.b) > 0.005, good: p30(x.a) < p30(x.b) }, pct(x.top4, 0)]) }
        ],
        findings,
        ai: [w ? `Sharpest PAR 30 rise: ${w.k}, ${pct(p30(w.b))} → ${pct(p30(w.a))}` : '', `PAR 30 ${pct(p30(LT))}, PAR 90 ${pct(p90(LT))} on ${cr(LT.glp)}`].concat(findings.map((f) => f.title)).filter(Boolean)
      };
    }
  };

  // ---------- 4. MFI + Consumer PR ----------
  const MFI_CONSUMER = {
    id: 'mfiConsumer', label: 'MFI + Consumer PR', icon: '🔗', file: 'mfi_consumer_pr_output.csv',
    blurb: 'Your microfinance borrowers split by their consumer-credit footprint (live, closed, enquiry only), with stress on both sides.',
    fields: [
      { id: 'm', name: 'Month (YYYY-MM)', kind: 'month', req: true, guess: /month|period|date/i },
      { id: 'state', name: 'State', kind: 'state', req: true, guess: /state|region/i },
      { id: 'overlap', name: 'Overlap type', kind: 'cat', req: true, guess: /overlap|footprint|type/i },
      { id: 'cprod', name: 'Consumer product held', kind: 'cat', req: true, guess: /product/i },
      { id: 'borrowers', name: 'Borrowers', kind: 'num', req: true, guess: /borrower/i },
      { id: 'mglp', name: 'MFI portfolio (₹ Cr)', kind: 'num', req: true, guess: /mfi.*(glp|bal|portfolio)/i },
      { id: 'cbal', name: 'Consumer balance (₹ Cr)', kind: 'num', req: false, guess: /consumer.*bal|cons.*bal/i },
      { id: 'mpar', name: 'MFI PAR 30 balance (₹ Cr)', kind: 'num', req: true, guess: /mfi.*(par|30)/i },
      { id: 'cd30', name: 'Consumer 30+ DPD balance (₹ Cr)', kind: 'num', req: false, guess: /consumer.*(dpd|30)|cons.*dpd/i }
    ],
    sample() {
      const r = rng(4404);
      const st = { BR: [0.17, 1.15, 0.9], UP: [0.15, 1.1, 1], TN: [0.15, 0.9, 1.35], KA: [0.13, 0.85, 1.3], WB: [0.12, 1, 0.85], MH: [0.1, 0.95, 1.1], OD: [0.1, 1.05, 0.8], MP: [0.08, 1.1, 0.9] };
      const types = [['MFI only', 0.5, 1], ['MFI + live consumer loan', 0.25, 1.7], ['MFI + closed consumer loan', 0.13, 1.1], ['MFI + consumer enquiry only', 0.12, 1.35]];
      const prods = [['Gold Loan', 0.42, 60000, 0.02], ['Personal Loan', 0.24, 120000, 0.06], ['Consumer Durable', 0.2, 25000, 0.05], ['Two-Wheeler Loan', 0.1, 70000, 0.07], ['Credit Card', 0.04, 40000, 0.09]];
      const rows = [];
      MONTHS().forEach((m, t) => Object.entries(st).forEach(([s, [w, sm, ov]]) => {
        const tot = 4000000 * w * Math.pow(1.006, t);
        const live = 0.25 * ov * (1 + 0.006 * t);
        const shares = [1 - live - 0.13 - 0.12, live, 0.13, 0.12];
        types.forEach(([tp, , mult], ti) => {
          const spread = ti === 1 ? 1 + 0.03 * t : 1;
          if (ti === 0) {
            const b = tot * shares[0] * (0.95 + 0.1 * r());
            const g = (b * 26000) / 1e7;
            rows.push([m, nm(s), tp, 'None', Math.round(b), f2(g), '0.00', f3(g * 0.022 * sm * (0.92 + 0.16 * r())), '0.000']);
            return;
          }
          prods.forEach(([pn, psh, ticket, d30]) => {
            const b = tot * shares[ti] * psh * (0.93 + 0.14 * r());
            const g = (b * 30000) / 1e7;
            const cb = ti === 1 ? (b * ticket * 0.6) / 1e7 : 0;
            rows.push([m, nm(s), tp, pn, Math.round(b), f2(g), f2(cb), f3(g * 0.022 * sm * mult * spread * (0.92 + 0.16 * r())), f3(cb * d30 * sm * 1.6 * spread * (0.9 + 0.2 * r()))]);
          });
        });
      }));
      return csv(['month', 'state', 'overlap_type', 'consumer_product', 'borrowers', 'mfi_glp_cr', 'consumer_bal_cr', 'mfi_par30_cr', 'consumer_dpd30_cr'], rows);
    },
    analyse(recs) {
      const T = timeline(recs), F = ['borrowers', 'mglp', 'cbal', 'mpar', 'cd30'];
      const byM = sum(recs, (r) => r.m, F);
      const LT = byM.get(T.L);
      const isOnly = (o) => !/consumer|retail|cc|loan/i.test(o.replace(/^mfi/i, '')) || /^mfi only$/i.test(o.trim());
      const isLive = (o) => /live/i.test(o);
      const par = (a) => div(a.mpar, a.mglp), cd = (a) => div(a.cd30, a.cbal);
      const L = recs.filter((r) => r.m === T.L);
      const only = one(L.filter((r) => isOnly(r.overlap)), F), live = one(L.filter((r) => isLive(r.overlap)), F), any = one(L.filter((r) => !isOnly(r.overlap)), F);
      const series = (pred) => T.ms.map((m) => ({ x: m, y: par(one(recs.filter((r) => r.m === m && pred(r.overlap)), F)) }));
      const types = sum(L, (r) => r.overlap, F);
      const prodL = sum(L.filter((r) => isLive(r.overlap) && !/^none$/i.test(r.cprod)), (r) => r.cprod, F);
      const prodRows = [...prodL.entries()].sort((a, b) => b[1].borrowers - a[1].borrowers);
      const stL = sum(L, (r) => r.state, F);
      const stRows = [...stL.keys()].map((k) => {
        const rs = L.filter((r) => r.state === k);
        const tot = one(rs, F), lv = one(rs.filter((r) => isLive(r.overlap)), F), on = one(rs.filter((r) => isOnly(r.overlap)), F), an = one(rs.filter((r) => !isOnly(r.overlap)), F);
        return { k, tot, lv, on, an, liveShare: div(lv.borrowers, tot.borrowers), anyShare: div(an.borrowers, tot.borrowers) };
      }).sort((a, b) => b.liveShare - a.liveShare);
      const mult = div(par(live), par(only));
      const clean = only.borrowers * (1 - par(only));
      const firstLive = one(recs.filter((r) => r.m === T.F && isLive(r.overlap)), F), firstOnly = one(recs.filter((r) => r.m === T.F && isOnly(r.overlap)), F);
      const multF = div(par(firstLive), par(firstOnly));
      const w = stRows[0];
      const findings = [
        { tone: 'insight', title: `${pct(div(any.borrowers, LT.borrowers), 0)} of your MFI borrowers have a consumer-credit footprint; ${pct(div(live.borrowers, LT.borrowers), 0)} are servicing both right now`, text: `${cnt(live.borrowers)} borrowers hold a live consumer loan worth ${cr(live.cbal)} alongside ${cr(live.mglp)} of MFI loans. Their consumer 30+ DPD is ${pct(cd(live))}.` },
        prodRows.length ? { tone: 'insight', title: `Most-held consumer product: ${prodRows[0][0]} (${pct(div(prodRows[0][1].borrowers, live.borrowers), 0)} of live-overlap borrowers)`, text: prodRows.map(([k, a]) => `${k} ${pct(div(a.borrowers, live.borrowers), 0)} (30+ DPD ${pct(cd(a))})`).join(' · ') } : null,
        w ? { tone: w.liveShare > div(live.borrowers, LT.borrowers) * 1.2 ? 'danger' : 'insight', title: `${w.k} has the deepest overlap: ${pct(w.liveShare, 0)} of MFI borrowers servicing a consumer loan too`, text: `MFI PAR 30 there is ${pct(par(w.lv))} for overlapping borrowers vs ${pct(par(w.on))} for MFI-only. Tighten combined-indebtedness checks in this state first.` } : null,
        { tone: 'okay', title: `Graduation pool: about ${cnt(clean)} MFI-only borrowers with a clean MFI record`, text: 'No consumer footprint yet and current on their MFI loans: a ready, bureau-verified pipeline for a first gold loan, two-wheeler or small personal loan.' }
      ].filter(Boolean);
      return {
        headline: { tone: mult > 1.4 ? 'danger' : 'insight', title: `Borrowers servicing MFI and consumer loans together: MFI PAR 30 of ${pct(par(live))}, ${mult.toFixed(1)}× MFI-only borrowers`, text: `The gap has ${mult > multF + 0.05 ? 'widened' : 'held'} from ${multF.toFixed(1)}× in ${ml(T.F)}. Stress on one side of the balance sheet is reaching the other: these borrowers are where combined leverage bites first.` },
        stats: [
          { label: `MFI borrowers · ${ml(T.L)}`, value: cnt(LT.borrowers), note: `${cr(LT.mglp)} MFI portfolio` },
          { label: 'Any consumer footprint', value: pct(div(any.borrowers, LT.borrowers), 0), note: 'live, closed or enquiry only' },
          { label: 'Live-to-live overlap', value: pct(div(live.borrowers, LT.borrowers), 0), note: `${cr(live.cbal)} consumer balance` },
          { label: 'MFI PAR 30: overlap vs MFI-only', value: mult.toFixed(1) + '×', note: `${pct(par(live))} vs ${pct(par(only))}`, bad: mult > 1.4 }
        ],
        charts: [
          { type: 'line', title: 'MFI PAR 30: overlapping vs MFI-only borrowers', sub: 'Does consumer credit add stress to the MFI book?', yPct: true, series: [{ name: 'MFI + live consumer', points: series(isLive) }, { name: 'MFI only', points: series(isOnly) }] },
          { type: 'bars', title: 'Borrowers by overlap type', sub: `${ml(T.L)} · share of MFI borrowers`, fmt: 'pct0', valueName: 'Share of borrowers', items: [...types.entries()].map(([k, a]) => ({ label: k, value: div(a.borrowers, LT.borrowers) })) }
        ],
        tables: [
          { title: 'By state', sub: `${ml(T.L)} · deepest live overlap first`, cols: ['State', 'MFI borrowers', 'Any footprint', 'Live-to-live', 'MFI PAR 30 (overlap)', 'MFI PAR 30 (MFI only)', 'Consumer 30+ DPD'], rows: stRows.map((x) => [x.k, cnt(x.tot.borrowers), pct(x.anyShare, 0), pct(x.liveShare, 0), { v: pct(par(x.lv)), bad: par(x.lv) > par(x.on) * 1.5 }, pct(par(x.on)), pct(cd(x.lv))]) },
          { title: 'Consumer products held by live-overlap borrowers', sub: ml(T.L), cols: ['Product', 'Borrowers', 'Share', 'Consumer balance', 'Consumer 30+ DPD', 'MFI PAR 30'], rows: prodRows.map(([k, a]) => [k, cnt(a.borrowers), pct(div(a.borrowers, live.borrowers), 0), cr(a.cbal), pct(cd(a)), pct(par(a))]) }
        ],
        findings,
        ai: [`MFI PAR 30 overlap ${pct(par(live))} vs MFI-only ${pct(par(only))} (${mult.toFixed(1)}×)`, `Any consumer footprint ${pct(div(any.borrowers, LT.borrowers), 0)}, live-to-live ${pct(div(live.borrowers, LT.borrowers), 0)}`].concat(findings.map((f) => f.title))
      };
    }
  };

  const TYPES = { consumer: CONSUMER, commercial: COMMERCIAL, mfi: MFI, mfiConsumer: MFI_CONSUMER };
  const ORDER = ['consumer', 'commercial', 'mfi', 'mfiConsumer'];

  // ---------- parse mapped rows into typed records ----------
  const findState = (v) => { const n = String(v).trim().toLowerCase(); return D.STATES.find((s) => s.name.toLowerCase() === n || s.id.toLowerCase() === n); };
  function toRecords(type, rows, mapping) {
    const recs = [], bad = { month: 0, number: 0, blank: 0 };
    let unknownStates = new Set();
    rows.forEach((row) => {
      const r = {};
      for (const f of type.fields) {
        const idx = mapping[f.id];
        if (idx == null) { if (f.req) return; continue; }
        const raw = String(row[idx] == null ? '' : row[idx]).trim();
        if (f.kind === 'month') {
          const m = raw.slice(0, 7);
          if (!/^\d{4}-\d{2}$/.test(m)) { bad.month++; return; }
          r[f.id] = m;
        } else if (f.kind === 'num') {
          const v = parseFloat(raw.replace(/,/g, ''));
          if (!isFinite(v) || v < 0) { if (f.req || raw !== '') { bad.number++; return; } r[f.id] = 0; } else r[f.id] = v;
        } else {
          if (!raw) { bad.blank++; return; }
          if (f.kind === 'state') { const st = findState(raw); if (!st) unknownStates.add(raw); r[f.id] = st ? st.name : raw; } else r[f.id] = raw;
        }
      }
      recs.push(r);
    });
    return { recs, bad, unknownStates: [...unknownStates] };
  }

  PIQ.pr = { TYPES, ORDER, toRecords };
})();
