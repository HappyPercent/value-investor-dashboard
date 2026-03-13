import { prisma } from "@/lib/prisma";
import { FUNDAMENTALS_TTL_HOURS } from "@/lib/constants";
import type { ScreenerFilters, ScreenerResultsResponse } from "@/types/screener";

export async function queryScreener(
  filters: ScreenerFilters = {},
  page = 1,
  pageSize = 50
): Promise<ScreenerResultsResponse> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};

  if (filters.index && filters.index !== "ALL") where.index = filters.index;
  if (filters.peMax != null) where.peRatio = { lte: filters.peMax, not: null };
  if (filters.pbMax != null) where.pbRatio = { lte: filters.pbMax, not: null };
  if (filters.deMax != null) where.deRatio = { lte: filters.deMax, not: null };
  if (filters.mosMin != null) where.marginOfSafety = { gte: filters.mosMin / 100, not: null };
  if (filters.crMin != null) where.currentRatio = { gte: filters.crMin, not: null };

  const clampedPage = Math.max(1, page);
  const clampedSize = Math.min(200, Math.max(1, pageSize));

  const [total, rows, lastJob, staleCount] = await Promise.all([
    prisma.screenerTicker.count({ where }),
    prisma.screenerTicker.findMany({
      where,
      orderBy: { marginOfSafety: "desc" },
      skip: (clampedPage - 1) * clampedSize,
      take: clampedSize,
    }),
    prisma.seedJob.findFirst({
      where: { status: "completed" },
      orderBy: { completedAt: "desc" },
    }),
    prisma.screenerTicker.count({
      where: {
        OR: [
          { fetchedAt: null },
          { fetchedAt: { lt: new Date(Date.now() - FUNDAMENTALS_TTL_HOURS * 60 * 60 * 1000) } },
        ],
      },
    }),
  ]);

  return {
    results: rows.map((r) => ({
      ticker: r.ticker,
      index: r.index,
      companyName: r.companyName,
      sector: r.sector,
      industry: r.industry,
      currentPrice: r.currentPrice,
      grahamNumber: r.grahamNumber,
      marginOfSafety: r.marginOfSafety,
      peRatio: r.peRatio,
      pbRatio: r.pbRatio,
      deRatio: r.deRatio,
      currentRatio: r.currentRatio,
      dividendYield: r.dividendYield,
      marketCap: r.marketCap,
      fetchedAt: r.fetchedAt?.toISOString() ?? null,
      fetchError: r.fetchError,
    })),
    total,
    page: clampedPage,
    pageSize: clampedSize,
    lastSeededAt: lastJob?.completedAt?.toISOString() ?? null,
    staleTickers: staleCount,
  };
}
