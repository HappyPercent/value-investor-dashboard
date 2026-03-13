"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ValuationBadge } from "@/components/portfolio/ValuationBadge";
import { ExpandedRowDetail } from "./ExpandedRowDetail";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { ScreenerResult } from "@/types/screener";

export type SortKey = keyof Pick<ScreenerResult, "ticker" | "currentPrice" | "grahamNumber" | "marginOfSafety" | "peRatio" | "pbRatio" | "deRatio">;

interface Props {
  results: ScreenerResult[];
  total: number;
  page: number;
  pageSize: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  sortKey: SortKey;
  sortAsc: boolean;
  onSortChange: (key: SortKey) => void;
}

function fmt(n: number | null, prefix = "", suffix = "", decimals = 2) {
  if (n === null) return "—";
  return `${prefix}${n.toFixed(decimals)}${suffix}`;
}

export function ScreenerTable({ results, total, page, pageSize, isLoading, onPageChange, sortKey, sortAsc, onSortChange }: Props) {
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [aiCache, setAiCache] = useState<Record<string, string>>({});

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col ? (
      sortAsc ? <ChevronUp className="h-3 w-3 inline ml-0.5" /> : <ChevronDown className="h-3 w-3 inline ml-0.5" />
    ) : null;

  const totalPages = Math.ceil(total / pageSize);

  const cols: Array<{ key: SortKey | null; label: string; align?: string }> = [
    { key: "ticker", label: "Ticker" },
    { key: null, label: "Company" },
    { key: null, label: "Sector" },
    { key: "currentPrice", label: "Price", align: "text-right" },
    { key: "grahamNumber", label: "Graham #", align: "text-right" },
    { key: "marginOfSafety", label: "MoS %", align: "text-right" },
    { key: "peRatio", label: "P/E", align: "text-right" },
    { key: "pbRatio", label: "P/B", align: "text-right" },
    { key: "deRatio", label: "D/E", align: "text-right" },
    { key: null, label: "Valuation" },
    { key: null, label: "" },
  ];

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="font-medium">No results match your filters.</p>
        <p className="text-sm mt-1">Try widening your criteria or refreshing the universe.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {cols.map((col) => (
                <TableHead
                  key={col.label}
                  className={`${col.align ?? ""} whitespace-nowrap ${col.key ? "cursor-pointer hover:text-foreground" : ""}`}
                  onClick={() => col.key && onSortChange(col.key)}
                >
                  {col.label}
                  {col.key && <SortIcon col={col.key} />}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((result) => (
              <>
                <TableRow
                  key={result.ticker}
                  className={`cursor-pointer hover:bg-muted/50 ${expandedTicker === result.ticker ? "bg-muted/30" : ""}`}
                  onClick={() =>
                    setExpandedTicker(expandedTicker === result.ticker ? null : result.ticker)
                  }
                >
                  <TableCell className="font-mono font-bold">{result.ticker}</TableCell>
                  <TableCell className="max-w-[160px] truncate text-sm" title={result.companyName ?? ""}>
                    {result.companyName ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{result.sector ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(result.currentPrice, "$", "", 2)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(result.grahamNumber, "$", "", 2)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {result.marginOfSafety !== null ? `${(result.marginOfSafety * 100).toFixed(1)}%` : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(result.peRatio, "", "×", 1)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(result.pbRatio, "", "×", 2)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(result.deRatio, "", "×", 2)}</TableCell>
                  <TableCell>
                    <ValuationBadge marginOfSafety={result.marginOfSafety} />
                  </TableCell>
                  <TableCell>
                    {expandedTicker === result.ticker ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </TableCell>
                </TableRow>
                {expandedTicker === result.ticker && (
                  <TableRow key={`${result.ticker}-expanded`}>
                    <TableCell colSpan={cols.length} className="p-0">
                      <ExpandedRowDetail
                        result={result}
                        cachedCommentary={aiCache[result.ticker]}
                        onCommentaryReceived={(text) =>
                          setAiCache((prev) => ({ ...prev, [result.ticker]: text }))
                        }
                      />
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total} results
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Prev
            </Button>
            <span className="px-3 py-1.5 text-xs">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
