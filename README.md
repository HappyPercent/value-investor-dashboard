# Value Investor Dashboard

[![CI](https://github.com/HappyPercent/value-investor-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/HappyPercent/value-investor-dashboard/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A local stock screener and portfolio analyzer built on Benjamin Graham's value-investing rules. It screens the S&P 500 and Russell 2000 for undervalued companies, scores your own holdings, and asks Claude for plain-English commentary on the numbers.

Next.js 14 · TypeScript · Prisma + SQLite · Tailwind + shadcn/ui · Yahoo Finance · Anthropic API

> **Not financial advice.** This is a personal research tool. Market data comes from Yahoo Finance through an unofficial library and can be late, incomplete or wrong. Graham's formulas are blunt: they ignore growth and are less meaningful for banks, insurers and REITs.

## What it does

**Screener** (`/screener`)
- Seeds a local SQLite cache with fundamentals for the S&P 500 and Russell 2000
- Filters and sorts by margin of safety, P/E, P/B, debt/equity, current ratio and dividend yield
- Expands a row for detail and an AI take on a single stock

**Portfolio** (`/portfolio`)
- Upload a CSV or enter positions by hand (see `public/sample-portfolio.csv`)
- Per-position Graham Number, margin of safety, gain/loss, and a BUY / HOLD / SELL label
- Multi-currency cost basis (EUR and USD) with an EUR/USD conversion
- Streamed AI commentary per stock, an overall portfolio summary and an upcoming-events calendar

## The maths

| Metric | Formula | Reading |
|---|---|---|
| Graham Number | `√(22.5 × EPS × book value per share)` | Fair-value ceiling; only defined when EPS and book value are positive |
| Margin of safety | `(Graham Number − price) / Graham Number` | `≥ 30%` BUY, `0–30%` HOLD, `< 0` SELL |
| Altman Z-Score | 1968 public-company formula | `> 2.99` safe, `1.81–2.99` grey, `< 1.81` distress |
| NCAV per share | `(current assets − total liabilities) / shares` | Graham's "net-net" floor |

All of it lives in [`lib/graham.ts`](lib/graham.ts) as pure functions with unit tests.

## Run locally

Requires Node 20+ and an [Anthropic API key](https://console.anthropic.com/) for the AI features. Screening and scoring work without one.

```bash
npm install
cp .env.example .env        # add ANTHROPIC_API_KEY
npx prisma generate
npx prisma db push          # creates the local SQLite database
npm run seed:sp500          # fills the screener cache (use `npm run seed` for everything)
npm run dev
```

Open http://localhost:3000.

The AI features spend tokens on your own API key. Fundamentals are cached for 24 hours, and the seed script skips tickers that are still fresh (`npm run seed:force` refetches everything).

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Unit tests (Vitest) |
| `npm run lint` | ESLint |
| `npm run seed`, `seed:sp500`, `seed:russell`, `seed:force` | Populate the screener cache |

## Project layout

```
app/          pages and API routes (screener, portfolio analysis, SSE streaming)
components/   screener, portfolio and shadcn/ui components
lib/          Graham maths, Yahoo Finance client, rate limiter, Claude prompts, seeding
prisma/       SQLite schema
scripts/      CLI seeding
tests/        unit tests
```

## License

MIT
