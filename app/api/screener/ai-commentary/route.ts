import { anthropic, buildTickerCommentaryPrompt } from "@/lib/claude";
import { formatSSE } from "@/lib/sse-client";
import type { ScreenerResult } from "@/types/screener";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { fundamentals } = await req.json() as { ticker: string; fundamentals: ScreenerResult };

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(formatSSE(event, data)));
      };

      try {
        const prompt = buildTickerCommentaryPrompt(fundamentals);
        const anthropicStream = anthropic.messages.stream({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 300,
          messages: [{ role: "user", content: prompt }],
        });

        for await (const chunk of anthropicStream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            send("chunk", { chunk: chunk.delta.text });
          }
        }
        send("done", {});
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
