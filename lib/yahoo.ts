import YahooFinance from "yahoo-finance2";
import type { YahooFundamentals } from "@/types/yahoo";
import { QuoteSummaryResult } from "yahoo-finance2/modules/quoteSummary-iface";

// yahoo-finance2 v3: must be instantiated as a class
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const MODULES = ["price", "defaultKeyStatistics", "summaryDetail", "financialData", "calendarEvents", "assetProfile"] as const;

/**
 * Parse a raw Yahoo quoteSummary result (live or deserialized from DB cache)
 * into YahooFundamentals. All field mapping lives here — this is the single
 * source of truth, so adding a new field only requires changing this function.
 */
export function parseYahooResult(result: Record<string, unknown>): Omit<YahooFundamentals, "rawData"> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = result as QuoteSummaryResult;
  const price = r.price;
  const stats = r.defaultKeyStatistics;
  const summary = r.summaryDetail;
  const financial = r.financialData;
  const calendar = r.calendarEvents;
  const profile = r.assetProfile;

  // Yahoo returns D/E as a percentage integer (e.g. 150 = 1.5×). Normalize to ratio.
  const rawDE = financial?.debtToEquity != null ? financial.debtToEquity : null;
  const deRatio = rawDE !== null ? rawDE / 100 : null;

  // Nearest upcoming earnings date — stored as ISO string in cache, Date in live result
  const earningsDateArr = calendar?.earnings?.earningsDate;
  const rawDate = earningsDateArr && earningsDateArr.length > 0 ? earningsDateArr[0] : null;
  const nextEarningsDate = rawDate ? new Date(rawDate) : null;

  const numOrNull = (v: unknown): number | null =>
    v != null && typeof v === "number" ? v : null;

  return {
    currentPrice: price?.regularMarketPrice ?? null,
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
  };
}

/** Fetch live data from Yahoo Finance and parse it. */
export async function fetchFundamentals(ticker: string): Promise<YahooFundamentals> {
  const result = await yf.quoteSummary(
    ticker,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { modules: MODULES as any },
    { validateResult: false }
  );
  const raw = result as QuoteSummaryResult;
  return {
    ...parseYahooResult(raw),
    rawData: JSON.stringify(raw),
  };
}
