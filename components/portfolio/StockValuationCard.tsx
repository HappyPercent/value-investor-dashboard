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

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt(n: number | null, prefix = "", suffix = "", decimals = 2) {
  if (n === null) return "—";
  return `${prefix}${n.toFixed(decimals)}${suffix}`;
}

function fmtPct(n: number | null) {
  if (n === null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function fmtCurrency(n: number | null, currency = "USD") {
  if (n === null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
}

function fmtBig(n: number | null) {
  if (n === null) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(0)}M`;
  return fmtCurrency(n);
}

function fmtEpsHistory(history: number[] | null) {
  if (!history || history.length === 0) return "—";
  return history.map((v) => `$${v.toFixed(2)}`).join(" → ") + " (newest→oldest)";
}

function altmanInfo(z: number | null): { text: string; color: string } {
  if (z === null) return { text: "—", color: "" };
  if (z > 2.99) return { text: `${z} — Safe`, color: "text-green-600" };
  if (z >= 1.81) return { text: `${z} — Grey zone`, color: "text-yellow-600" };
  return { text: `${z} — Distress`, color: "text-red-600" };
}

// ── Shared sub-components ─────────────────────────────────────────────────────

interface RowProps { label: string; value: string; highlight?: string }
function MetricRow({ label, value, highlight }: RowProps) {
  return (
    <div className="flex justify-between items-center py-0.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium tabular-nums ${highlight ?? ""}`}>{value}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-4 mb-1 first:mt-0">
      {children}
    </p>
  );
}

// ── Verdict / sentiment styles ────────────────────────────────────────────────

const verdictStyles: Record<TickerAnalysis["verdict"], string> = {
  buy: "bg-green-600 text-white hover:bg-green-700",
  hold: "bg-yellow-500 text-white hover:bg-yellow-600",
  avoid: "bg-red-600 text-white hover:bg-red-700",
};
const verdictLabels: Record<TickerAnalysis["verdict"], string> = {
  buy: "BUY", hold: "HOLD", avoid: "AVOID",
};
const significanceStyles: Record<"high" | "medium" | "low", string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-gray-100 text-gray-600",
};
const sentimentIcon: Record<"positive" | "negative" | "neutral", string> = {
  positive: "↑", negative: "↓", neutral: "→",
};
const sentimentColor: Record<"positive" | "negative" | "neutral", string> = {
  positive: "text-green-600", negative: "text-red-600", neutral: "text-gray-500",
};

// ── Detail modal ──────────────────────────────────────────────────────────────

