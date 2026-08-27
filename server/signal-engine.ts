export type Candle = {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
};

export type SignalDirection = "BUY" | "SELL" | "WAIT";
export type SNRVSensitivity = "Low" | "Medium" | "High";

export type AnalysisSettings = {
  snrvEnabled: boolean;
  smcEnabled: boolean;
  snrvSwingLength: number;
  snrvSensitivity: SNRVSensitivity;
  minSignalScore: number;
  atrStopMultiplier: number;
  rewardRiskRatio: number;
  maxAtrPct: number;
};

export type Zone = {
  kind: "support" | "resistance" | "bullish_order_block" | "bearish_order_block";
  top: number;
  bottom: number;
  pivotIndex?: number;
};

export type SnrvContext = {
  phase: "Accumulation" | "Manipulation" | "Distribution" | "Expansion" | "Void Fill" | "Neutral";
  bias: "SUPPORT" | "RESISTANCE" | "NONE";
  supportZone: Zone | null;
  resistanceZone: Zone | null;
  zoneWidth: number;
  touchingSupport: boolean;
  touchingResistance: boolean;
  nullZoneActive: boolean;
  voidFill: boolean;
  voidUp: boolean;
  voidDown: boolean;
  bosBull: boolean;
  bosBear: boolean;
  bullFvg: boolean;
  bearFvg: boolean;
  bullSweep: boolean;
  bearSweep: boolean;
  bullOrderBlock: Zone | null;
  bearOrderBlock: Zone | null;
  bullishConfirmation: boolean;
  bearishConfirmation: boolean;
  phaseReadyBuy: boolean;
  phaseReadySell: boolean;
  nullBreakBull: boolean;
  nullBreakBear: boolean;
  voidTrapBuy: boolean;
  voidTrapSell: boolean;
};

export type ComputedSignal = {
  symbol: string;
  timeframe: string;
  direction: SignalDirection;
  score: number;
  confidence: number;
  entry: number;
  stopLoss: number | null;
  takeProfit1: number | null;
  takeProfit2: number | null;
  riskReward: number | null;
  phase: SnrvContext["phase"];
  bias: SnrvContext["bias"];
  reasons: string[];
  warnings: string[];
  indicators: {
    ema50: number;
    ema200: number;
    rsi: number;
    atr: number;
    atrPercent: number;
    macdLine: number;
    macdSignal: number;
    macdHistogram: number;
    bollingerMiddle: number;
    bollingerUpper: number;
    bollingerLower: number;
    bollingerPercentB: number;
    support: number;
    resistance: number;
  };
  confluence: SnrvContext;
};

function ensureFinite(value: number, name: string) {
  if (!Number.isFinite(value)) throw new Error(`${name} is not a finite number`);
  return value;
}

export function ema(values: number[], period: number) {
  if (values.length < period) throw new Error(`Need at least ${period} values for EMA`);
  const multiplier = 2 / (period + 1);
  const result: number[] = [values.slice(0, period).reduce((sum, value) => sum + value, 0) / period];
  for (const value of values.slice(period)) result.push((value - result.at(-1)!) * multiplier + result.at(-1)!);
  return [...Array(period - 1).fill(result[0]), ...result];
}

export function rsi(values: number[], period = 14) {
  if (values.length <= period) throw new Error("Not enough values for RSI");
  const changes = values.slice(1).map((value, index) => value - values[index]);
  let averageGain = changes.slice(0, period).reduce((sum, value) => sum + Math.max(value, 0), 0) / period;
  let averageLoss = changes.slice(0, period).reduce((sum, value) => sum + Math.max(-value, 0), 0) / period;
  for (const change of changes.slice(period)) {
    averageGain = (averageGain * (period - 1) + Math.max(change, 0)) / period;
    averageLoss = (averageLoss * (period - 1) + Math.max(-change, 0)) / period;
  }
  if (averageLoss === 0) return 100;
  return 100 - 100 / (1 + averageGain / averageLoss);
}

