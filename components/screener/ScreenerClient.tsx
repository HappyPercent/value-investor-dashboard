"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FilterPanel } from "@/components/screener/FilterPanel";
import { ScreenerTable, SortKey } from "@/components/screener/ScreenerTable";
import { SeedProgressModal } from "@/components/screener/SeedProgressModal";
import type { ScreenerFilters, ScreenerResult, ScreenerResultsResponse, SeedOptions } from "@/types/screener";

interface Props {
  initialData: ScreenerResultsResponse;
}
const DEFAULT_FILTERS: ScreenerFilters = {
  index:    "ALL",
  peMax:    15,      // Graham: P/E ≤ 15
  pbMax:    1.5,     // Graham: P/B ≤ 1.5
  deMax:    0.5,     // Graham: conservative leverage
  crMin:    2.0,     // Graham: current ratio ≥ 2
  mosMin:   33,      // Buy at ≥ 33% below intrinsic value
};

export function ScreenerClient({ initialData }: Props) {
  const [filters, setFilters] = useState<ScreenerFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ScreenerResultsResponse>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [seedModalOpen, setSeedModalOpen] = useState(false);
  const [seedOptions, setSeedOptions] = useState<SeedOptions>({ index: "ALL", forceRefresh: false });
  const [sortKey, setSortKey] = useState<SortKey>("marginOfSafety");
  const [sortAsc, setSortAsc] = useState(false);
  const [tickerSearch, setTickerSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchResults = useCallback(async (currentFilters: ScreenerFilters, currentPage: number) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (currentFilters.peMin       != null) params.set("peMin",       String(currentFilters.peMin));
      if (currentFilters.peMax       != null) params.set("peMax",       String(currentFilters.peMax));
      if (currentFilters.pbMin       != null) params.set("pbMin",       String(currentFilters.pbMin));
      if (currentFilters.pbMax       != null) params.set("pbMax",       String(currentFilters.pbMax));
      if (currentFilters.deMin       != null) params.set("deMin",       String(currentFilters.deMin));
      if (currentFilters.deMax       != null) params.set("deMax",       String(currentFilters.deMax));
      if (currentFilters.mosMin      != null) params.set("mosMin",      String(currentFilters.mosMin));
      if (currentFilters.mosMax      != null) params.set("mosMax",      String(currentFilters.mosMax));
      if (currentFilters.crMin       != null) params.set("crMin",       String(currentFilters.crMin));
      if (currentFilters.crMax       != null) params.set("crMax",       String(currentFilters.crMax));
      if (currentFilters.marketCapMin != null) params.set("marketCapMin", String(currentFilters.marketCapMin));
      if (currentFilters.marketCapMax != null) params.set("marketCapMax", String(currentFilters.marketCapMax));
      if (currentFilters.index && currentFilters.index !== "ALL") params.set("index", currentFilters.index);
      if (currentFilters.tickerSearch) params.set("tickerSearch", currentFilters.tickerSearch);
      if (currentFilters.sortBy) params.set("sortBy", currentFilters.sortBy);
      if (currentFilters.sortOrder) params.set("sortOrder", currentFilters.sortOrder);
      params.set("page", String(currentPage));

      const res = await fetch(`/api/screener/results?${params}`);
      const json: ScreenerResultsResponse = await res.json();
      setData(json);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleFiltersChange = (newFilters: ScreenerFilters) => {
    setFilters(newFilters);
    setPage(1);
    fetchResults(newFilters, 1);
  };

  const handleTickerSearchChange = (value: string) => {
    setTickerSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const newFilters = { ...filters, tickerSearch: value || undefined };
      setFilters(newFilters);
      setPage(1);
      fetchResults(newFilters, 1);
    }, 300);
  };

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchResults(filters, newPage);
  };

  const handleSeedRequest = () => {
    setSeedOptions({ index: filters.index ?? "ALL", forceRefresh: false });
    setSeedModalOpen(true);
  };

  const handleSeedClose = () => {
    setSeedModalOpen(false);
    fetchResults(filters, page);
  };

  return (
    <div className="flex gap-6">
      <aside className="w-48 flex-shrink-0">
        <FilterPanel
          filters={filters}
          onChange={handleFiltersChange}
          onSeedRequest={handleSeedRequest}
          lastSeededAt={data.lastSeededAt}
          staleTickers={data.staleTickers}
          isLoading={isLoading}
        />
      </aside>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Loading…" : `${data.total.toLocaleString()} results`}
          </p>
          <input
            type="search"
            placeholder="Search ticker or company…"
            value={tickerSearch}
            onChange={(e) => handleTickerSearchChange(e.target.value)}
            className="h-8 w-56 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <ScreenerTable
          results={data.results}
          total={data.total}
          page={page}
          pageSize={data.pageSize}
          isLoading={isLoading}
          onPageChange={handlePageChange}
          sortKey={sortKey}
          sortAsc={sortAsc}
          onSortChange={(key) => {
            if (sortKey === key) setSortAsc((a) => !a);
            else { setSortKey(key); setSortAsc(false); }
            handleFiltersChange({ ...filters, sortBy: key, sortOrder: sortAsc ? "asc" : "desc" });
          }}
        />
      </div>

      <SeedProgressModal
        isOpen={seedModalOpen}
        onClose={handleSeedClose}
        options={seedOptions}
      />
    </div>
  );
}
