export interface ScreenerResult {
  ticker: string;
  index: string;
  companyName: string | null;
  sector: string | null;
  industry: string | null;
  currentPrice: number | null;
  grahamNumber: number | null;
  marginOfSafety: number | null;
  peRatio: number | null;
  pbRatio: number | null;
  deRatio: number | null;
  currentRatio: number | null;
  dividendYield: number | null;
  marketCap: number | null;
  fetchedAt: string | null;
  fetchError: string | null;
}

export interface ScreenerFilters {
  peMin?: number;
  peMax?: number;
  pbMin?: number;
  pbMax?: number;
  deMin?: number;
  deMax?: number;
  mosMin?: number;   // 0-100 percent
  mosMax?: number;   // 0-100 percent
  crMin?: number;
  crMax?: number;
  marketCapMin?: number; // billions USD
  marketCapMax?: number; // billions USD
  index?: "SP500" | "RUSSELL2000" | "ALL";
  sortBy?: "marginOfSafety" | "peRatio" | "pbRatio" | "deRatio" | "currentRatio" | "dividendYield" | "currentPrice" | "grahamNumber" | "ticker";
  sortOrder?: "asc" | "desc";
}

export interface ScreenerResultsResponse {
  results: ScreenerResult[];
  total: number;
  page: number;
  pageSize: number;
  lastSeededAt: string | null;
  staleTickers: number;
}

export interface SeedOptions {
  index?: "SP500" | "RUSSELL2000" | "ALL";
  forceRefresh?: boolean;
}

export type SeedProgressEvent =
  | { type: "seed_start"; jobId: number; total: number }
  | { type: "ticker_done"; ticker: string; success: boolean; processed: number; total: number }
  | { type: "seed_complete"; jobId: number; succeeded: number; failed: number; durationMs: number }
  | { type: "error"; message: string };
