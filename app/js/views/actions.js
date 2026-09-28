/* Action Board — everything the user pinned from any module, with owner, due date and status. */
(function () {
  const PIQ = window.PIQ;
  const { h, pageHead, prodName, stateName } = PIQ.ui;
  const S = PIQ.sem, C = PIQ.config;
  const STATUSES = ['Open', 'In progress', 'Done'], PRIORITIES = ['High', 'Medium', 'Low'];
  let fStatus = 'active', fModule = 'ALL', fPriority = 'ALL';

  const when = (iso) => { const d = new Date(iso); return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); };
  const ctx = (it) => [it.viewTitle || it.view, prodName(it.p), stateName(it.s), it.dpd ? S.METRICS[it.dpd].short : null].filter(Boolean).join(' · ');

  function exportCsv(list) {
    const cols = ['Action', 'Detail', 'Priority', 'Status', 'Owner', 'Due', 'Note', 'Source module', 'Product', 'State', 'Captured'];
    const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const rows = list.map((x) => [x.text, x.detail, x.priority, x.status, x.owner, x.due, x.note, x.viewTitle || x.view, prodName(x.p), stateName(x.s), x.created].map(esc).join(','));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([cols.join(',') + '\n' + rows.join('\n')], { type: 'text/csv' }));
    a.download = 'portfolioiq_action_board.csv';
    a.click();
  }
  function select(parent, options, value, onChange, cls) {
    const s = h('select', cls || 'mini', parent);
    options.forEach((o) => { const op = h('option', null, s, o.name || o); op.value = o.id || o; if ((o.id || o) === value) op.selected = true; });
    s.addEventListener('change', () => onChange(s.value));
    return s;
  }

  function render(root) {
    const A = PIQ.actions;
    const all = A.all();
    pageHead(root, 'Action Board', 'Everything you flagged while going through the dashboards, in one place. Pin items with the 📌 buttons, or right-click any card, tile, alert or AI answer and choose "Send to Action Board". Highlight text first to send just that.');

    const counts = STATUSES.map((s) => all.filter((x) => x.status === s).length);
    const tiles = h('div', 'grid g4', root);
    [['Open', counts[0]], ['In progress', counts[1]], ['Done', counts[2]], ['High priority, not done', all.filter((x) => x.priority === 'High' && x.status !== 'Done').length]].forEach(([l, v]) => { const c = h('div', 'card stat', tiles); h('div', 'stat-label', c, l); h('div', 'stat-value', c, String(v)); });

    const bar = h('div', 'filters', root);
    bar.style.marginTop = '16px';
    const fld = (label) => { const f = h('div', 'field', bar); h('label', null, f, label); return f; };
    select(fld('Status'), [{ id: 'active', name: 'Open + in progress' }, { id: 'ALL', name: 'All' }].concat(STATUSES.map((s) => ({ id: s, name: s }))), fStatus, (v) => { fStatus = v; PIQ.go('actions'); });
    const mods = [...new Set(all.map((x) => x.view))];
    select(fld('Source module'), [{ id: 'ALL', name: 'All modules' }].concat(mods.map((m) => ({ id: m, name: (PIQ.views[m] || {}).title || m }))), fModule, (v) => { fModule = v; PIQ.go('actions'); });
    select(fld('Priority'), [{ id: 'ALL', name: 'All' }].concat(PRIORITIES.map((p) => ({ id: p, name: p }))), fPriority, (v) => { fPriority = v; PIQ.go('actions'); });
    const btns = h('div', null, bar);
    btns.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-left:auto;align-self:flex-end';
    const addB = h('button', 'btn', btns, '+ Add action');
    addB.addEventListener('click', () => { const t = prompt('New action'); if (t) { A.add(t, '', { view: 'actions', viewTitle: 'Added manually' }); PIQ.go('actions'); } });
    const recB = h('button', 'btn', btns, '✦ Add recommended actions');
    recB.title = 'Pull the platform\'s ranked recommendations onto the board';
    recB.addEventListener('click', () => {
      PIQ.insights.recommendations('ALL').forEach((r, i) => A.add(r.title, r.why + ' Impact: ' + r.impact.map(([k, v]) => k + ' ' + v).join('; '), { view: r.action.view, viewTitle: 'Recommendation', p: r.action.params.p || r.p || 'ALL', s: r.action.params.s || 'ALL', priority: i < 2 ? 'High' : 'Medium' }));
      PIQ.go('actions');
    });
    const csv = h('button', 'btn', btns, '⇩ Export CSV');
    const pr = h('button', 'btn', btns, '⎙ Print');
    pr.addEventListener('click', () => window.print());

    const list = all.filter((x) => (fStatus === 'ALL' || (fStatus === 'active' ? x.status !== 'Done' : x.status === fStatus)) && (fModule === 'ALL' || x.view === fModule) && (fPriority === 'ALL' || x.priority === fPriority))
      .sort((a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority) || (a.created < b.created ? 1 : -1));
    csv.addEventListener('click', () => exportCsv(list));

    const board = h('div', 'action-board', root);
    if (!all.length) {
      const e = h('div', 'card empty', board);
      h('h3', null, e, 'Your Action Board is empty');
      h('p', 'muted', e, 'Go through any dashboard and press 📌 on a card, recommendation, alert or AI answer, or right-click it and choose "Send to Action Board". Or start with the platform\'s own recommendations:');
      const b = h('button', 'btn primary', e, '✦ Add recommended actions');
      b.addEventListener('click', () => recB.click());
      return;
    }
    if (!list.length) { h('div', 'card empty', board, 'Nothing matches these filters.'); }
    list.forEach((it) => {
      const c = h('div', 'card action-item' + (it.status === 'Done' ? ' done' : ''), board);
      const top = h('div', 'action-top', c);
      const chk = h('input', null, top);
      chk.type = 'checkbox'; chk.checked = it.status === 'Done'; chk.title = 'Mark done';
      chk.addEventListener('change', () => { A.update(it.id, { status: chk.checked ? 'Done' : 'Open' }); PIQ.go('actions'); });
      const main = h('div', 'action-main', top);
      const title = h('div', 'action-text', main, it.text);
      title.contentEditable = 'true';
      title.spellcheck = false;
      title.addEventListener('blur', () => { const v = title.textContent.trim(); if (v && v !== it.text) A.update(it.id, { text: v }); });
      if (it.detail) h('div', 'action-detail', main, it.detail);
      const meta = h('div', 'action-meta', main);
      h('span', 'tag prio-' + it.priority.toLowerCase(), meta, it.priority);
      h('span', 'src-chip', meta, '⛁ ' + ctx(it));
      h('span', 'muted small', meta, 'Captured ' + when(it.created));
      const act = h('div', 'action-btns', top);
      const open = h('button', 'btn sm', act, 'Open source →');
      open.addEventListener('click', () => PIQ.go(PIQ.views[it.view] ? it.view : 'overview', { p: it.p, s: it.s }));
      const del = h('button', 'icon-btn', act, '✕');
      del.title = 'Remove'; del.setAttribute('aria-label', 'Remove action');
      del.addEventListener('click', () => { A.remove(it.id); PIQ.go('actions'); });

      const row = h('div', 'action-fields', c);
      const f = (label) => { const w = h('label', 'afield', row); h('span', null, w, label); return w; };
      select(f('Priority'), PRIORITIES, it.priority, (v) => { A.update(it.id, { priority: v }); PIQ.go('actions'); });
      select(f('Status'), STATUSES, it.status, (v) => { A.update(it.id, { status: v }); PIQ.go('actions'); });
      const own = h('input', null, f('Owner')); own.type = 'text'; own.placeholder = 'e.g. Head of Collections'; own.value = it.owner;
      own.addEventListener('change', () => A.update(it.id, { owner: own.value }));
      const due = h('input', null, f('Due')); due.type = 'date'; due.value = it.due;
      due.addEventListener('change', () => A.update(it.id, { due: due.value }));
      const note = h('input', null, f('Note')); note.type = 'text'; note.placeholder = 'Add a note'; note.value = it.note;
      note.addEventListener('change', () => A.update(it.id, { note: note.value }));
      note.parentNode.classList.add('wide');
    });
    const foot = h('div', 'small muted', root, `Saved in this browser for the prototype. In production the board lives in ${C.member.name}'s workspace, is shared with the team, and can push actions to email or the bank's task tools.`);
    foot.style.marginTop = '12px';
    const clr = h('button', 'btn sm', root, 'Clear done items');
    clr.style.marginTop = '8px';
    clr.addEventListener('click', () => { A.clearDone(); PIQ.go('actions'); });
  }
  PIQ.views.actions = { title: 'Action Board', render };
})();
