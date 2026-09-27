/* Shared UI helpers: formatting, cards with table twins, stat tiles, controls, global state. */
(function (root) {
  const PIQ = (root.PIQ = root.PIQ || {});
  const h = (tag, cls, parent, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  };
  // html() is used only with trusted, app-authored strings (never with user/LLM/CSV text)
  const html = (tag, cls, parent, markup) => { const e = h(tag, cls, parent); e.innerHTML = markup; return e; };

  const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
  const fmt = {
    pct: (v, d) => (v == null ? '—' : (v * 100).toFixed(d == null ? 2 : d) + '%'),
    pp: (v, d) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(d == null ? 2 : d) + ' pp'),
    bps: (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(Math.round(v * 10000)) + ' bps'),
    chg: (v, d) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(d == null ? 1 : d) + '%'),
    cr: (v) => {
      if (v == null) return '—';
      if (Math.abs(v) >= 100000) return '₹' + (v / 100000).toFixed(2) + ' L Cr';
      if (Math.abs(v) >= 1000) return '₹' + inr.format(Math.round(v)) + ' Cr';
      return '₹' + v.toFixed(v < 10 ? 2 : 1) + ' Cr';
    },
    count: (v) => {
      if (v == null) return '—';
      if (v >= 1e7) return (v / 1e7).toFixed(2) + ' Cr';
      if (v >= 1e5) return (v / 1e5).toFixed(1) + ' L';
      if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
      return Math.round(v).toString();
    },
    int: (v) => inr.format(Math.round(v)),
    metric: (id, v) => {
      const M = PIQ.sem.METRICS[id];
      return M.unit === 'pct' ? fmt.pct(v) : M.unit === 'cr' ? fmt.cr(v) : fmt.count(v);
    },
    metricTick: (id) => {
      const M = PIQ.sem.METRICS[id];
      return M.unit === 'pct' ? (v) => (v * 100).toFixed(v * 100 < 10 ? 1 : 0) + '%' : M.unit === 'cr' ? (v) => (v >= 100000 ? (v / 100000).toFixed(1) + 'L' : v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v.toFixed(0)) : fmt.count;
    },
    delta: (id, d) => {
      const M = PIQ.sem.METRICS[id];
      return M.unit === 'pct' ? fmt.pp(d) : fmt.chg(d);
    },
    day: (d) => { const x = new Date(d + 'T00:00:00Z'); return x.getUTCDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][x.getUTCMonth()]; }
  };
  const ml = (m) => PIQ.data.monthLabel(m);

  // --- global filter state (product + state) shared by all views ---
  // Default: the member's entire portfolio (all products, all states), 30+ DPD
  const state = { p: 'ALL', s: 'ALL', peer: 'mid-pvt', dpd: 'dpd30' };
  const subs = [];
  function setState(patch) { Object.assign(state, patch); subs.forEach((f) => f(state)); }
  function onState(f) { subs.push(f); }

  // --- controls ---
  function select(parent, label, options, value, onChange) {
    const f = h('div', 'field', parent);
    h('label', null, f, label);
    const s = h('select', null, f);
    options.forEach((o) => { const op = h('option', null, s, o.name); op.value = o.id; if (o.id === value) op.selected = true; });
    s.addEventListener('change', () => onChange(s.value));
    return s;
  }
  function seg(parent, label, options, value, onChange) {
    const f = h('div', 'field', parent);
    if (label) h('label', null, f, label);
    const g = h('div', 'seg', f);
    options.forEach((o) => {
      const b = h('button', o.id === value ? 'on' : '', g, o.name);
      b.type = 'button';
      b.addEventListener('click', () => { g.querySelectorAll('button').forEach((x) => x.classList.remove('on')); b.classList.add('on'); onChange(o.id); });
    });
    return g;
  }
  const productOptions = (withAll) => (withAll === false ? [] : [{ id: 'ALL', name: 'All products' }]).concat(PIQ.data.PRODUCTS.map((p) => ({ id: p.id, name: p.name })));
  const stateOptions = () => [{ id: 'ALL', name: 'All states' }].concat(PIQ.data.STATES.map((s) => ({ id: s.id, name: s.name })));
  // opts: { state: false } hides the state picker; { dpd: true } shows the 30+/90+/180+ switch;
  // { allProducts: false } forces a single product (e.g. the policy simulator)
  function productStateFilters(parent, opts) {
    opts = opts || {};
    const bar = h('div', 'filters', parent);
    const pv = opts.allProducts === false && state.p === 'ALL' ? 'PL' : state.p;
    select(bar, 'Product', productOptions(opts.allProducts), pv, (v) => setState({ p: v }));
    if (opts.state !== false) select(bar, 'State', stateOptions(), state.s, (v) => setState({ s: v }));
    if (opts.dpd) seg(bar, 'Delinquency', PIQ.sem.DPD_METRICS.map((id) => ({ id, name: PIQ.sem.METRICS[id].short.replace(' DPD', '') })), state.dpd, (v) => setState({ dpd: v }));
    return bar;
  }

  // --- card with optional table twin ---
  function card(parent, o) {
    const c = h('div', 'card' + (o.cls ? ' ' + o.cls : ''), parent);
    const head = h('div', 'card-head', c);
    const t = h('div', null, head);
    h('h3', null, t, o.title);
    if (o.sub) h('div', 'sub', t, o.sub);
    const tools = h('div', 'card-tools', head);
    const body = h('div', 'card-body', c);
    const viz = h('div', 'viz', body);
    let tblBox;
    if (o.table) {
      const b = h('button', 'btn sm', tools, 'Table');
      b.type = 'button';
      b.title = 'Show the data behind this chart';
      tblBox = h('div', 'table-wrap', body);
      tblBox.style.display = 'none';
      b.addEventListener('click', () => {
        const show = tblBox.style.display === 'none';
        tblBox.style.display = show ? '' : 'none';
        viz.style.display = show ? 'none' : '';
        b.textContent = show ? 'Chart' : 'Table';
        if (show) { tblBox.innerHTML = ''; table(tblBox, o.table()); }
      });
    }
    if (o.source) h('div', 'source', c, o.source);
    return { el: c, body, viz, tools, head };
  }
  function table(parent, spec) {
    const t = h('table', 'tbl', parent);
    const tr = h('tr', null, h('thead', null, t));
    spec.cols.forEach((col) => h('th', col.r ? 'r' : '', tr, col.name));
    const tb = h('tbody', null, t);
    spec.rows.forEach((row) => {
      const r = h('tr', null, tb);
      row.forEach((v, i) => h('td', spec.cols[i].r ? 'r' : '', r, v));
    });
    return t;
  }
  function stat(parent, o) {
    const c = h('div', 'card stat', parent);
    h('div', 'stat-label', c, o.label);
    const row = h('div', 'stat-row', c);
    const left = h('div', null, row);
    h('div', 'stat-value', left, o.value);
    if (o.delta) {
      const d = h('div', 'stat-delta ' + (o.deltaTone || ''), left, o.delta);
      if (o.deltaNote) h('span', 'muted', d, ' ' + o.deltaNote);
    }
    if (o.spark) { const sp = h('div', null, row); PIQ.charts.spark(sp, o.spark, o.sparkColor); }
    return c;
  }
  const tone = (metricId, delta) => {
    const M = PIQ.sem.METRICS[metricId];
    if (!delta) return '';
    return (delta > 0) === M.bad ? 'bad' : 'good';
  };
  function sourceText(ds, extra) {
    const S = PIQ.sem.DATASETS;
    return 'Source: ' + ds.map((k) => S[k].name).join(' + ') + ' · as of ' + S[ds[0]].asOf + (extra ? ' · ' + extra : '') + ' · synthetic demo data';
  }
  function pageHead(parent, title, desc, right) {
    const ph = h('div', 'page-head', parent);
    const t = h('div', null, ph);
    h('h1', null, t, title);
    if (desc) h('p', null, t, desc);
    if (right) { const r = h('div', null, ph); r.style.marginLeft = 'auto'; right(r); }
    return ph;
  }
  const stateName = (s) => (s === 'ALL' || !s ? 'All states' : PIQ.data.S[s].name);
  const prodName = (p) => (p === 'ALL' || !p ? 'All products' : PIQ.data.P[p].name);
  const prodLong = (p) => (p === 'ALL' || !p ? 'Total portfolio' : PIQ.data.P[p].long);

  PIQ.ui = { h, html, fmt, ml, state, setState, onState, select, seg, productStateFilters, productOptions, stateOptions, card, table, stat, tone, sourceText, pageHead, stateName, prodName, prodLong };
})(window);
