import { describe, expect, it } from "vitest";
import { renderChartSnapshot } from "./chart-renderer";
import type { ChartSnapshot } from "./chart-model";

const snapshot: ChartSnapshot = {
  candles: [
    { timestamp: "2026-08-27T12:00:00.000Z", open: 100, high: 104, low: 98, close: 103 },
    { timestamp: "2026-08-27T13:00:00.000Z", open: 103, high: 105, low: 101, close: 102 },
  ],
  ema50: [101, 102], ema200: [100, 101],
  bollingerUpper: [105, 106], bollingerMiddle: [101, 102], bollingerLower: [97, 98],
  zones: [{ key: "support", label: "Support", top: 101, bottom: 99, startIndex: 0, tone: "support" }],
  markers: [{ index: 1, label: "BOS", direction: "bull" }],
  levels: [{ key: "entry", label: "Entry", price: 102, tone: "gold" }, { key: "stop", label: "SL", price: 98, tone: "red" }],
};

describe("chart renderer", () => {
  it("renders a non-empty PNG from the chart snapshot", () => {
    const output = renderChartSnapshot(snapshot);
    expect(output.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(output.length).toBeGreaterThan(1_000);
  });

  it("rejects an empty snapshot instead of sending a blank image", () => {
    expect(() => renderChartSnapshot({ ...snapshot, candles: [] })).toThrow("empty chart snapshot");
  });
});
