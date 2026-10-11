/*
 * Current score cut-offs by product × state (the member's credit policy grid).
 * Defaults come from config (one cut-off per product); the member can override any product/state
 * cell by typing in the grid or by importing a CSV. Overrides are kept in this browser
 * (localStorage) in the prototype; in production they live in the member's private tenant.
 */
(function () {
  const PIQ = window.PIQ;
  const D = PIQ.data, C = PIQ.config;
  const KEY = 'piq-cutoffs-v1';
  const MIN = 300, MAX = 900;
  let over = {}; // { 'PL|UP': 700 }
  try { over = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { over = {}; }
  const listeners = [];
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(over)); } catch (e) { /* private mode: keep in memory */ }
    listeners.forEach((f) => f());
  };

  const def = (p) => C.currentCutoff[p];
  const get = (p, s) => (s && s !== 'ALL' && over[p + '|' + s] != null ? over[p + '|' + s] : def(p));
  const isCustom = (p, s) => over[p + '|' + s] != null && over[p + '|' + s] !== def(p);
  const varies = (p) => D.STATES.some((st) => get(p, st.id) !== def(p));
  const fn = (p) => (st) => get(p, st); // per-state cut-off function for the simulator
  const valid = (v) => Number.isFinite(v) && v >= MIN && v <= MAX;

  function set(p, s, v, quiet) {
    v = Math.round(+v);
    if (!valid(v)) return false;
    if (v === def(p)) delete over[p + '|' + s]; else over[p + '|' + s] = v;
    if (!quiet) { save(); log(p, s, v); }
    return true;
  }
  function setProduct(p, v) {
    v = Math.round(+v);
    if (!valid(v)) return false;
    D.STATES.forEach((st) => set(p, st.id, v, true));
    save(); log(p, 'ALL', v);
    return true;
  }
  function reset() { over = {}; save(); log('ALL', 'ALL', 'defaults'); }
  const log = (p, s, v) => { if (PIQ.sem) PIQ.sem.log('cutoffs.update', { p, s, cutoff: v }); };
  const count = () => Object.keys(over).length;

  // ---- CSV in / out ----
  const norm = (x) => String(x == null ? '' : x).trim().toLowerCase().replace(/\s+/g, ' ');
  const findProd = (v) => D.PRODUCTS.find((p) => [p.id, p.name, p.long].some((x) => norm(x) === norm(v)));
  const isAll = (v) => /^(all|all states|\*|india|national)$/.test(norm(v));
  const findState = (v) => D.STATES.find((s) => norm(s.id) === norm(v) || norm(s.name) === norm(v) || norm(s.name).replace(/ states$/, '') === norm(v));
  function rows(text) {
    return String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => l.split(/[,;\t]/).map((x) => x.trim().replace(/^"|"$/g, '')));
  }
  // Accepts two layouts:
  //  long: product,state,cutoff   (one row per cell; state "All" sets every state for that product)
  //  wide: state,PL,CC,HL,...     (one row per state, one column per product; a row "All" sets the product default for all states)
  function importCSV(text) {
    const r = rows(text);
    if (!r.length) return { ok: 0, errors: ['The file is empty.'] };
    const head = r[0].map(norm);
    const errors = [];
    let ok = 0;
    const apply = (p, sv, v, line) => {
      const n = Math.round(+v);
      if (!valid(n)) { errors.push(`Line ${line}: cut-off "${v}" must be a number between ${MIN} and ${MAX}`); return; }
      if (isAll(sv)) { D.STATES.forEach((st) => set(p.id, st.id, n, true)); ok += D.STATES.length; return; }
      const st = findState(sv);
      if (!st) { errors.push(`Line ${line}: unknown state "${sv}"`); return; }
      set(p.id, st.id, n, true); ok++;
    };
    const prodCols = head.map((x) => findProd(x));
    if (head[0] === 'state' || head[0] === 'region' || prodCols.filter(Boolean).length >= 2) {
      r.slice(1).forEach((row, i) => {
        row.slice(1).forEach((v, j) => {
          const p = prodCols[j + 1];
          if (!p || v === '') return;
          apply(p, row[0], v, i + 2);
        });
      });
    } else {
      const hasHead = !findProd(r[0][0]);
      const ci = hasHead ? { p: head.findIndex((x) => /product/.test(x)), s: head.findIndex((x) => /state|region/.test(x)), c: head.findIndex((x) => /cut|score|min/.test(x)) } : { p: 0, s: 1, c: 2 };
      if (ci.p < 0 || ci.s < 0 || ci.c < 0) return { ok: 0, errors: ['Columns not recognised. Use "product,state,cutoff" or "state,PL,CC,…" (see the template).'] };
      r.slice(hasHead ? 1 : 0).forEach((row, i) => {
        const line = i + (hasHead ? 2 : 1);
        const p = findProd(row[ci.p]);
        if (!p) { errors.push(`Line ${line}: unknown product "${row[ci.p]}"`); return; }
        apply(p, row[ci.s], row[ci.c], line);
      });
    }
    if (ok) { save(); log('import', 'ALL', ok + ' cells'); }
    return { ok, errors };
  }
  function templateCSV() {
    const lines = [['state'].concat(D.PRODUCTS.map((p) => p.id)).join(',')];
    D.STATES.forEach((st) => lines.push(['"' + st.name + '"'].concat(D.PRODUCTS.map((p) => get(p.id, st.id))).join(',')));
    return lines.join('\n');
  }

  PIQ.cutoffs = { MIN, MAX, def, get, set, setProduct, reset, isCustom, varies, fn, count, importCSV, templateCSV, onChange: (f) => listeners.push(f) };
})();
