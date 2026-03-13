export interface RawPosition {
  ticker: string;
  shares: number;
  costBasis: number;
}

export interface EnrichedPosition {
  id: number;
  sessionId: string;
  ticker: string;
  shares: number;
  costBasis: number;
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
  fetchedAt: string | null;
  fetchError: string | null;
}

export interface PortfolioSummary {
  totalValue: number;
  totalCostBasis: number;
  totalGainLoss: number;
  totalGainLossPct: number;
  averageMarginOfSafety: number | null;
  undervaluedCount: number;
  overvaluedCount: number;
  naCount: number;
  fetchErrors: string[];
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
