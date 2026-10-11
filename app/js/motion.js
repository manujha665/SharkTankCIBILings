/*
 * Presentation-mode motion. Runs once each time you open a page (or the tour moves on), never on
 * filter clicks, so changing a dropdown is instant. Charts draw themselves, the "me vs market" bar
 * wipes in, headline numbers count up, cards rise in quickly, critical alerts pulse twice.
 * Press M to switch motion off or on (remembered). Honours the OS "reduce motion" setting.
 */
(function () {
  const PIQ = window.PIQ;
  const body = document.body;
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } } };
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let on = store.get('piq-motion') !== 'off';
  let doneSeq = -1;

  // count the one number in a value up from zero, keeping its prefix, suffix, commas and decimals
  function countUp(el) {
    if (el.childNodes.length !== 1 || el.firstChild.nodeType !== 3) return;
    const node = el.firstChild, txt = node.nodeValue, m = txt.match(/\d[\d,]*\.?\d*/g);
    if (!m || m.length !== 1) return;
    const raw = m[0], target = parseFloat(raw.replace(/,/g, ''));
    if (!isFinite(target) || !target) return;
    const dec = (raw.split('.')[1] || '').length, comma = raw.includes(','), i = txt.indexOf(raw);
    const pre = txt.slice(0, i), post = txt.slice(i + raw.length), t0 = performance.now(), dur = 700;
    (function tick(now) {
      const k = Math.min(1, (now - t0) / dur);
      let s = (target * (1 - Math.pow(1 - k, 3))).toFixed(dec);
      if (comma) s = s.replace(/^\d+/, (d) => d.replace(/\B(?=(\d{3})+(?!\d))/g, ','));
      if (!node.isConnected) return;
      node.nodeValue = k < 1 ? pre + s + post : txt;
      if (k < 1) requestAnimationFrame(tick);
    })(t0);
  }

  function animate(root) {
    let n = 0;
    root.querySelectorAll('.card, .stat, .alert-tile, .reco, .gl-card').forEach((el) => {
      el.style.setProperty('--mo-i', Math.min(n++, 8));
      el.classList.add('mo-in');
    });
    root.querySelectorAll('.split-bar').forEach((el) => el.classList.add('mo-wipe'));
    root.querySelectorAll('.stat-value, .hero').forEach(countUp);
    root.querySelectorAll('svg').forEach((svg) => {
      const lines = svg.querySelectorAll('.viz-line'), bars = svg.querySelectorAll('.viz-bar');
      if (!lines.length && !bars.length) return;
      lines.forEach((p, i) => { p.setAttribute('pathLength', '1'); p.style.setProperty('--mo-i', i); p.classList.add('mo-draw'); });
      bars.forEach((b, i) => {
        const nx = b.nextElementSibling, a = nx && nx.classList.contains('viz-val') ? nx.getAttribute('text-anchor') : '';
        b.style.setProperty('--mo-i', Math.min(i, 20));
        b.classList.add(a === 'middle' ? 'mo-grow-y' : 'mo-grow-x');
        if (a === 'end') b.classList.add('neg');
      });
      svg.querySelectorAll('.viz-dot, .viz-val, .viz-end-val, .viz-end-name, .viz-ref, .viz-annot, .viz-annot-text').forEach((el) => {
        if (el.style.display !== 'none') el.classList.add('mo-late');
      });
    });
  }

  // animate the first paint after each navigation (PIQ.go bumps PIQ.navSeq); re-renders from filters are left alone
  const view = document.getElementById('view');
  let pending = false;
  const check = () => {
    pending = false;
    const seq = PIQ.navSeq || 0;
    if (seq === doneSeq || !view.children.length) return;
    doneSeq = seq;
    if (on && !reduce) animate(view);
  };
  if (view) {
    check(); // the first page is drawn before this script loads
    new MutationObserver(() => { if (!pending) { pending = true; requestAnimationFrame(check); } }).observe(view, { childList: true });
  }

  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || /input|textarea|select/i.test(e.target.tagName || '')) return;
    if (e.key === 'm' || e.key === 'M') {
      on = !on;
      store.set('piq-motion', on ? 'on' : 'off');
      if (PIQ.actions && PIQ.actions.toast) PIQ.actions.toast(on ? 'Motion on' : 'Motion off');
    }
  });
  PIQ.motion = { isOn: () => on && !reduce };
})();
