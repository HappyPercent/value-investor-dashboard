import { formatSSE } from "@/lib/sse-client";
import { seedUniverse } from "@/lib/seed-core";
import type { SeedOptions } from "@/types/screener";

export const maxDuration = 300; // Seed job can take several minutes

export async function POST(req: Request) {
  const body: SeedOptions & { forceRefresh?: boolean } = await req.json().catch(() => ({}));
  const index = body.index ?? "ALL";
  const forceRefresh = body.forceRefresh ?? false;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(formatSSE(event, data)));
      };

      try {
        await seedUniverse({
          index,
          forceRefresh,
          onProgress: (event) => {
            send(event.type, event);
          },
        });
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
