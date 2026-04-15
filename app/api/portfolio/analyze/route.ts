import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchFundamentals, fetchExchangeRate } from "@/lib/yahoo";
import { computeGrahamNumber, computeMarginOfSafety, computeAltmanZ, computeNCAVPerShare } from "@/lib/graham";
import { delay } from "@/lib/rate-limiter";
import type { PortfolioAnalyzeRequest, PortfolioAnalyzeResponse, EnrichedPosition, PortfolioSummary } from "@/types/portfolio";

// ── Currency helpers ──────────────────────────────────────────────────────────

/** Convert a value from `from` currency to EUR using the given EUR/USD rate. */
function toEur(value: number, from: string, eurUsdRate: number): number {
  if (from === "EUR") return value;
  if (from === "USD") return value / eurUsdRate;
  return value; // fallback: treat as EUR
}

/** Convert a cost basis in `costCurrency` to the `priceCurrency` for fair gain/loss calc. */
function convertCostBasis(costBasis: number, costCurrency: string, priceCurrency: string, eurUsdRate: number): number {
  if (costCurrency === priceCurrency) return costBasis;
  if (costCurrency === "EUR" && priceCurrency === "USD") return costBasis * eurUsdRate;
  if (costCurrency === "USD" && priceCurrency === "EUR") return costBasis / eurUsdRate;
  return costBasis; // other pairs: no conversion (expand later)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseEpsHistory(raw: string | null): number[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function dbPositionToEnriched(p: {
  id: number;
  sessionId: string;
  ticker: string;
  shares: number;
  costBasis: number;
  currency: string;
  priceCurrency: string | null;
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
  nextEarningsDate: Date | null;
  grahamNumber: number | null;
  marginOfSafety: number | null;
  currentValue: number | null;
  gainLoss: number | null;
  gainLossPct: number | null;
  returnOnEquity: number | null;
  returnOnAssets: number | null;
  grossMargins: number | null;
  operatingMargins: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  freeCashflow: number | null;
  operatingCashflow: number | null;
  totalDebt: number | null;
  totalCash: number | null;
  sharesOutstanding: number | null;
  forwardEPS: number | null;
  totalCurrentAssets: number | null;
  totalCurrentLiabilities: number | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  retainedEarnings: number | null;
  ebit: number | null;
  revenue: number | null;
  epsHistory: string | null;
  altmanZScore: number | null;
  ncavPerShare: number | null;
  fetchedAt: Date | null;
  fetchError: string | null;
}): EnrichedPosition {
  return {
    id: p.id,
    sessionId: p.sessionId,
    ticker: p.ticker,
    shares: p.shares,
    costBasis: p.costBasis,
    currency: p.currency,
    priceCurrency: p.priceCurrency,
    companyName: p.companyName,
    sector: p.sector,
    industry: p.industry,
    currentPrice: p.currentPrice,
    trailingEPS: p.trailingEPS,
    bookValuePerShare: p.bookValuePerShare,
    peRatio: p.peRatio,
    pbRatio: p.pbRatio,
    deRatio: p.deRatio,
    currentRatio: p.currentRatio,
    dividendYield: p.dividendYield,
    marketCap: p.marketCap,
    nextEarningsDate: p.nextEarningsDate?.toISOString() ?? null,
    grahamNumber: p.grahamNumber,
    marginOfSafety: p.marginOfSafety,
    currentValue: p.currentValue,
    gainLoss: p.gainLoss,
    gainLossPct: p.gainLossPct,
    returnOnEquity: p.returnOnEquity,
    returnOnAssets: p.returnOnAssets,
    grossMargins: p.grossMargins,
    operatingMargins: p.operatingMargins,
    revenueGrowth: p.revenueGrowth,
    earningsGrowth: p.earningsGrowth,
    freeCashflow: p.freeCashflow,
    operatingCashflow: p.operatingCashflow,
    totalDebt: p.totalDebt,
    totalCash: p.totalCash,
    sharesOutstanding: p.sharesOutstanding,
    forwardEPS: p.forwardEPS,
    totalCurrentAssets: p.totalCurrentAssets,
    totalCurrentLiabilities: p.totalCurrentLiabilities,
    totalAssets: p.totalAssets,
    totalLiabilities: p.totalLiabilities,
    retainedEarnings: p.retainedEarnings,
    ebit: p.ebit,
    revenue: p.revenue,
    epsHistory: parseEpsHistory(p.epsHistory),
    altmanZScore: p.altmanZScore,
    ncavPerShare: p.ncavPerShare,
    fetchedAt: p.fetchedAt?.toISOString() ?? null,
    fetchError: p.fetchError,
  };
}

