import YahooFinance from "yahoo-finance2";
import type { YahooFundamentals } from "@/types/yahoo";
import { QuoteSummaryResult } from "yahoo-finance2/modules/quoteSummary-iface";

// yahoo-finance2 v3: must be instantiated as a class
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

// balanceSheetHistory is used as a fallback for tickers where fundamentalsTimeSeries
// doesn't return balance sheet data (e.g. financial/insurance companies).
const MODULES = [
  "price",
  "defaultKeyStatistics",
  "summaryDetail",
  "financialData",
  "calendarEvents",
  "assetProfile",
  "balanceSheetHistory",
] as const;

// ── fundamentalsTimeSeries helpers ────────────────────────────────────────────

interface TimeSeriesData {
  totalCurrentAssets: number | null;
  totalCurrentLiabilities: number | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  retainedEarnings: number | null;
  ebit: number | null;
  epsHistory: number[];
}

/**
 * Extract the numeric value from a fundamentalsTimeSeries entry.
 * Entries can be plain numbers, {reportedValue, date}, or {raw, fmt}.
 */
function tsValue(entry: unknown): number | null {
  if (entry == null) return null;
  if (typeof entry === "number") return entry;
  if (typeof entry === "object") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = entry as any;
    const v = e.reportedValue ?? e.raw ?? e.value ?? null;
    return typeof v === "number" ? v : null;
  }
  return null;
}


/**
 * Fetch balance sheet and income statement data via fundamentalsTimeSeries,
 * which replaced the deprecated balanceSheetHistory / incomeStatementHistory
 * quoteSummary submodules (broken since Nov 2024).
 */
async function fetchFundamentalsTimeSeries(ticker: string): Promise<TimeSeriesData> {
  const empty: TimeSeriesData = {
    totalCurrentAssets: null,
    totalCurrentLiabilities: null,
    totalAssets: null,
    totalLiabilities: null,
    retainedEarnings: null,
    ebit: null,
    epsHistory: [],
  };

  try {
    const period1 = new Date();
    period1.setFullYear(period1.getFullYear() - 5);

    // yahoo-finance2 fundamentalsTimeSeries:
    // - type: "annual" | "quarterly" | "trailing"
    // - module: "financials" | "balance-sheet" | "cash-flow" | "all"
    // processResponse() strips the type prefix so returned keys are flat:
    // annualTotalAssets → totalAssets, annualCurrentAssets → currentAssets, EBIT stays EBIT, etc.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await (yf as any).fundamentalsTimeSeries(
      ticker,
      { period1: period1.toISOString().slice(0, 10), type: "annual", module: "all" },
      { validateResult: false }
    );

    // result is an array of per-period objects with flat keys (annual prefix stripped)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entries: any[] = Array.isArray(result) ? result : [];
    if (entries.length === 0) return empty;

    // Sort descending by date so entries[0] is the most recent period
    entries.sort((a, b) => {
      const da = a.date instanceof Date ? a.date.getTime() : 0;
      const db = b.date instanceof Date ? b.date.getTime() : 0;
      return db - da;
    });

    const latest = entries[0];

    // Balance sheet (most recent annual)
    // API returns flat field names (not "annual"-prefixed)
    const totalCurrentAssets = tsValue(latest.currentAssets);
    const totalCurrentLiabilities = tsValue(latest.currentLiabilities);
    const totalAssets = tsValue(latest.totalAssets);
    const totalLiabilities = tsValue(latest.totalLiabilitiesNetMinorityInterest);
    const retainedEarnings = tsValue(latest.retainedEarnings);

    // Income statement (most recent annual)
    const ebit = tsValue(latest.EBIT);

    // EPS history: most recent first, up to 4 years
    const epsHistory: number[] = [];
    for (const entry of entries.slice(0, 4)) {
      // Prefer diluted EPS directly; fall back to netIncome / dilutedShares
      const directEPS = tsValue(entry.dilutedEPS) ?? tsValue(entry.basicEPS);
      if (directEPS !== null) {
        epsHistory.push(directEPS);
        continue;
      }
      const ni = tsValue(entry.netIncomeCommonStockholders) ?? tsValue(entry.netIncome);
      const sh = tsValue(entry.dilutedAverageShares) ?? tsValue(entry.basicAverageShares);
      if (ni !== null && sh !== null && sh > 0) {
        epsHistory.push(ni / sh);
      }
    }

    return {
      totalCurrentAssets,
      totalCurrentLiabilities,
      totalAssets,
      totalLiabilities,
      retainedEarnings,
      ebit,
      epsHistory,
    };
  } catch (e) {
    console.error("Error fetching fundamentals time series:", e);
    return empty;
  }
}

// ── parseYahooResult ──────────────────────────────────────────────────────────

/**
 * Parse a raw Yahoo quoteSummary result into YahooFundamentals.
 * Balance sheet / income statement fields are null here — they come from
 * fundamentalsTimeSeries and are merged in fetchFundamentals.
 */
