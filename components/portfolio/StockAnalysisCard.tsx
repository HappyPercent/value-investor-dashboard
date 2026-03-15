import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TickerAnalysis } from "@/types/portfolio";

interface Props {
  analysis: TickerAnalysis;
}

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

export function StockAnalysisCard({ analysis: a }: Props) {
  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-bold text-lg leading-tight">{a.ticker}</h3>
            <p className="text-xs text-muted-foreground truncate" title={a.companyName}>
              {a.companyName}
            </p>
          </div>
          <Badge className={verdictStyles[a.verdict]}>{verdictLabels[a.verdict]}</Badge>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed mt-2">{a.grahamAssessment}</p>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 flex-1">
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
          <div className="mt-auto pt-3 border-t">
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
      </CardContent>
    </Card>
  );
}
