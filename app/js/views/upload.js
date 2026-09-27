/* Bring Your Data — upload a member file, map fields, join with industry, get new insights. */
(function () {
  const PIQ = window.PIQ;
  const { h, fmt, ml, card, sourceText, pageHead } = PIQ.ui;
  const S = PIQ.sem, D = PIQ.data;
  let parsed = null, mapping = null, step = 1, fileName = '';

  const FIELDS = [
    { id: 'month', name: 'Month (YYYY-MM)', req: true, guess: /month|period|date/i },
    { id: 'product', name: 'Product', req: true, guess: /product/i },
    { id: 'state', name: 'State', req: true, guess: /state|region/i },
    { id: 'band', name: 'Risk band', req: true, guess: /band|tier|risk/i },
    { id: 'bal', name: 'Balance (₹ Cr)', req: true, guess: /^bal|balance(?!.*dpd)|outstanding/i },
    { id: 'd30', name: '30+ DPD balance (₹ Cr)', req: true, guess: /dpd|delinq/i },
    { id: 'dim', name: 'New dimension to analyse', req: false, guess: /channel|source|branch|segment|campaign/i }
  ];

  function parseCSV(text) {
    const rows = [];
    let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') q = false;
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cur); cur = '';
        if (row.some((x) => x !== '')) rows.push(row);
        row = [];
      } else cur += ch;
    }
    row.push(cur);
    if (row.some((x) => x !== '')) rows.push(row);
    const head = rows.shift().map((x) => x.trim());
    return { head, rows };
  }
  const norm = (x) => String(x || '').trim().toLowerCase();
  const findState = (v) => D.STATES.find((s) => norm(s.name) === norm(v) || norm(s.id) === norm(v));
  const findBand = (v) => D.BANDS.find((b) => norm(b.name) === norm(v) || norm(b.id) === norm(v));
  const findProd = (v) => D.PRODUCTS.find((p) => norm(p.id) === norm(v) || norm(p.name) === norm(v) || norm(p.long) === norm(v));

  function autoMap(head) {
    const used = new Set(), m = {};
    FIELDS.forEach((f) => {
      const idx = head.findIndex((c, i) => !used.has(i) && f.guess.test(c));
      if (idx >= 0) { m[f.id] = idx; used.add(idx); }
    });
    return m;
  }

  // Join uploaded rows to industry: expected DPD if each row performed at the industry rate of its segment
  function analyse() {
    const recs = [];
    let unmatched = 0;
    parsed.rows.forEach((r) => {
      const st = findState(r[mapping.state]), bd = findBand(r[mapping.band]), pr = findProd(r[mapping.product]);
      const m = String(r[mapping.month]).trim().slice(0, 7);
      const bal = parseFloat(r[mapping.bal]), d30 = parseFloat(r[mapping.d30]);
      if (!st || !bd || !pr || !D.MONTHS.includes(m) || !isFinite(bal) || !isFinite(d30)) { unmatched++; return; }
      const indRate = S.value('industry', 'dpd30', { p: pr.id, s: st.id, b: bd.id, m });
      recs.push({ m, p: pr.id, s: st.id, b: bd.id, dim: mapping.dim != null ? String(r[mapping.dim]).trim() : 'All', bal, d30, exp: bal * indRate });
    });
    const out = { recs, unmatched, months: [...new Set(recs.map((r) => r.m))].sort() };
    PIQ.uploaded = { name: fileName, dimName: mapping.dim != null ? parsed.head[mapping.dim] : null, ...out };
    S.log('upload.analyse', { file: fileName, rows: recs.length });
    return out;
  }
  function groupBy(recs, keyFn) {
    const g = {};
    recs.forEach((r) => { const k = keyFn(r); const a = (g[k] = g[k] || { bal: 0, d30: 0, exp: 0 }); a.bal += r.bal; a.d30 += r.d30; a.exp += r.exp; });
    return g;
  }
  PIQ.uploadInsights = function () {
    const U = PIQ.uploaded;
    if (!U) return null;
    const last = U.months[U.months.length - 1];
    const L = U.recs.filter((r) => r.m === last);
    const byDim = groupBy(L, (r) => r.dim);
    const cells = groupBy(L, (r) => r.dim + '|' + r.s + '|' + (r.b === 'NP' || r.b === 'SB' ? 'NPSB' : 'PRIME'));
    const worst = Object.entries(cells).filter(([, a]) => a.bal > 20).map(([k, a]) => ({ k, idx: a.d30 / a.exp, a })).sort((x, y) => y.idx - x.idx)[0];
    return { last, byDim, worst };
  };

  function render(root) {
    pageHead(root, 'Bring Your Data', 'Upload a file with fields the bureau doesn\'t hold, such as sourcing channel, campaign, branch or collection agency. The platform joins it to industry benchmarks so you can see how each slice performs against the market, like for like.');
    const steps = h('div', 'steps', root);
    ['Upload', 'Map fields', 'Validate', 'Insights'].forEach((n, i) => { const s = h('div', 'step' + (step === i + 1 ? ' on' : ''), steps); h('b', null, s, String(i + 1)); h('span', null, s, n); });
    const privacy = h('div', 'callout okay', root);
    privacy.style.marginBottom = '16px';
    h('h4', null, privacy, '🔒 Your file never leaves this browser');
    h('p', null, privacy, 'In this prototype, parsing and joining happen on your device. In production, uploads live in the member\'s private tenant: they are encrypted, never pooled into industry data, and never visible to other members.');

    if (step === 1) {
      const drop = h('label', 'drop', root);
      h('div', null, drop, '⇪').style.fontSize = '28px';
      h('div', null, drop, 'Drop a CSV here or click to browse');
      h('div', 'small muted', drop, 'Needs: month, product, state, risk band, balance, 30+ DPD balance, plus any new field to analyse');
      const inp = h('input', null, drop); inp.type = 'file'; inp.accept = '.csv,text/csv'; inp.style.display = 'none';
      const load = (name, text) => { fileName = name; parsed = parseCSV(text); mapping = autoMap(parsed.head); step = 2; PIQ.go('upload'); };
      inp.addEventListener('change', () => { const f = inp.files[0]; if (f) f.text().then((t) => load(f.name, t)); });
      drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('over'));
      drop.addEventListener('drop', (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) f.text().then((t) => load(f.name, t)); });
      const row = h('div', null, root); row.style.cssText = 'display:flex;gap:10px;margin-top:14px;flex-wrap:wrap';
      const b1 = h('button', 'btn primary', row, 'Use the sample file (sourcing channel)');
      b1.addEventListener('click', () => load('sahyadri_pl_sourcing_channel.csv', PIQ.sampleUploadCSV()));
      const b2 = h('button', 'btn', row, 'Download sample CSV');
      b2.addEventListener('click', () => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([PIQ.sampleUploadCSV()], { type: 'text/csv' }));
        a.download = 'sahyadri_pl_sourcing_channel.csv'; a.click();
      });
      return;
    }
    if (step === 2) {
      const c = h('div', 'card', root);
      h('h3', null, c, `Map fields: ${fileName}`);
      h('div', 'sub muted small', c, `${parsed.rows.length.toLocaleString('en-IN')} rows · ${parsed.head.length} columns · fields detected automatically, adjust if needed`);
      const grid = h('div', null, c); grid.style.marginTop = '12px';
      FIELDS.forEach((f) => {
        const r = h('div', 'map-row', grid);
        h('div', null, r, f.name + (f.req ? ' *' : ''));
        const sel = h('select', null, r);
        sel.style.cssText = 'padding:6px;border:1px solid var(--border);border-radius:8px;background:var(--surface)';
        const none = h('option', null, sel, '— not mapped —'); none.value = '';
        parsed.head.forEach((col, i) => { const o = h('option', null, sel, col); o.value = i; if (mapping[f.id] === i) o.selected = true; });
        sel.addEventListener('change', () => { if (sel.value === '') delete mapping[f.id]; else mapping[f.id] = +sel.value; });
        h('div', 'small muted', r, mapping[f.id] != null ? 'e.g. ' + parsed.rows.slice(0, 3).map((x) => x[mapping[f.id]]).join(', ') : '');
      });
      const row = h('div', null, c); row.style.cssText = 'display:flex;gap:10px;margin-top:14px';
      const back = h('button', 'btn', row, '← Back'); back.addEventListener('click', () => { step = 1; PIQ.go('upload'); });
      const next = h('button', 'btn primary', row, 'Validate →');
      next.addEventListener('click', () => {
        const miss = FIELDS.filter((f) => f.req && mapping[f.id] == null);
        if (miss.length) { alert('Please map: ' + miss.map((m) => m.name).join(', ')); return; }
        step = 3; PIQ.go('upload');
      });
      return;
    }
    const res = analyse();
    if (step === 3) {
      const c = h('div', 'card', root);
      h('h3', null, c, 'Validation');
      const ok = res.recs.length, tot = parsed.rows.length;
      const g = h('div', 'grid g4', c); g.style.marginTop = '12px';
      [['Rows matched to bureau keys', fmt.int(ok) + ' / ' + fmt.int(tot)], ['Match rate', fmt.pct(ok / tot, 1)], ['Months covered', ml(res.months[0]) + ' – ' + ml(res.months[res.months.length - 1])], ['Balance covered (latest)', fmt.cr(res.recs.filter((r) => r.m === res.months[res.months.length - 1]).reduce((a, r) => a + r.bal, 0))]].forEach(([k, v]) => { const s = h('div', 'stat', g); h('div', 'stat-label', s, k); h('div', 'stat-value', s, v).style.fontSize = '20px'; });
      if (res.unmatched) h('p', 'small bad', c, `${res.unmatched} rows could not be matched (unknown state, band, product or month) and are excluded.`);
      const row = h('div', null, c); row.style.cssText = 'display:flex;gap:10px;margin-top:14px';
      const back = h('button', 'btn', row, '← Back'); back.addEventListener('click', () => { step = 2; PIQ.go('upload'); });
      const next = h('button', 'btn primary', row, 'Generate insights →'); next.addEventListener('click', () => { step = 4; PIQ.go('upload'); });
      return;
    }
    // step 4: insights
    const ins = PIQ.uploadInsights();
    const dimName = (PIQ.uploaded.dimName || 'segment').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
    const [wDim, wS, wB] = ins.worst.k.split('|');
    const top = h('div', 'callout danger', root);
    h('h4', null, top, `${wDim}-sourced ${wB === 'NPSB' ? 'near-prime & subprime' : 'prime'} loans in ${D.S[wS].name} run at ${ins.worst.idx.toFixed(2)}× the market's delinquency for the same segments`);
    h('p', null, top, `That's ${fmt.pct(ins.worst.a.d30 / ins.worst.a.bal)} 30+ DPD against an industry-expected ${fmt.pct(ins.worst.a.exp / ins.worst.a.bal)} on ${fmt.cr(ins.worst.a.bal)} of balance (${ml(ins.last)}). This explains the member-specific deterioration found in "Why did it change?", and the bureau could never have seen it without your channel field.`);
    const g = h('div', 'grid g2', root); g.style.marginTop = '16px';
    const dims = Object.keys(ins.byDim);
    const c1 = card(g, {
      title: `30+ DPD by ${dimName}`, sub: `${ml(ins.last)} · tick = industry rate for the same product/state/band mix`,
      source: 'Source: uploaded file (' + fileName + ') joined to ' + S.DATASETS.industry.name + ' · synthetic demo data',
      table: () => ({ cols: [{ name: dimName }, { name: 'Balance', r: 1 }, { name: 'Your 30+ DPD', r: 1 }, { name: 'Market-expected', r: 1 }, { name: 'Index', r: 1 }], rows: dims.map((d) => { const a = ins.byDim[d]; return [d, fmt.cr(a.bal), fmt.pct(a.d30 / a.bal), fmt.pct(a.exp / a.bal), (a.d30 / a.exp).toFixed(2) + '×']; }) })
    });
    PIQ.charts.bars(c1.viz, { items: dims.map((d) => ({ label: d, value: ins.byDim[d].d30 / ins.byDim[d].bal, ref: ins.byDim[d].exp / ins.byDim[d].bal })), fmt: (v) => fmt.pct(v), color: 'var(--s1)', valueName: 'Your 30+ DPD', refName: 'Market-expected' });

    const c2 = card(g, { title: `Performance index by ${dimName} × state`, sub: 'Actual ÷ market-expected 30+ DPD, near-prime & subprime only. Above 1.0 = worse than market', source: 'Source: uploaded file joined to industry · like-for-like' });
    const L = PIQ.uploaded.recs.filter((r) => r.m === ins.last && (r.b === 'NP' || r.b === 'SB'));
    const cells = groupBy(L, (r) => r.dim + '|' + r.s);
    const tb = h('table', 'tbl heat', h('div', 'table-wrap', c2.viz));
    const hr = h('tr', null, h('thead', null, tb));
    h('th', null, hr, dimName);
    D.STATES.forEach((s) => { const th = h('th', null, hr, s.id); th.style.textAlign = 'center'; th.title = s.name; });
    const body = h('tbody', null, tb);
    dims.forEach((d) => {
      const r = h('tr', null, body);
      h('td', null, r, d);
      D.STATES.forEach((s) => {
        const a = cells[d + '|' + s.id];
        const idx = a ? a.d30 / a.exp : null;
        const td = h('td', 'cell', r, idx ? idx.toFixed(2) + '×' : '—');
        if (idx) {
          const k = Math.min(1, Math.abs(Math.log(idx)) / Math.log(1.8));
          td.style.background = `color-mix(in oklab, ${idx > 1 ? 'var(--div-pos)' : 'var(--div-neg)'} ${Math.round(k * 85)}%, var(--div-mid))`;
          td.style.color = k > 0.55 ? '#fff' : 'var(--ink)';
        }
      });
    });
    const row = h('div', null, root); row.style.cssText = 'display:flex;gap:10px;margin-top:16px;flex-wrap:wrap';
    const ask = h('button', 'btn primary', row, '✦ Ask the AI about this file');
    ask.addEventListener('click', () => PIQ.openDrawer(`Which ${dimName.toLowerCase()} is performing worst in my uploaded file?`));
    const again = h('button', 'btn', row, 'Upload another file');
    again.addEventListener('click', () => { step = 1; parsed = null; PIQ.go('upload'); });
  }
  PIQ.views.upload = { title: 'Bring Your Data', render };
})();
