export interface RawPosition {
  ticker: string;
  shares: number;
  costBasis: number;
  currency: string; // currency of costBasis, e.g. "EUR" or "USD"
}

export interface EnrichedPosition {
  id: number;
  sessionId: string;
  ticker: string;
  shares: number;
  costBasis: number;
  currency: string;         // currency of costBasis (e.g. "EUR")
  priceCurrency: string | null; // currency of currentPrice from Yahoo (e.g. "USD")
  companyName: string | null;
  sector: string | null;
  industry: string | null;
  currentPrice: number | null;
  trailingEPS: number | null;
  bookValuePerShare: number | null;
  peRatio: number | null;
  pbRatio: number | null;
  deRatio: number | null;
  currentRatio: number | null;
  dividendYield: number | null;
  marketCap: number | null;
  nextEarningsDate: string | null;
  grahamNumber: number | null;
  marginOfSafety: number | null;
  currentValue: number | null;
  gainLoss: number | null;
  gainLossPct: number | null;

  // Profitability & efficiency
  returnOnEquity: number | null;
  returnOnAssets: number | null;
  grossMargins: number | null;
  operatingMargins: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;

  // Cash flow & debt
  freeCashflow: number | null;
  operatingCashflow: number | null;
  totalDebt: number | null;
  totalCash: number | null;

  // Share data
  sharesOutstanding: number | null;
  forwardEPS: number | null;

  // Balance sheet
  totalCurrentAssets: number | null;
  totalCurrentLiabilities: number | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  retainedEarnings: number | null;

  // Income statement
  ebit: number | null;
  revenue: number | null;

  // EPS history (last ≤4 annual values, most recent first)
  epsHistory: number[] | null;

  // Computed Graham metrics
  altmanZScore: number | null;
  ncavPerShare: number | null;

  fetchedAt: string | null;
  fetchError: string | null;
}

export interface PortfolioSummary {
  totalValue: number;      // in EUR
  totalCostBasis: number;  // in EUR
  totalGainLoss: number;   // in EUR
  totalGainLossPct: number;
  averageMarginOfSafety: number | null;
  undervaluedCount: number;
  overvaluedCount: number;
  naCount: number;
  fetchErrors: string[];
  eurUsdRate: number;      // rate used for currency conversion
}

export interface PortfolioAnalyzeResponse {
  sessionId: string;
  positions: EnrichedPosition[];
  summary: PortfolioSummary;
}

export interface PortfolioAnalyzeRequest {
  source: "csv" | "manual";
  positions: RawPosition[];
}

export type ValuationLabel = "BUY" | "HOLD" | "SELL" | "N/A";

export interface SSEEvent {
  event: string;
  data: unknown;
}

// ── AI Deep Analysis ──────────────────────────────────────────────────────────

export interface TickerAnalysis {
  ticker: string;
  companyName: string;
  strengths: string[];
  weaknesses: string[];
  recentNews: Array<{
    headline: string;
    sentiment: "positive" | "negative" | "neutral";
  }>;
  upcomingEvents: Array<{
    date: string;
    event: string;
    significance: "high" | "medium" | "low";
  }>;
  grahamAssessment: string;
  verdict: "buy" | "hold" | "avoid";
}

export type AiAnalysisStreamEvent =
  | { type: "progress"; ticker: string; current: number; total: number }
  | { type: "result"; ticker: string; analysis: TickerAnalysis }
  | { type: "error"; ticker: string; error: string }
  | { type: "done" };
