import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { PortfolioSummary } from "@/types/portfolio";

interface Props {
  summary: PortfolioSummary;
  isLoading?: boolean;
}

function fmt(n: number, opts?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat("en-US", opts).format(n);
}

function fmtEur(n: number) {
  return fmt(n, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function fmtPct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

export function PortfolioSummaryHeader({ summary, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-3 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const gainColor = summary.totalGainLoss >= 0 ? "text-green-600" : "text-red-600";
  const mosColor =
    summary.averageMarginOfSafety === null
      ? ""
      : summary.averageMarginOfSafety >= 0.3
      ? "text-green-600"
      : summary.averageMarginOfSafety >= 0
      ? "text-yellow-600"
      : "text-red-600";

  const stats = [
    { label: "Portfolio Value (EUR)", value: fmtEur(summary.totalValue) },
    { label: "Cost Basis (EUR)", value: fmtEur(summary.totalCostBasis) },
    {
      label: "Gain / Loss (EUR)",
      value: `${summary.totalGainLoss >= 0 ? "+" : ""}${fmtEur(summary.totalGainLoss)} (${fmtPct(summary.totalGainLossPct)})`,
      color: gainColor,
    },
    {
      label: "Avg Margin of Safety",
      value: summary.averageMarginOfSafety !== null ? fmtPct(summary.averageMarginOfSafety) : "N/A",
      color: mosColor,
    },
    {
      label: "Undervalued / Total",
      value: `${summary.undervaluedCount} / ${summary.undervaluedCount + summary.overvaluedCount + summary.naCount}`,
    },
    {
      label: "Data Errors",
      value: summary.fetchErrors.length > 0 ? summary.fetchErrors.join(", ") : "None",
      color: summary.fetchErrors.length > 0 ? "text-destructive text-xs" : "text-muted-foreground",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
      {stats.map((s) => (
        <Card key={s.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {s.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-lg font-semibold ${s.color ?? ""}`}>{s.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
