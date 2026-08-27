import { describe, expect, it } from "vitest";
import { fetchClosedCandles } from "./market-data";
import { calculateSignal, type AnalysisSettings } from "./signal-engine";

const settings: AnalysisSettings = {
  snrvEnabled: true,
  smcEnabled: true,
  snrvSwingLength: 20,
  snrvSensitivity: "Medium",
  minSignalScore: 3,
  atrStopMultiplier: 1.5,
  rewardRiskRatio: 1.8,
  maxAtrPct: 0.05,
};

describe("live market-data analysis", () => {
  it("fetches completed EUR/USD candles and returns a signal-only analysis", async () => {
    const market = await fetchClosedCandles({ symbol: "EUR/USD", interval: "1h", outputsize: 250 });
    const signal = calculateSignal(market.candles, market.symbol, "1h", settings);

    expect(market.symbol).toBe("EUR/USD");
    expect(market.candles.length).toBeGreaterThanOrEqual(210);
    expect(["BUY", "SELL", "WAIT"]).toContain(signal.direction);
    expect(signal.entry).toBeGreaterThan(0);
    expect(signal.confluence.phase).toBeTruthy();
    expect("orderId" in signal).toBe(false);
  }, 25_000);
});
