"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw } from "lucide-react";
import type { ScreenerFilters } from "@/types/screener";

interface Props {
  filters: ScreenerFilters;
  onChange: (filters: ScreenerFilters) => void;
  onSeedRequest: () => void;
  lastSeededAt: string | null;
  staleTickers: number;
  isLoading: boolean;
}

interface FilterInputProps {
  label: string;
  id: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  placeholder: string;
  step?: string;
}

function FilterInput({ label, id, value, onChange, placeholder, step = "0.1" }: FilterInputProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Input
        id={id}
        type="number"
        placeholder={placeholder}
        step={step}
        min="0"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))}
        className="h-8 text-sm"
      />
    </div>
  );
}

export function FilterPanel({ filters, onChange, onSeedRequest, lastSeededAt, staleTickers, isLoading }: Props) {
  const set = (key: keyof ScreenerFilters, value: unknown) =>
    onChange({ ...filters, [key]: value });

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Index</Label>
        <Select
          value={filters.index ?? "ALL"}
          onValueChange={(v) => set("index", v as ScreenerFilters["index"])}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Indices</SelectItem>
            <SelectItem value="SP500">S&amp;P 500</SelectItem>
            <SelectItem value="RUSSELL2000">Russell 2000</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <FilterInput
        label="Max P/E"
        id="peMax"
        value={filters.peMax}
        onChange={(v) => set("peMax", v)}
        placeholder="15"
        step="1"
      />
      <FilterInput
        label="Max P/B"
        id="pbMax"
        value={filters.pbMax}
        onChange={(v) => set("pbMax", v)}
        placeholder="1.5"
      />
      <FilterInput
        label="Max D/E"
        id="deMax"
        value={filters.deMax}
        onChange={(v) => set("deMax", v)}
        placeholder="0.5"
      />
      <FilterInput
        label="Min Current Ratio"
        id="crMin"
        value={filters.crMin}
        onChange={(v) => set("crMin", v)}
        placeholder="2.0"
      />
      <FilterInput
        label="Min Margin of Safety %"
        id="mosMin"
        value={filters.mosMin}
        onChange={(v) => set("mosMin", v)}
        placeholder="20"
        step="5"
      />

      <div className="pt-2 border-t space-y-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={onSeedRequest}
          disabled={isLoading}
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Refresh Universe
        </Button>
        {lastSeededAt && (
          <p className="text-xs text-muted-foreground text-center">
            Last seeded: {new Date(lastSeededAt).toLocaleDateString()}
          </p>
        )}
        {!lastSeededAt && (
          <p className="text-xs text-amber-600 text-center font-medium">
            No data yet — run seed first
          </p>
        )}
        {staleTickers > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            {staleTickers} stale tickers
          </p>
        )}
      </div>
    </div>
  );
}
