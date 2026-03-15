import { NextResponse } from "next/server";
import { queryScreener } from "@/lib/screener-query";
import type { ScreenerFilters } from "@/types/screener";

function getNum(p: URLSearchParams, key: string): number | undefined {
  const v = p.get(key);
  return v ? parseFloat(v) : undefined;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const filters: ScreenerFilters = {
    index:        (searchParams.get("index") ?? "ALL") as ScreenerFilters["index"],
    peMin:        getNum(searchParams, "peMin"),
    peMax:        getNum(searchParams, "peMax"),
    pbMin:        getNum(searchParams, "pbMin"),
    pbMax:        getNum(searchParams, "pbMax"),
    deMin:        getNum(searchParams, "deMin"),
    deMax:        getNum(searchParams, "deMax"),
    mosMin:       getNum(searchParams, "mosMin"),
    mosMax:       getNum(searchParams, "mosMax"),
    crMin:        getNum(searchParams, "crMin"),
    crMax:        getNum(searchParams, "crMax"),
    marketCapMin: getNum(searchParams, "marketCapMin"),
    marketCapMax: getNum(searchParams, "marketCapMax"),
    sortBy:       searchParams.get("sortBy") as ScreenerFilters["sortBy"] || "marginOfSafety",
    sortOrder:    searchParams.get("sortOrder") as ScreenerFilters["sortOrder"] || "desc",
  };
  const page     = parseInt(searchParams.get("page")     ?? "1",  10);
  const pageSize = parseInt(searchParams.get("pageSize") ?? "50", 10);

  const data = await queryScreener(filters, page, pageSize);
  return NextResponse.json(data);
}
