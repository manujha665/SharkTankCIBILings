/*
 * Minimal, dependency-free SVG charts. Colors come from CSS custom properties so light/dark
 * themes swap in one place. Every chart has a hover layer; every chart card has a table twin.
 */
(function (root) {
  const PIQ = (root.PIQ = root.PIQ || {});
  const NS = 'http://www.w3.org/2000/svg';

  function svgEl(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs || {}) {
      if (k === 'style') Object.assign(e.style, attrs[k]);
      else if (k === 'text') e.textContent = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    if (parent) parent.appendChild(e);
    return e;
  }
  function h(tag, cls, parent, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }

  function niceTicks(min, max, count) {
    if (min === max) { max = min + 1; }
    const span = max - min;
    const step0 = span / Math.max(1, count);
    const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const err = step0 / mag;
    const step = (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1) * mag;
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = lo; v <= hi + step * 0.5; v += step) ticks.push(+v.toFixed(10));
    return ticks;
  }

  // ---------- shared tooltip ----------
  let tip;
  function tooltip() {
    if (!tip) { tip = h('div', 'viz-tip', document.body); tip.setAttribute('role', 'status'); }
    return tip;
  }
  function showTip(evt, title, rows) {
    const t = tooltip();
    t.innerHTML = '';
    if (title) h('div', 'viz-tip-title', t, title);
    rows.forEach((r) => {
      const row = h('div', 'viz-tip-row', t);
      const key = h('span', 'viz-tip-key', row);
      key.style.background = r.color || 'transparent';
      if (r.shape === 'rect') key.classList.add('rect');
      h('strong', null, row, r.value);
      h('span', 'viz-tip-name', row, r.name);
    });
    t.style.display = 'block';
    const pad = 14, w = t.offsetWidth, hgt = t.offsetHeight;
    let x = evt.clientX + pad, y = evt.clientY + pad;
    if (x + w > window.innerWidth - 8) x = evt.clientX - w - pad;
    if (y + hgt > window.innerHeight - 8) y = evt.clientY - hgt - pad;
    t.style.left = x + 'px'; t.style.top = y + 'px';
  }
  function hideTip() { if (tip) tip.style.display = 'none'; }

  function legend(parent, series, shape) {
    const lg = h('div', 'viz-legend', parent);
    series.forEach((s) => {
      const it = h('span', 'viz-legend-item', lg);
      const k = h('span', 'viz-legend-key ' + (shape || 'line'), it);
      k.style.background = s.color;
      h('span', null, it, s.name);
    });
    return lg;
  }

  // Re-render on resize, keep a single observer per container
  function responsive(container, draw) {
    draw();
    if (container._ro) container._ro.disconnect();
    let last = container.clientWidth;
    const ro = new ResizeObserver(() => {
      if (Math.abs(container.clientWidth - last) > 4) { last = container.clientWidth; draw(); }
    });
    ro.observe(container);
    container._ro = ro;
  }

  const textW = (s, px) => String(s).length * (px || 11) * 0.6;

  // ---------- Line chart ----------
  // opts: { series:[{name,color,points:[{x,y}]}], xLabel(x), yFmt(v), yTickFmt(v), height, zero, annotations:[{x,label}], endLabels, xNumeric, area }
  function line(container, opts) {
    responsive(container, () => {
      container.innerHTML = '';
      const series = opts.series.filter((s) => s.points && s.points.some((p) => p.y != null));
      if (series.length > 1 && opts.legend !== false) legend(container, series, 'line');
      const W = Math.max(280, container.clientWidth), H = opts.height || 240;
      const xs = series[0] ? series[0].points.map((p) => p.x) : [];
      const all = [];
      series.forEach((s) => s.points.forEach((p) => p.y != null && all.push(p.y)));
      let yMin = Math.min(...all), yMax = Math.max(...all);
      if (opts.zero) yMin = Math.min(0, yMin);
      const padY = (yMax - yMin) * 0.12 || Math.abs(yMax) * 0.1 || 1;
      const dataMin = yMin;
      if (!opts.zero) yMin -= padY;
      if (dataMin >= 0 && yMin < 0) yMin = 0; // never invent a negative axis for non-negative data
      yMax += padY * 0.6;
      const ticks = niceTicks(yMin, yMax, 4);
      const tf = opts.yTickFmt || opts.yFmt || ((v) => v);
      const left = Math.max(...ticks.map((t) => textW(tf(t)))) + 14;
      const endW = opts.endLabels ? Math.min(150, Math.max(...series.map((s) => textW(s.name + ' 00.00%', 11))) + 14) : 12;
      const M = { t: 16, r: endW, b: 28, l: left };
      const iw = W - M.l - M.r, ih = H - M.t - M.b;
      const svg = svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, class: 'viz-svg', role: 'img', 'aria-label': opts.aria || 'Line chart' }, container);
      const y0 = ticks[0], y1 = ticks[ticks.length - 1];
      const Y = (v) => M.t + ih - ((v - y0) / (y1 - y0)) * ih;
      let X;
      if (opts.xNumeric) {
        const a = Math.min(...xs), b = Math.max(...xs);
        X = (x) => M.l + ((x - a) / (b - a || 1)) * iw;
      } else {
        X = (x) => M.l + (xs.indexOf(x) / Math.max(1, xs.length - 1)) * iw;
      }
      const g = svgEl('g', {}, svg);
      ticks.forEach((t) => {
        svgEl('line', { x1: M.l, x2: M.l + iw, y1: Y(t), y2: Y(t), class: t === 0 ? 'viz-base' : 'viz-grid' }, g);
        svgEl('text', { x: M.l - 8, y: Y(t) + 4, 'text-anchor': 'end', class: 'viz-tick', text: tf(t) }, g);
      });
      const xl = opts.xLabel || ((x) => x);
      const nT = Math.min(xs.length, Math.max(2, Math.floor(iw / 70)));
      const step = Math.max(1, Math.round((xs.length - 1) / (nT - 1)));
      for (let i = 0; i < xs.length; i += step) {
        const anchor = i === 0 ? 'start' : 'middle';
        svgEl('text', { x: X(xs[i]), y: H - 8, 'text-anchor': anchor, class: 'viz-tick', text: xl(xs[i]) }, g);
      }
      (opts.annotations || []).forEach((a) => {
        if (!xs.includes(a.x) && !opts.xNumeric) return;
        const ax = X(a.x);
        svgEl('line', { x1: ax, x2: ax, y1: M.t - 4, y2: M.t + ih, class: 'viz-annot' }, g);
        const nearRight = ax > M.l + iw * 0.7;
        svgEl('text', { x: nearRight ? ax - 5 : ax + 5, y: M.t + 8, 'text-anchor': nearRight ? 'end' : 'start', class: 'viz-annot-text', text: a.label }, g);
      });
      series.forEach((s, si) => {
        let d = '', pen = false;
        s.points.forEach((p) => {
          if (p.y == null) { pen = false; return; }
          d += (pen ? 'L' : 'M') + X(p.x).toFixed(1) + ',' + Y(p.y).toFixed(1);
          pen = true;
        });
        if (opts.area && si === 0) {
          const pts = s.points.filter((p) => p.y != null);
          const ad = d + `L${X(pts[pts.length - 1].x)},${M.t + ih}L${X(pts[0].x)},${M.t + ih}Z`;
          svgEl('path', { d: ad, style: { fill: s.color, opacity: 0.1 } }, g);
        }
        svgEl('path', { d, class: 'viz-line', style: { stroke: s.color } }, g);
        (s.marks || []).forEach((mk) => {
          const p = s.points.find((q) => q.x === mk);
          if (p && p.y != null) svgEl('circle', { cx: X(p.x), cy: Y(p.y), r: 5, class: 'viz-dot', style: { fill: s.color } }, g);
        });
      });
      // end dots + labels
      const ends = series.map((s) => {
        const pts = s.points.filter((p) => p.y != null);
        const last = pts[pts.length - 1];
        svgEl('circle', { cx: X(last.x), cy: Y(last.y), r: 4, class: 'viz-dot', style: { fill: s.color } }, g);
        return { s, y: Y(last.y), v: last.y, x: X(last.x) };
      });
      if (opts.endLabels) {
        const sorted = ends.slice().sort((a, b) => a.y - b.y);
        const collide = sorted.some((e, i) => i && e.y - sorted[i - 1].y < 26);
        if (!collide) {
          ends.forEach((e) => {
            svgEl('text', { x: e.x + 9, y: e.y - 2, class: 'viz-end-val', text: (opts.yFmt || tf)(e.v) }, g);
            svgEl('text', { x: e.x + 9, y: e.y + 11, class: 'viz-end-name', text: e.s.name }, g);
          });
        } else {
          ends.forEach((e) => svgEl('text', { x: e.x + 9, y: e.y + 4, class: 'viz-end-val', text: (opts.yFmt || tf)(e.v) }, g));
          // values only; names live in the legend — never nudge detached labels
          const ys = ends.map((e) => e.y).sort((a, b) => a - b);
          if (ys.some((y, i) => i && y - ys[i - 1] < 13)) g.querySelectorAll('.viz-end-val').forEach((n) => n.remove());
        }
      }
      // crosshair
      const cross = svgEl('line', { x1: 0, x2: 0, y1: M.t, y2: M.t + ih, class: 'viz-cross', style: { display: 'none' } }, svg);
      const hits = series.map((s) => svgEl('circle', { r: 5, class: 'viz-dot', style: { fill: s.color, display: 'none' } }, svg));
      const hit = svgEl('rect', { x: M.l, y: M.t, width: iw, height: ih, fill: 'transparent', tabindex: 0 }, svg);
      const nearest = (px) => {
        let bi = 0, bd = Infinity;
        xs.forEach((x, i) => { const dd = Math.abs(X(x) - px); if (dd < bd) { bd = dd; bi = i; } });
        return bi;
      };
      const move = (evt, idx) => {
        const i = idx != null ? idx : nearest(evt.clientX - svg.getBoundingClientRect().left);
        const x = xs[i];
        cross.setAttribute('x1', X(x)); cross.setAttribute('x2', X(x)); cross.style.display = '';
        const rows = [];
        series.forEach((s, si) => {
          const p = s.points[i];
          if (p && p.y != null) {
            hits[si].setAttribute('cx', X(x)); hits[si].setAttribute('cy', Y(p.y)); hits[si].style.display = '';
            rows.push({ color: s.color, value: (opts.yFmt || tf)(p.y), name: s.name });
          } else hits[si].style.display = 'none';
        });
        const r = svg.getBoundingClientRect();
        showTip(evt && evt.clientX ? evt : { clientX: r.left + X(x), clientY: r.top + M.t }, xl(x, true), rows);
      };
      hit.addEventListener('pointermove', (e) => move(e));
      hit.addEventListener('pointerleave', () => { cross.style.display = 'none'; hits.forEach((c) => (c.style.display = 'none')); hideTip(); });
      let ki = xs.length - 1;
      hit.addEventListener('focus', () => move(null, ki));
      hit.addEventListener('blur', hideTip);
      hit.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') { ki = Math.max(0, ki - 1); move(null, ki); }
        if (e.key === 'ArrowRight') { ki = Math.min(xs.length - 1, ki + 1); move(null, ki); }
      });
    });
  }

  // ---------- Horizontal bars ----------
  // opts: { items:[{label,value,color,ref,refLabel,tag}], fmt, color, refName }
  function bars(container, opts) {
    responsive(container, () => {
      container.innerHTML = '';
      const items = opts.items;
      if (opts.refName) legend(container, [{ name: opts.valueName || 'Value', color: opts.color }, { name: opts.refName, color: 'var(--ink-2)' }], 'rect');
      const W = Math.max(280, container.clientWidth);
      const rowH = 34, M = { t: 6, r: Math.max(70, Math.max(...items.map((i) => textW(opts.fmt(i.value), 12))) + 14), b: 6, l: Math.min(190, Math.max(...items.map((i) => textW(i.label, 12))) + 16) };
      const H = M.t + M.b + rowH * items.length;
      const iw = W - M.l - M.r;
      const vals = items.map((i) => i.value).concat(items.map((i) => i.ref || 0));
      const vmin = Math.min(0, ...vals), vmax = Math.max(0, ...vals);
      const Xs = (v) => M.l + ((v - vmin) / (vmax - vmin || 1)) * iw;
      const svg = svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, class: 'viz-svg', role: 'img', 'aria-label': opts.aria || 'Bar chart' }, container);
      svgEl('line', { x1: Xs(0), x2: Xs(0), y1: M.t, y2: H - M.b, class: 'viz-base' }, svg);
      items.forEach((it, i) => {
        const cy = M.t + i * rowH + rowH / 2;
        const bh = Math.min(20, rowH - 12);
        svgEl('text', { x: M.l - 10, y: cy + 4, 'text-anchor': 'end', class: 'viz-label', text: it.label }, svg);
        const x0 = Xs(0), x1 = Xs(it.value);
        const neg = x1 < x0, w = Math.abs(x1 - x0);
        const r = Math.min(4, w);
        const top = cy - bh / 2;
        const d = neg
          ? `M${x0},${top}H${x1 + r}Q${x1},${top} ${x1},${top + r}V${top + bh - r}Q${x1},${top + bh} ${x1 + r},${top + bh}H${x0}Z`
          : `M${x0},${top}H${x1 - r}Q${x1},${top} ${x1},${top + r}V${top + bh - r}Q${x1},${top + bh} ${x1 - r},${top + bh}H${x0}Z`;
        const bar = svgEl('path', { d, class: 'viz-bar', style: { fill: it.color || opts.color || 'var(--s1)' }, tabindex: 0 }, svg);
        const lab = svgEl('text', { x: neg ? x1 - 6 : x1 + 6, y: cy + 4, 'text-anchor': neg ? 'end' : 'start', class: 'viz-val', text: opts.fmt(it.value) }, svg);
        if (it.ref != null) {
          const rx = Xs(it.ref);
          svgEl('line', { x1: rx, x2: rx, y1: cy - bh / 2 - 4, y2: cy + bh / 2 + 4, class: 'viz-ref' }, svg);
          if (!neg && Math.abs(rx - (x1 + 6)) < textW(opts.fmt(it.value)) + 6 && rx > x1) lab.setAttribute('x', rx + 6);
        }
        const tipRows = [{ color: it.color || opts.color || 'var(--s1)', value: opts.fmt(it.value), name: opts.valueName || it.label, shape: 'rect' }];
        if (it.ref != null) tipRows.push({ color: 'var(--ink-2)', value: opts.fmt(it.ref), name: opts.refName || 'Benchmark' });
        const on = (e) => { bar.classList.add('hover'); showTip(e, it.label, tipRows); };
        bar.addEventListener('pointermove', on);
        bar.addEventListener('focus', () => { const r = bar.getBoundingClientRect(); on({ clientX: r.right, clientY: r.top }); });
        bar.addEventListener('pointerleave', () => { bar.classList.remove('hover'); hideTip(); });
        bar.addEventListener('blur', () => { bar.classList.remove('hover'); hideTip(); });
      });
    });
  }

  // ---------- Dot plot (member vs peer vs industry per row) ----------
  // opts: { rows:[{label, values:{key:v}}], series:[{key,name,color}], fmt }
  function dots(container, opts) {
    responsive(container, () => {
      container.innerHTML = '';
      const series = opts.series.filter((s) => opts.rows.some((r) => r.values[s.key] != null));
      legend(container, series, 'dot');
      const W = Math.max(280, container.clientWidth), rowH = 36;
      const M = { t: 8, r: 24, b: 26, l: Math.min(160, Math.max(...opts.rows.map((r) => textW(r.label, 12))) + 16) };
      const H = M.t + M.b + rowH * opts.rows.length;
      const iw = W - M.l - M.r;
      const all = [];
      opts.rows.forEach((r) => series.forEach((s) => r.values[s.key] != null && all.push(r.values[s.key])));
      const ticks = niceTicks(Math.min(...all) * 0.9, Math.max(...all) * 1.05, 4);
      const X = (v) => M.l + ((v - ticks[0]) / (ticks[ticks.length - 1] - ticks[0])) * iw;
      const svg = svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, class: 'viz-svg', role: 'img', 'aria-label': opts.aria || 'Dot plot' }, container);
      ticks.forEach((t) => {
        svgEl('line', { x1: X(t), x2: X(t), y1: M.t, y2: H - M.b, class: 'viz-grid' }, svg);
        svgEl('text', { x: X(t), y: H - 8, 'text-anchor': 'middle', class: 'viz-tick', text: opts.fmt(t) }, svg);
      });
      opts.rows.forEach((r, i) => {
        const cy = M.t + i * rowH + rowH / 2;
        svgEl('text', { x: M.l - 10, y: cy + 4, 'text-anchor': 'end', class: 'viz-label', text: r.label }, svg);
        const vs = series.map((s) => r.values[s.key]).filter((v) => v != null);
        svgEl('line', { x1: X(Math.min(...vs)), x2: X(Math.max(...vs)), y1: cy, y2: cy, class: 'viz-range' }, svg);
        series.forEach((s) => {
          const v = r.values[s.key];
          if (v == null) return;
          svgEl('circle', { cx: X(v), cy, r: s.key === series[0].key ? 6 : 5, class: 'viz-dot', style: { fill: s.color } }, svg);
        });
        const hitR = svgEl('rect', { x: M.l, y: cy - rowH / 2, width: iw, height: rowH, fill: 'transparent', tabindex: 0 }, svg);
        const rows = series.filter((s) => r.values[s.key] != null).map((s) => ({ color: s.color, value: opts.fmt(r.values[s.key]), name: s.name }));
        hitR.addEventListener('pointermove', (e) => showTip(e, r.label, rows));
        hitR.addEventListener('pointerleave', hideTip);
        hitR.addEventListener('focus', () => { const b = hitR.getBoundingClientRect(); showTip({ clientX: b.left + b.width / 2, clientY: b.top }, r.label, rows); });
        hitR.addEventListener('blur', hideTip);
      });
    });
  }

  // ---------- 100% stacked columns ----------
  // opts: { x:[...], xLabel, stacks:[{name,color,values:[]}], fmt }
  function stacked(container, opts) {
    responsive(container, () => {
      container.innerHTML = '';
      legend(container, opts.stacks, 'rect');
      const W = Math.max(280, container.clientWidth), H = opts.height || 220;
      const M = { t: 8, r: 8, b: 26, l: 40 };
      const iw = W - M.l - M.r, ih = H - M.t - M.b;
      const n = opts.x.length, band = iw / n, bw = Math.min(24, band - 2);
      const svg = svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, class: 'viz-svg', role: 'img', 'aria-label': opts.aria || 'Stacked columns' }, container);
      [0, 0.25, 0.5, 0.75, 1].forEach((t) => {
        const y = M.t + ih - t * ih;
        svgEl('line', { x1: M.l, x2: M.l + iw, y1: y, y2: y, class: t === 0 ? 'viz-base' : 'viz-grid' }, svg);
        svgEl('text', { x: M.l - 6, y: y + 4, 'text-anchor': 'end', class: 'viz-tick', text: Math.round(t * 100) + '%' }, svg);
      });
      const step = Math.max(1, Math.ceil(n / Math.floor(iw / 60)));
      opts.x.forEach((x, i) => {
        const cx = M.l + band * i + band / 2;
        const tot = opts.stacks.reduce((a, s) => a + s.values[i], 0);
        let acc = 0;
        opts.stacks.forEach((s, si) => {
          const v = s.values[i] / tot;
          const y1 = M.t + ih - acc * ih, hgt = v * ih;
          const isTop = si === opts.stacks.length - 1;
          const gap = si > 0 ? 2 : 0;
          const r = isTop ? Math.min(4, hgt) : 0;
          const top = y1 - hgt, x0 = cx - bw / 2;
          const d = `M${x0},${y1 - gap}V${top + r}Q${x0},${top} ${x0 + r},${top}H${x0 + bw - r}Q${x0 + bw},${top} ${x0 + bw},${top + r}V${y1 - gap}Z`;
          const seg = svgEl('path', { d, class: 'viz-bar', style: { fill: s.color } }, svg);
          seg.addEventListener('pointermove', (e) => {
            seg.classList.add('hover');
            showTip(e, (opts.xLabel || String)(x), opts.stacks.slice().reverse().map((q) => ({ color: q.color, value: (opts.fmt || ((z) => (z * 100).toFixed(1) + '%'))(q.values[i] / tot), name: q.name, shape: 'rect' })));
          });
          seg.addEventListener('pointerleave', () => { seg.classList.remove('hover'); hideTip(); });
          acc += v;
        });
        if (i % step === 0) svgEl('text', { x: cx, y: H - 8, 'text-anchor': 'middle', class: 'viz-tick', text: (opts.xLabel || String)(x) }, svg);
      });
    });
  }

  // ---------- Waterfall ----------
  // opts: { start:{label,value}, steps:[{label,value,note}], end:{label,value}, fmt, deltaFmt, upIsBad }
  function waterfall(container, opts) {
    responsive(container, () => {
      container.innerHTML = '';
      const W = Math.max(280, container.clientWidth), H = opts.height || 260;
      const cols = [{ type: 'total', label: opts.start.label, value: opts.start.value }]
        .concat(opts.steps.map((s) => ({ type: 'step', ...s })))
        .concat([{ type: 'total', label: opts.end.label, value: opts.end.value }]);
      let run = opts.start.value;
      cols.forEach((c) => {
        if (c.type === 'step') { c.from = run; c.to = run + c.value; run = c.to; }
        else { c.from = 0; c.to = c.value; }
      });
      const lo = Math.min(...cols.map((c) => Math.min(c.from, c.to)).filter((v) => v > 0)) * 0.85;
      const hi = Math.max(...cols.map((c) => Math.max(c.from, c.to))) * 1.08;
      const ticks = niceTicks(opts.zero ? 0 : lo, hi, 4);
      const M = { t: 22, r: 8, b: 42, l: Math.max(...ticks.map((t) => textW(opts.fmt(t)))) + 14 };
      const iw = W - M.l - M.r, ih = H - M.t - M.b;
      const Y = (v) => M.t + ih - ((v - ticks[0]) / (ticks[ticks.length - 1] - ticks[0])) * ih;
      const svg = svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, class: 'viz-svg', role: 'img', 'aria-label': opts.aria || 'Waterfall' }, container);
      ticks.forEach((t) => {
        svgEl('line', { x1: M.l, x2: M.l + iw, y1: Y(t), y2: Y(t), class: 'viz-grid' }, svg);
        svgEl('text', { x: M.l - 8, y: Y(t) + 4, 'text-anchor': 'end', class: 'viz-tick', text: opts.fmt(t) }, svg);
      });
      const band = iw / cols.length, bw = Math.min(44, band * 0.6);
      cols.forEach((c, i) => {
        const cx = M.l + band * i + band / 2, x0 = cx - bw / 2;
        const top = Y(Math.max(c.from, c.to)), bot = c.type === 'total' ? M.t + ih : Y(Math.min(c.from, c.to));
        const hgt = Math.max(2, bot - top), r = Math.min(4, hgt / 2);
        const up = c.type === 'step' && c.value > 0;
        const color = c.type === 'total' ? 'var(--s1)' : (up === !!opts.upIsBad ? 'var(--st-critical)' : 'var(--st-good)');
        const d = `M${x0},${top + hgt}V${top + r}Q${x0},${top} ${x0 + r},${top}H${x0 + bw - r}Q${x0 + bw},${top} ${x0 + bw},${top + r}V${top + hgt}Z`;
        const bar = svgEl('path', { d, class: 'viz-bar', style: { fill: color }, tabindex: 0 }, svg);
        if (i < cols.length - 1) {
          const nextFrom = c.type === 'total' ? c.to : c.to;
          svgEl('line', { x1: x0 + bw, x2: x0 + band, y1: Y(nextFrom), y2: Y(nextFrom), class: 'viz-connector' }, svg);
        }
        const valText = c.type === 'total' ? opts.fmt(c.value) : (c.value > 0 ? '+' : '−') + (opts.deltaFmt || opts.fmt)(Math.abs(c.value));
        svgEl('text', { x: cx, y: top - 6, 'text-anchor': 'middle', class: 'viz-val', text: valText }, svg);
        // wrap the category label into at most two lines that fit the column band
        const maxCh = Math.max(5, Math.floor(band / 7));
        const words = c.label.replace(/-/g, '- ').split(' ').filter(Boolean);
        const l1 = [], l2 = [];
        words.forEach((w) => ((l1.join(' ') + ' ' + w).trim().length <= maxCh && !l2.length ? l1 : l2).push(w));
        const join = (arr) => arr.join(' ').replace(/- /g, '-');
        const lab1 = svgEl('text', { x: cx, y: H - 24, 'text-anchor': 'middle', class: 'viz-label', text: join(l1) || join(l2) }, svg);
        if (l1.length && l2.length) svgEl('text', { x: cx, y: H - 10, 'text-anchor': 'middle', class: 'viz-label', text: join(l2) }, svg);
        if (band < 80) lab1.parentNode.querySelectorAll('.viz-label').forEach((n) => { n.style.fontSize = '11px'; });
        const rows = [{ color, value: valText, name: c.note || c.label, shape: 'rect' }];
        bar.addEventListener('pointermove', (e) => { bar.classList.add('hover'); showTip(e, c.label, rows); });
        bar.addEventListener('pointerleave', () => { bar.classList.remove('hover'); hideTip(); });
      });
    });
  }

  // ---------- Sparkline ----------
  function spark(container, values, color) {
    container.innerHTML = '';
    const W = 120, H = 32;
    const v = values.filter((x) => x != null);
    const lo = Math.min(...v), hi = Math.max(...v);
    const X = (i) => 2 + (i / (values.length - 1)) * (W - 8);
    const Y = (y) => 4 + (1 - (y - lo) / (hi - lo || 1)) * (H - 8);
    const svg = svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, class: 'viz-spark', 'aria-hidden': 'true' }, container);
    svgEl('path', { d: values.map((y, i) => (i ? 'L' : 'M') + X(i) + ',' + Y(y)).join(''), class: 'viz-spark-line' }, svg);
    svgEl('circle', { cx: X(values.length - 1), cy: Y(values[values.length - 1]), r: 3, style: { fill: color || 'var(--s1)' } }, svg);
  }

  PIQ.charts = { line, bars, dots, stacked, waterfall, spark, legend, showTip, hideTip, h, niceTicks };
})(window);
