import { prisma } from "@/lib/prisma";
import { FUNDAMENTALS_TTL_HOURS } from "@/lib/constants";
import type { ScreenerFilters, ScreenerResultsResponse } from "@/types/screener";

export async function queryScreener(
  filters: ScreenerFilters = {},
  page = 1,
  pageSize = 50
): Promise<ScreenerResultsResponse> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {companyName: { not: null }}; // Exclude tickers that failed to fetch at all

  if (filters.index && filters.index !== "ALL") where.index = filters.index;

  if (filters.peMin != null || filters.peMax != null) {
    where.peRatio = { not: null, ...(filters.peMin != null && { gte: filters.peMin }), ...(filters.peMax != null && { lte: filters.peMax }) };
  }
  if (filters.pbMin != null || filters.pbMax != null) {
    where.pbRatio = { not: null, ...(filters.pbMin != null && { gte: filters.pbMin }), ...(filters.pbMax != null && { lte: filters.pbMax }) };
  }
  if (filters.deMin != null || filters.deMax != null) {
    where.deRatio = { not: null, ...(filters.deMin != null && { gte: filters.deMin }), ...(filters.deMax != null && { lte: filters.deMax }) };
  }
  if (filters.mosMin != null || filters.mosMax != null) {
    where.marginOfSafety = { not: null, ...(filters.mosMin != null && { gte: filters.mosMin / 100 }), ...(filters.mosMax != null && { lte: filters.mosMax / 100 }) };
  }
  if (filters.crMin != null || filters.crMax != null) {
    where.currentRatio = { not: null, ...(filters.crMin != null && { gte: filters.crMin }), ...(filters.crMax != null && { lte: filters.crMax }) };
  }
  if (filters.marketCapMin != null || filters.marketCapMax != null) {
    const B = 1_000_000_000;
    where.marketCap = { not: null, ...(filters.marketCapMin != null && { gte: filters.marketCapMin * B }), ...(filters.marketCapMax != null && { lte: filters.marketCapMax * B }) };
  }

  const clampedPage = Math.max(1, page);
  const clampedSize = Math.min(200, Math.max(1, pageSize));

  const [total, rows, lastJob, staleCount] = await Promise.all([
    prisma.screenerTicker.count({ where }),
    prisma.screenerTicker.findMany({
      where,
      orderBy: { [filters.sortBy || "marginOfSafety"]: filters.sortOrder || "desc" },
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
