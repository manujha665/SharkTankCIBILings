/* Bring Your Data — upload a member file, map fields, join with industry, get new insights. */
(function () {
  const PIQ = window.PIQ;
  const { h, fmt, ml, card, stat, sourceText, pageHead } = PIQ.ui;
  const S = PIQ.sem, D = PIQ.data;
  let parsed = null, mapping = null, step = 0, fileName = '';

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

  // ---------- Portfolio Review (PR) uploads + custom files ----------
  // kind: null (choose) | 'consumer' | 'commercial' | 'mfi' | 'mfiConsumer' | 'custom'
  let kind = null, prRes = null;
  const CUSTOM = { id: 'custom', label: 'Custom file', icon: '⇪', file: 'sahyadri_pl_sourcing_channel.csv', fields: FIELDS, blurb: 'Any file with a field the bureau doesn\'t hold (sourcing channel, campaign, branch), joined to industry benchmarks.' };
  const typeOf = () => (kind === 'custom' ? CUSTOM : PIQ.pr.TYPES[kind]);
  const sampleOf = () => (kind === 'custom' ? PIQ.sampleUploadCSV() : typeOf().sample());
  const autoMapFor = (head, fields) => {
    const used = new Set(), m = {};
    fields.forEach((f) => { const idx = head.findIndex((c, i) => !used.has(i) && f.guess.test(c)); if (idx >= 0) { m[f.id] = idx; used.add(idx); } });
    return m;
  };
  function load(name, text) {
    fileName = name;
    parsed = parseCSV(text);
    mapping = autoMapFor(parsed.head, typeOf().fields);
    step = 2;
    PIQ.go('upload');
  }
  function download(name, text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
    a.download = name; a.click();
  }

  function render(root) {
    pageHead(root, 'Bring Your Data', 'Upload a bureau Portfolio Review (PR) output and get insights computed from that file alone. Pick the PR type first, so the platform knows the layout and which analysis to run.');
    const steps = h('div', 'steps', root);
    ['Choose PR type', 'Upload', 'Map fields', 'Validate & submit', 'Insights'].forEach((n, i) => { const st = h('div', 'step' + (step === i ? ' on' : ''), steps); h('b', null, st, String(i + 1)); h('span', null, st, n); });
    const privacy = h('div', 'callout okay', root);
    privacy.style.marginBottom = '16px';
    h('h4', null, privacy, '🔒 Your file never leaves this browser');
    h('p', null, privacy, 'In this prototype, parsing and analysis happen on your device. In production, uploads live in the member\'s private tenant: they are encrypted, never pooled into industry data, and never visible to other members.');

    if (step === 0 || !kind) {
      step = 0;
      h('div', 'section-title', root, 'What are you uploading?');
      const g = h('div', 'grid g4 pr-pick', root);
      PIQ.pr.ORDER.forEach((k) => {
        const T = PIQ.pr.TYPES[k];
        const b = h('button', 'pr-btn', g);
        b.type = 'button';
        h('span', 'pr-ico', b, T.icon);
        h('strong', null, b, T.label);
        h('span', 'small muted', b, T.blurb);
        h('span', 'pr-go', b, 'Upload ' + T.label + ' →');
        b.addEventListener('click', () => { kind = k; step = 1; PIQ.go('upload'); });
      });
      const other = h('div', 'card', root);
      other.style.marginTop = '16px';
      h('h3', null, other, 'Other data: a file with a new field');
      h('p', 'small muted', other, CUSTOM.blurb + ' Example: your personal-loan sourcing channel, benchmarked against the market like for like.');
      const ob = h('button', 'btn', other, 'Upload a custom file (e.g. sourcing channel) →');
      ob.addEventListener('click', () => { kind = 'custom'; step = 1; PIQ.go('upload'); });
      return;
    }
    const T = typeOf();

    if (step === 1) {
      const hd = h('div', 'pr-head', root);
      h('span', 'pr-ico', hd, T.icon);
      const tx = h('div', null, hd);
      h('h3', null, tx, 'Upload: ' + T.label);
      h('div', 'small muted', tx, T.blurb);
      const ch = h('button', 'btn sm', hd, '← Choose another type');
      ch.addEventListener('click', () => { kind = null; step = 0; PIQ.go('upload'); });
      const drop = h('label', 'drop', root);
      h('div', null, drop, '⇪').style.fontSize = '28px';
      h('div', null, drop, `Drop your ${T.label} output (CSV) here or click to browse`);
      h('div', 'small muted', drop, 'Expected columns: ' + T.fields.map((f) => f.name + (f.req ? '' : ' (optional)')).join(' · '));
      const inp = h('input', null, drop); inp.type = 'file'; inp.accept = '.csv,text/csv'; inp.style.display = 'none';
      inp.addEventListener('change', () => { const f = inp.files[0]; if (f) f.text().then((t) => load(f.name, t)); });
      drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('over'));
      drop.addEventListener('drop', (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) f.text().then((t) => load(f.name, t)); });
      const row = h('div', null, root); row.style.cssText = 'display:flex;gap:10px;margin-top:14px;flex-wrap:wrap';
      const b1 = h('button', 'btn primary', row, kind === 'custom' ? 'Use the sample file (sourcing channel)' : `Use the sample ${T.label}`);
      b1.addEventListener('click', () => load(T.file, sampleOf()));
      const b2 = h('button', 'btn', row, kind === 'custom' ? 'Download sample CSV' : `Download sample ${T.label} (CSV)`);
      b2.addEventListener('click', () => download(T.file, sampleOf()));
      return;
    }
    if (step === 2) {
      const c = h('div', 'card', root);
      h('h3', null, c, `Map fields: ${fileName}`);
      h('div', 'sub muted small', c, `${T.label} · ${parsed.rows.length.toLocaleString('en-IN')} rows · ${parsed.head.length} columns · fields detected automatically, adjust if needed`);
      const grid = h('div', null, c); grid.style.marginTop = '12px';
      T.fields.forEach((f) => {
        const r = h('div', 'map-row', grid);
        h('div', null, r, f.name + (f.req ? ' *' : ''));
        const sel = h('select', null, r);
        sel.style.cssText = 'padding:6px;border:1px solid var(--border);border-radius:8px;background:var(--surface)';
        sel.setAttribute('aria-label', 'Column for ' + f.name);
        const none = h('option', null, sel, '— not mapped —'); none.value = '';
        parsed.head.forEach((col, i) => { const o = h('option', null, sel, col); o.value = i; if (mapping[f.id] === i) o.selected = true; });
        sel.addEventListener('change', () => { if (sel.value === '') delete mapping[f.id]; else mapping[f.id] = +sel.value; });
        h('div', 'small muted', r, mapping[f.id] != null ? 'e.g. ' + parsed.rows.slice(0, 3).map((x) => x[mapping[f.id]]).join(', ') : '');
      });
      const row = h('div', null, c); row.style.cssText = 'display:flex;gap:10px;margin-top:14px';
      const back = h('button', 'btn', row, '← Back'); back.addEventListener('click', () => { step = 1; PIQ.go('upload'); });
      const next = h('button', 'btn primary', row, 'Validate →');
      next.addEventListener('click', () => {
        const miss = T.fields.filter((f) => f.req && mapping[f.id] == null);
        if (miss.length) { alert('Please map: ' + miss.map((m) => m.name).join(', ')); return; }
        step = 3; PIQ.go('upload');
      });
      return;
    }
    if (kind !== 'custom') return renderPR(root, T);
    const res = analyse();
    PIQ.lastUpload = 'custom';
    if (step === 3) {
      const c = h('div', 'card', root);
      h('h3', null, c, 'Validation');
      const ok = res.recs.length, tot = parsed.rows.length;
      const g = h('div', 'grid g4', c); g.style.marginTop = '12px';
      [['Rows matched to bureau keys', fmt.int(ok) + ' / ' + fmt.int(tot)], ['Match rate', fmt.pct(ok / tot, 1)], ['Months covered', ml(res.months[0]) + ' – ' + ml(res.months[res.months.length - 1])], ['Balance covered (latest)', fmt.cr(res.recs.filter((r) => r.m === res.months[res.months.length - 1]).reduce((a, r) => a + r.bal, 0))]].forEach(([k, v]) => { const st = h('div', 'stat', g); h('div', 'stat-label', st, k); h('div', 'stat-value', st, v).style.fontSize = '20px'; });
      if (res.unmatched) h('p', 'small bad', c, `${res.unmatched} rows could not be matched (unknown state, band, product or month) and are excluded.`);
      const row = h('div', null, c); row.style.cssText = 'display:flex;gap:10px;margin-top:14px';
      const back = h('button', 'btn', row, '← Back'); back.addEventListener('click', () => { step = 2; PIQ.go('upload'); });
      const next = h('button', 'btn primary', row, 'Generate insights →'); next.addEventListener('click', () => { step = 4; PIQ.go('upload'); });
      return;
    }
    customInsights(root);
  }

  // PR: validate, submit, then insights from the uploaded file only
  function renderPR(root, T) {
    const tr = PIQ.pr.toRecords(T, parsed.rows, mapping);
    const months = [...new Set(tr.recs.map((r) => r.m))].sort();
    if (step === 3) {
      const c = h('div', 'card', root);
      h('h3', null, c, `Validation: ${T.label}`);
      const ok = tr.recs.length, tot = parsed.rows.length;
      const g = h('div', 'grid g4', c); g.style.marginTop = '12px';
      [['Valid rows', fmt.int(ok) + ' / ' + fmt.int(tot)], ['Valid share', fmt.pct(tot ? ok / tot : 0, 1)], ['Months covered', months.length ? `${ml(months[0])} – ${ml(months[months.length - 1])} (${months.length})` : '—'], ['Fields mapped', `${Object.keys(mapping).length} of ${T.fields.length}`]].forEach(([k, v]) => { const st = h('div', 'stat', g); h('div', 'stat-label', st, k); h('div', 'stat-value', st, v).style.fontSize = '20px'; });
      const issues = [];
      if (tr.bad.month) issues.push(`${fmt.int(tr.bad.month)} rows with a month that isn't YYYY-MM`);
      if (tr.bad.number) issues.push(`${fmt.int(tr.bad.number)} rows with a missing or negative number`);
      if (tr.bad.blank) issues.push(`${fmt.int(tr.bad.blank)} rows with a blank category`);
      if (issues.length) h('p', 'small bad', c, issues.join(' · ') + '. These rows are excluded.');
      if (tr.unknownStates.length) h('p', 'small muted', c, `Kept as written (not a recognised state name): ${tr.unknownStates.slice(0, 6).join(', ')}${tr.unknownStates.length > 6 ? '…' : ''}.`);
      if (months.length < 2) h('p', 'small bad', c, 'The file needs at least two months to show trends.');
      const row = h('div', null, c); row.style.cssText = 'display:flex;gap:10px;margin-top:14px';
      const back = h('button', 'btn', row, '← Back'); back.addEventListener('click', () => { step = 2; PIQ.go('upload'); });
      const next = h('button', 'btn primary', row, 'Submit & analyse →');
      next.disabled = !ok || months.length < 2;
      next.addEventListener('click', () => {
        prRes = T.analyse(tr.recs);
        PIQ.uploadedPR = { kind, label: T.label, name: fileName, rows: tr.recs.length, months, analysis: prRes };
        PIQ.lastUpload = 'pr';
        S.log('upload.pr', { type: T.label, file: fileName, rows: tr.recs.length });
        step = 4; PIQ.go('upload');
      });
      return;
    }
    const A = prRes || (PIQ.uploadedPR && PIQ.uploadedPR.kind === kind ? PIQ.uploadedPR.analysis : T.analyse(tr.recs));
    const src = `Source: your uploaded ${T.label} (${fileName}) only · no other data used`;
    const meta = h('div', 'small muted', root, `${T.icon} ${T.label} · ${fileName} · ${fmt.int(tr.recs.length)} rows · ${months.length ? ml(months[0]) + ' – ' + ml(months[months.length - 1]) : ''} · insights computed only from this file`);
    meta.style.marginBottom = '10px';
    if (A.headline) {
      const top = h('div', 'callout ' + A.headline.tone, root);
      const th = h('div', null, top); th.style.cssText = 'display:flex;gap:10px;justify-content:space-between;align-items:flex-start';
      h('h4', null, th, A.headline.title);
      if (PIQ.actions) PIQ.actions.pinButton(th, () => ({ text: A.headline.title, detail: A.headline.text + ' (' + T.label + ')' }));
      h('p', null, top, A.headline.text);
    }
    const sg = h('div', 'grid g4', root); sg.style.marginTop = '16px';
    A.stats.forEach((x) => stat(sg, { label: x.label, value: x.value, delta: x.note, deltaTone: x.bad ? 'bad' : '' }));
    const cg = h('div', 'grid g2', root); cg.style.marginTop = '16px';
    const COL = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)'];
    const vf = (k) => (k === 'pct0' ? (v) => fmt.pct(v, 0) : k === 'cr' ? fmt.cr : (v) => fmt.pct(v));
    A.charts.forEach((ch) => {
      const c = card(cg, { title: ch.title, sub: ch.sub, source: src });
      if (ch.type === 'line') PIQ.charts.line(c.viz, { series: ch.series.map((x, i) => ({ name: x.name, color: COL[i % 4], points: x.points })), xLabel: (x) => ml(x), yFmt: (v) => fmt.pct(v), yTickFmt: (v) => (v * 100).toFixed(1) + '%', height: 240, endLabels: true, zero: true });
      else PIQ.charts.bars(c.viz, Object.assign({ items: ch.items.map((x) => (x.ref == null ? { label: x.label, value: x.value } : x)), fmt: vf(ch.fmt), color: 'var(--s1)', valueName: ch.valueName }, ch.refName ? { refName: ch.refName } : {}));
    });
    if (A.findings.length) {
      h('div', 'section-title', root, 'What the file says').style.marginTop = '22px';
      const fg = h('div', 'grid g2', root);
      A.findings.forEach((f) => { const d = h('div', 'callout ' + f.tone, fg); h('h4', null, d, f.title); h('p', null, d, f.text); });
    }
    A.tables.forEach((tb) => {
      const c = card(root, { title: tb.title, sub: tb.sub, source: src });
      c.el.style.marginTop = '16px';
      const t = h('table', 'tbl', h('div', 'table-wrap', c.viz));
      const hr = h('tr', null, h('thead', null, t));
      tb.cols.forEach((x, i) => h('th', i ? 'r' : '', hr, x));
      const body = h('tbody', null, t);
      tb.rows.forEach((r) => { const tr2 = h('tr', null, body); r.forEach((v, i) => { const o = v && typeof v === 'object' ? v : { v }; h('td', (i ? 'r' : '') + (o.bad ? ' bad' : o.good ? ' good' : ''), tr2, o.v); }); });
    });
    const row = h('div', null, root); row.style.cssText = 'display:flex;gap:10px;margin-top:16px;flex-wrap:wrap';
    const ask = h('button', 'btn primary', row, '✦ Ask the AI about this file');
    ask.addEventListener('click', () => PIQ.openDrawer(`What does my uploaded ${T.label} say?`));
    const again = h('button', 'btn', row, 'Upload another file');
    again.addEventListener('click', () => { kind = null; step = 0; parsed = null; prRes = null; PIQ.go('upload'); });
  }

  // Custom file (e.g. sourcing channel) joined to industry benchmarks
  function customInsights(root) {
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

    const c2 = card(g, { title: `Performance index by ${dimName} × state`, sub: 'Actual ÷ market-expected 30+ DPD, near-prime & subprime, your 8 largest states. Above 1.0 = worse than market', source: 'Source: uploaded file joined to industry · like-for-like' });
    const L = PIQ.uploaded.recs.filter((r) => r.m === ins.last && (r.b === 'NP' || r.b === 'SB'));
    const cells = groupBy(L, (r) => r.dim + '|' + r.s);
    const tb = h('table', 'tbl heat', h('div', 'table-wrap', c2.viz));
    const hr = h('tr', null, h('thead', null, tb));
    h('th', null, hr, dimName);
    const balBy = groupBy(L, (r) => r.s);
    const topS = D.STATES.filter((s) => balBy[s.id]).sort((a, b) => balBy[b.id].bal - balBy[a.id].bal).slice(0, 8);
    topS.forEach((s) => { const th = h('th', null, hr, s.id); th.style.textAlign = 'center'; th.title = s.name; });
    const body = h('tbody', null, tb);
    dims.forEach((d) => {
      const r = h('tr', null, body);
      h('td', null, r, d);
      topS.forEach((s) => {
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
    again.addEventListener('click', () => { kind = null; step = 0; parsed = null; PIQ.go('upload'); });
  }

  // Jump straight to a sample's insights (used by the guided tour)
  function demo(k) {
    kind = k || 'custom';
    const T = typeOf();
    fileName = T.file; parsed = parseCSV(sampleOf()); mapping = autoMapFor(parsed.head, T.fields);
    if (kind !== 'custom') {
      const tr = PIQ.pr.toRecords(T, parsed.rows, mapping);
      prRes = T.analyse(tr.recs);
      PIQ.uploadedPR = { kind, label: T.label, name: fileName, rows: tr.recs.length, months: [...new Set(tr.recs.map((r) => r.m))].sort(), analysis: prRes };
      PIQ.lastUpload = 'pr';
    }
    step = 4;
    PIQ.go('upload');
  }

  PIQ.views.upload = { title: 'Bring Your Data', render, demo };
})();
