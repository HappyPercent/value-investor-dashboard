import YahooFinance from "yahoo-finance2";
import type { YahooFundamentals } from "@/types/yahoo";
import { QuoteSummaryResult } from "yahoo-finance2/modules/quoteSummary-iface";

// yahoo-finance2 v3: must be instantiated as a class
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export async function fetchFundamentals(ticker: string): Promise<YahooFundamentals> {
  const result = await yf.quoteSummary(
    ticker,
    { modules: ["price", "defaultKeyStatistics", "summaryDetail", "financialData", "calendarEvents", "assetProfile"] },
    { validateResult: false }
  ) as QuoteSummaryResult;

  const price = result.price;
  const stats = result.defaultKeyStatistics;
  const summary = result.summaryDetail;
  const financial = result.financialData;
  const calendar = result.calendarEvents;
  const profile = result.assetProfile;

  // Yahoo returns D/E as a percentage integer (e.g. 150 = 1.5×). Normalize to ratio.
  const rawDE = financial?.debtToEquity != null ? financial.debtToEquity : null;
  const deRatio = rawDE !== null ? rawDE / 100 : null;

  // Nearest upcoming earnings date
  const earningsDateArr = calendar?.earnings?.earningsDate;
  const nextEarningsDate =
    earningsDateArr && earningsDateArr.length > 0
      ? (earningsDateArr[0] as unknown as Date)
      : null;

  // Many stats fields are typed as Percent | number — coerce safely to number | null
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
    rawData: JSON.stringify(result), // Store raw response for debugging
  };
}
