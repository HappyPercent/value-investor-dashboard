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

function parseNum(val: string): number | undefined {
  return val === "" ? undefined : parseFloat(val);
}

interface RangeFilterProps {
  label: string;
  minId: string;
  maxId: string;
  minValue: number | undefined;
  maxValue: number | undefined;
  onMinChange: (v: number | undefined) => void;
  onMaxChange: (v: number | undefined) => void;
  minPlaceholder?: string;
  maxPlaceholder?: string;
  step?: string;
}

function RangeFilter({
  label,
  minId,
  maxId,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  minPlaceholder = "Min",
  maxPlaceholder = "Max",
  step = "0.1",
}: RangeFilterProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-1.5">
        <Input
          id={minId}
          type="number"
          placeholder={minPlaceholder}
          step={step}
          min="0"
          value={minValue ?? ""}
          onChange={(e) => onMinChange(parseNum(e.target.value))}
          className="h-8 text-sm w-0 flex-1"
        />
        <Input
          id={maxId}
          type="number"
          placeholder={maxPlaceholder}
          step={step}
          min="0"
          value={maxValue ?? ""}
          onChange={(e) => onMaxChange(parseNum(e.target.value))}
          className="h-8 text-sm w-0 flex-1"
        />
      </div>
    </div>
  );
}

export function FilterPanel({ filters, onChange, onSeedRequest, lastSeededAt, staleTickers, isLoading }: Props) {
  const set = (patch: Partial<ScreenerFilters>) => onChange({ ...filters, ...patch });

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Index</Label>
        <Select
          value={filters.index ?? "ALL"}
          onValueChange={(v) => set({ index: v as ScreenerFilters["index"] })}
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

      <RangeFilter
        label="P/E Ratio"
        minId="peMin" maxId="peMax"
        minValue={filters.peMin} maxValue={filters.peMax}
        onMinChange={(v) => set({ peMin: v })}
        onMaxChange={(v) => set({ peMax: v })}
        step="1"
      />

      <RangeFilter
        label="P/B Ratio"
        minId="pbMin" maxId="pbMax"
        minValue={filters.pbMin} maxValue={filters.pbMax}
        onMinChange={(v) => set({ pbMin: v })}
        onMaxChange={(v) => set({ pbMax: v })}
      />

      <RangeFilter
        label="D/E Ratio"
        minId="deMin" maxId="deMax"
        minValue={filters.deMin} maxValue={filters.deMax}
        onMinChange={(v) => set({ deMin: v })}
        onMaxChange={(v) => set({ deMax: v })}
      />

      <RangeFilter
        label="Current Ratio"
        minId="crMin" maxId="crMax"
        minValue={filters.crMin} maxValue={filters.crMax}
        onMinChange={(v) => set({ crMin: v })}
        onMaxChange={(v) => set({ crMax: v })}
      />

      <RangeFilter
        label="Margin of Safety %"
        minId="mosMin" maxId="mosMax"
        minValue={filters.mosMin} maxValue={filters.mosMax}
        onMinChange={(v) => set({ mosMin: v })}
        onMaxChange={(v) => set({ mosMax: v })}
        step="5"
      />

      <RangeFilter
        label="Market Cap ($B)"
        minId="marketCapMin" maxId="marketCapMax"
        minValue={filters.marketCapMin} maxValue={filters.marketCapMax}
        onMinChange={(v) => set({ marketCapMin: v })}
        onMaxChange={(v) => set({ marketCapMax: v })}
        step="1"
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
