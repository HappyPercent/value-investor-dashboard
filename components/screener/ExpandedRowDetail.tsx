"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { readSSEStream } from "@/lib/sse-client";
import { Sparkles } from "lucide-react";
import type { ScreenerResult } from "@/types/screener";

interface Props {
  result: ScreenerResult;
  cachedCommentary?: string;
  onCommentaryReceived: (text: string) => void;
}

function fmt(n: number | null, prefix = "", suffix = "", dec = 2) {
  return n !== null ? `${prefix}${n.toFixed(dec)}${suffix}` : "—";
}

export function ExpandedRowDetail({ result, cachedCommentary, onCommentaryReceived }: Props) {
  const [commentary, setCommentary] = useState(cachedCommentary ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestAI = async () => {
    if (loading) return;
    setLoading(true);
    setCommentary("");
    setError(null);
    let fullText = "";

    try {
      const res = await fetch("/api/screener/ai-commentary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: result.ticker, fundamentals: result }),
      });

      await readSSEStream(res, (event) => {
        if (event.event === "chunk") {
          const { chunk } = event.data as { chunk: string };
          fullText += chunk;
          setCommentary(fullText);
        } else if (event.event === "error") {
          const { message } = event.data as { message: string };
          setError(message);
        }
      });

      onCommentaryReceived(fullText);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-muted/20 border-t grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Extended Fundamentals */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Extended Fundamentals
        </h4>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {[
            ["Industry", result.industry ?? "—"],
            ["Index", result.index],
            ["Market Cap", result.marketCap !== null ? `$${(result.marketCap / 1e9).toFixed(1)}B` : "—"],
            ["Current Ratio", fmt(result.currentRatio, "", "×")],
            ["Div. Yield", result.dividendYield !== null ? `${(result.dividendYield * 100).toFixed(2)}%` : "—"],
            ["Data Age", result.fetchedAt ? new Date(result.fetchedAt).toLocaleDateString() : "—"],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between col-span-1">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* AI Commentary */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          AI Analysis
        </h4>
        {!commentary && !loading && !error ? (
          <Button variant="outline" size="sm" onClick={requestAI}>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Generate Analysis
          </Button>
        ) : loading && !commentary ? (
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm leading-relaxed text-muted-foreground">{commentary}</p>
            <Button variant="ghost" size="sm" onClick={requestAI} disabled={loading}>
              <Sparkles className="h-3 w-3 mr-1" />
              Regenerate
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
