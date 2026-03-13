import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchFundamentals } from "@/lib/yahoo";
import { computeGrahamNumber, computeMarginOfSafety } from "@/lib/graham";
import { delay } from "@/lib/rate-limiter";
import type { PortfolioAnalyzeRequest, PortfolioAnalyzeResponse, EnrichedPosition } from "@/types/portfolio";

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

  // Create a new portfolio session
  const session = await prisma.portfolioSession.create({
    data: { source },
  });

  const enrichedPositions: EnrichedPosition[] = [];
  const fetchErrors: string[] = [];

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    if (i > 0) await delay(500); // Rate limit yahoo-finance2

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
    const gainLoss = fundamentals?.currentPrice != null
      ? (fundamentals.currentPrice - pos.costBasis) * pos.shares
      : null;
    const gainLossPct = fundamentals?.currentPrice != null && pos.costBasis > 0
      ? (fundamentals.currentPrice - pos.costBasis) / pos.costBasis
      : null;

    const dbPosition = await prisma.portfolioPosition.create({
      data: {
        sessionId: session.id,
        ticker: pos.ticker,
        shares: pos.shares,
        costBasis: pos.costBasis,
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
        fetchedAt: fundamentals ? new Date() : null,
        fetchError,
      },
    });

    enrichedPositions.push({
      id: dbPosition.id,
      sessionId: session.id,
      ticker: pos.ticker,
      shares: pos.shares,
      costBasis: pos.costBasis,
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
      nextEarningsDate: fundamentals?.nextEarningsDate?.toISOString() ?? null,
      grahamNumber,
      marginOfSafety,
      currentValue,
      gainLoss,
      gainLossPct,
      fetchedAt: fundamentals ? new Date().toISOString() : null,
      fetchError,
    });
  }

  // Compute portfolio summary
  const totalValue = enrichedPositions.reduce((s, p) => s + (p.currentValue ?? 0), 0);
  const totalCostBasis = enrichedPositions.reduce((s, p) => s + p.costBasis * p.shares, 0);
  const totalGainLoss = totalValue - totalCostBasis;
  const totalGainLossPct = totalCostBasis > 0 ? totalGainLoss / totalCostBasis : 0;

  const mosValues = enrichedPositions
    .map((p) => p.marginOfSafety)
    .filter((v): v is number => v !== null);
  const averageMarginOfSafety =
    mosValues.length > 0
      ? mosValues.reduce((a, b) => a + b, 0) / mosValues.length
      : null;

  const undervaluedCount = enrichedPositions.filter(
    (p) => p.marginOfSafety !== null && p.marginOfSafety >= 0
  ).length;
  const overvaluedCount = enrichedPositions.filter(
    (p) => p.marginOfSafety !== null && p.marginOfSafety < 0
  ).length;
  const naCount = enrichedPositions.filter((p) => p.marginOfSafety === null).length;

  const response: PortfolioAnalyzeResponse = {
    sessionId: session.id,
    positions: enrichedPositions,
    summary: {
      totalValue,
      totalCostBasis,
      totalGainLoss,
      totalGainLossPct,
      averageMarginOfSafety,
      undervaluedCount,
      overvaluedCount,
      naCount,
      fetchErrors,
    },
  };

  return NextResponse.json(response);
}
