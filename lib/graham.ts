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
 * Altman Z-Score (original 1968 public-company formula).
 * Z > 2.99 → Safe zone; 1.81–2.99 → Grey zone; < 1.81 → Distress zone.
 *
 * X1 = Working Capital / Total Assets
 * X2 = Retained Earnings / Total Assets
 * X3 = EBIT / Total Assets
 * X4 = Market Cap / Total Liabilities
 * X5 = Revenue / Total Assets
 */
export function computeAltmanZ(params: {
  totalCurrentAssets: number | null;
  totalCurrentLiabilities: number | null;
  totalAssets: number | null;
  retainedEarnings: number | null;
  ebit: number | null;
  marketCap: number | null;
  totalLiabilities: number | null;
  revenue: number | null;
}): number | null {
  const {
    totalCurrentAssets,
    totalCurrentLiabilities,
    totalAssets,
    retainedEarnings,
    ebit,
    marketCap,
    totalLiabilities,
    revenue,
  } = params;

  if (
    totalCurrentAssets === null ||
    totalCurrentLiabilities === null ||
    totalAssets === null ||
    totalAssets <= 0 ||
    retainedEarnings === null ||
    ebit === null ||
    marketCap === null ||
    totalLiabilities === null ||
    totalLiabilities <= 0 ||
    revenue === null
  ) {
    return null;
  }

  const workingCapital = totalCurrentAssets - totalCurrentLiabilities;
  const x1 = workingCapital / totalAssets;
  const x2 = retainedEarnings / totalAssets;
  const x3 = ebit / totalAssets;
  const x4 = marketCap / totalLiabilities;
  const x5 = revenue / totalAssets;

  const z = 1.2 * x1 + 1.4 * x2 + 3.3 * x3 + 0.6 * x4 + 1.0 * x5;
  return isFinite(z) ? Math.round(z * 100) / 100 : null;
}

/**
 * Net Current Asset Value per share = (Total Current Assets − Total Liabilities) / Shares Outstanding
 * Graham's "net-net" floor: price below NCAV/share is deeply undervalued.
 */
export function computeNCAVPerShare(params: {
  totalCurrentAssets: number | null;
  totalLiabilities: number | null;
  sharesOutstanding: number | null;
}): number | null {
  const { totalCurrentAssets, totalLiabilities, sharesOutstanding } = params;
  if (
    totalCurrentAssets === null ||
    totalLiabilities === null ||
    sharesOutstanding === null ||
    sharesOutstanding <= 0
  ) {
    return null;
  }
  const ncav = (totalCurrentAssets - totalLiabilities) / sharesOutstanding;
  return isFinite(ncav) ? Math.round(ncav * 100) / 100 : null;
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
