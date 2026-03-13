"use client";

import { useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PortfolioUploader } from "@/components/portfolio/PortfolioUploader";
import { PortfolioSummaryHeader } from "@/components/portfolio/PortfolioSummaryHeader";
import { StockValuationCard } from "@/components/portfolio/StockValuationCard";
import { AICommentaryPanel } from "@/components/portfolio/AICommentaryPanel";
import { EventsCalendar } from "@/components/portfolio/EventsCalendar";
import type { PortfolioAnalyzeResponse, RawPosition, EnrichedPosition } from "@/types/portfolio";

type Phase = "input" | "loading" | "results";

export default function PortfolioPage() {
  const [phase, setPhase] = useState<Phase>("input");
  const [result, setResult] = useState<PortfolioAnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Per-ticker AI commentary keyed by ticker symbol
  const [aiCommentary, setAiCommentary] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState(false);

  const handlePositionsReady = useCallback(
    async (positions: RawPosition[], source: "csv" | "manual") => {
      setPhase("loading");
      setError(null);
      setAiCommentary({});

      try {
        const res = await fetch("/api/portfolio/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source, positions }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
        }
        const data: PortfolioAnalyzeResponse = await res.json();
        setResult(data);
        setPhase("results");
        setAiLoading(true);
      } catch (e) {
        setError(String(e));
        setPhase("input");
      }
    },
    []
  );

  const handleStockCommentary = useCallback((ticker: string, commentary: string) => {
    setAiCommentary((prev) => ({ ...prev, [ticker]: commentary }));
  }, []);

  const handleAIDone = useCallback(() => {
    setAiLoading(false);
  }, []);

  const reset = () => {
    setPhase("input");
    setResult(null);
    setAiCommentary({});
    setAiLoading(false);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Portfolio Analyzer</h1>
        <p className="text-muted-foreground mt-1">
          Upload your portfolio to get Graham Number valuations and AI-powered commentary.
        </p>
      </div>

      {phase === "input" && (
        <div className="max-w-2xl">
          {error && (
            <p className="text-sm text-destructive mb-4 p-3 rounded-md bg-destructive/10">
              {error}
            </p>
          )}
          <PortfolioUploader onPositionsReady={handlePositionsReady} />
        </div>
      )}

      {phase === "loading" && (
        <div className="text-center py-16">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Fetching fundamentals for each position…</p>
          <p className="text-xs text-muted-foreground mt-1">This may take a moment (rate-limited requests)</p>
        </div>
      )}

      {phase === "results" && result && (
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {result.positions.length} Positions Analyzed
            </h2>
            <button
              onClick={reset}
              className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Analyze another portfolio
            </button>
          </div>

          <PortfolioSummaryHeader summary={result.summary} />

          <Tabs defaultValue="positions">
            <TabsList>
              <TabsTrigger value="positions">Valuations</TabsTrigger>
              <TabsTrigger value="ai">AI Summary</TabsTrigger>
              <TabsTrigger value="events">Events Calendar</TabsTrigger>
            </TabsList>

            <TabsContent value="positions" className="mt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {result.positions.map((position: EnrichedPosition) => (
                  <StockValuationCard
                    key={position.ticker}
                    position={position}
                    aiCommentary={aiCommentary[position.ticker]}
                    isLoadingAI={aiLoading}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="ai" className="mt-6 max-w-3xl">
              <AICommentaryPanel
                sessionId={result.sessionId}
                onStockCommentary={handleStockCommentary}
                onDone={handleAIDone}
              />
            </TabsContent>

            <TabsContent value="events" className="mt-6 max-w-3xl">
              <EventsCalendar sessionId={result.sessionId} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
