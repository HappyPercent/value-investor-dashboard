"use client";

import { useState, useCallback, useEffect } from "react";
import { PortfolioUploader } from "@/components/portfolio/PortfolioUploader";
import { PortfolioSummaryHeader } from "@/components/portfolio/PortfolioSummaryHeader";
import { StockValuationCard } from "@/components/portfolio/StockValuationCard";
import type {
  PortfolioAnalyzeResponse,
  RawPosition,
  EnrichedPosition,
  TickerAnalysis,
  AiAnalysisStreamEvent,
} from "@/types/portfolio";

type Phase = "input" | "loading" | "results";

export default function PortfolioPage() {
  const [phase, setPhase] = useState<Phase>("input");
  const [result, setResult] = useState<PortfolioAnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [aiAnalysisResults, setAiAnalysisResults] = useState<Record<string, TickerAnalysis>>({});
  const [analyzingTickers, setAnalyzingTickers] = useState<Record<string, boolean>>({});

  // On mount: restore session from URL ?session= param, sessionStorage, or last saved portfolio
  useEffect(() => {
    const localSessionId =
      new URLSearchParams(window.location.search).get("session") ??
      sessionStorage.getItem("portfolio_session_id");

    const portfolioUrl = localSessionId
      ? `/api/portfolio/analyze?sessionId=${localSessionId}`
      : `/api/portfolio/analyze`;

    setPhase("loading");
    fetch(portfolioUrl)
      .then((r) => r.json())
      .then((portfolioData) => {
        if (!portfolioData?.sessionId) {
          sessionStorage.removeItem("portfolio_session_id");
          window.history.replaceState(null, "", window.location.pathname);
          setPhase("input");
          return;
        }
        return fetch(`/api/analyze?portfolioId=${portfolioData.sessionId}`)
          .then((r) => r.json())
          .then((aiData) => {
            sessionStorage.setItem("portfolio_session_id", portfolioData.sessionId);
            setResult(portfolioData as PortfolioAnalyzeResponse);
            if (aiData?.analyses) {
              const map: Record<string, TickerAnalysis> = {};
              for (const a of aiData.analyses as TickerAnalysis[]) {
                map[a.ticker] = a;
              }
              setAiAnalysisResults(map);
            }
            setPhase("results");
          });
      })
      .catch(() => {
        sessionStorage.removeItem("portfolio_session_id");
        window.history.replaceState(null, "", window.location.pathname);
        setPhase("input");
      });
  }, []);

  const handlePositionsReady = useCallback(
    async (positions: RawPosition[], source: "csv" | "manual") => {
      setPhase("loading");
      setError(null);
      setAiAnalysisResults({});

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
        // Persist session reference in URL and sessionStorage
        window.history.replaceState(null, "", `?session=${data.sessionId}`);
        sessionStorage.setItem("portfolio_session_id", data.sessionId);
      } catch (e) {
        setError(String(e));
        setPhase("input");
      }
    },
    []
  );

  const startAiAnalysisForTicker = useCallback(async (ticker: string) => {
    if (!result?.sessionId) return;

    setAnalyzingTickers((prev) => ({ ...prev, [ticker]: true }));
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portfolioId: result.sessionId, ticker }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event: AiAnalysisStreamEvent = JSON.parse(line);
            if (event.type === "result") {
              setAiAnalysisResults((prev) => ({ ...prev, [event.ticker]: event.analysis }));
            }
          } catch {/* skip */}
        }
      }
    } catch (e) {
      console.error(`AI analysis error for ${ticker}:`, e);
    } finally {
      setAnalyzingTickers((prev) => {
        const next = { ...prev };
        delete next[ticker];
        return next;
      });
    }
  }, [result?.sessionId]);

  const reset = () => {
    setPhase("input");
    setResult(null);
    setAiAnalysisResults({});
    setAnalyzingTickers({});
    sessionStorage.removeItem("portfolio_session_id");
    window.history.replaceState(null, "", window.location.pathname);
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {result.positions.map((position: EnrichedPosition) => (
              <StockValuationCard
                key={position.ticker}
                position={position}
                analysis={aiAnalysisResults[position.ticker] ?? null}
                isAnalyzing={!!analyzingTickers[position.ticker]}
                onAnalyze={() => startAiAnalysisForTicker(position.ticker)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
