/* Global configuration. Rename the product or the demo member here only. */
(function (root) {
  root.PIQ = root.PIQ || {};
  root.PIQ.config = {
    productName: 'PortfolioIQ',
    tagline: 'Credit & Lending Intelligence',
    member: {
      id: 'SAHYADRI',
      name: 'Sahyadri Bank',
      type: 'Mid-size private bank',
      user: 'Priya Menon',
      role: 'Chief Risk Officer'
    },
    // Policy score cut-offs currently live at the demo member (used by the simulator & recommendations)
    currentCutoff: { PL: 680, CC: 720 },
    previousCutoff: { PL: 700, CC: 720 },
    policyChangeMonth: '2026-02',
    // Privacy guardrails for peer benchmarking
    privacy: { minPeers: 5, maxShare: 0.25 },
    // LLM: when the page is served by server.js and an approved LLM is configured there,
    // the AI Analyst uses it for language; all numbers still come from governed tools.
    llmEndpoint: '/api/llm',
    dataAsOf: 'Aug 2026',
    loginsAsOf: '26 Sep 2026'
  };
})(typeof window !== 'undefined' ? window : globalThis);
