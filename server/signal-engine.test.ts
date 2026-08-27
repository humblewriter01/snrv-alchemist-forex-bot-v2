import { describe, expect, it } from "vitest";
import { normalizeSymbol } from "./market-data";
import { calculateSignal, type AnalysisSettings, type Candle } from "./signal-engine";

const settings: AnalysisSettings = {
  snrvEnabled: false,
  smcEnabled: false,
  snrvSwingLength: 20,
  snrvSensitivity: "Medium",
  minSignalScore: 3,
  atrStopMultiplier: 1.5,
  rewardRiskRatio: 1.8,
  maxAtrPct: 0.5,
};

function trendCandles(start: number, step: number): Candle[] {
  return Array.from({ length: 240 }, (_, index) => {
    const close = start + step * index;
    const open = close - step * 0.4;
    return { timestamp: `2026-01-${String(index + 1).padStart(3, "0")}`, open, high: Math.max(open, close) + Math.abs(step) * 0.3, low: Math.min(open, close) - Math.abs(step) * 0.3, close };
  });
}

describe("market symbols", () => {
  it("normalizes dashboard watchlist aliases", () => {
    expect(normalizeSymbol("gold")).toBe("XAU/USD");
    expect(normalizeSymbol("XAGU")).toBe("XAG/USD");
    expect(normalizeSymbol("eurusd")).toBe("EUR/USD");
  });
});

describe("signal engine", () => {
  it("issues only a BUY/SELL/WAIT intelligence outcome with coherent long reference levels", () => {
    const signal = calculateSignal(trendCandles(100, 0.08), "XAU/USD", "1h", settings);
    expect(signal.direction).toBe("BUY");
    expect(signal.stopLoss).not.toBeNull();
    expect(signal.takeProfit1).not.toBeNull();
    expect(signal.stopLoss!).toBeLessThan(signal.entry);
    expect(signal.takeProfit1!).toBeGreaterThan(signal.entry);
    expect(signal.reasons.join(" ")).toContain("MACD");
  });

  it("uses the no-execution signal contract and coherent short reference levels", () => {
    const signal = calculateSignal(trendCandles(140, -0.08), "EUR/USD", "1h", settings);
    expect(signal.direction).toBe("SELL");
    expect(signal.stopLoss!).toBeGreaterThan(signal.entry);
    expect(signal.takeProfit1!).toBeLessThan(signal.entry);
    expect(signal.riskReward).toBe(settings.rewardRiskRatio);
    expect("orderId" in signal).toBe(false);
  });
});
