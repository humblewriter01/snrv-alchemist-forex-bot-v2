import { createStoredSignal, type StoredSignalInput } from "./db";
import { fetchClosedCandles } from "./market-data";
import { calculateSignal, type AnalysisSettings, type ComputedSignal } from "./signal-engine";

export async function analyzeAndPersist(input: { ownerOpenId: string; symbol: string; timeframe: string; source: "manual" | "scheduled"; settings: AnalysisSettings }) {
  const { symbol, candles } = await fetchClosedCandles({ symbol: input.symbol, interval: input.timeframe });
  const signal = calculateSignal(candles, symbol, input.timeframe, input.settings);
  const accepted = signal.direction === "BUY" || signal.direction === "SELL";
  const stored = await createStoredSignal({
    ownerOpenId: input.ownerOpenId,
    source: input.source,
    symbol: signal.symbol,
    timeframe: signal.timeframe,
    direction: signal.direction,
    signalType: "SNRV_SIGNAL",
    entry: signal.entry,
    stopLoss: signal.stopLoss,
    takeProfit1: signal.takeProfit1,
    takeProfit2: signal.takeProfit2,
    riskReward: signal.riskReward,
    signalScore: signal.score,
    confidence: signal.confidence,
    phase: signal.phase,
    bias: signal.bias,
    confluence: signal.confluence,
    indicators: signal.indicators,
    validationOutcome: accepted ? "accepted" : "rejected",
    validationMessage: accepted ? "Closed-candle signal passed the configured confirmation rules." : signal.warnings.join(" "),
    deliveryStatus: "not_requested",
  });
  return { signal, stored };
}

export function signalToTelegramText(signal: ComputedSignal) {
  const level = (value: number | null) => value === null ? "Not issued" : String(value);
  return [
    `SNRV Alchemist | ${signal.symbol} | ${signal.timeframe}`,
    `Signal: ${signal.direction} | Score: ${signal.score} | Confidence guide: ${signal.confidence}%`,
    `Reference: ${signal.entry} | Stop: ${level(signal.stopLoss)} | TP1: ${level(signal.takeProfit1)}`,
    `Phase: ${signal.phase} | Bias: ${signal.bias}`,
    `MACD: ${signal.indicators.macdLine} / ${signal.indicators.macdSignal} | RSI: ${signal.indicators.rsi} | Bollinger %B: ${signal.indicators.bollingerPercentB}`,
    "Signal-only intelligence. No orders are placed.",
  ].join("\n");
}
