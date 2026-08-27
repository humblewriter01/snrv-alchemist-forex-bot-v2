import { describe, expect, it } from "vitest";
import { buildChartSnapshot } from "./chart-model";
import type { Candle, ComputedSignal } from "./signal-engine";

const candles: Candle[] = Array.from({ length: 250 }, (_, index) => ({ timestamp: new Date(Date.UTC(2026, 7, 1, 0, index)).toISOString(), open: 100 + index * 0.1, high: 101 + index * 0.1, low: 99 + index * 0.1, close: 100.5 + index * 0.1 }));
const baseSignal: ComputedSignal = { symbol: "XAU/USD", timeframe: "1h", direction: "BUY", score: 5, confidence: 80, entry: 111.9, stopLoss: 109.5, takeProfit1: 116.2, takeProfit2: 118.3, riskReward: 1.8, phase: "Manipulation", bias: "SUPPORT", reasons: [], warnings: [], indicators: { ema50: 1, ema200: 1, rsi: 50, atr: 1, atrPercent: .01, macdLine: 1, macdSignal: .5, macdHistogram: .5, bollingerMiddle: 1, bollingerUpper: 2, bollingerLower: 0, bollingerPercentB: .6, support: 1, resistance: 2 }, confluence: { phase: "Manipulation", bias: "SUPPORT", supportZone: { kind: "support", top: 108, bottom: 106, pivotIndex: 50 }, resistanceZone: null, zoneWidth: 1, touchingSupport: true, touchingResistance: false, nullZoneActive: false, voidFill: false, voidUp: false, voidDown: false, bosBull: true, bosBear: false, bullFvg: false, bearFvg: false, bullSweep: false, bearSweep: false, bullOrderBlock: { kind: "bullish_order_block", top: 109, bottom: 107, pivotIndex: 100 }, bearOrderBlock: null, bullishConfirmation: true, bearishConfirmation: false, phaseReadyBuy: true, phaseReadySell: false, nullBreakBull: false, nullBreakBear: false, voidTrapBuy: false, voidTrapSell: false } };

describe("chart snapshot", () => {
  it("maps closed candles, technical overlays, SNRV zones, SMC markers, and qualified BUY reference levels", () => {
    const snapshot = buildChartSnapshot(candles, baseSignal);
    expect(snapshot.candles).toHaveLength(120);
    expect(snapshot.ema50).toHaveLength(120);
    expect(snapshot.bollingerUpper).toHaveLength(120);
    expect(snapshot.zones.map(zone => zone.label)).toEqual(expect.arrayContaining(["SNRV Support", "Bullish OB"]));
    expect(snapshot.markers.map(marker => marker.label)).toContain("BOS ↑");
    expect(snapshot.levels.map(level => level.key)).toEqual(["entry", "stop", "tp1", "tp2"]);
  });

  it("does not produce entry, stop, or target overlays for an unqualified WAIT result", () => {
    const snapshot = buildChartSnapshot(candles, { ...baseSignal, direction: "WAIT", stopLoss: null, takeProfit1: null, takeProfit2: null, riskReward: null });
    expect(snapshot.levels).toEqual([]);
  });
});