// ── GET /api/portfolio/analyze?sessionId=xxx ──────────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");

  const session = sessionId
    ? await prisma.portfolioSession.findUnique({
        where: { id: sessionId },
        include: { positions: { orderBy: { id: "asc" } } },
      })
    : await prisma.portfolioSession.findFirst({
        orderBy: { createdAt: "desc" },
        include: { positions: { orderBy: { id: "asc" } } },
      });

  if (!session) {
    return NextResponse.json({ sessionId: null });
  }

  const positions: EnrichedPosition[] = session.positions.map(dbPositionToEnriched);

  const eurUsdRate = await fetchExchangeRate("EUR", "USD");

  // All totals converted to EUR for a consistent base currency
  const totalValue = positions.reduce((s, p) => s + toEur(p.currentValue ?? 0, p.priceCurrency ?? "USD", eurUsdRate), 0);
  const totalCostBasis = positions.reduce((s, p) => s + toEur(p.costBasis * p.shares, p.currency, eurUsdRate), 0);
  const totalGainLoss = totalValue - totalCostBasis;
  const totalGainLossPct = totalCostBasis > 0 ? totalGainLoss / totalCostBasis : 0;
  const mosValues = positions.map((p) => p.marginOfSafety).filter((v): v is number => v !== null);
  const averageMarginOfSafety = mosValues.length > 0 ? mosValues.reduce((a, b) => a + b, 0) / mosValues.length : null;
  const fetchErrors = positions.filter((p) => p.fetchError).map((p) => p.ticker);

  const summary: PortfolioSummary = {
    totalValue,
    totalCostBasis,
    totalGainLoss,
    totalGainLossPct,
    averageMarginOfSafety,
    undervaluedCount: positions.filter((p) => p.marginOfSafety !== null && p.marginOfSafety >= 0).length,
    overvaluedCount: positions.filter((p) => p.marginOfSafety !== null && p.marginOfSafety < 0).length,
    naCount: positions.filter((p) => p.marginOfSafety === null).length,
    fetchErrors,
    eurUsdRate,
  };

  return NextResponse.json({ sessionId, positions, summary } satisfies PortfolioAnalyzeResponse);
}

// ── POST /api/portfolio/analyze ───────────────────────────────────────────────

