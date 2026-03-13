import { Badge } from "@/components/ui/badge";
import { getValuationLabel } from "@/lib/graham";
import type { ValuationLabel } from "@/types/portfolio";

interface Props {
  marginOfSafety: number | null;
}

const variantMap: Record<ValuationLabel, "default" | "secondary" | "destructive" | "outline"> = {
  BUY: "default",
  HOLD: "secondary",
  SELL: "destructive",
  "N/A": "outline",
};

const colorMap: Record<ValuationLabel, string> = {
  BUY: "bg-green-600 text-white hover:bg-green-700",
  HOLD: "bg-yellow-500 text-white hover:bg-yellow-600",
  SELL: "bg-red-600 text-white hover:bg-red-700",
  "N/A": "",
};

export function ValuationBadge({ marginOfSafety }: Props) {
  const label = getValuationLabel(marginOfSafety);
  return (
    <Badge variant={variantMap[label]} className={colorMap[label]}>
      {label}
    </Badge>
  );
}
