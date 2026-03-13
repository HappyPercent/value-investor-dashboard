import { prisma } from "@/lib/prisma";
import { fetchFundamentals } from "@/lib/yahoo";
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

  // Filter out already-fresh tickers unless force refresh
  const ttlCutoff = new Date(Date.now() - FUNDAMENTALS_TTL_HOURS * 60 * 60 * 1000);
  let toProcess = tickers;
  if (!forceRefresh) {
    const existingFresh = await prisma.screenerTicker.findMany({
      where: { fetchedAt: { gte: ttlCutoff } },
      select: { ticker: true },
    });
    const freshSet = new Set(existingFresh.map((r) => r.ticker));
    toProcess = tickers.filter(({ ticker }) => !freshSet.has(ticker));
  }

  const job = await prisma.seedJob.create({
    data: {
      status: "running",
      totalTickers: toProcess.length,
    },
  });

  await onProgress({ type: "seed_start", jobId: job.id, total: toProcess.length });

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

    const processTicker = async ({ ticker, idx }: { ticker: string; idx: string }) => {
      let success = false;
      try {
        const f = await fetchFundamentals(ticker);
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
        total: toProcess.length,
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
