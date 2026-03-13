"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { readSSEStream } from "@/lib/sse-client";

interface Props {
  sessionId: string;
  onStockCommentary?: (ticker: string, commentary: string) => void;
  onDone?: () => void;
}

export function AICommentaryPanel({ sessionId, onStockCommentary, onDone }: Props) {
  const [summary, setSummary] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setSummary("");
    setError(null);

    async function run() {
      try {
        const res = await fetch("/api/portfolio/ai-commentary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, mode: "portfolio" }),
          signal: ctrl.signal,
        });

        await readSSEStream(res, (event) => {
          if (event.event === "stock_commentary") {
            const { ticker, commentary } = event.data as { ticker: string; commentary: string };
            onStockCommentary?.(ticker, commentary);
          } else if (event.event === "summary") {
            const { summary: s } = event.data as { summary: string };
            setSummary(s);
          } else if (event.event === "raw_commentary") {
            const { text } = event.data as { text: string };
            setSummary(text);
          } else if (event.event === "error") {
            const { message } = event.data as { message: string };
            setError(message);
          } else if (event.event === "done") {
            onDone?.();
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
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          Portfolio Summary
          {loading && (
            <span className="text-xs font-normal text-muted-foreground animate-pulse">
              Analyzing...
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : loading && !summary ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-muted-foreground">{summary}</p>
        )}
      </CardContent>
    </Card>
  );
}
