import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import MarketChart from "./MarketChart";

const snapshot = {
  candles: [{ timestamp: "2026-08-27 10:00:00", open: 1.1, high: 1.12, low: 1.09, close: 1.115 }, { timestamp: "2026-08-27 11:00:00", open: 1.115, high: 1.13, low: 1.11, close: 1.125 }],
  ema50: [1.1, 1.11], ema200: [1.09, 1.1], bollingerUpper: [1.13, 1.14], bollingerMiddle: [1.11, 1.12], bollingerLower: [1.09, 1.1],
  zones: [{ key: "support", label: "SNRV Support", top: 1.105, bottom: 1.095, startIndex: 0, tone: "support" as const }], markers: [{ index: 1, label: "BOS ↑", direction: "bull" as const }],
  levels: [{ key: "entry" as const, label: "Entry", price: 1.125, tone: "gold" as const }, { key: "stop" as const, label: "SL", price: 1.11, tone: "red" as const }, { key: "tp1" as const, label: "TP1", price: 1.15, tone: "green" as const }, { key: "tp2" as const, label: "TP2", price: 1.16, tone: "green" as const }],
};

describe("MarketChart", () => {
  it("renders completed-candle structure, SNRV/SMC overlays, and qualified entry/SL/TP levels", () => {
    render(<MarketChart snapshot={snapshot} symbol="EUR/USD" timeframe="1h" />);
    expect(screen.getByRole("img", { name: "EUR/USD 1h candlestick analysis chart" })).toBeTruthy();
    expect(screen.getByText("SNRV Support")).toBeTruthy();
    expect(screen.getByText("BOS ↑")).toBeTruthy();
    expect(screen.getByText("Entry 1.1250")).toBeTruthy();
    expect(screen.getByText("TP1 1.1500")).toBeTruthy();
  });

  it("shows OHLC detail after the user moves across a candle", () => {
    const { container } = render(<MarketChart snapshot={snapshot} symbol="EUR/USD" timeframe="1h" />);
    const chart = container.querySelector('svg[aria-label="EUR/USD 1h candlestick analysis chart"]');
    expect(chart).toBeTruthy();
    Object.defineProperty(chart, "getBoundingClientRect", { value: () => ({ left: 0, width: 1000 }) });
    fireEvent.mouseMove(chart!, { clientX: 300, clientY: 200 });
    expect(screen.getByText(/O 1\.1000/)).toBeTruthy();
  });
});
