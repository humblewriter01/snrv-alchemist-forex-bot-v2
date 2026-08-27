import { describe, expect, it } from "vitest";
import { buildChartSnapshot } from "./chart-model";
import { fetchClosedCandles } from "./market-data";
import { calculateSignal, type AnalysisSettings } from "./signal-engine";

const settings: AnalysisSettings = { snrvEnabled: true, smcEnabled: true, snrvSwingLength: 20, snrvSensitivity: "Medium", minSignalScore: 3, atrStopMultiplier: 1.5, rewardRiskRatio: 1.8, maxAtrPct: 0.05 };

describe("live chart snapshot", () => {
  it("creates a chart-ready snapshot from completed EUR/USD candles without any execution fields", async () => {
    const market = await fetchClosedCandles({ symbol: "EUR/USD", interval: "1h", outputsize: 250 });
    const signal = calculateSignal(market.candles, market.symbol, "1h", settings);
    const chart = buildChartSnapshot(market.candles, signal);
    expect(chart.candles.length).toBeGreaterThan(100);
    expect(chart.ema50).toHaveLength(chart.candles.length);
    expect(chart.levels.every(level => ["entry", "stop", "tp1", "tp2"].includes(level.key))).toBe(true);
    if (signal.direction === "WAIT") expect(chart.levels).toEqual([]);
  }, 25_000);
});
