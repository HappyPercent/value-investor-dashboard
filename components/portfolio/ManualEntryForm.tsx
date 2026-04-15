"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import type { RawPosition } from "@/types/portfolio";

interface Props {
  onPositionsReady: (positions: RawPosition[]) => void;
  disabled?: boolean;
}

interface Row {
  ticker: string;
  shares: string;
  costBasis: string;
  currency: string;
}

const emptyRow = (): Row => ({ ticker: "", shares: "", costBasis: "", currency: "EUR" });

export function ManualEntryForm({ onPositionsReady, disabled }: Props) {
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [errors, setErrors] = useState<string[]>([]);

  const update = (i: number, field: keyof Row, value: string) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = () => {
    const errs: string[] = [];
    const positions: RawPosition[] = [];

    rows.forEach((row, i) => {
      const rowNum = i + 1;
      const ticker = row.ticker.trim().toUpperCase();
      if (!ticker) { errs.push(`Row ${rowNum}: ticker is required`); return; }
      const shares = parseFloat(row.shares);
      if (isNaN(shares) || shares <= 0) { errs.push(`Row ${rowNum} (${ticker}): invalid shares`); return; }
      const costBasis = parseFloat(row.costBasis);
      if (isNaN(costBasis) || costBasis < 0) { errs.push(`Row ${rowNum} (${ticker}): invalid cost basis`); return; }
      positions.push({ ticker, shares, costBasis, currency: row.currency || "EUR" });
    });

    if (errs.length > 0) {
      setErrors(errs);
      return;
    }
    setErrors([]);
    onPositionsReady(positions);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_1fr_1fr_80px_auto] gap-2 text-sm font-medium text-muted-foreground px-1">
        <Label>Ticker</Label>
        <Label>Shares</Label>
        <Label>Cost Basis / Share</Label>
        <Label>Currency</Label>
        <span />
      </div>

      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_1fr_80px_auto] gap-2 items-center">
          <Input
            placeholder="AAPL"
            value={row.ticker}
            onChange={(e) => update(i, "ticker", e.target.value.toUpperCase())}
            disabled={disabled}
          />
          <Input
            type="number"
            placeholder="100"
            min="0"
            step="any"
            value={row.shares}
            onChange={(e) => update(i, "shares", e.target.value)}
            disabled={disabled}
          />
          <Input
            type="number"
            placeholder="150.00"
            min="0"
            step="0.01"
            value={row.costBasis}
            onChange={(e) => update(i, "costBasis", e.target.value)}
            disabled={disabled}
          />
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={row.currency}
            onChange={(e) => update(i, "currency", e.target.value)}
            disabled={disabled}
          >
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
          </select>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => removeRow(i)}
            disabled={rows.length === 1 || disabled}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      {errors.length > 0 && (
        <ul className="text-sm text-destructive space-y-0.5">
          {errors.map((e, i) => <li key={i}>• {e}</li>)}
        </ul>
      )}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={addRow} disabled={disabled}>
          <Plus className="h-4 w-4 mr-1" />
          Add Row
        </Button>
        <Button onClick={handleSubmit} disabled={disabled}>
          Analyze Portfolio
        </Button>
      </div>
    </div>
  );
}
