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
    currentCutoff: { PL: 680, CC: 720, HL: 700, LAP: 700, AL: 700, TW: 680, GL: 650, MSME: 700, AGRI: 650, MFL: 650 },
    previousCutoff: { PL: 700, CC: 720, HL: 700, LAP: 700, AL: 700, TW: 680, GL: 650, MSME: 700, AGRI: 650, MFL: 650 },
    policyChangeMonth: '2026-02',
    // Privacy guardrails for peer benchmarking
    privacy: { minPeers: 5, maxShare: 0.25 },
    // LLM: when the page is served by server.js and an approved LLM is configured there,
    // the AI Analyst uses it for language; all numbers still come from governed tools.
    llmEndpoint: '/api/llm',
    // Cross-segment overlap (bureau-wide). MFI figures from the team's working estimate; others illustrative.
    overlap: {
      mfiLiveBorrowersCr: 8.0,     // live microfinance borrowers (crore)
      mfiAnyRetailPct: 0.5,        // any retail footprint: enquiry + live + closed retail trade lines
      mfiLiveLivePct: 0.25,        // live MFI loan AND live retail loan
      msmeLiveEntitiesCr: 1.2,     // live MSME / commercial borrowers (crore, illustrative)
      msmeLinkedPct: 0.78,         // entities whose directors / partners / proprietors / guarantors are matched to consumer records
      msmePromoterRetailPct: 0.64  // of linked entities, share with a promoter holding a live retail loan
    },
    dataAsOf: 'Aug 2026',
    loginsAsOf: '26 Sep 2026'
  };
})(typeof window !== 'undefined' ? window : globalThis);
