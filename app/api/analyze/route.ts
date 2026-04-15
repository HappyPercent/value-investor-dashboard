import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { anthropic } from "@/lib/claude";
import type { TickerAnalysis, AiAnalysisStreamEvent } from "@/types/portfolio";

interface PositionData {
  ticker: string;
  companyName: string | null;
  sector: string | null;
  industry: string | null;
  currentPrice: number | null;
  marketCap: number | null;
  trailingEPS: number | null;
  forwardEPS: number | null;
  bookValuePerShare: number | null;
  peRatio: number | null;
  pbRatio: number | null;
  deRatio: number | null;
  currentRatio: number | null;
  dividendYield: number | null;
  grahamNumber: number | null;
  marginOfSafety: number | null;
  ncavPerShare: number | null;
  altmanZScore: number | null;
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
  epsHistory: string | null;
  nextEarningsDate: Date | null;
}

// ── Formatters ────────────────────────────────────────────────────────────────

const fmt = (v: number | null, suffix = "", decimals = 2) =>
  v !== null ? `${v.toFixed(decimals)}${suffix}` : "N/A";

const pct = (v: number | null) =>
  v !== null ? `${(v * 100).toFixed(1)}%` : "N/A";

const billions = (v: number | null) => {
  if (v === null) return "N/A";
  const b = v / 1e9;
  return b >= 1 ? `$${b.toFixed(2)}B` : `$${(v / 1e6).toFixed(0)}M`;
};

function altmanZoneLabel(z: number | null): string {
  if (z === null) return "N/A";
  if (z > 2.99) return `${z.toFixed(2)} (Safe)`;
  if (z >= 1.81) return `${z.toFixed(2)} (Grey zone)`;
  return `${z.toFixed(2)} (Distress — HIGH RISK)`;
}

function epsHistoryLabel(raw: string | null): string {
  if (!raw) return "N/A";
  try {
    const arr: number[] = JSON.parse(raw);
    if (!arr.length) return "N/A";
    return arr.map((v) => `$${v.toFixed(2)}`).join(" → ") + " (newest→oldest)";
  } catch {
    return "N/A";
  }
}

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildTickerPrompt(pos: PositionData): string {
  const netDebt =
    pos.totalDebt !== null && pos.totalCash !== null
      ? pos.totalDebt - pos.totalCash
      : null;

  const fundamentals = [
    // Identity
    `Ticker:                  ${pos.ticker}`,
    `Company:                 ${pos.companyName ?? "N/A"}`,
    `Sector / Industry:       ${pos.sector ?? "N/A"} / ${pos.industry ?? "N/A"}`,
    `Market Cap:              ${billions(pos.marketCap)}`,
    ``,
    // Valuation
    `Current Price:           $${fmt(pos.currentPrice)}`,
    `Trailing EPS:            $${fmt(pos.trailingEPS)}`,
    `Forward EPS:             $${fmt(pos.forwardEPS)}`,
    `Book Value/Share:        $${fmt(pos.bookValuePerShare)}`,
    `P/E Ratio:               ${fmt(pos.peRatio, "×")}`,
    `P/B Ratio:               ${fmt(pos.pbRatio, "×")}`,
    `Dividend Yield:          ${pct(pos.dividendYield)}`,
    ``,
    // Graham core
    `Graham Number:           $${fmt(pos.grahamNumber)}`,
    `Margin of Safety:        ${pct(pos.marginOfSafety)}`,
    `NCAV/Share:              $${fmt(pos.ncavPerShare)}  (Graham net-net floor; price < NCAV = deep value)`,
    ``,
    // Financial health
    `D/E Ratio:               ${fmt(pos.deRatio, "×")}`,
    `Current Ratio:           ${fmt(pos.currentRatio, "×")}`,
    `Net Debt:                ${billions(netDebt)}`,
    ``,
    // Profitability
    `Return on Equity (ROE):  ${pct(pos.returnOnEquity)}`,
    `Return on Assets (ROA):  ${pct(pos.returnOnAssets)}`,
    `Gross Margin:            ${pct(pos.grossMargins)}`,
    `Operating Margin:        ${pct(pos.operatingMargins)}`,
    ``,
    // Growth
    `Revenue Growth (YoY):    ${pct(pos.revenueGrowth)}`,
    `Earnings Growth (YoY):   ${pct(pos.earningsGrowth)}`,
    `EPS History (annual):    ${epsHistoryLabel(pos.epsHistory)}`,
    ``,
    // Cash flow
    `Operating Cash Flow:     ${billions(pos.operatingCashflow)}`,
    `Free Cash Flow:          ${billions(pos.freeCashflow)}`,
    ``,
    // Distress
    `Altman Z-Score:          ${altmanZoneLabel(pos.altmanZScore)}`,
    ``,
    // Events
    pos.nextEarningsDate
      ? `Next Earnings Date:      ${pos.nextEarningsDate.toISOString().slice(0, 10)}`
      : "",
  ].filter((l) => l !== undefined).join("\n");

  return `You are a Benjamin Graham value investing analyst. The following fundamental data for ${pos.ticker} has already been collected — do NOT search for these figures again:
  ${fundamentals}
  Use web_search ONLY (do not use code execution or any other tool) to find:
  1. Significant news about ${pos.ticker} from the last 30 days
  2. Upcoming important dates that could impact the stock (confirm or supplement next earnings, plus any FDA decisions, patent expirations, regulatory rulings, contract renewals, or other material events)

  Based on the fundamentals above and what you find via web search, apply Graham's defensive investor checklist:
  - Enterprise size: Market cap adequate for a defensive investor?
  - Financial condition: Current ratio ≥ 2× and net debt manageable?
  - Earnings stability: Has EPS been positive and growing? (see EPS history)
  - Dividend record: Does the company pay a dividend?
  - Earnings growth: Revenue and earnings growth trend?
  - Moderate P/E (Graham preferred ≤15×) and P/B (≤1.5×)?
  - Margin of safety ≥ 30%?
  - NCAV: Is the stock trading below net current asset value (net-net)?
  - Altman Z-Score: Any financial distress risk?
  - Cash flow quality: Does free cash flow confirm accounting earnings?

  Then:
  - Identify concrete STRENGTHS from a Graham value investing perspective
  - Identify concrete WEAKNESSES or red flags
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

// ── Stream helpers ────────────────────────────────────────────────────────────

const encode = (obj: AiAnalysisStreamEvent) =>
  new TextEncoder().encode(JSON.stringify(obj) + "\n");

// ── GET /api/analyze?portfolioId=xxx ─────────────────────────────────────────

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

// ── POST /api/analyze ─────────────────────────────────────────────────────────

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

  const stream = new ReadableStream({
    async start(controller) {
      const completedAnalyses: TickerAnalysis[] = [];

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
            messages: [{ role: "user", content: buildTickerPrompt(pos as PositionData) }],
          });

          const textBlock = [...response.content]
            .reverse()
            .find((b) => b.type === "text");

          if (!textBlock || textBlock.type !== "text") {
            throw new Error("No text response returned from Claude");
          }

          const cleaned = textBlock.text.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
          const analysis: TickerAnalysis = JSON.parse(cleaned);
          completedAnalyses.push(analysis);
          controller.enqueue(encode({ type: "result", ticker, analysis }));
        } catch (e) {
          controller.enqueue(encode({ type: "error", ticker, error: String(e) }));
        }
      }

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