export function parseYahooResult(result: Record<string, unknown>): Omit<YahooFundamentals, "rawData"> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = result as QuoteSummaryResult & Record<string, any>;
  const price = r.price;
  const stats = r.defaultKeyStatistics;
  const summary = r.summaryDetail;
  const financial = r.financialData;
  const calendar = r.calendarEvents;
  const profile = r.assetProfile;
  // Most recent annual balance sheet statement (fallback when timeseries lacks data)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bs = r.balanceSheetHistory?.balanceSheetStatements?.[0] as any;
  console.log("[balanceSheetHistory] bs:", bs);

  // Yahoo returns D/E as a percentage integer (e.g. 150 = 1.5×). Normalize to ratio.
  const rawDE = financial?.debtToEquity != null ? financial.debtToEquity : null;
  const deRatio = rawDE !== null ? rawDE / 100 : null;

  // Nearest upcoming earnings date
  const earningsDateArr = calendar?.earnings?.earningsDate;
  const rawDate = earningsDateArr && earningsDateArr.length > 0 ? earningsDateArr[0] : null;
  const nextEarningsDate = rawDate ? new Date(rawDate) : null;

  const numOrNull = (v: unknown): number | null =>
    v != null && typeof v === "number" ? v : null;

  return {
    currentPrice: price?.regularMarketPrice ?? null,
    priceCurrency: (price?.currency as string | null | undefined) ?? null,
    companyName: (price?.longName as string | null | undefined) ?? (price?.shortName as string | null | undefined) ?? null,
    sector: (profile?.sector as string | null | undefined) ?? (price?.sector as string | null | undefined) ?? null,
    industry: (profile?.industry as string | null | undefined) ?? (price?.industry as string | null | undefined) ?? null,
    marketCap: price?.marketCap ?? null,
    trailingEPS: numOrNull(stats?.trailingEps),
    bookValuePerShare: numOrNull(stats?.bookValue),
    peRatio: numOrNull(summary?.trailingPE) ?? numOrNull(price?.trailingPE),
    pbRatio: numOrNull(stats?.priceToBook) ?? numOrNull(summary?.priceToBook),
    deRatio,
    currentRatio: financial?.currentRatio ?? null,
    dividendYield: numOrNull(stats?.dividendYield) ?? numOrNull(price?.dividendYield),
    nextEarningsDate,

    // Profitability
    returnOnEquity: numOrNull(financial?.returnOnEquity),
    returnOnAssets: numOrNull(financial?.returnOnAssets),
    grossMargins: numOrNull(financial?.grossMargins),
    operatingMargins: numOrNull(financial?.operatingMargins),
    revenueGrowth: numOrNull(financial?.revenueGrowth),
    earningsGrowth: numOrNull(financial?.earningsGrowth),

    // Cash flow & debt
    freeCashflow: numOrNull(financial?.freeCashflow),
    operatingCashflow: numOrNull(financial?.operatingCashflow),
    totalDebt: numOrNull(financial?.totalDebt),
    totalCash: numOrNull(financial?.totalCash),

    // Share data
    sharesOutstanding: numOrNull(stats?.sharesOutstanding),
    forwardEPS: numOrNull(stats?.forwardEps),

    // Revenue (available from financialData; EBIT + balance sheet come from timeseries)
    revenue: numOrNull(financial?.totalRevenue),

    // Prefer timeseries data; fall back to balanceSheetHistory when timeseries lacks data
    totalCurrentAssets: numOrNull(bs?.totalCurrentAssets),
    totalCurrentLiabilities: numOrNull(bs?.totalCurrentLiabilities),
    totalAssets: numOrNull(bs?.totalAssets),
    totalLiabilities: numOrNull(bs?.totalLiab),
    retainedEarnings: numOrNull(bs?.retainedEarnings),
    ebit: null,
    epsHistory: [],
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch the current exchange rate between two currencies using Yahoo Finance.
 * e.g. fetchExchangeRate("EUR", "USD") returns how many USD per 1 EUR.
 */
export async function fetchExchangeRate(from: string, to: string): Promise<number> {
  if (from === to) return 1;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const quote = await (yf as any).quote(`${from}${to}=X`);
    const rate = quote?.regularMarketPrice ?? null;
    if (typeof rate === "number" && rate > 0) return rate;
  } catch (e) {
    console.error(`Failed to fetch exchange rate ${from}/${to}:`, e);
  }
  // Fallback: approximate rate
  if (from === "EUR" && to === "USD") return 1.08;
  if (from === "USD" && to === "EUR") return 0.93;
  return 1;
}

/** Fetch live data from Yahoo Finance and parse it. */
export async function fetchFundamentals(ticker: string): Promise<YahooFundamentals> {
  const [result, timeSeries] = await Promise.all([
    yf.quoteSummary(
      ticker,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { modules: MODULES as any },
      { validateResult: false }
    ),
    fetchFundamentalsTimeSeries(ticker),
  ]);

  const raw = result as QuoteSummaryResult;
  const base = parseYahooResult(raw);
  return {
    ...base,
    // Timeseries values win only when non-null (so balanceSheetHistory fallback is preserved)
    totalCurrentAssets: timeSeries.totalCurrentAssets ?? base.totalCurrentAssets,
    totalCurrentLiabilities: timeSeries.totalCurrentLiabilities ?? base.totalCurrentLiabilities,
    totalAssets: timeSeries.totalAssets ?? base.totalAssets,
    totalLiabilities: timeSeries.totalLiabilities ?? base.totalLiabilities,
    retainedEarnings: timeSeries.retainedEarnings ?? base.retainedEarnings,
    ebit: timeSeries.ebit ?? base.ebit,
    epsHistory: timeSeries.epsHistory.length ? timeSeries.epsHistory : base.epsHistory,
    rawData: JSON.stringify(raw),
  };
}