export function atr(candles: Candle[], period = 14) {
  if (candles.length < period) throw new Error("Not enough values for ATR");
  const ranges = candles.map((candle, index) => {
    const previousClose = candles[Math.max(0, index - 1)].close;
    return Math.max(candle.high - candle.low, Math.abs(candle.high - previousClose), Math.abs(candle.low - previousClose));
  });
  let result = ranges.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  for (const value of ranges.slice(period)) result = (result * (period - 1) + value) / period;
  return result;
}

function macd(closes: number[]) {
  const fast = ema(closes, 12);
  const slow = ema(closes, 26);
  const line = fast.map((value, index) => value - slow[index]);
  const signal = ema(line, 9);
  return { line: line.at(-1)!, signal: signal.at(-1)!, histogram: line.at(-1)! - signal.at(-1)! };
}

function bollinger(closes: number[], period = 20, deviations = 2) {
  if (closes.length < period) throw new Error("Not enough values for Bollinger Bands");
  const window = closes.slice(-period);
  const middle = window.reduce((sum, value) => sum + value, 0) / period;
  const variance = window.reduce((sum, value) => sum + (value - middle) ** 2, 0) / period;
  const standardDeviation = Math.sqrt(variance);
  const upper = middle + deviations * standardDeviation;
  const lower = middle - deviations * standardDeviation;
  const width = upper - lower;
  return { middle, upper, lower, percentB: width === 0 ? 0.5 : (closes.at(-1)! - lower) / width };
}

function pivotIndices(candles: Candle[], swingLength: number) {
  const highs: Array<[number, number]> = [];
  const lows: Array<[number, number]> = [];
  for (let index = swingLength; index < candles.length - swingLength; index += 1) {
    const left = candles.slice(index - swingLength, index);
    const right = candles.slice(index + 1, index + swingLength + 1);
    if (left.concat(right).every(candle => candles[index].high >= candle.high)) highs.push([index, candles[index].high]);
    if (left.concat(right).every(candle => candles[index].low <= candle.low)) lows.push([index, candles[index].low]);
  }
  return { highs, lows };
}

function latestBefore(pivots: Array<[number, number]>, index: number) {
  return [...pivots].reverse().find(([pivotIndex]) => pivotIndex < index) ?? null;
}

function bullishEngulfing(current: Candle, previous: Candle) {
  return current.close > current.open && current.open <= Math.min(previous.open, previous.close) && current.close >= Math.max(previous.open, previous.close);
}

function bearishEngulfing(current: Candle, previous: Candle) {
  return current.close < current.open && current.open >= Math.max(previous.open, previous.close) && current.close <= Math.min(previous.open, previous.close);
}

