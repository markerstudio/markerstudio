// Pure money helpers — no DB, no Notion, no React. Safe to import from both
// server and client bundles (the client finance form uses it too).

// Approximate USD→ILS used where a live per-day rate isn't fetched (the client
// statement, the admin client form, the history backfill). The live Finance
// view converts per day; here a steady average is enough.
export const APPROX_USD_ILS = 3.7;

// Live USD→ILS rate for a specific calendar day (ECB reference via
// Frankfurter). Used to FREEZE a dollar payment's shekel value at the moment
// it happens — the rate of that day, never re-valued later. A past day's rate
// never changes, so a tiny module cache makes repeats free; any fetch failure
// falls back to the steady average rather than blocking a payment.
const _rateCache = new Map<string, number>();
export async function usdIlsRateOn(date: string): Promise<number> {
  const day = (date || "").slice(0, 10) || new Date().toISOString().slice(0, 10);
  const hit = _rateCache.get(day);
  if (hit) return hit;
  try {
    const res = await fetch(`https://api.frankfurter.app/${day}?from=USD&to=ILS`, { cache: "no-store" });
    if (res.ok) {
      const j = await res.json();
      const r = j?.rates?.ILS;
      if (typeof r === "number" && r > 0) {
        _rateCache.set(day, r);
        return r;
      }
    }
  } catch {
    /* fall through to the approximate rate */
  }
  return APPROX_USD_ILS;
}

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
