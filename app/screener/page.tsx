import { queryScreener } from "@/lib/screener-query";
import { ScreenerClient } from "@/components/screener/ScreenerClient";

export default async function ScreenerPage() {
  const initialData = await queryScreener();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Market Screener</h1>
        <p className="text-muted-foreground mt-1">
          Screen S&amp;P 500 and Russell 2000 for undervalued stocks using Graham value investing criteria.
        </p>
      </div>

      <ScreenerClient initialData={initialData} />
    </div>
  );
}
