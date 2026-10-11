/*
 * Action Board store + capture tools.
 *
 * Anything on any page can be sent to the Action Board: via the 📌 buttons, or by right-clicking a
 * card / tile / alert / callout / AI answer (selected text wins over the whole element). Each action
 * keeps its source (module, filters, time) so the board can jump back to it.
 *
 * Storage: this browser (localStorage) in the prototype; in production the board lives in the
 * member's tenant and is shared with the team.
 */
(function () {
  const PIQ = window.PIQ;
  const KEY = 'piq-actions-v1';
  let items = [];
  const subs = [];
  try { items = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { items = []; }
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) { /* storage unavailable: keep in memory */ }
    subs.forEach((f) => f(items));
  };
  const uid = () => 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  function context() {
    const st = PIQ.ui.state;
    return { view: PIQ.currentView || 'overview', viewTitle: (PIQ.views[PIQ.currentView] || {}).title || '', p: st.p, s: st.s, dpd: st.dpd };
  }
  // text: the action; detail: supporting numbers / explanation
  function add(text, detail, extra) {
    text = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 300);
    if (!text) return null;
    const norm = (x) => x.toLowerCase().replace(/[\s.!]+$/, '');
    const dup = items.find((x) => norm(x.text) === norm(text) && x.status !== 'Done');
    if (dup) { toast('Already on your Action Board', true); return dup; }
    const it = Object.assign({
      id: uid(), text, detail: String(detail || '').replace(/\s+/g, ' ').trim().slice(0, 600),
      created: new Date().toISOString(), status: 'Open', priority: 'Medium', owner: '', due: '', note: ''
    }, context(), extra || {});
    items.unshift(it);
    save();
    toast('📌 Sent to Action Board');
    PIQ.sem.log('actions.add', { text: text.slice(0, 60), from: it.view });
    return it;
  }
  const update = (id, patch) => { const it = items.find((x) => x.id === id); if (it) { Object.assign(it, patch); save(); } };
  const remove = (id) => { items = items.filter((x) => x.id !== id); save(); };
  const clearDone = () => { items = items.filter((x) => x.status !== 'Done'); save(); };
  const openCount = () => items.filter((x) => x.status !== 'Done').length;

  // ---------- toast ----------
  let toastEl, toastT;
  function toast(msg, muted) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.innerHTML = '';
    const sp = document.createElement('span'); sp.textContent = msg; toastEl.appendChild(sp);
    if (!muted) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = 'View board';
      b.addEventListener('click', () => { toastEl.classList.remove('show'); PIQ.go('actions'); });
      toastEl.appendChild(b);
    }
    toastEl.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('show'), 2800);
  }

  // ---------- extracting an action from any element ----------
  const CAPTURABLE = '.reco, .alert, .callout, .msg.bot, .stat, .card, tr';
  const txt = (el, sel) => { const n = el.querySelector(sel); return n ? n.textContent.trim() : ''; };
  function describe(el) {
    if (el.matches('tr')) {
      const cells = [...el.children].map((c) => c.textContent.trim()).filter(Boolean);
      const table = el.closest('.card');
      const head = table ? txt(table, 'h3') : '';
      return { text: (head ? head + ': ' : '') + cells.slice(0, 2).join(' · '), detail: cells.slice(2).join(' · ') };
    }
    if (el.matches('.reco')) return { text: txt(el, 'h4'), detail: [txt(el, 'p'), txt(el, '.impact')].filter(Boolean).join(' — ') };
    if (el.matches('.alert')) return { text: txt(el, '.alert-title'), detail: txt(el, '.alert-detail') };
    if (el.matches('.callout')) return { text: txt(el, 'h4'), detail: txt(el, 'p') };
    if (el.matches('.msg.bot')) { const b = el.querySelector('.bot-bubble'); const t = b ? b.textContent.trim() : ''; return { text: t.split(/(?<=[.!?])\s/)[0], detail: t }; }
    if (el.matches('.stat')) return { text: [txt(el, '.stat-label'), txt(el, '.stat-value')].filter(Boolean).join(': '), detail: txt(el, '.stat-delta') };
    return { text: txt(el, 'h3') || txt(el, 'h4'), detail: txt(el, '.sub') };
  }
  function captureFrom(el, selection) {
    const d = describe(el);
    if (selection) return add(selection, d.text ? 'From: ' + d.text : '');
    return add(d.text, d.detail);
  }

  // ---------- right-click menu ----------
  let menu, openedAt = 0;
  function hideMenu() { if (menu) menu.style.display = 'none'; }
  function showMenu(x, y, el, selection) {
    if (!menu) {
      menu = document.createElement('div');
      menu.className = 'ctx-menu';
      menu.setAttribute('role', 'menu');
      document.body.appendChild(menu);
      document.addEventListener('click', hideMenu);
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideMenu(); });
      // ignore the scroll some browsers fire as the menu opens; close on real scrolling only
      window.addEventListener('scroll', () => { if (Date.now() - openedAt > 400) hideMenu(); }, true);
    }
    menu.innerHTML = '';
    const d = describe(el);
    const head = document.createElement('div');
    head.className = 'ctx-head';
    head.textContent = selection ? '“' + selection.slice(0, 60) + (selection.length > 60 ? '…' : '') + '”' : (d.text || 'This item').slice(0, 70);
    menu.appendChild(head);
    const item = (label, fn) => {
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'menuitem'); b.textContent = label;
      b.addEventListener('click', (e) => { e.stopPropagation(); hideMenu(); fn(); });
      menu.appendChild(b);
    };
    item(selection ? '📌 Send selected text to Action Board' : '📌 Send to Action Board', () => captureFrom(el, selection));
    if (selection) item('📌 Send whole item instead', () => captureFrom(el, ''));
    item('⧉ Copy text', () => { try { navigator.clipboard.writeText(selection || [d.text, d.detail].filter(Boolean).join(' — ')); toast('Copied', true); } catch (e) { /* ignore */ } });
    item('▤ Open Action Board', () => PIQ.go('actions'));
    openedAt = Date.now();
    menu.style.display = 'block';
    const w = menu.offsetWidth, hgt = menu.offsetHeight;
    menu.style.left = Math.min(x, window.innerWidth - w - 8) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - hgt - 8) + 'px';
  }
  document.addEventListener('contextmenu', (e) => {
    const inApp = e.target.closest('#view, #drawer');
    if (!inApp || e.target.closest('input, textarea, select, .action-board')) return; // keep native menu for form fields
    const el = e.target.closest(CAPTURABLE);
    if (!el) return;
    e.preventDefault();
    const sel = (window.getSelection && String(window.getSelection()).trim()) || '';
    showMenu(e.clientX, e.clientY, el, sel.length > 3 ? sel : '');
  });

  // Small reusable 📌 button
  function pinButton(parent, getPayload, label) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn sm pin-btn';
    b.textContent = label || '📌';
    b.title = 'Send to Action Board';
    b.setAttribute('aria-label', 'Send to Action Board');
    b.addEventListener('click', (e) => { e.stopPropagation(); const pl = getPayload(); add(pl.text, pl.detail, pl.extra); });
    parent.appendChild(b);
    return b;
  }

  PIQ.actions = { all: () => items, add, update, remove, clearDone, openCount, onChange: (f) => subs.push(f), pinButton, describe, toast };
})();
