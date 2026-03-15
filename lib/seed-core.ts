import { prisma } from "@/lib/prisma";
import { fetchFundamentals, parseYahooResult } from "@/lib/yahoo";
import { computeGrahamNumber, computeMarginOfSafety } from "@/lib/graham";
import { delay } from "@/lib/rate-limiter";
import { SP500_TICKERS, RUSSELL2000_TICKERS, FUNDAMENTALS_TTL_HOURS } from "@/lib/constants";
import type { SeedProgressEvent, SeedOptions } from "@/types/screener";

export interface SeedJobResult {
  jobId: number;
  succeeded: number;
  failed: number;
  durationMs: number;
}

export async function seedUniverse(options: {
  index: SeedOptions["index"];
  forceRefresh: boolean;
  onProgress: (event: SeedProgressEvent) => void | Promise<void>;
}): Promise<SeedJobResult> {
  const { index = "ALL", forceRefresh, onProgress } = options;

  // Determine which tickers to process
  type TickerEntry = { ticker: string; idx: string };
  let tickers: TickerEntry[] = [];
  if (index === "SP500" || index === "ALL") {
    tickers = tickers.concat(SP500_TICKERS.map((t) => ({ ticker: t, idx: "SP500" })));
  }
  if (index === "RUSSELL2000" || index === "ALL") {
    tickers = tickers.concat(RUSSELL2000_TICKERS.map((t) => ({ ticker: t, idx: "RUSSELL2000" })));
  }

  // Deduplicate (some tickers may appear in both lists)
  const seen = new Set<string>();
  tickers = tickers.filter(({ ticker }) => {
    if (seen.has(ticker)) return false;
    seen.add(ticker);
    return true;
  });

  // Split tickers into stale (need Yahoo fetch) and fresh (recompute from cached rawData)
  const ttlCutoff = new Date(Date.now() - FUNDAMENTALS_TTL_HOURS * 60 * 60 * 1000);

  type TickerWork = { ticker: string; idx: string; rawData: string | null };
  let toProcess: TickerWork[];

  if (forceRefresh) {
    toProcess = tickers.map((t) => ({ ...t, rawData: null }));
  } else {
    const existing = await prisma.screenerTicker.findMany({
      where: { ticker: { in: tickers.map((t) => t.ticker) } },
      select: { ticker: true, fetchedAt: true, rawData: true },
    });
    const existingMap = new Map(existing.map((r) => [r.ticker, r]));
    toProcess = tickers.map(({ ticker, idx }) => {
      const row = existingMap.get(ticker);
      const isFresh = row?.fetchedAt && row.fetchedAt >= ttlCutoff;
      // Fresh + has cache → recompute from rawData (no API call)
      // Fresh + no cache → still need to fetch
      return { ticker, idx, rawData: isFresh && row?.rawData ? row.rawData : null };
    });
  }

  const job = await prisma.seedJob.create({
    data: {
      status: "running",
      totalTickers: tickers.length,
    },
  });

  await onProgress({ type: "seed_start", jobId: job.id, total: tickers.length });

  const startMs = Date.now();
  let succeeded = 0;
  let failed = 0;
  let processed = 0;

  // Process in concurrent batches of 3, with 200ms between batch starts
  const CONCURRENCY = 3;
  const BATCH_DELAY_MS = 200;

  for (let i = 0; i < toProcess.length; i += CONCURRENCY) {
    const batchStart = Date.now();
    const batch = toProcess.slice(i, i + CONCURRENCY);

    const processTicker = async ({ ticker, idx, rawData: cachedRaw }: TickerWork) => {
      let success = false;
      try {
        // Use cached raw data if available (avoids Yahoo API call)
        const f = cachedRaw
          ? { ...parseYahooResult(JSON.parse(cachedRaw)), rawData: cachedRaw }
          : await fetchFundamentals(ticker);
        const grahamNumber = computeGrahamNumber(f.trailingEPS, f.bookValuePerShare);
        const marginOfSafety = computeMarginOfSafety(grahamNumber, f.currentPrice);

        await prisma.screenerTicker.upsert({
          where: { ticker },
          create: {
            ticker,
            index: idx,
            companyName: f.companyName,
            sector: f.sector,
            industry: f.industry,
            currentPrice: f.currentPrice,
            trailingEPS: f.trailingEPS,
            bookValuePerShare: f.bookValuePerShare,
            peRatio: f.peRatio,
            pbRatio: f.pbRatio,
            deRatio: f.deRatio,
            currentRatio: f.currentRatio,
            dividendYield: f.dividendYield,
            marketCap: f.marketCap,
            grahamNumber,
            marginOfSafety,
            fetchedAt: new Date(),
            fetchError: null,
            rawData: f.rawData,
          },
          update: {
            index: idx,
            companyName: f.companyName,
            sector: f.sector,
            industry: f.industry,
            currentPrice: f.currentPrice,
            trailingEPS: f.trailingEPS,
            bookValuePerShare: f.bookValuePerShare,
            peRatio: f.peRatio,
            pbRatio: f.pbRatio,
            deRatio: f.deRatio,
            currentRatio: f.currentRatio,
            dividendYield: f.dividendYield,
            marketCap: f.marketCap,
            grahamNumber,
            marginOfSafety,
            fetchedAt: new Date(),
            fetchError: null,
            rawData: f.rawData,
          },
        });
        succeeded++;
        success = true;
      } catch (e) {
        await prisma.screenerTicker.upsert({
          where: { ticker },
          create: { ticker, index: idx, fetchError: String(e) },
          update: { fetchError: String(e), fetchedAt: new Date() },
        });
        failed++;
      }
      return { ticker, success };
    };

    const batchResults = await Promise.all(batch.map(processTicker));

    for (const { ticker, success } of batchResults) {
      processed++;
      await onProgress({
        type: "ticker_done",
        ticker,
        success,
        processed,
        total: tickers.length,
      });
    }

    await prisma.seedJob.update({
      where: { id: job.id },
      data: { processed, succeeded, failed },
    });

    // Rate limit: wait remaining time to reach BATCH_DELAY_MS from batch start
    const elapsed = Date.now() - batchStart;
    const remaining = BATCH_DELAY_MS - elapsed;
    if (remaining > 0 && i + CONCURRENCY < toProcess.length) await delay(remaining);
  }

  const durationMs = Date.now() - startMs;
  await prisma.seedJob.update({
    where: { id: job.id },
    data: { status: "completed", completedAt: new Date(), succeeded, failed },
  });

  await onProgress({ type: "seed_complete", jobId: job.id, succeeded, failed, durationMs });

  return { jobId: job.id, succeeded, failed, durationMs };
}
