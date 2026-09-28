/* App shell: navigation, header, routing, theme, AI drawer. */
(function () {
  const { h, state, onState } = PIQ.ui;
  const C = PIQ.config;
  const NAV = [
    { sec: 'Intelligence' },
    { id: 'overview', name: 'Command Centre', ico: '◎' },
    { id: 'industry', name: 'Industry Intelligence', ico: '▦' },
    { id: 'benchmark', name: 'Peer Benchmarking', ico: '⇆' },
    { id: 'fresh', name: 'Fresh Signals (weekly)', ico: '◷', tag: 'new' },
    { id: 'overlaps', name: 'Overlap Intelligence', ico: '⧉', tag: 'new' },
    { sec: 'Decide' },
    { id: 'actions', name: 'Action Board', ico: '📌', tag: 'new' },
    { id: 'why', name: 'Why did it change?', ico: '◈', tag: 'new' },
    { id: 'simulator', name: 'Policy Simulator', ico: '⚙' },
    { id: 'logins', name: 'Login & Application Pulse', ico: '⚡', tag: 'new' },
    { sec: 'Ask & extend' },
    { id: 'analyst', name: 'AI Analyst', ico: '✦' },
    { id: 'upload', name: 'Bring Your Data', ico: '⇪' },
    { id: 'brief', name: 'Board Brief', ico: '▤' },
    { sec: 'Trust' },
    { id: 'governance', name: 'Governance & Trust', ico: '⛨' }
  ];
  let current = 'overview';
  PIQ.routeParams = {};

  function buildSide() {
    const side = document.getElementById('side');
    side.innerHTML = '';
    const b = h('div', 'brand', side);
    h('div', 'brand-mark', b, 'IQ');
    const t = h('div', null, b);
    h('div', 'brand-name', t, C.productName);
    h('div', 'brand-tag', t, C.tagline);
    const alerts = PIQ.sem.alerts().filter((a) => a.sev === 'critical' || a.sev === 'serious').length;
    NAV.forEach((n) => {
      if (n.sec) { h('div', 'nav-sec', side, n.sec); return; }
      const a = h('button', 'nav-item' + (n.id === current ? ' active' : ''), side);
      a.type = 'button';
      h('span', 'ico', a, n.ico);
      h('span', null, a, n.name);
      if (n.id === 'overview' && alerts) h('span', 'nav-badge', a, String(alerts));
      if (n.id === 'actions') { const c = PIQ.actions.openCount(); if (c) { const bd = h('span', 'nav-badge count', a, String(c)); bd.title = c + ' open actions'; } }
      if (n.tag) h('span', 'nav-new', a, n.tag);
      a.addEventListener('click', () => go(n.id));
    });
    h('div', 'side-foot', side, 'Prototype · synthetic data only. No real bureau or member data is used.');
  }

  function buildTop() {
    const top = document.getElementById('top');
    top.innerHTML = '';
    const v = PIQ.views[current];
    const t = h('div', null, top);
    h('div', 'top-title', t, v.title);
    h('div', 'top-sub', t, C.member.name + ' · ' + C.member.type);
    const r = h('div', 'top-right', top);
    h('span', 'pill warn', r, '● Synthetic demo data');
    h('span', 'pill', r, 'Data as of ' + C.dataAsOf);
    const llm = h('span', 'pill', r, 'AI: governed engine');
    llm.id = 'llm-pill';
    PIQ.llm.status().then((s) => { if (s.ok) { llm.textContent = 'AI: ' + s.label; llm.className = 'pill ok'; } });
    const tourBtn = h('button', 'btn sm primary', r, '▶ Demo tour');
    tourBtn.type = 'button';
    tourBtn.title = 'Guided walkthrough of the pitch story (→ next, ← back, Esc exit)';
    tourBtn.addEventListener('click', () => PIQ.tour.start());
    const theme = h('button', 'icon-btn', r, '◐');
    theme.type = 'button';
    theme.title = 'Toggle light / dark';
    theme.addEventListener('click', () => {
      const root = document.documentElement;
      const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
      root.dataset.theme = dark ? 'light' : 'dark';
      try { localStorage.setItem('piq-theme', root.dataset.theme); } catch (e) { /* storage unavailable */ }
      render();
    });
    const who = h('div', 'avatar', r, C.member.user.split(' ').map((x) => x[0]).join(''));
    who.title = C.member.user + ' — ' + C.member.role;
  }

  function render() {
    const view = document.getElementById('view');
    view.innerHTML = '';
    PIQ.charts.hideTip();
    PIQ.views[current].render(view, PIQ.routeParams || {});
  }

  function go(id, params) {
    current = id;
    PIQ.currentView = id;
    PIQ.routeParams = params || {};
    if (params && params.p) state.p = params.p;
    if (params && params.s) state.s = params.s;
    try { history.replaceState(null, '', '#' + id); } catch (e) { /* file:// */ }
    buildSide(); buildTop(); render();
    document.getElementById('fab').style.display = id === 'analyst' ? 'none' : '';
    window.scrollTo(0, 0);
  }
  PIQ.go = go;
  PIQ.actions.onChange(() => buildSide());
  onState(() => { PIQ.routeParams = {}; render(); });

  // Drawer: the AI analyst available from every page
  function setupDrawer() {
    const drawer = document.getElementById('drawer');
    const head = h('div', 'drawer-head', drawer);
    h('strong', null, head, '✦ Ask ' + C.productName);
    h('span', 'muted small', head, 'answers only from approved datasets');
    const full = h('button', 'btn sm', head, 'Full screen');
    full.style.marginLeft = 'auto';
    full.type = 'button';
    const close = h('button', 'icon-btn', head, '✕');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close');
    const box = h('div', null, drawer);
    box.style.cssText = 'flex:1;display:flex;min-height:0';
    PIQ.chatUI.mount(box, { compact: true });
    const open = () => drawer.classList.add('open');
    const shut = () => drawer.classList.remove('open');
    document.getElementById('fab').addEventListener('click', open);
    close.addEventListener('click', shut);
    full.addEventListener('click', () => { shut(); go('analyst'); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') shut(); });
    PIQ.openDrawer = (q) => { open(); if (q) PIQ.chatUI.ask(q); };
  }

  try { const t = localStorage.getItem('piq-theme'); if (t) document.documentElement.dataset.theme = t; } catch (e) { /* ignore */ }
  const start = (location.hash || '').slice(1);
  setupDrawer();
  go(PIQ.views[start] ? start : 'overview');
  // index.html#tour opens the guided tour; #tour-play auto-plays it (handy for kiosks / recordings)
  if (start === 'tour' || start === 'tour-play') setTimeout(() => PIQ.tour.start({ autoplay: start === 'tour-play' }), 300);
})();
