// Pure money helpers — no DB, no Notion, no React. Safe to import from both
// server and client bundles (the client finance form uses it too).

// Approximate USD→ILS used where a live per-day rate isn't fetched (the client
// statement, the admin client form, the history backfill). The live Finance
// view converts per day; here a steady average is enough.
export const APPROX_USD_ILS = 3.7;

// Turn a free-text amount label into a single ILS figure, summing every
// currency it contains: "150 ILS + $50" → 150 + 50×rate, "$1,200" → converted,
// "1,800 ILS" → 1800. Robust to multi-currency labels — unlike a blanket
// strip-non-digits, it never concatenates "150" and "50" into 15050. A bare
// number with no currency marker is read as ILS (legacy single-currency rows).
export function amountLabelToIls(label: string): number {
  if (!label) return 0;
  const ilsM = label.match(/([\d,.]+)\s*ILS/i);
  const usdM = label.match(/\$\s*([\d,.]+)/);
  if (!ilsM && !usdM) return parseFloat(label.replace(/[^0-9.]/g, "")) || 0;
  const ils = ilsM ? parseFloat(ilsM[1].replace(/,/g, "")) || 0 : 0;
  const usd = usdM ? parseFloat(usdM[1].replace(/,/g, "")) || 0 : 0;
  return Math.round(ils + usd * APPROX_USD_ILS);
}
