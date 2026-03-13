export interface YahooFundamentals {
  currentPrice: number | null;
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
  rawData?: string; // Store raw response for debugging
}
