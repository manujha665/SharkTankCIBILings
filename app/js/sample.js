/*
 * Generates the sample "member upload" file: the member's own sourcing-channel split, a field
 * the bureau does not hold. Consistent with the member dataset, so joins to industry work.
 */
(function (root) {
  const PIQ = (root.PIQ = root.PIQ || {});
  function sampleUploadCSV() {
    const D = PIQ.data;
    const months = D.MONTHS.slice(-6);
    const channels = ['Branch', 'DSA', 'Digital'];
    const lines = ['month,product,state,risk_band,sourcing_channel,balance_cr,dpd30_balance_cr'];
    months.forEach((m) => {
      D.STATES.forEach((st) => {
        D.BANDS.forEach((b) => {
          const r = D.member.find((x) => x.m === m && x.p === 'PL' && x.s === st.id && x.b === b.id);
          const hot = (st.id === 'GJ' || st.id === 'UP') && (b.id === 'NP' || b.id === 'SB');
          const share = hot ? { Branch: 0.25, DSA: 0.55, Digital: 0.2 } : { Branch: 0.45, DSA: 0.3, Digital: 0.25 };
          const mult = hot
            ? { Branch: 0.62, DSA: st.id === 'GJ' ? 1.42 : 1.3, Digital: 0.85 }
            : { Branch: 0.88, DSA: 1.12, Digital: 1.02 };
          const norm = channels.reduce((a, c) => a + share[c] * mult[c], 0);
          const rate = r.d30 / r.bal;
          channels.forEach((c) => {
            const bal = r.bal * share[c];
            lines.push([m, 'PL', st.name, b.name, c, bal.toFixed(2), (bal * rate * mult[c] / norm).toFixed(3)].join(','));
          });
        });
      });
    });
    return lines.join('\n');
  }
  PIQ.sampleUploadCSV = sampleUploadCSV;
})(typeof window !== 'undefined' ? window : globalThis);
