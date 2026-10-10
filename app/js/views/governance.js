/* Governance & Trust — guardrails, metric catalogue, AI audit trail. */
(function () {
  const PIQ = window.PIQ;
  const { h, pageHead, table } = PIQ.ui;
  const S = PIQ.sem, C = PIQ.config;

  function render(root) {
    pageHead(root, 'Governance & Trust', 'For a credit bureau, trust is the product. These guardrails are built into the platform, not bolted on, and each one is enforced in the data layer, not just the screen.');
    const g = h('div', 'grid g2', root);
    const c = h('div', 'card', g);
    h('h3', null, c, 'Guardrails');
    [
      ['🔐', 'Hard tenant isolation', `A member can only ever query its own portfolio. Requests for another lender's data are refused by the semantic layer, including when they come through the AI agent. Try asking the AI "Show me HDFC's delinquency".`],
      ['👥', 'Peer privacy rules', `Peer benchmarks need at least ${C.privacy.minPeers} institutions, and no single institution may exceed ${C.privacy.maxShare * 100}% of the group's balance. Otherwise the benchmark is suppressed, with the reason shown. Peers are never named.`],
      ['⛁', 'No number without a source', 'Every chart and every AI answer is computed by governed functions over approved datasets and shows its source, filters and as-of date. The language model never calculates or invents numbers. It only phrases results that the tools return.'],
      ['🧭', 'Scope control', 'The AI answers only from the platform\'s approved datasets. Questions outside scope (share prices, macro forecasts, individual borrowers) get a clear "not available" instead of a guess.'],
      ['📝', 'Full audit trail', 'Every query, including dashboard calls, simulations and AI tool calls, is logged with its parameters for compliance review.'],
      ['📤', 'Member uploads stay private', 'Uploaded files are processed within the member\'s tenant, never pooled into industry data and never visible to other members. In this prototype they never leave the browser.'],
      ['⚖', 'Regulatory alignment', 'Designed around CICRA 2005 and RBI credit information rules, plus the DPDP Act 2023 principles of purpose limitation and data minimisation. Only aggregated, non-personal outputs are shown. No borrower-level data is exposed.']
    ].forEach(([i, t, d]) => { const r = h('div', 'guard', c); h('div', 'guard-ico', r, i); const x = h('div', null, r); h('h4', null, x, t); h('p', null, x, d); });

    const right = h('div', 'grid', g);
    const m = h('div', 'card', right);
    h('h3', null, m, 'Approved metric catalogue');
    h('div', 'sub muted small', m, 'One definition per metric, used by every dashboard and by the AI');
    const mt = h('div', 'table-wrap', m); mt.style.marginTop = '10px';
    table(mt, { cols: [{ name: 'Metric' }, { name: 'Definition' }], rows: Object.values(S.METRICS).map((x) => [x.name, x.def]) });
    const d = h('div', 'card', right);
    h('h3', null, d, 'Approved datasets');
    const dt = h('div', 'table-wrap', d); dt.style.marginTop = '10px';
    table(dt, { cols: [{ name: 'Dataset' }, { name: 'Grain' }, { name: 'Refresh' }, { name: 'As of' }], rows: Object.values(S.DATASETS).map((x) => [x.name, x.grain, x.refresh, x.asOf]) });

    const a = h('div', 'card', root);
    a.style.marginTop = '16px';
    const ah = h('div', 'card-head', a);
    const at = h('div', null, ah);
    h('h3', null, at, 'Audit trail (this session)');
    h('div', 'sub', at, 'Every governed query, whether from a dashboard or the AI');
    const at2 = h('div', 'table-wrap', a);
    table(at2, { cols: [{ name: 'Time' }, { name: 'Origin' }, { name: 'Tool' }, { name: 'Parameters' }], rows: S.audit.slice(0, 40).map((x) => [x.ts.toLocaleTimeString(), x.by, x.tool, x.params]) });
    if (!S.audit.length) h('div', 'empty', a, 'No queries yet.');

    const l = h('div', 'card', root);
    l.style.marginTop = '16px';
    h('h3', null, l, 'AI model configuration');
    const st = h('p', 'muted', l, 'Checking…');
    PIQ.llm.status().then((s) => {
      st.textContent = s.ok
        ? `Connected to the approved LLM "${s.label}" through the platform gateway. The model receives tool definitions and returns tool calls; it never sees raw data tables.`
        : 'No LLM connected. The AI Analyst is running on the built-in governed engine (deterministic intent parser + the same tools). To connect an approved LLM, run server.js with the provider settings in docs/LLM_SETUP.md.';
    });
  }
  PIQ.views.governance = { title: 'Governance & Trust', render };
})();
