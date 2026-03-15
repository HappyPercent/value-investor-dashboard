"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ValuationBadge } from "./ValuationBadge";
import type { EnrichedPosition, TickerAnalysis } from "@/types/portfolio";

interface Props {
  position: EnrichedPosition;
  analysis?: TickerAnalysis | null;
  isAnalyzing?: boolean;
  onAnalyze?: () => void;
}

function fmt(n: number | null, prefix = "", suffix = "", decimals = 2) {
  if (n === null) return "—";
  return `${prefix}${n.toFixed(decimals)}${suffix}`;
}

function fmtPct(n: number | null) {
  if (n === null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function fmtCurrency(n: number | null) {
  if (n === null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function fmtEur(n: number | null) {
  if (n === null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR" }).format(n);
}

interface RowProps { label: string; value: string; highlight?: string }
function MetricRow({ label, value, highlight }: RowProps) {
  return (
    <div className="flex justify-between items-center py-0.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium tabular-nums ${highlight ?? ""}`}>{value}</span>
    </div>
  );
}

// ── verdict styles (reused in modal) ─────────────────────────────────────────

const verdictStyles: Record<TickerAnalysis["verdict"], string> = {
  buy: "bg-green-600 text-white hover:bg-green-700",
  hold: "bg-yellow-500 text-white hover:bg-yellow-600",
  avoid: "bg-red-600 text-white hover:bg-red-700",
};

const verdictLabels: Record<TickerAnalysis["verdict"], string> = {
  buy: "BUY",
  hold: "HOLD",
  avoid: "AVOID",
};

const significanceStyles: Record<"high" | "medium" | "low", string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-gray-100 text-gray-600",
};

const sentimentIcon: Record<"positive" | "negative" | "neutral", string> = {
  positive: "↑",
  negative: "↓",
  neutral: "→",
};

const sentimentColor: Record<"positive" | "negative" | "neutral", string> = {
  positive: "text-green-600",
  negative: "text-red-600",
  neutral: "text-gray-500",
};

// ── modal content ─────────────────────────────────────────────────────────────

function AnalysisModalContent({ a }: { a: TickerAnalysis }) {
  return (
    <div className="flex flex-col gap-5">
      {/* Strengths */}
      {a.strengths.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            Strengths
          </p>
          <ul className="space-y-0.5">
            {a.strengths.map((s, idx) => (
              <li key={idx} className="text-sm text-muted-foreground flex items-start gap-1.5">
                <span className="text-green-500 shrink-0">+</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Weaknesses */}
      {a.weaknesses.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            Weaknesses
          </p>
          <ul className="space-y-0.5">
            {a.weaknesses.map((w, idx) => (
              <li key={idx} className="text-sm text-muted-foreground flex items-start gap-1.5">
                <span className="text-red-500 shrink-0">−</span>
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Graham Assessment */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
          Graham Assessment
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">{a.grahamAssessment}</p>
      </div>

      {/* Upcoming Events */}
      {a.upcomingEvents.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            Upcoming Events
          </p>
          <ul className="space-y-1.5">
            {a.upcomingEvents.map((ev, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm">
                <span
                  className={`mt-0.5 shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold uppercase ${significanceStyles[ev.significance]}`}
                >
                  {ev.significance}
                </span>
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground">{ev.date}</span> — {ev.event}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recent News */}
      {a.recentNews.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            Recent News
          </p>
          <ul className="space-y-1">
            {a.recentNews.map((n, idx) => (
              <li key={idx} className="flex items-start gap-1.5 text-sm">
                <span className={`font-bold shrink-0 ${sentimentColor[n.sentiment]}`}>
                  {sentimentIcon[n.sentiment]}
                </span>
                <span className="text-muted-foreground leading-snug">{n.headline}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export function StockValuationCard({ position: p, analysis, isAnalyzing, onAnalyze }: Props) {
  const [showModal, setShowModal] = useState(false);

  const gainColor = p.gainLoss !== null
    ? p.gainLoss >= 0 ? "text-green-600" : "text-red-600"
    : undefined;
  const mosColor = p.marginOfSafety !== null
    ? p.marginOfSafety >= 0.3
      ? "text-green-600"
      : p.marginOfSafety >= 0
      ? "text-yellow-600"
      : "text-red-600"
    : undefined;

  return (
    <>
      <Card className="flex flex-col h-full">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-bold text-lg leading-tight">{p.ticker}</h3>
              {p.companyName && (
                <p className="text-xs text-muted-foreground truncate max-w-[160px]" title={p.companyName}>
                  {p.companyName}
                </p>
              )}
              {p.sector && (
                <p className="text-xs text-muted-foreground">{p.sector}</p>
              )}
            </div>
            <ValuationBadge marginOfSafety={p.marginOfSafety} />
          </div>

          {p.fetchError && (
            <p className="text-xs text-destructive mt-1">
              Data error: {p.fetchError.slice(0, 80)}
            </p>
          )}
        </CardHeader>

        <CardContent className="flex flex-col gap-4 flex-1">
          {/* Graham Analysis */}
          <div className="space-y-0.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Graham Analysis
            </p>
            <MetricRow label="Current Price" value={fmtCurrency(p.currentPrice)} />
            <MetricRow label="Graham Number" value={fmtCurrency(p.grahamNumber)} />
            <MetricRow
              label="Margin of Safety"
              value={fmtPct(p.marginOfSafety)}
              highlight={mosColor}
            />
          </div>

          {/* Fundamentals */}
          <div className="space-y-0.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Fundamentals
            </p>
            <MetricRow label="P/E Ratio" value={fmt(p.peRatio, "", "×", 1)} />
            <MetricRow label="P/B Ratio" value={fmt(p.pbRatio, "", "×")} />
            <MetricRow label="D/E Ratio" value={fmt(p.deRatio, "", "×")} />
            <MetricRow label="Current Ratio" value={fmt(p.currentRatio, "", "×")} />
            <MetricRow label="Div. Yield" value={fmtPct(p.dividendYield)} />
            <MetricRow label="Trailing EPS" value={fmtCurrency(p.trailingEPS)} />
            <MetricRow label="Book Value/Share" value={fmtCurrency(p.bookValuePerShare)} />
          </div>

          {/* Position */}
          <div className="space-y-0.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Position
            </p>
            <MetricRow label="Shares" value={p.shares.toLocaleString()} />
            <MetricRow label="Cost Basis" value={fmtEur(p.costBasis)} />
            <MetricRow label="Current Value" value={fmtCurrency(p.currentValue)} />
            <MetricRow
              label="Gain / Loss"
              value={`${p.gainLoss !== null && p.gainLoss >= 0 ? "+" : ""}${fmtCurrency(p.gainLoss)} (${fmtPct(p.gainLossPct)})`}
              highlight={gainColor}
            />
            {p.nextEarningsDate && (
              <MetricRow
                label="Next Earnings"
                value={new Date(p.nextEarningsDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              />
            )}
          </div>

          {/* AI Analysis button */}
          <div className="mt-auto pt-3 border-t">
            {isAnalyzing ? (
              <Button size="sm" variant="outline" className="w-full" disabled>
                <span className="animate-spin h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full mr-2" />
                Analyzing…
              </Button>
            ) : analysis ? (
              <div className="flex items-center gap-2">
                <Badge className={`${verdictStyles[analysis.verdict]} shrink-0`}>
                  {verdictLabels[analysis.verdict]}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowModal(true)}
                >
                  Show full AI analysis
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" className="w-full" onClick={onAnalyze}>
                AI Analysis
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Analysis modal */}
      {analysis && (
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {p.ticker}
                {p.companyName && (
                  <span className="text-sm font-normal text-muted-foreground">— {p.companyName}</span>
                )}
                <Badge className={verdictStyles[analysis.verdict]}>
                  {verdictLabels[analysis.verdict]}
                </Badge>
              </DialogTitle>
            </DialogHeader>
            <AnalysisModalContent a={analysis} />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
