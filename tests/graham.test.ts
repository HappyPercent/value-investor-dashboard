import { describe, expect, it } from "vitest";
import {
  computeAltmanZ,
  computeGrahamNumber,
  computeMarginOfSafety,
  computeNCAVPerShare,
  getValuationLabel,
} from "@/lib/graham";

describe("computeGrahamNumber", () => {
  it("is sqrt(22.5 * EPS * BVPS)", () => {
    expect(computeGrahamNumber(4, 25)).toBeCloseTo(Math.sqrt(2250), 6);
  });

  it("returns null for missing or non-positive inputs", () => {
    expect(computeGrahamNumber(null, 25)).toBeNull();
    expect(computeGrahamNumber(4, null)).toBeNull();
    expect(computeGrahamNumber(0, 25)).toBeNull();
    expect(computeGrahamNumber(-1, 25)).toBeNull();
    expect(computeGrahamNumber(4, -5)).toBeNull();
  });
});

describe("computeMarginOfSafety", () => {
  it("is positive when price is below the Graham Number", () => {
    expect(computeMarginOfSafety(100, 70)).toBeCloseTo(0.3);
  });

  it("is negative when overvalued", () => {
    expect(computeMarginOfSafety(100, 125)).toBeCloseTo(-0.25);
  });

  it("returns null for missing data or a non-positive price", () => {
    expect(computeMarginOfSafety(null, 50)).toBeNull();
    expect(computeMarginOfSafety(100, null)).toBeNull();
    expect(computeMarginOfSafety(100, 0)).toBeNull();
  });
});

describe("computeAltmanZ", () => {
  const base = {
    totalCurrentAssets: 100,
    totalCurrentLiabilities: 50,
    totalAssets: 200,
    retainedEarnings: 80,
    ebit: 40,
    marketCap: 300,
    totalLiabilities: 100,
    revenue: 250,
  };

  it("applies the original 1968 coefficients", () => {
    // 1.2*0.25 + 1.4*0.4 + 3.3*0.2 + 0.6*3 + 1.0*1.25
    expect(computeAltmanZ(base)).toBe(4.57);
  });

  it("returns null when any input is missing", () => {
    expect(computeAltmanZ({ ...base, ebit: null })).toBeNull();
    expect(computeAltmanZ({ ...base, revenue: null })).toBeNull();
  });

  it("returns null when assets or liabilities are not positive", () => {
    expect(computeAltmanZ({ ...base, totalAssets: 0 })).toBeNull();
    expect(computeAltmanZ({ ...base, totalLiabilities: 0 })).toBeNull();
  });
});

describe("computeNCAVPerShare", () => {
  it("is (current assets - total liabilities) / shares", () => {
    expect(
      computeNCAVPerShare({
        totalCurrentAssets: 1000,
        totalLiabilities: 400,
        sharesOutstanding: 100,
      })
    ).toBe(6);
  });

  it("can be negative", () => {
    expect(
      computeNCAVPerShare({
        totalCurrentAssets: 100,
        totalLiabilities: 400,
        sharesOutstanding: 100,
      })
    ).toBe(-3);
  });

  it("returns null for missing data or zero shares", () => {
    expect(
      computeNCAVPerShare({ totalCurrentAssets: null, totalLiabilities: 1, sharesOutstanding: 1 })
    ).toBeNull();
    expect(
      computeNCAVPerShare({ totalCurrentAssets: 1, totalLiabilities: 1, sharesOutstanding: 0 })
    ).toBeNull();
  });
});

describe("getValuationLabel", () => {
  it.each([
    [null, "N/A"],
    [0.5, "BUY"],
    [0.3, "BUY"],
    [0.29, "HOLD"],
    [0, "HOLD"],
    [-0.01, "SELL"],
  ])("margin of safety %s -> %s", (mos, label) => {
    expect(getValuationLabel(mos)).toBe(label);
  });
});
