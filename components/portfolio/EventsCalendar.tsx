"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { readSSEStream } from "@/lib/sse-client";

interface Props {
  sessionId: string;
}

export function EventsCalendar({ sessionId }: Props) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setText("");
    setError(null);

    async function run() {
      try {
        const res = await fetch("/api/portfolio/ai-commentary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, mode: "events" }),
          signal: ctrl.signal,
        });

        await readSSEStream(res, (event) => {
          if (event.event === "events_chunk") {
            const { chunk } = event.data as { chunk: string };
            setText((prev) => prev + chunk);
          } else if (event.event === "error") {
            const { message } = event.data as { message: string };
            setError(message);
          }
        });
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setError(String(e));
        }
      } finally {
        setLoading(false);
      }
    }

    run();
    return () => ctrl.abort();
  }, [sessionId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          Upcoming Events &amp; Catalysts
          {loading && (
            <span className="text-xs font-normal text-muted-foreground animate-pulse">
              Generating...
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : loading && !text ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        ) : (
          <div className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {text}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
