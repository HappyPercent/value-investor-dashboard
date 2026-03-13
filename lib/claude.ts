import Anthropic from "@anthropic-ai/sdk";
import type { EnrichedPosition } from "@/types/portfolio";
import type { ScreenerResult } from "@/types/screener";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export function buildPortfolioPrompt(positions: EnrichedPosition[]): string {
  const positionData = positions.map((p) => ({
    ticker: p.ticker,
    company: p.companyName,
    sector: p.sector,
    shares: p.shares,
    costBasis: p.costBasis,
    currentPrice: p.currentPrice,
    gainLossPct: p.gainLossPct != null ? `${(p.gainLossPct * 100).toFixed(1)}%` : null,
    grahamNumber: p.grahamNumber?.toFixed(2) ?? null,
    marginOfSafety: p.marginOfSafety != null ? `${(p.marginOfSafety * 100).toFixed(1)}%` : null,
    pe: p.peRatio?.toFixed(1) ?? null,
    pb: p.pbRatio?.toFixed(2) ?? null,
    de: p.deRatio?.toFixed(2) ?? null,
    currentRatio: p.currentRatio?.toFixed(2) ?? null,
    error: p.fetchError ?? null,
  }));

  return `You are a value investor analyst following Benjamin Graham's principles. Be concise, factual, and grounded in the numbers provided.

Analyze this portfolio using Graham value investing principles. For each stock, provide 2-3 sentences covering: how the current price compares to the Graham Number, key risk factors based on the fundamentals, and a clear buy/hold/sell rationale.

Note: For financial sector stocks (banks, insurance) and REITs, flag that Graham Number is less meaningful due to their balance sheet structure.

After the per-stock commentary, provide a 3-4 sentence overall portfolio summary covering diversification, average margin of safety, top concerns, and overall quality.

Portfolio data:
${JSON.stringify(positionData, null, 2)}

Respond with valid JSON only, no markdown fences:
{
  "stocks": [
    { "ticker": "AAPL", "commentary": "..." }
  ],
  "summary": "..."
}`;
}

export function buildEventsPrompt(positions: EnrichedPosition[]): string {
  const holdings = positions.map((p) => ({
    ticker: p.ticker,
    company: p.companyName,
    sector: p.sector,
    industry: p.industry,
    nextEarningsDate: p.nextEarningsDate,
  }));

  return `You are a financial research analyst. Given the following portfolio holdings, identify and list upcoming catalysts that could materially affect these stocks over the next 6 months.

For each relevant ticker, list:
1. The confirmed earnings date (if provided)
2. Industry-specific catalysts: FDA decisions, patent expirations, major contract renewals, regulatory decisions, product launches, or other sector-specific events

Be specific about timing where possible (e.g., "Q1 2025 earnings expected ~April 2025"). If no specific catalyst applies, skip that ticker.

Holdings:
${JSON.stringify(holdings, null, 2)}

Format as a readable list grouped by ticker, like:
**TICKER (Company Name)**
- Earnings: [date or estimated date]
- [Catalyst 1]
- [Catalyst 2]`;
}

export function buildTickerCommentaryPrompt(result: ScreenerResult): string {
  return `You are a Graham value investor analyst. Provide a brief 3-4 sentence analysis of ${result.ticker} (${result.companyName ?? "Unknown"}) from a value investing perspective.

Key metrics:
- Price: $${result.currentPrice?.toFixed(2) ?? "N/A"}
- Graham Number: $${result.grahamNumber?.toFixed(2) ?? "N/A"}
- Margin of Safety: ${result.marginOfSafety != null ? `${(result.marginOfSafety * 100).toFixed(1)}%` : "N/A"}
- P/E: ${result.peRatio?.toFixed(1) ?? "N/A"}
- P/B: ${result.pbRatio?.toFixed(2) ?? "N/A"}
- D/E: ${result.deRatio?.toFixed(2) ?? "N/A"}
- Current Ratio: ${result.currentRatio?.toFixed(2) ?? "N/A"}
- Sector: ${result.sector ?? "Unknown"}

Cover: valuation vs Graham Number, key strengths or risks from fundamentals, and a clear investment thesis (buy/avoid and why). Be direct and concise.`;
}

