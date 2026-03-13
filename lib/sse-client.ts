export interface ParsedSSEEvent {
  event: string;
  data: unknown;
}

/**
 * Parses raw SSE text (may contain partial/multiple events) into structured events.
 * Handles buffering across partial reads.
 */
export function parseSSEChunk(text: string): ParsedSSEEvent[] {
  const events: ParsedSSEEvent[] = [];
  // Split on double newline which separates events
  const blocks = text.split("\n\n");

  for (const block of blocks) {
    if (!block.trim()) continue;
    const lines = block.split("\n");
    let eventName = "message";
    let dataStr = "";

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        eventName = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        dataStr = line.slice(6).trim();
      }
    }

    if (dataStr) {
      try {
        events.push({ event: eventName, data: JSON.parse(dataStr) });
      } catch {
        events.push({ event: eventName, data: dataStr });
      }
    }
  }

  return events;
}

/**
 * Reads an SSE stream from a fetch Response, calling onEvent for each parsed event.
 * Returns when the stream is done.
 */
export async function readSSEStream(
  response: Response,
  onEvent: (event: ParsedSSEEvent) => void
): Promise<void> {
  if (!response.body) throw new Error("Response has no body");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Process complete events (separated by \n\n)
    const parts = buffer.split("\n\n");
    // Keep the last incomplete part in the buffer
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      if (!part.trim()) continue;
      const parsed = parseSSEChunk(part + "\n\n");
      parsed.forEach(onEvent);
    }
  }

  // Process any remaining buffer content
  if (buffer.trim()) {
    const parsed = parseSSEChunk(buffer);
    parsed.forEach(onEvent);
  }
}

/** Formats a server-sent event string for use in SSE route handlers. */
export function formatSSE(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