function DetailModal({
  p,
  analysis,
  isAnalyzing,
  onAnalyze,
}: {
  p: EnrichedPosition;
  analysis?: TickerAnalysis | null;
  isAnalyzing?: boolean;
  onAnalyze?: () => void;
}) {
  const gainColor = p.gainLoss !== null
    ? p.gainLoss >= 0 ? "text-green-600" : "text-red-600"
    : undefined;
  const mosColor = p.marginOfSafety !== null
    ? p.marginOfSafety >= 0.3 ? "text-green-600"
      : p.marginOfSafety >= 0 ? "text-yellow-600"
      : "text-red-600"
    : undefined;
  const netDebt =
    p.totalDebt !== null && p.totalCash !== null ? p.totalDebt - p.totalCash : null;
  const altman = altmanInfo(p.altmanZScore);

  return (
    <div className="flex flex-col gap-0.5">
      {/* Graham Valuation */}
      <SectionLabel>Graham Valuation</SectionLabel>
      <MetricRow label="Current Price" value={fmtCurrency(p.currentPrice, p.priceCurrency ?? "USD")} />
      <MetricRow label="Graham Number" value={fmtCurrency(p.grahamNumber, p.priceCurrency ?? "USD")} />
      <MetricRow label="Margin of Safety" value={fmtPct(p.marginOfSafety)} highlight={mosColor} />
      <MetricRow label="NCAV / Share" value={fmtCurrency(p.ncavPerShare, p.priceCurrency ?? "USD")} />
      <MetricRow label="Altman Z-Score" value={altman.text} highlight={altman.color} />

      {/* Fundamentals */}
      <SectionLabel>Fundamentals</SectionLabel>
      <MetricRow label="Trailing EPS" value={fmtCurrency(p.trailingEPS)} />
      <MetricRow label="Forward EPS" value={fmtCurrency(p.forwardEPS)} />
      <MetricRow label="Book Value / Share" value={fmtCurrency(p.bookValuePerShare)} />
      <MetricRow label="P/E Ratio" value={fmt(p.peRatio, "", "×", 1)} />
      <MetricRow label="P/B Ratio" value={fmt(p.pbRatio, "", "×")} />
      <MetricRow label="D/E Ratio" value={fmt(p.deRatio, "", "×")} />
      <MetricRow label="Current Ratio" value={fmt(p.currentRatio, "", "×")} />
      <MetricRow label="Dividend Yield" value={fmtPct(p.dividendYield)} />

      {/* Profitability */}
      <SectionLabel>Profitability</SectionLabel>
      <MetricRow label="Return on Equity" value={fmtPct(p.returnOnEquity)} />
      <MetricRow label="Return on Assets" value={fmtPct(p.returnOnAssets)} />
      <MetricRow label="Gross Margin" value={fmtPct(p.grossMargins)} />
      <MetricRow label="Operating Margin" value={fmtPct(p.operatingMargins)} />

      {/* Growth */}
      <SectionLabel>Growth & Trends</SectionLabel>
      <MetricRow label="Revenue Growth (YoY)" value={fmtPct(p.revenueGrowth)} />
      <MetricRow label="Earnings Growth (YoY)" value={fmtPct(p.earningsGrowth)} />
      <div className="py-0.5 text-sm">
        <p className="text-muted-foreground mb-0.5">Annual EPS History</p>
        <p className="font-medium tabular-nums text-right">{fmtEpsHistory(p.epsHistory)}</p>
      </div>

      {/* Cash Flow & Debt */}
      <SectionLabel>Cash Flow & Debt</SectionLabel>
      <MetricRow label="Operating Cash Flow" value={fmtBig(p.operatingCashflow)} />
      <MetricRow label="Free Cash Flow" value={fmtBig(p.freeCashflow)} />
      <MetricRow label="Total Debt" value={fmtBig(p.totalDebt)} />
      <MetricRow label="Total Cash" value={fmtBig(p.totalCash)} />
      <MetricRow label="Net Debt" value={fmtBig(netDebt)} />

      {/* Balance Sheet */}
      <SectionLabel>Balance Sheet</SectionLabel>
      <MetricRow label="Total Assets" value={fmtBig(p.totalAssets)} />
      <MetricRow label="Current Assets" value={fmtBig(p.totalCurrentAssets)} />
      <MetricRow label="Current Liabilities" value={fmtBig(p.totalCurrentLiabilities)} />
      <MetricRow label="Total Liabilities" value={fmtBig(p.totalLiabilities)} />
      <MetricRow label="Retained Earnings" value={fmtBig(p.retainedEarnings)} />
      <MetricRow label="EBIT" value={fmtBig(p.ebit)} />
      <MetricRow label="Revenue" value={fmtBig(p.revenue)} />

      {/* Position */}
      <SectionLabel>Position</SectionLabel>
      <MetricRow label="Shares" value={p.shares.toLocaleString()} />
      <MetricRow label={`Cost Basis / Share (${p.currency})`} value={fmtCurrency(p.costBasis, p.currency)} />
      <MetricRow label={`Current Value (${p.priceCurrency ?? "USD"})`} value={fmtCurrency(p.currentValue, p.priceCurrency ?? "USD")} />
      <MetricRow
        label={`Gain / Loss (${p.priceCurrency ?? "USD"})`}
        value={`${p.gainLoss !== null && p.gainLoss >= 0 ? "+" : ""}${fmtCurrency(p.gainLoss, p.priceCurrency ?? "USD")} (${fmtPct(p.gainLossPct)})`}
        highlight={gainColor}
      />
      {p.nextEarningsDate && (
        <MetricRow
          label="Next Earnings"
          value={new Date(p.nextEarningsDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        />
      )}

      {/* AI Analysis */}
      <SectionLabel>AI Analysis</SectionLabel>
      {isAnalyzing ? (
        <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
          <span className="animate-spin h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full" />
          Analyzing…
        </div>
      ) : analysis ? (
        <div className="flex flex-col gap-3 pt-1">
          <Badge className={`${verdictStyles[analysis.verdict]} self-start`}>
            {verdictLabels[analysis.verdict]}
          </Badge>

          {analysis.strengths.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Strengths</p>
              <ul className="space-y-0.5">
                {analysis.strengths.map((s, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-1.5">
                    <span className="text-green-500 shrink-0">+</span>{s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysis.weaknesses.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Weaknesses</p>
              <ul className="space-y-0.5">
                {analysis.weaknesses.map((w, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-1.5">
                    <span className="text-red-500 shrink-0">−</span>{w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Assessment</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{analysis.grahamAssessment}</p>
          </div>

          {analysis.upcomingEvents.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Upcoming Events</p>
              <ul className="space-y-1.5">
                {analysis.upcomingEvents.map((ev, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className={`mt-0.5 shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold uppercase ${significanceStyles[ev.significance]}`}>
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

          {analysis.recentNews.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Recent News</p>
              <ul className="space-y-1">
                {analysis.recentNews.map((n, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-sm">
                    <span className={`font-bold shrink-0 ${sentimentColor[n.sentiment]}`}>{sentimentIcon[n.sentiment]}</span>
                    <span className="text-muted-foreground leading-snug">{n.headline}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <Button size="sm" variant="outline" className="w-full mt-1" onClick={onAnalyze}>
          Run AI Analysis
        </Button>
      )}
    </div>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────

export function StockValuationCard({ position: p, analysis, isAnalyzing, onAnalyze }: Props) {
  const [showDetail, setShowDetail] = useState(false);

  const gainColor = p.gainLoss !== null
    ? p.gainLoss >= 0 ? "text-green-600" : "text-red-600"
    : undefined;
  const mosColor = p.marginOfSafety !== null
    ? p.marginOfSafety >= 0.3 ? "text-green-600"
      : p.marginOfSafety >= 0 ? "text-yellow-600"
      : "text-red-600"
    : undefined;

  return (
    <>
      <Card className="flex flex-col h-full">
        <CardHeader className="pb-2">
          <div className="flex items-start gap-2 w-full min-w-0">
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-lg leading-tight">{p.ticker}</h3>
              {p.companyName && (
                <p className="text-xs text-muted-foreground truncate" title={p.companyName}>
                  {p.companyName}
                </p>
              )}
              {(p.sector || p.industry) && (
                <p className="text-xs text-muted-foreground truncate">
                  {[p.sector, p.industry].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
            <div className="shrink-0">
              <ValuationBadge marginOfSafety={p.marginOfSafety} />
            </div>
          </div>
          {p.fetchError && (
            <p className="text-xs text-destructive mt-1">Data error: {p.fetchError.slice(0, 80)}</p>
          )}
        </CardHeader>

        <CardContent className="flex flex-col gap-3 flex-1">
          {/* Core Graham metrics */}
          <div className="space-y-0.5">
            <MetricRow label="Price" value={fmtCurrency(p.currentPrice, p.priceCurrency ?? "USD")} />
            <MetricRow label="Graham Number" value={fmtCurrency(p.grahamNumber, p.priceCurrency ?? "USD")} />
            <MetricRow label="Margin of Safety" value={fmtPct(p.marginOfSafety)} highlight={mosColor} />
          </div>

          {/* Position P&L */}
          <div className="space-y-0.5 border-t pt-2">
            <MetricRow label="Value" value={fmtCurrency(p.currentValue, p.priceCurrency ?? "USD")} />
            <MetricRow
              label="Gain / Loss"
              value={`${p.gainLoss !== null && p.gainLoss >= 0 ? "+" : ""}${fmtCurrency(p.gainLoss, p.priceCurrency ?? "USD")} (${fmtPct(p.gainLossPct)})`}
              highlight={gainColor}
            />
          </div>

          {/* Footer */}
          <div className="mt-auto pt-2 border-t flex items-center gap-2">
            {/* AI verdict badge (compact) */}
            {isAnalyzing ? (
              <span className="animate-spin h-3.5 w-3.5 border-2 border-muted-foreground border-t-transparent rounded-full shrink-0" />
            ) : analysis ? (
              <Badge className={`${verdictStyles[analysis.verdict]} shrink-0`}>
                {verdictLabels[analysis.verdict]}
              </Badge>
            ) : null}

            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => setShowDetail(true)}
            >
              Details
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Detail modal */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <span>{p.ticker}</span>
              {p.companyName && (
                <span className="text-sm font-normal text-muted-foreground">— {p.companyName}</span>
              )}
              {analysis && (
                <Badge className={verdictStyles[analysis.verdict]}>
                  {verdictLabels[analysis.verdict]}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <DetailModal
            p={p}
            analysis={analysis}
            isAnalyzing={isAnalyzing}
            onAnalyze={() => { onAnalyze?.(); }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
