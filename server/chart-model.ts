import { ema, type Candle, type ComputedSignal, type Zone } from "./signal-engine";

export type ChartLevel = { key: "entry" | "stop" | "tp1" | "tp2"; label: string; price: number; tone: "gold" | "red" | "green" };
export type ChartZone = { key: string; label: string; top: number; bottom: number; startIndex: number; tone: "support" | "resistance" | "orderBlock" };
export type ChartMarker = { index: number; label: string; direction: "bull" | "bear" | "neutral" };

export type ChartSnapshot = {
  candles: Candle[];
  ema50: Array<number | null>;
  ema200: Array<number | null>;
  bollingerUpper: Array<number | null>;
  bollingerMiddle: Array<number | null>;
  bollingerLower: Array<number | null>;
  zones: ChartZone[];
  markers: ChartMarker[];
  levels: ChartLevel[];
};

function rollingBands(closes: number[], period = 20) {
  return closes.map((_, index) => {
    if (index < period - 1) return { upper: null, middle: null, lower: null };
    const values = closes.slice(index - period + 1, index + 1);
    const middle = values.reduce((sum, value) => sum + value, 0) / period;
    const variance = values.reduce((sum, value) => sum + (value - middle) ** 2, 0) / period;
    const deviation = Math.sqrt(variance);
    return { upper: middle + deviation * 2, middle, lower: middle - deviation * 2 };
  });
}

function zoneToOverlay(zone: Zone | null, key: string, label: string, tone: ChartZone["tone"], offset: number): ChartZone[] {
  if (!zone) return [];
  return [{ key, label, top: zone.top, bottom: zone.bottom, startIndex: Math.max(0, (zone.pivotIndex ?? offset) - offset), tone }];
}

export function buildChartSnapshot(allCandles: Candle[], signal: ComputedSignal, visibleCandles = 120): ChartSnapshot {
  const start = Math.max(0, allCandles.length - visibleCandles);
  const closes = allCandles.map(candle => candle.close);
  const bands = rollingBands(closes);
  const context = signal.confluence;
  const zones = [
    ...zoneToOverlay(context.supportZone, "support", "SNRV Support", "support", start),
    ...zoneToOverlay(context.resistanceZone, "resistance", "SNRV Resistance", "resistance", start),
    ...zoneToOverlay(context.bullOrderBlock, "bull-ob", "Bullish OB", "orderBlock", start),
    ...zoneToOverlay(context.bearOrderBlock, "bear-ob", "Bearish OB", "orderBlock", start),
  ];
  const latest = Math.min(visibleCandles - 1, allCandles.length - 1 - start);
  const markers: ChartMarker[] = [];
  if (context.bosBull) markers.push({ index: latest, label: "BOS ↑", direction: "bull" });
  if (context.bosBear) markers.push({ index: latest, label: "BOS ↓", direction: "bear" });
  if (context.bullSweep) markers.push({ index: latest, label: "Sweep ↓", direction: "bull" });
  if (context.bearSweep) markers.push({ index: latest, label: "Sweep ↑", direction: "bear" });
  if (context.bullFvg) markers.push({ index: latest, label: "Bull FVG", direction: "bull" });
  if (context.bearFvg) markers.push({ index: latest, label: "Bear FVG", direction: "bear" });
  const levels: ChartLevel[] = signal.direction === "WAIT" ? [] : [
    { key: "entry", label: "Entry", price: signal.entry, tone: "gold" },
    ...(signal.stopLoss === null ? [] : [{ key: "stop" as const, label: "SL", price: signal.stopLoss, tone: "red" as const }]),
    ...(signal.takeProfit1 === null ? [] : [{ key: "tp1" as const, label: "TP1", price: signal.takeProfit1, tone: "green" as const }]),
    ...(signal.takeProfit2 === null ? [] : [{ key: "tp2" as const, label: "TP2", price: signal.takeProfit2, tone: "green" as const }]),
  ];
  return {
    candles: allCandles.slice(start),
    ema50: ema(closes, 50).slice(start), ema200: ema(closes, 200).slice(start),
    bollingerUpper: bands.slice(start).map(point => point.upper), bollingerMiddle: bands.slice(start).map(point => point.middle), bollingerLower: bands.slice(start).map(point => point.lower),
    zones, markers, levels,
  };
}
