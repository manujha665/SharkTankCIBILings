/* Peer Benchmarking — member vs peer group vs industry, with privacy guardrails enforced live. */
(function () {
  const PIQ = window.PIQ;
  const { h, fmt, ml, state, setState, card, stat, sourceText, pageHead, productStateFilters, select, stateName } = PIQ.ui;
  const S = PIQ.sem, D = PIQ.data, C = PIQ.config;
  let metric = 'dpd30';
  let custom = { types: ['PVT'], sizes: ['Mid'] };

  function render(root, params) {
    if (params && params.metric) metric = params.metric;
    const p = state.p, s = state.s;
    pageHead(root, 'Peer Benchmarking', 'How you compare with a peer group you choose and with the whole market. Peers are always anonymised aggregates, and groups that could expose a single lender are blocked automatically.');
    const bar = productStateFilters(root);
    select(bar, 'Metric', ['dpd30', 'dpd90', 'cure'].map((id) => ({ id, name: S.METRICS[id].name })), metric, (v) => { metric = v; PIQ.go('benchmark'); });
    select(bar, 'Peer group', S.PEER_GROUPS.map((g) => ({ id: g.id, name: g.name + ' (' + S.peerMembers(g.types, g.sizes).length + ')' })).concat([{ id: 'custom', name: 'Custom…' }]), state.peer, (v) => setState({ peer: v }));

    const group = state.peer === 'custom' ? Object.assign({ id: 'custom', name: 'Custom group' }, custom) : S.PEER_GROUPS.find((g) => g.id === state.peer);
    if (state.peer === 'custom') {
      const cb = h('div', 'card', root);
      cb.style.marginBottom = '16px';
      h('h3', null, cb, 'Build a custom peer group');
      const row = h('div', null, cb);
      row.style.cssText = 'display:flex;gap:24px;flex-wrap:wrap;margin-top:10px';
      const mk = (label, list, key) => {
        const f = h('div', null, row);
        h('div', 'muted small', f, label);
        list.forEach(([id, name]) => {
          const l = h('label', null, f);
          l.style.cssText = 'display:inline-flex;gap:6px;margin:6px 12px 0 0;align-items:center';
          const i = h('input', null, l); i.type = 'checkbox'; i.checked = custom[key].includes(id);
          h('span', null, l, name);
          i.addEventListener('change', () => {
            custom[key] = i.checked ? custom[key].concat(id) : custom[key].filter((x) => x !== id);
            PIQ.go('benchmark');
          });
        });
      };
      mk('Category', D.LENDERS.map((l) => [l.id, l.name]), 'types');
      mk('Size', [['Mid', 'Mid-size'], ['Large', 'Large']], 'sizes');
    }
    const chk = S.peerCheck(group.types, group.sizes, { p, s });
    const pv = h('div', chk.ok ? 'callout okay' : 'suppressed', root);
    pv.style.marginBottom = '16px';
    if (chk.ok) {
      h('h4', null, pv, `✓ Privacy check passed: ${chk.n} institutions, largest is ${fmt.pct(chk.maxShare, 0)} of group balance`);
      h('p', null, pv, `Rules: at least ${C.privacy.minPeers} institutions, and no single institution above ${C.privacy.maxShare * 100}% of group balance. Peer names are never shown.`);
    } else {
      h('strong', null, pv, '⚠');
      const tx = h('div', null, pv);
      h('strong', null, tx, 'Peer benchmark suppressed. ');
      h('span', null, tx, chk.reason + ' Try a broader group.');
    }

    const t = S.latest(), t6 = S.monthsAgo(6);
    const M = S.METRICS[metric];
    const f = { p, s };
    const mv = S.value('member', metric, Object.assign({ m: t }, f));
    const iv = S.value('industry', metric, Object.assign({ m: t }, f));
    const ps = S.peerSeries(group, metric, f);
    const pvv = ps.suppressed ? null : ps.points[ps.points.length - 1].y;
    const mv6 = S.value('member', metric, Object.assign({ m: t6 }, f));
    const pv6 = ps.suppressed ? null : ps.points[ps.points.length - 7].y;

    const tiles = h('div', 'grid g4', root);
    const good = (d) => (M.bad ? d < 0 : d > 0);
    stat(tiles, { label: `You · ${M.short}`, value: fmt.pct(mv), delta: fmt.pp(mv - mv6), deltaTone: good(mv - mv6) ? 'good' : 'bad', deltaNote: '6m' });
    stat(tiles, { label: `Peer group · ${M.short}`, value: pvv == null ? 'Suppressed' : fmt.pct(pvv), delta: pvv == null ? 'privacy rule' : fmt.pp(pvv - pv6), deltaTone: '', deltaNote: pvv == null ? '' : '6m' });
    stat(tiles, { label: 'Gap to peers', value: pvv == null ? '—' : fmt.bps(mv - pvv), delta: pvv == null ? '' : good(mv - pvv) ? 'better than peers' : 'worse than peers', deltaTone: pvv == null ? '' : good(mv - pvv) ? 'good' : 'bad' });
    stat(tiles, { label: 'Gap to industry', value: fmt.bps(mv - iv), delta: good(mv - iv) ? 'better than industry' : 'worse than industry', deltaTone: good(mv - iv) ? 'good' : 'bad' });

    const g = h('div', 'grid g2', root);
    g.style.marginTop = '16px';
    const mS = S.series('member', metric, f), iS = S.series('industry', metric, f);
    const c1 = card(g, {
      title: `${M.name}: trend`, sub: `${D.P[p].long} · ${stateName(s)}`,
      source: sourceText(['member', 'peers', 'industry']),
      table: () => ({ cols: [{ name: 'Month' }, { name: 'You', r: 1 }, { name: 'Peers', r: 1 }, { name: 'Industry', r: 1 }], rows: mS.map((x, i) => [ml(x.x), fmt.pct(x.y), ps.suppressed ? 'Suppressed' : fmt.pct(ps.points[i].y), fmt.pct(iS[i].y)]) })
    });
    PIQ.charts.line(c1.viz, {
      series: [{ name: C.member.name, color: 'var(--s1)', points: mS }, { name: group.name, color: 'var(--s2)', points: ps.points }, { name: 'Industry', color: 'var(--s3)', points: iS }],
      xLabel: ml, yFmt: (v) => fmt.pct(v), yTickFmt: fmt.metricTick(metric), endLabels: true, height: 270
    });

    const rows = D.STATES.map((x) => ({
      label: x.name,
      values: { mem: S.value('member', metric, { p, s: x.id, m: t }), peer: S.peerValue(group.id === 'custom' ? group : group.id, metric, { p, s: x.id, m: t }), ind: S.value('industry', metric, { p, s: x.id, m: t }) }
    }));
    const c2 = card(g, {
      title: `${M.short} by state`, sub: ml(t) + ' · the gap between dots is your story',
      source: sourceText(['member', 'peers', 'industry']),
      table: () => ({ cols: [{ name: 'State' }, { name: 'You', r: 1 }, { name: 'Peers', r: 1 }, { name: 'Industry', r: 1 }], rows: rows.map((r) => [r.label, fmt.pct(r.values.mem), fmt.pct(r.values.peer), fmt.pct(r.values.ind)]) })
    });
    PIQ.charts.dots(c2.viz, { rows, series: [{ key: 'mem', name: C.member.name, color: 'var(--s1)' }, { key: 'peer', name: 'Peers', color: 'var(--s2)' }, { key: 'ind', name: 'Industry', color: 'var(--s3)' }], fmt: (v) => fmt.pct(v) });

    // Diverging heatmap: member vs industry ratio
    const c3 = card(g, { cls: 'span2', title: 'Where you differ from the market: state × risk band', sub: `Your ${M.short} ÷ industry ${M.short} in the same cell (${ml(t)}). ${M.bad ? 'Red = worse than market, blue = better.' : 'Blue = better than market, red = worse.'}`, source: sourceText(['member', 'industry'], 'like-for-like segments remove mix effects') });
    const tb = h('table', 'tbl heat', h('div', 'table-wrap', c3.viz));
    const hr = h('tr', null, h('thead', null, tb));
    h('th', null, hr, 'State');
    D.BANDS.forEach((b) => { const th = h('th', null, hr, b.name + ' (' + b.range + ')'); th.style.textAlign = 'center'; });
    const body = h('tbody', null, tb);
    D.STATES.forEach((x) => {
      const r = h('tr', null, body);
      h('td', null, r, x.name);
      D.BANDS.forEach((b) => {
        const a = S.value('member', metric, { p, s: x.id, b: b.id, m: t }), ii = S.value('industry', metric, { p, s: x.id, b: b.id, m: t });
        const ratio = a / ii;
        const worse = M.bad ? ratio > 1 : ratio < 1;
        const k = Math.min(1, Math.abs(Math.log(ratio)) / Math.log(1.8));
        const td = h('td', 'cell', r, ratio.toFixed(2) + '×');
        td.style.background = `color-mix(in oklab, ${worse ? 'var(--div-pos)' : 'var(--div-neg)'} ${Math.round(k * 85)}%, var(--div-mid))`;
        td.style.color = k > 0.55 ? '#fff' : 'var(--ink)';
        td.title = `You ${fmt.pct(a)} vs industry ${fmt.pct(ii)}`;
      });
    });
  }
  PIQ.views.benchmark = { title: 'Peer Benchmarking', render };
})();
