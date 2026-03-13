"use client";

import { useCallback, useState } from "react";
import { FilterPanel } from "@/components/screener/FilterPanel";
import { ScreenerTable, SortKey } from "@/components/screener/ScreenerTable";
import { SeedProgressModal } from "@/components/screener/SeedProgressModal";
import type { ScreenerFilters, ScreenerResult, ScreenerResultsResponse, SeedOptions } from "@/types/screener";

interface Props {
  initialData: ScreenerResultsResponse;
}
const DEFAULT_FILTERS: ScreenerFilters = { index: "ALL" };

export function ScreenerClient({ initialData }: Props) {
  const [filters, setFilters] = useState<ScreenerFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ScreenerResultsResponse>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [seedModalOpen, setSeedModalOpen] = useState(false);
  const [seedOptions, setSeedOptions] = useState<SeedOptions>({ index: "ALL", forceRefresh: false });
  const [sortKey, setSortKey] = useState<SortKey>("marginOfSafety");
  const [sortAsc, setSortAsc] = useState(false);

  const fetchResults = useCallback(async (currentFilters: ScreenerFilters, currentPage: number) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (currentFilters.peMax  != null) params.set("peMax",  String(currentFilters.peMax));
      if (currentFilters.pbMax  != null) params.set("pbMax",  String(currentFilters.pbMax));
      if (currentFilters.deMax  != null) params.set("deMax",  String(currentFilters.deMax));
      if (currentFilters.mosMin != null) params.set("mosMin", String(currentFilters.mosMin));
      if (currentFilters.crMin  != null) params.set("crMin",  String(currentFilters.crMin));
      if (currentFilters.index && currentFilters.index !== "ALL") params.set("index", currentFilters.index);
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
