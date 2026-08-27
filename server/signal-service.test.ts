import { describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({ createStoredSignal: vi.fn() }));
const marketMocks = vi.hoisted(() => ({ fetchClosedCandles: vi.fn() }));
const engineMocks = vi.hoisted(() => ({ calculateSignal: vi.fn() }));

vi.mock("./db", () => dbMocks);
vi.mock("./market-data", () => marketMocks);
vi.mock("./signal-engine", () => engineMocks);

import { analyzeAndPersist, signalToTelegramText } from "./signal-service";

const settings = { snrvEnabled: true, smcEnabled: true, snrvSwingLength: 20, snrvSensitivity: "Medium" as const, minSignalScore: 3, atrStopMultiplier: 1.5, rewardRiskRatio: 1.8, maxAtrPct: 0.05 };

describe("signal persistence contract", () => {
  it("stores a qualified scheduled result with accepted validation and notification-ready delivery state", async () => {
    marketMocks.fetchClosedCandles.mockResolvedValue({ symbol: "XAU/USD", candles: [{ timestamp: "2026-08-27 12:00:00", open: 1, high: 1, low: 1, close: 1 }] });
    engineMocks.calculateSignal.mockReturnValue({ symbol: "XAU/USD", timeframe: "1h", direction: "BUY", score: 5, confidence: 80, entry: 2390, stopLoss: 2375, takeProfit1: 2417, takeProfit2: 2430, riskReward: 1.8, phase: "Manipulation", bias: "SUPPORT", reasons: ["Closed-candle confirmation."], warnings: [], indicators: { ema50: 1, ema200: 1, rsi: 55, atr: 1, atrPercent: 0.01, macdLine: 1, macdSignal: 0.5, macdHistogram: 0.5, bollingerMiddle: 1, bollingerUpper: 2, bollingerLower: 0, bollingerPercentB: 0.7, support: 1, resistance: 2 }, confluence: { phase: "Manipulation" } });
    dbMocks.createStoredSignal.mockResolvedValue({ id: 7, createdAt: new Date("2026-08-27T12:00:00.000Z") });

    const result = await analyzeAndPersist({ ownerOpenId: "owner-1", symbol: "XAU/USD", timeframe: "1h", source: "scheduled", settings });

    expect(dbMocks.createStoredSignal).toHaveBeenCalledWith(expect.objectContaining({ ownerOpenId: "owner-1", source: "scheduled", direction: "BUY", validationOutcome: "accepted", deliveryStatus: "not_requested", entry: 2390, phase: "Manipulation" }));
    expect(result.stored).toMatchObject({ id: 7, createdAt: new Date("2026-08-27T12:00:00.000Z") });
  });

  it("formats a notification as signal intelligence and never as an order instruction", () => {
    const message = signalToTelegramText({ symbol: "EUR/USD", timeframe: "1h", direction: "WAIT", score: 2, confidence: 36, entry: 1.1, stopLoss: null, takeProfit1: null, takeProfit2: null, riskReward: null, phase: "Neutral", bias: "NONE", reasons: [], warnings: [], indicators: { macdLine: 0, macdSignal: 0, rsi: 50, bollingerPercentB: 0.5 } } as never);
    expect(message).toContain("Signal-only intelligence");
    expect(message).not.toContain("Place order");
  });
});
