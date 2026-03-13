/**
 * CLI seed script: npx tsx scripts/seed-universe.ts [--index SP500|RUSSELL2000|ALL] [--force]
 *
 * Usage:
 *   npm run seed                  # Seed all indices (skip fresh tickers)
 *   npm run seed:sp500            # Seed S&P 500 only
 *   npm run seed:force            # Force re-fetch all tickers
 */

import { seedUniverse } from "../lib/seed-core";
import type { SeedOptions } from "../types/screener";

const args = process.argv.slice(2);
const indexArg = args.find((a) => a.startsWith("--index="))?.split("=")[1] ?? "ALL";
const forceRefresh = args.includes("--force");

const index = (["SP500", "RUSSELL2000", "ALL"].includes(indexArg)
  ? indexArg
  : "ALL") as NonNullable<SeedOptions["index"]>;

console.log(`\n🌱 Starting universe seed (index=${index}, force=${forceRefresh})\n`);

seedUniverse({
  index,
  forceRefresh,
  onProgress(event) {
    switch (event.type) {
      case "seed_start":
        console.log(`📋 Job #${event.jobId}: ${event.total} tickers to process`);
        break;
      case "ticker_done":
        const icon = event.success ? "✓" : "✗";
        const pct = ((event.processed / event.total) * 100).toFixed(1);
        process.stdout.write(`\r  ${icon} ${event.ticker.padEnd(8)} [${event.processed}/${event.total}] ${pct}%  `);
        break;
      case "seed_complete":
        console.log(
          `\n\n✅ Done! Succeeded: ${event.succeeded}, Failed: ${event.failed}, Time: ${(event.durationMs / 1000).toFixed(1)}s`
        );
        break;
      case "error":
        console.error(`\n❌ Error: ${event.message}`);
        break;
    }
  },
})
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
