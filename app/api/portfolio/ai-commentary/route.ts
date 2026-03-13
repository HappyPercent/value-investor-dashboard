import { prisma } from "@/lib/prisma";
import { anthropic, buildPortfolioPrompt, buildEventsPrompt } from "@/lib/claude";
import { formatSSE } from "@/lib/sse-client";
import type { EnrichedPosition } from "@/types/portfolio";

export const maxDuration = 120; // Vercel / Next.js route timeout

export async function POST(req: Request) {
  const { sessionId, mode } = await req.json() as { sessionId: string; mode: "portfolio" | "events" };

  const dbPositions = await prisma.portfolioPosition.findMany({
    where: { sessionId },
    orderBy: { ticker: "asc" },
  });

  if (dbPositions.length === 0) {
    return new Response(
      formatSSE("error", { message: "Session not found or has no positions" }),
      { status: 404, headers: { "Content-Type": "text/event-stream" } }
    );
  }

  const positions: EnrichedPosition[] = dbPositions.map((p) => ({
    id: p.id,
    sessionId: p.sessionId,
    ticker: p.ticker,
    shares: p.shares,
    costBasis: p.costBasis,
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
    fetchedAt: p.fetchedAt?.toISOString() ?? null,
    fetchError: p.fetchError,
  }));

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(formatSSE(event, data)));
      };

      try {
        if (mode === "events") {
          // Events calendar: stream raw text
          const prompt = buildEventsPrompt(positions);
          const anthropicStream = anthropic.messages.stream({
            model: "claude-sonnet-4-6",
            max_tokens: 2000,
            messages: [{ role: "user", content: prompt }],
          });

          for await (const chunk of anthropicStream) {
            if (
              chunk.type === "content_block_delta" &&
              chunk.delta.type === "text_delta"
            ) {
              send("events_chunk", { chunk: chunk.delta.text });
            }
          }
          send("done", {});
        } else {
          // Portfolio mode: request JSON, then re-stream structured events
          send("portfolio_start", {});

          const prompt = buildPortfolioPrompt(positions);
          let fullText = "";

          const anthropicStream = anthropic.messages.stream({
            model: "claude-sonnet-4-6",
            max_tokens: 4000,
            messages: [{ role: "user", content: prompt }],
          });

          for await (const chunk of anthropicStream) {
            if (
              chunk.type === "content_block_delta" &&
              chunk.delta.type === "text_delta"
            ) {
              fullText += chunk.delta.text;
            }
          }

          // Parse the JSON response and emit structured events
          try {
            // Strip markdown code fences if present
            const jsonText = fullText.replace(/^```json\s*/i, "").replace(/\s*```$/, "").trim();
            const parsed = JSON.parse(jsonText) as {
              stocks: Array<{ ticker: string; commentary: string }>;
              summary: string;
            };

            for (const stock of parsed.stocks) {
              send("stock_commentary", { ticker: stock.ticker, commentary: stock.commentary });
            }
            send("summary", { summary: parsed.summary });
          } catch {
            // Fallback: emit raw text if JSON parse fails
            send("raw_commentary", { text: fullText });
          }

          send("done", {});
        }
      } catch (e) {
        send("error", { message: String(e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