export async function POST(req: Request) {
  let body: PortfolioAnalyzeRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { source, positions } = body;
  if (!positions || positions.length === 0) {
    return NextResponse.json({ error: "No positions provided" }, { status: 400 });
  }

  try {
  // Replace any existing portfolio — only the last one is kept
  await prisma.aiAnalysis.deleteMany({});
  await prisma.portfolioSession.deleteMany({});

  const session = await prisma.portfolioSession.create({
    data: { source },
  });

  const enrichedPositions: EnrichedPosition[] = [];
  const fetchErrors: string[] = [];

  // Fetch EUR/USD rate once for the entire batch
  const eurUsdRate = await fetchExchangeRate("EUR", "USD");

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    if (i > 0) await delay(500);

    let fundamentals = null;
    let fetchError: string | null = null;

    try {
      fundamentals = await fetchFundamentals(pos.ticker);
    } catch (e) {
      fetchError = String(e);
      fetchErrors.push(pos.ticker);
    }

    const grahamNumber = fundamentals
      ? computeGrahamNumber(fundamentals.trailingEPS, fundamentals.bookValuePerShare)
      : null;
    const marginOfSafety = fundamentals
      ? computeMarginOfSafety(grahamNumber, fundamentals.currentPrice)
      : null;
    const currentValue = fundamentals?.currentPrice != null
      ? pos.shares * fundamentals.currentPrice
      : null;

    // Convert cost basis to the stock's price currency for an apples-to-apples comparison
    const priceCurrency = fundamentals?.priceCurrency ?? "USD";
    const costBasisInPriceCurrency = convertCostBasis(pos.costBasis, pos.currency, priceCurrency, eurUsdRate);
    const gainLoss = fundamentals?.currentPrice != null
      ? (fundamentals.currentPrice - costBasisInPriceCurrency) * pos.shares
      : null;
    const gainLossPct = fundamentals?.currentPrice != null && costBasisInPriceCurrency > 0
      ? (fundamentals.currentPrice - costBasisInPriceCurrency) / costBasisInPriceCurrency
      : null;

    const altmanZScore = fundamentals
      ? computeAltmanZ({
          totalCurrentAssets: fundamentals.totalCurrentAssets,
          totalCurrentLiabilities: fundamentals.totalCurrentLiabilities,
          totalAssets: fundamentals.totalAssets,
          retainedEarnings: fundamentals.retainedEarnings,
          ebit: fundamentals.ebit,
          marketCap: fundamentals.marketCap,
          totalLiabilities: fundamentals.totalLiabilities,
          revenue: fundamentals.revenue,
        })
      : null;

    const ncavPerShare = fundamentals
      ? computeNCAVPerShare({
          totalCurrentAssets: fundamentals.totalCurrentAssets,
          totalLiabilities: fundamentals.totalLiabilities,
          sharesOutstanding: fundamentals.sharesOutstanding,
        })
      : null;

    const dbPosition = await prisma.portfolioPosition.create({
      data: {
        sessionId: session.id,
        ticker: pos.ticker,
        shares: pos.shares,
        costBasis: pos.costBasis,
        currency: pos.currency,
        priceCurrency: fundamentals?.priceCurrency ?? null,
        companyName: fundamentals?.companyName ?? null,
        sector: fundamentals?.sector ?? null,
        industry: fundamentals?.industry ?? null,
        currentPrice: fundamentals?.currentPrice ?? null,
        trailingEPS: fundamentals?.trailingEPS ?? null,
        bookValuePerShare: fundamentals?.bookValuePerShare ?? null,
        peRatio: fundamentals?.peRatio ?? null,
        pbRatio: fundamentals?.pbRatio ?? null,
        deRatio: fundamentals?.deRatio ?? null,
        currentRatio: fundamentals?.currentRatio ?? null,
        dividendYield: fundamentals?.dividendYield ?? null,
        marketCap: fundamentals?.marketCap ?? null,
        nextEarningsDate: fundamentals?.nextEarningsDate ?? null,
        grahamNumber,
        marginOfSafety,
        currentValue,
        gainLoss,
        gainLossPct,
        returnOnEquity: fundamentals?.returnOnEquity ?? null,
        returnOnAssets: fundamentals?.returnOnAssets ?? null,
        grossMargins: fundamentals?.grossMargins ?? null,
        operatingMargins: fundamentals?.operatingMargins ?? null,
        revenueGrowth: fundamentals?.revenueGrowth ?? null,
        earningsGrowth: fundamentals?.earningsGrowth ?? null,
        freeCashflow: fundamentals?.freeCashflow ?? null,
        operatingCashflow: fundamentals?.operatingCashflow ?? null,
        totalDebt: fundamentals?.totalDebt ?? null,
        totalCash: fundamentals?.totalCash ?? null,
        sharesOutstanding: fundamentals?.sharesOutstanding ?? null,
        forwardEPS: fundamentals?.forwardEPS ?? null,
        totalCurrentAssets: fundamentals?.totalCurrentAssets ?? null,
        totalCurrentLiabilities: fundamentals?.totalCurrentLiabilities ?? null,
        totalAssets: fundamentals?.totalAssets ?? null,
        totalLiabilities: fundamentals?.totalLiabilities ?? null,
        retainedEarnings: fundamentals?.retainedEarnings ?? null,
        ebit: fundamentals?.ebit ?? null,
        revenue: fundamentals?.revenue ?? null,
        epsHistory: fundamentals?.epsHistory.length ? JSON.stringify(fundamentals.epsHistory) : null,
        altmanZScore,
        ncavPerShare,
        fetchedAt: fundamentals ? new Date() : null,
        fetchError,
      },
    });

    enrichedPositions.push(dbPositionToEnriched(dbPosition));
  }

  // All totals in EUR for a consistent base currency
  const totalValue = enrichedPositions.reduce((s, p) => s + toEur(p.currentValue ?? 0, p.priceCurrency ?? "USD", eurUsdRate), 0);
  const totalCostBasis = enrichedPositions.reduce((s, p) => s + toEur(p.costBasis * p.shares, p.currency, eurUsdRate), 0);
  const totalGainLoss = totalValue - totalCostBasis;
  const totalGainLossPct = totalCostBasis > 0 ? totalGainLoss / totalCostBasis : 0;
  const mosValues = enrichedPositions.map((p) => p.marginOfSafety).filter((v): v is number => v !== null);
  const averageMarginOfSafety = mosValues.length > 0 ? mosValues.reduce((a, b) => a + b, 0) / mosValues.length : null;

  const response: PortfolioAnalyzeResponse = {
    sessionId: session.id,
    positions: enrichedPositions,
    summary: {
      totalValue,
      totalCostBasis,
      totalGainLoss,
      totalGainLossPct,
      averageMarginOfSafety,
      undervaluedCount: enrichedPositions.filter((p) => p.marginOfSafety !== null && p.marginOfSafety >= 0).length,
      overvaluedCount: enrichedPositions.filter((p) => p.marginOfSafety !== null && p.marginOfSafety < 0).length,
      naCount: enrichedPositions.filter((p) => p.marginOfSafety === null).length,
      fetchErrors,
      eurUsdRate,
    },
  };

  return NextResponse.json(response);
  } catch (err) {
    console.error("[POST /api/portfolio/analyze] fatal:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