export function analyzeSnrv(candles: Candle[], settings: AnalysisSettings): SnrvContext {
  const swingLength = Math.max(4, Math.min(60, settings.snrvSwingLength));
  if (candles.length < Math.max(swingLength * 2 + 5, 60)) throw new Error("Not enough closed candles for SNRV structure analysis");
  const currentIndex = candles.length - 1;
  const current = candles[currentIndex];
  const previous = candles[currentIndex - 1];
  const currentAtr = atr(candles);
  const sensitivityMultiplier = settings.snrvSensitivity === "Low" ? 1 : settings.snrvSensitivity === "High" ? 0.3 : 0.6;
  const zoneWidth = currentAtr * sensitivityMultiplier;
  const pivots = pivotIndices(candles, swingLength);
  const lastHigh = latestBefore(pivots.highs, currentIndex);
  const lastLow = latestBefore(pivots.lows, currentIndex);
  const resistanceZone = lastHigh ? { kind: "resistance" as const, top: lastHigh[1] + zoneWidth, bottom: lastHigh[1] - zoneWidth, pivotIndex: lastHigh[0] } : null;
  const supportZone = lastLow ? { kind: "support" as const, top: lastLow[1] + zoneWidth, bottom: lastLow[1] - zoneWidth, pivotIndex: lastLow[0] } : null;
  const touchingSupport = Boolean(supportZone && current.low <= supportZone.top && current.high >= supportZone.bottom);
  const touchingResistance = Boolean(resistanceZone && current.low <= resistanceZone.top && current.high >= resistanceZone.bottom);
  const voidUp = Boolean(lastHigh && current.high > lastHigh[1] && current.close < lastHigh[1]);
  const voidDown = Boolean(lastLow && current.low < lastLow[1] && current.close > lastLow[1]);
  const voidZones: Array<{ top: number; bottom: number; index: number }> = [];
  candles.forEach((candle, index) => {
    if (index === 0) return;
    const high = latestBefore(pivots.highs, index);
    const low = latestBefore(pivots.lows, index);
    if (high && candle.high > high[1] && candle.close < high[1]) voidZones.push({ top: candle.high, bottom: high[1], index });
    if (low && candle.low < low[1] && candle.close > low[1]) voidZones.push({ top: low[1], bottom: candle.low, index });
  });
  const voidFill = voidZones.some(zone => zone.index !== currentIndex && current.close >= zone.bottom && current.close <= zone.top);
  const recent = candles.slice(-20);
  const rangeHigh = Math.max(...recent.map(candle => candle.high));
  const rangeLow = Math.min(...recent.map(candle => candle.low));
  const bullish = bullishEngulfing(current, previous);
  const bearish = bearishEngulfing(current, previous);
  const accumulation = rangeHigh - rangeLow < currentAtr * 1.5;
  const distribution = Boolean((bearish && lastHigh && current.high >= lastHigh[1] - zoneWidth) || (bullish && lastLow && current.low <= lastLow[1] + zoneWidth));
  const expansion = Math.abs(current.close - current.open) > currentAtr * 1.5;
  const phase: SnrvContext["phase"] = voidFill ? "Void Fill" : expansion ? "Expansion" : distribution ? "Distribution" : (voidUp || voidDown) ? "Manipulation" : accumulation ? "Accumulation" : "Neutral";
  const bosBull = Boolean(lastHigh && current.close > lastHigh[1] && previous.close <= lastHigh[1]);
  const bosBear = Boolean(lastLow && current.close < lastLow[1] && previous.close >= lastLow[1]);
  const bullFvg = candles.length >= 3 && current.low > candles.at(-3)!.high;
  const bearFvg = candles.length >= 3 && current.high < candles.at(-3)!.low;
  const bullOrderBlock = bosBull && previous.close < previous.open ? { kind: "bullish_order_block" as const, top: previous.high, bottom: previous.low, pivotIndex: currentIndex - 1 } : null;
  const bearOrderBlock = bosBear && previous.close > previous.open ? { kind: "bearish_order_block" as const, top: previous.high, bottom: previous.low, pivotIndex: currentIndex - 1 } : null;
  const bullishConfirmation = !settings.smcEnabled || bullFvg || bosBull || voidDown || bullish;
  const bearishConfirmation = !settings.smcEnabled || bearFvg || bosBear || voidUp || bearish;
  const nullZoneActive = Boolean(lastHigh && lastLow && lastHigh[1] - zoneWidth > lastLow[1] + zoneWidth && current.high > lastLow[1] + zoneWidth && current.low < lastHigh[1] - zoneWidth);
  return {
    phase,
    bias: touchingSupport ? "SUPPORT" : touchingResistance ? "RESISTANCE" : "NONE",
    supportZone,
    resistanceZone,
    zoneWidth,
    touchingSupport,
    touchingResistance,
    nullZoneActive,
    voidFill,
    voidUp,
    voidDown,
    bosBull,
    bosBear,
    bullFvg,
    bearFvg,
    bullSweep: voidDown,
    bearSweep: voidUp,
    bullOrderBlock,
    bearOrderBlock,
    bullishConfirmation,
    bearishConfirmation,
    phaseReadyBuy: ["Manipulation", "Void Fill", "Accumulation"].includes(phase),
    phaseReadySell: ["Manipulation", "Void Fill", "Distribution"].includes(phase),
    nullBreakBull: nullZoneActive && bosBull && expansion,
    nullBreakBear: nullZoneActive && bosBear && expansion,
    voidTrapBuy: voidDown && current.close > current.open,
    voidTrapSell: voidUp && current.close < current.open,
  };
}

