import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { anthropic } from "@/lib/claude";
import { fetchEurUsdRate } from "@/lib/yahoo";
import type { TickerAnalysis, AiAnalysisStreamEvent } from "@/types/portfolio";

interface PositionData {
  ticker: string;
  companyName: string | null;
  sector: string | null;
  currentPrice: number | null;
  trailingEPS: number | null;
  bookValuePerShare: number | null;
  peRatio: number | null;
  pbRatio: number | null;
  deRatio: number | null;
  currentRatio: number | null;
  dividendYield: number | null;
  grahamNumber: number | null;
  marginOfSafety: number | null;
  nextEarningsDate: Date | null;
}

function buildTickerPrompt(pos: PositionData, eurUsdRate: number | null): string {
  const n = (v: number | null, suffix = "") =>
    v !== null ? `${v.toFixed(2)}${suffix}` : "N/A";
  const pct = (v: number | null) =>
    v !== null ? `${(v * 100).toFixed(1)}%` : "N/A";

  const fundamentals = [
    `Ticker:              ${pos.ticker}`,
    `Company:             ${pos.companyName ?? "N/A"}`,
    `Sector:              ${pos.sector ?? "N/A"}`,
    `Current Price:       $${n(pos.currentPrice)}`,
    `Trailing EPS:        $${n(pos.trailingEPS)}`,
    `Book Value/Share:    $${n(pos.bookValuePerShare)}`,
    `P/E Ratio:           ${n(pos.peRatio, "×")}`,
    `P/B Ratio:           ${n(pos.pbRatio, "×")}`,
    `D/E Ratio:           ${n(pos.deRatio, "×")}`,
    `Current Ratio:       ${n(pos.currentRatio, "×")}`,
    `Dividend Yield:      ${pct(pos.dividendYield)}`,
    `Graham Number:       $${n(pos.grahamNumber)}`,
    `Margin of Safety:    ${pct(pos.marginOfSafety)}`,
    pos.nextEarningsDate
      ? `Next Earnings Date:  ${pos.nextEarningsDate.toISOString().slice(0, 10)}`
      : "",
  ].filter(Boolean).join("\n");

  const fxNote = eurUsdRate !== null
    ? `\nNote: investor's cost basis is in EUR. Current EUR/USD rate: ${eurUsdRate.toFixed(4)}.\n`
    : "";

  return `You are a Benjamin Graham value investing analyst. The following fundamental data for ${pos.ticker} has already been collected — do NOT search for these figures again:

${fundamentals}
${fxNote}
Use web_search ONLY (do not use code execution or any other tool) to find:
1. Significant news about ${pos.ticker} from the last 30 days
2. Upcoming important dates that could impact the stock (confirm or supplement next earnings, plus any FDA decisions, patent expirations, regulatory rulings, contract renewals, or other material events)

Based on the fundamentals above and what you find via web search:
- Identify concrete STRENGTHS from a Graham value investing perspective (e.g. low P/B, strong current ratio, consistent EPS, adequate margin of safety)
- Identify concrete WEAKNESSES or red flags (e.g. high debt, negative MOS, declining EPS, low current ratio)
- Write a concise overall Graham-style assessment (2-3 sentences)
- Give a verdict

Return a JSON object with this exact structure:
{
  "ticker": string,
  "companyName": string,
  "strengths": string[],
  "weaknesses": string[],
  "recentNews": [
    { "headline": string, "sentiment": "positive" | "negative" | "neutral" }
  ],
  "upcomingEvents": [
    { "date": string, "event": string, "significance": "high" | "medium" | "low" }
  ],
  "grahamAssessment": string,
  "verdict": "buy" | "hold" | "avoid"
}

Return JSON only. No markdown, no explanation.`;
}

const encode = (obj: AiAnalysisStreamEvent) =>
  new TextEncoder().encode(JSON.stringify(obj) + "\n");

// GET /api/analyze?portfolioId=xxx — return cached analysis
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const portfolioId = searchParams.get("portfolioId");

  if (!portfolioId) {
    return NextResponse.json({ error: "portfolioId is required" }, { status: 400 });
  }

  try {
    const record = await prisma.aiAnalysis.findUnique({ where: { portfolioId } });
    if (!record) {
      return NextResponse.json(null);
    }

    return NextResponse.json({
      analyses: JSON.parse(record.data) as TickerAnalysis[],
      updatedAt: record.updatedAt.toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/analyze — stream AI analysis for portfolio or a single ticker
// body: { portfolioId: string, ticker?: string }
export async function POST(req: Request) {
  let portfolioId: string;
  let singleTicker: string | undefined;
  try {
    const body = await req.json();
    portfolioId = body.portfolioId;
    singleTicker = body.ticker;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!portfolioId) {
    return NextResponse.json({ error: "portfolioId is required" }, { status: 400 });
  }

  const positions = await prisma.portfolioPosition.findMany({
    where: {
      sessionId: portfolioId,
      ...(singleTicker ? { ticker: singleTicker } : {}),
    },
    orderBy: { id: "asc" },
  });

  if (positions.length === 0) {
    return NextResponse.json({ error: "No positions found for this portfolio" }, { status: 404 });
  }

  const total = positions.length;

  // Fetch EUR/USD rate once before the loop
  const eurUsdRate = await fetchEurUsdRate();

  const stream = new ReadableStream({
    async start(controller) {
      const completedAnalyses: TickerAnalysis[] = [];

      // For single-ticker updates, load existing analyses so we can merge
      let existingAnalyses: TickerAnalysis[] = [];
      if (singleTicker) {
        const record = await prisma.aiAnalysis.findUnique({ where: { portfolioId } });
        if (record) {
          existingAnalyses = JSON.parse(record.data) as TickerAnalysis[];
        }
      }

      for (let i = 0; i < positions.length; i++) {
        const pos = positions[i];
        const ticker = pos.ticker;
        const current = i + 1;

        controller.enqueue(encode({ type: "progress", ticker, current, total }));

        try {
          const response = await anthropic.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 8000,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tools: [{ type: "web_search_20260209", name: "web_search" }] as any,
            messages: [{ role: "user", content: buildTickerPrompt(pos, eurUsdRate) }],
          });
          // Find the last text block (Claude puts its final answer there)
          const textBlock = [...response.content]
            .reverse()
            .find((b) => b.type === "text");

          if (!textBlock || textBlock.type !== "text") {
            throw new Error("No text response returned from Claude");
          }

          // Strip accidental markdown fences before parsing
          const cleaned = textBlock.text.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
          const analysis: TickerAnalysis = JSON.parse(cleaned);
          completedAnalyses.push(analysis);
          controller.enqueue(encode({ type: "result", ticker, analysis }));
        } catch (e) {
          controller.enqueue(encode({ type: "error", ticker, error: String(e) }));
        }
      }

      // Merge single-ticker result into existing analyses, or save all
      const analyzedTickers = positions.map((p) => p.ticker);
      const toSave = singleTicker
        ? [
            ...existingAnalyses.filter((a) => !analyzedTickers.includes(a.ticker)),
            ...completedAnalyses,
          ]
        : completedAnalyses;

      if (toSave.length > 0) {
        await prisma.aiAnalysis.upsert({
          where: { portfolioId },
          create: { portfolioId, data: JSON.stringify(toSave) },
          update: { data: JSON.stringify(toSave) },
        });
      }

      controller.enqueue(encode({ type: "done" }));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      "Transfer-Encoding": "chunked",
    },
  });
}
