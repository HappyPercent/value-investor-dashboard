export interface YahooFundamentals {
  currentPrice: number | null;
  priceCurrency: string | null;
  companyName: string | null;
  sector: string | null;
  industry: string | null;
  marketCap: number | null;
  trailingEPS: number | null;
  bookValuePerShare: number | null;
  peRatio: number | null;
  pbRatio: number | null;
  deRatio: number | null;
  currentRatio: number | null;
  dividendYield: number | null;
  nextEarningsDate: Date | null;

  // Profitability & efficiency (from financialData)
  returnOnEquity: number | null;
  returnOnAssets: number | null;
  grossMargins: number | null;
  operatingMargins: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;

  // Cash flow & debt (from financialData)
  freeCashflow: number | null;
  operatingCashflow: number | null;
  totalDebt: number | null;
  totalCash: number | null;

  // Share data (from defaultKeyStatistics)
  sharesOutstanding: number | null;
  forwardEPS: number | null;

  // Balance sheet (from balanceSheetHistory — most recent annual)
  totalCurrentAssets: number | null;
  totalCurrentLiabilities: number | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  retainedEarnings: number | null;

  // Income statement (from incomeStatementHistory — most recent annual)
  ebit: number | null;
  revenue: number | null;

  // EPS history: net income / shares for last ≤4 annual periods, most recent first
  epsHistory: number[];

  rawData?: string;
}
