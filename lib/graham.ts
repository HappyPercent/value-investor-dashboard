import type { ValuationLabel } from "@/types/portfolio";

/**
 * Graham Number = √(22.5 × EPS × Book Value Per Share)
 * Only valid when both EPS and BVPS are strictly positive.
 */
export function computeGrahamNumber(
  eps: number | null,
  bvps: number | null
): number | null {
  if (eps === null || bvps === null) return null;
  if (eps <= 0 || bvps <= 0) return null;
  const result = Math.sqrt(22.5 * eps * bvps);
  if (!isFinite(result) || isNaN(result)) return null;
  return result;
}

/**
 * Margin of Safety = (Graham Number - Price) / Graham Number
 * Returns a decimal (e.g. 0.35 = 35%). Negative means overvalued.
 */
export function computeMarginOfSafety(
  grahamNumber: number | null,
  price: number | null
): number | null {
  if (grahamNumber === null || price === null) return null;
  if (price <= 0) return null;
  return (grahamNumber - price) / grahamNumber;
}

/**
 * BUY  ≥ 30% MoS
 * HOLD  0–30% MoS
 * SELL  < 0% MoS (overvalued)
 * N/A   null (not calculable)
 */
export function getValuationLabel(mos: number | null): ValuationLabel {
  if (mos === null) return "N/A";
  if (mos >= 0.3) return "BUY";
  if (mos >= 0) return "HOLD";
  return "SELL";
}
