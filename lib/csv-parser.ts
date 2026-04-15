import Papa from "papaparse";
import type { RawPosition } from "@/types/portfolio";

export interface ParseResult {
  positions: RawPosition[];
  errors: string[];
}

export function parsePortfolioCSV(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const errors: string[] = [];
        const positions: RawPosition[] = [];

        results.data.forEach((row, i) => {
          const rowNum = i + 2; // 1-based, accounting for header
          const ticker = (row["ticker"] ?? row["symbol"] ?? row["Ticker"] ?? row["Symbol"] ?? "").trim().toUpperCase();
          const sharesRaw = row["shares"] ?? row["Shares"] ?? row["quantity"] ?? row["Quantity"] ?? "";
          const costRaw = row["cost_basis"] ?? row["costBasis"] ?? row["cost"] ?? row["Cost"] ?? row["Cost Basis"] ?? "";
          const currencyRaw = (row["currency"] ?? row["Currency"] ?? row["ccy"] ?? row["CCY"] ?? "").trim().toUpperCase();
          const currency = currencyRaw || "EUR"; // default to EUR

          if (!ticker) {
            errors.push(`Row ${rowNum}: missing ticker/symbol`);
            return;
          }
          const shares = parseFloat(sharesRaw);
          if (isNaN(shares) || shares <= 0) {
            errors.push(`Row ${rowNum} (${ticker}): invalid shares "${sharesRaw}"`);
            return;
          }
          const costBasis = parseFloat(costRaw);
          if (isNaN(costBasis) || costBasis < 0) {
            errors.push(`Row ${rowNum} (${ticker}): invalid cost_basis "${costRaw}"`);
            return;
          }
          positions.push({ ticker, shares, costBasis, currency });
        });

        if (results.errors.length > 0) {
          results.errors.forEach((e) => errors.push(`CSV parse error: ${e.message}`));
        }

        resolve({ positions, errors });
      },
      error(err) {
        resolve({ positions: [], errors: [err.message] });
      },
    });
  });
}
