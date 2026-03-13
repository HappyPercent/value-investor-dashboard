import { NextResponse } from "next/server";
import { queryScreener } from "@/lib/screener-query";
import type { ScreenerFilters } from "@/types/screener";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const filters: ScreenerFilters = {
    index:  (searchParams.get("index") ?? "ALL") as ScreenerFilters["index"],
    peMax:  searchParams.get("peMax")  ? parseFloat(searchParams.get("peMax")!)  : undefined,
    pbMax:  searchParams.get("pbMax")  ? parseFloat(searchParams.get("pbMax")!)  : undefined,
    deMax:  searchParams.get("deMax")  ? parseFloat(searchParams.get("deMax")!)  : undefined,
    mosMin: searchParams.get("mosMin") ? parseFloat(searchParams.get("mosMin")!) : undefined,
    crMin:  searchParams.get("crMin")  ? parseFloat(searchParams.get("crMin")!)  : undefined,
  };
  const page     = parseInt(searchParams.get("page")     ?? "1",  10);
  const pageSize = parseInt(searchParams.get("pageSize") ?? "50", 10);

  const data = await queryScreener(filters, page, pageSize);
  return NextResponse.json(data);
}