function pricePrecision(price: number) {
  return price >= 100 ? 2 : price >= 1 ? 4 : 6;
}

function rounded(value: number | null, precision: number) {
  return value === null ? null : Number(value.toFixed(precision));
}

export function calculateSignal(candles: Candle[], symbol: string, timeframe: string, settings: AnalysisSettings): ComputedSignal {
  if (candles.length < 210) throw new Error("At least 210 closed candles are required for a stable signal");
  candles.forEach(candle => [candle.open, candle.high, candle.low, candle.close].forEach(value => ensureFinite(value, "Candle price")));
  const closes = candles.map(candle => candle.close);
  const current = candles.at(-1)!;
  const previous = candles.at(-2)!;
  const ema50 = ema(closes, 50).at(-1)!;
  const ema200 = ema(closes, 200).at(-1)!;
  const currentRsi = rsi(closes);
  const currentAtr = atr(candles);
  const macdValues = macd(closes);
  const bands = bollinger(closes);
  const atrPercent = current.close === 0 ? 1 : currentAtr / current.close;
  const recent = candles.slice(-50);
  const support = Math.min(...recent.map(candle => candle.low));
  const resistance = Math.max(...recent.map(candle => candle.high));
  const confluence = settings.snrvEnabled ? analyzeSnrv(candles, settings) : {
    phase: "Neutral" as const, bias: "NONE" as const, supportZone: null, resistanceZone: null, zoneWidth: 0,
    touchingSupport: false, touchingResistance: false, nullZoneActive: false, voidFill: false, voidUp: false, voidDown: false,
    bosBull: false, bosBear: false, bullFvg: false, bearFvg: false, bullSweep: false, bearSweep: false, bullOrderBlock: null,
    bearOrderBlock: null, bullishConfirmation: true, bearishConfirmation: true, phaseReadyBuy: true, phaseReadySell: true,
    nullBreakBull: false, nullBreakBear: false, voidTrapBuy: false, voidTrapSell: false,
  };
  let longScore = 0;
  let shortScore = 0;
  const longReasons: string[] = [];
  const shortReasons: string[] = [];
  if (current.close > ema50 && ema50 > ema200) { longScore += 1; longReasons.push("Price is above the 50 EMA and the 50 EMA is above the 200 EMA."); }
  if (current.close < ema50 && ema50 < ema200) { shortScore += 1; shortReasons.push("Price is below the 50 EMA and the 50 EMA is below the 200 EMA."); }
  if (currentRsi > 50 && currentRsi < 70) { longScore += 1; longReasons.push(`RSI is constructive at ${currentRsi.toFixed(1)}.`); }
  if (currentRsi > 30 && currentRsi < 50) { shortScore += 1; shortReasons.push(`RSI is weak at ${currentRsi.toFixed(1)}.`); }
  if (macdValues.line > macdValues.signal && macdValues.histogram > 0) { longScore += 1; longReasons.push("MACD line is above its signal line with a positive histogram."); }
  if (macdValues.line < macdValues.signal && macdValues.histogram < 0) { shortScore += 1; shortReasons.push("MACD line is below its signal line with a negative histogram."); }
  if (current.close > bands.middle && bands.percentB < 1) { longScore += 1; longReasons.push(`Price is above the Bollinger middle band at %B ${bands.percentB.toFixed(2)}.`); }
  if (current.close < bands.middle && bands.percentB > 0) { shortScore += 1; shortReasons.push(`Price is below the Bollinger middle band at %B ${bands.percentB.toFixed(2)}.`); }
  if (current.close > previous.high) { longScore += 1; longReasons.push("The latest closed candle broke above the prior high."); }
  if (current.close < previous.low) { shortScore += 1; shortReasons.push("The latest closed candle broke below the prior low."); }
  const buyGate = !settings.snrvEnabled || ((confluence.touchingSupport && confluence.phaseReadyBuy && confluence.bullishConfirmation && current.close > current.open) || confluence.voidTrapBuy || confluence.nullBreakBull);
  const sellGate = !settings.snrvEnabled || ((confluence.touchingResistance && confluence.phaseReadySell && confluence.bearishConfirmation && current.close < current.open) || confluence.voidTrapSell || confluence.nullBreakBear);
  if (settings.snrvEnabled && buyGate) { longScore += 2; longReasons.push(`SNRV/Alchemist bullish confluence: ${confluence.phase} phase, ${confluence.bias} context.`); }
  if (settings.snrvEnabled && sellGate) { shortScore += 2; shortReasons.push(`SNRV/Alchemist bearish confluence: ${confluence.phase} phase, ${confluence.bias} context.`); }
  const warnings: string[] = [];
  if (atrPercent > settings.maxAtrPct) warnings.push(`Volatility filter rejected this setup: ATR is ${(atrPercent * 100).toFixed(2)}% of price.`);
  let direction: SignalDirection = "WAIT";
  let reasons: string[] = [];
  let stopLoss: number | null = null;
  let takeProfit1: number | null = null;
  let takeProfit2: number | null = null;
  const score = Math.max(longScore, shortScore);
  if (warnings.length === 0 && buyGate && longScore > shortScore && longScore >= settings.minSignalScore) {
    direction = "BUY"; reasons = longReasons; stopLoss = current.close - settings.atrStopMultiplier * currentAtr; takeProfit1 = current.close + settings.rewardRiskRatio * (current.close - stopLoss); takeProfit2 = current.close + settings.rewardRiskRatio * 1.5 * (current.close - stopLoss);
  } else if (warnings.length === 0 && sellGate && shortScore > longScore && shortScore >= settings.minSignalScore) {
    direction = "SELL"; reasons = shortReasons; stopLoss = current.close + settings.atrStopMultiplier * currentAtr; takeProfit1 = current.close - settings.rewardRiskRatio * (stopLoss - current.close); takeProfit2 = current.close - settings.rewardRiskRatio * 1.5 * (stopLoss - current.close);
  } else {
    warnings.push(`Confirmation threshold not met (long=${longScore}, short=${shortScore}, required=${settings.minSignalScore}).`);
  }
  const precision = pricePrecision(current.close);
  return {
    symbol, timeframe, direction, score, confidence: direction === "WAIT" ? 20 + score * 8 : Math.min(95, Math.max(20, 30 + score * 14)),
    entry: rounded(current.close, precision)!, stopLoss: rounded(stopLoss, precision), takeProfit1: rounded(takeProfit1, precision), takeProfit2: rounded(takeProfit2, precision), riskReward: direction === "WAIT" ? null : settings.rewardRiskRatio,
    phase: confluence.phase, bias: confluence.bias, reasons, warnings,
    indicators: {
      ema50: rounded(ema50, precision)!, ema200: rounded(ema200, precision)!, rsi: Number(currentRsi.toFixed(2)), atr: rounded(currentAtr, precision)!, atrPercent: Number(atrPercent.toFixed(5)),
      macdLine: rounded(macdValues.line, precision)!, macdSignal: rounded(macdValues.signal, precision)!, macdHistogram: rounded(macdValues.histogram, precision)!,
      bollingerMiddle: rounded(bands.middle, precision)!, bollingerUpper: rounded(bands.upper, precision)!, bollingerLower: rounded(bands.lower, precision)!, bollingerPercentB: Number(bands.percentB.toFixed(4)),
      support: rounded(support, precision)!, resistance: rounded(resistance, precision)!,
    },
    confluence,
  };
}
