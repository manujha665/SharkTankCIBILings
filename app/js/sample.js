/*
 * Generates the sample "member upload" file: the member's own approval-route split (which credit
 * desk approved each loan), a field
 * the bureau does not hold. Consistent with the member dataset, so joins to industry work.
 */
(function (root) {
  const PIQ = (root.PIQ = root.PIQ || {});
  function sampleUploadCSV() {
    const D = PIQ.data;
    const months = D.MONTHS.slice(-6);
    const CH = { Central: 'Central credit hub', Auto: 'Auto-approved (no manual review)', Regional: 'Regional credit hub' };
    const channels = ['Central', 'Auto', 'Regional'];
    const lines = ['month,product,state,risk_band,approval_route,balance_cr,dpd30_balance_cr'];
    months.forEach((m) => {
      D.STATES.forEach((st) => {
        D.BANDS.forEach((b) => {
          const r = D.cube.member.sum({ m, p: 'PL', s: st.id, b: b.id });
          const hot = (st.id === 'GJ' || st.id === 'UP') && (b.id === 'NP' || b.id === 'SB');
          const share = hot ? { Central: 0.25, Auto: 0.55, Regional: 0.2 } : { Central: 0.45, Auto: 0.3, Regional: 0.25 };
          const mult = hot
            ? { Central: 0.62, Auto: st.id === 'GJ' ? 1.42 : 1.3, Regional: 0.85 }
            : { Central: 0.88, Auto: 1.12, Regional: 1.02 };
          const norm = channels.reduce((a, c) => a + share[c] * mult[c], 0);
          const rate = r.d30 / r.bal;
          channels.forEach((c) => {
            const bal = r.bal * share[c];
            lines.push([m, 'PL', st.name, b.name, CH[c], bal.toFixed(2), (bal * rate * mult[c] / norm).toFixed(3)].join(','));
          });
        });
      });
    });
    return lines.join('\n');
  }
  PIQ.sampleUploadCSV = sampleUploadCSV;
})(typeof window !== 'undefined' ? window : globalThis);
