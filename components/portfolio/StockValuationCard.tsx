import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ValuationBadge } from "./ValuationBadge";
import type { EnrichedPosition } from "@/types/portfolio";

interface Props {
  position: EnrichedPosition;
  aiCommentary?: string;
  isLoadingAI?: boolean;
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

interface RowProps { label: string; value: string; highlight?: string }
function MetricRow({ label, value, highlight }: RowProps) {
  return (
    <div className="flex justify-between items-center py-0.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium tabular-nums ${highlight ?? ""}`}>{value}</span>
    </div>
  );
}

export function StockValuationCard({ position: p, aiCommentary, isLoadingAI }: Props) {
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
          <MetricRow label="Cost Basis" value={fmtCurrency(p.costBasis)} />
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

        {/* AI Commentary */}
        <div className="mt-auto pt-3 border-t">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            AI Analysis
          </p>
          {isLoadingAI && !aiCommentary ? (
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
          ) : aiCommentary ? (
            <p className="text-sm text-muted-foreground leading-relaxed">{aiCommentary}</p>
          ) : (
            <p className="text-xs text-muted-foreground italic">No commentary yet</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
