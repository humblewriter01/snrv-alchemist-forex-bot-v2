import { PNG } from "pngjs";
import type { ChartSnapshot } from "./chart-model";

const WIDTH = 1280;
const HEIGHT = 720;
const PAD = { left: 56, right: 28, top: 28, bottom: 42 };

type Color = [number, number, number, number];
const COLORS = {
  background: [12, 18, 28, 255] as Color,
  panel: [18, 27, 40, 255] as Color,
  grid: [42, 57, 76, 255] as Color,
  text: [206, 218, 232, 255] as Color,
  bullish: [46, 205, 150, 255] as Color,
  bearish: [239, 92, 92, 255] as Color,
  ema50: [245, 190, 66, 255] as Color,
  ema200: [180, 126, 255, 255] as Color,
  band: [90, 160, 230, 180] as Color,
  support: [55, 190, 150, 70] as Color,
  resistance: [240, 100, 100, 70] as Color,
  orderBlock: [245, 190, 66, 70] as Color,
  entry: [245, 190, 66, 255] as Color,
  stop: [239, 92, 92, 255] as Color,
  target: [46, 205, 150, 255] as Color,
};

function setPixel(png: PNG, x: number, y: number, color: Color) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const offset = (png.width * y + x) << 2;
  png.data[offset] = color[0]; png.data[offset + 1] = color[1]; png.data[offset + 2] = color[2]; png.data[offset + 3] = color[3];
}

function rect(png: PNG, left: number, top: number, width: number, height: number, color: Color) {
  for (let y = Math.floor(top); y < Math.ceil(top + height); y += 1) {
    for (let x = Math.floor(left); x < Math.ceil(left + width); x += 1) setPixel(png, x, y, color);
  }
}

function line(png: PNG, x1: number, y1: number, x2: number, y2: number, color: Color, thickness = 1) {
  let x = Math.round(x1); let y = Math.round(y1);
  const endX = Math.round(x2); const endY = Math.round(y2);
  const dx = Math.abs(endX - x); const sx = x < endX ? 1 : -1;
  const dy = -Math.abs(endY - y); const sy = y < endY ? 1 : -1;
  let error = dx + dy;
  while (true) {
    for (let ox = -Math.floor(thickness / 2); ox <= Math.floor(thickness / 2); ox += 1) {
      for (let oy = -Math.floor(thickness / 2); oy <= Math.floor(thickness / 2); oy += 1) setPixel(png, x + ox, y + oy, color);
    }
    if (x === endX && y === endY) break;
    const twice = 2 * error;
    if (twice >= dy) { error += dy; x += sx; }
    if (twice <= dx) { error += dx; y += sy; }
  }
}

function valueRange(snapshot: ChartSnapshot) {
  const values = snapshot.candles.flatMap(candle => [candle.high, candle.low]);
  for (const series of [snapshot.ema50, snapshot.ema200, snapshot.bollingerUpper, snapshot.bollingerMiddle, snapshot.bollingerLower]) {
    values.push(...series.filter((value): value is number => value !== null));
  }
  for (const zone of snapshot.zones) values.push(zone.top, zone.bottom);
  for (const level of snapshot.levels) values.push(level.price);
  const min = Math.min(...values); const max = Math.max(...values);
  const padding = Math.max((max - min) * 0.08, Math.abs(max) * 0.0005, 0.000001);
  return { min: min - padding, max: max + padding };
}

function seriesLine(png: PNG, series: Array<number | null>, x: (index: number) => number, y: (value: number) => number, color: Color, thickness = 2) {
  let previous: { x: number; y: number } | null = null;
  series.forEach((value, index) => {
    if (value === null || !Number.isFinite(value)) { previous = null; return; }
    const current = { x: x(index), y: y(value) };
    if (previous) line(png, previous.x, previous.y, current.x, current.y, color, thickness);
    previous = current;
  });
}

function levelColor(key: ChartSnapshot["levels"][number]["key"]): Color {
  return key === "entry" ? COLORS.entry : key === "stop" ? COLORS.stop : COLORS.target;
}

/** Render a Telegram-friendly PNG without browser, font, or network dependencies. */
export function renderChartSnapshot(snapshot: ChartSnapshot): Buffer {
  if (!snapshot.candles.length) throw new Error("Cannot render an empty chart snapshot.");
  const png = new PNG({ width: WIDTH, height: HEIGHT });
  rect(png, 0, 0, WIDTH, HEIGHT, COLORS.background);
  const plotLeft = PAD.left; const plotTop = PAD.top;
  const plotWidth = WIDTH - PAD.left - PAD.right; const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  rect(png, plotLeft, plotTop, plotWidth, plotHeight, COLORS.panel);
  const { min, max } = valueRange(snapshot);
  const x = (index: number) => plotLeft + (index / Math.max(1, snapshot.candles.length - 1)) * plotWidth;
  const y = (value: number) => plotTop + ((max - value) / (max - min)) * plotHeight;
  const candleWidth = Math.max(2, Math.min(12, plotWidth / snapshot.candles.length * 0.64));

  for (let i = 0; i <= 8; i += 1) {
    const yy = plotTop + (i / 8) * plotHeight;
    line(png, plotLeft, yy, plotLeft + plotWidth, yy, COLORS.grid);
  }
  for (let i = 0; i <= 10; i += 1) {
    const xx = plotLeft + (i / 10) * plotWidth;
    line(png, xx, plotTop, xx, plotTop + plotHeight, COLORS.grid);
  }

  for (const zone of snapshot.zones) {
    const color = zone.tone === "support" ? COLORS.support : zone.tone === "resistance" ? COLORS.resistance : COLORS.orderBlock;
    const startX = x(Math.max(0, Math.min(snapshot.candles.length - 1, zone.startIndex)));
    const top = y(zone.top); const bottom = y(zone.bottom);
    rect(png, startX, Math.min(top, bottom), plotLeft + plotWidth - startX, Math.abs(bottom - top), color);
  }

  seriesLine(png, snapshot.bollingerUpper, x, y, COLORS.band);
  seriesLine(png, snapshot.bollingerMiddle, x, y, [90, 160, 230, 120]);
  seriesLine(png, snapshot.bollingerLower, x, y, COLORS.band);
  seriesLine(png, snapshot.ema50, x, y, COLORS.ema50, 3);
  seriesLine(png, snapshot.ema200, x, y, COLORS.ema200, 3);

  snapshot.candles.forEach((candle, index) => {
    const xx = x(index); const color = candle.close >= candle.open ? COLORS.bullish : COLORS.bearish;
    line(png, xx, y(candle.high), xx, y(candle.low), color, 2);
    const bodyTop = y(Math.max(candle.open, candle.close));
    const bodyHeight = Math.max(2, Math.abs(y(candle.open) - y(candle.close)));
    rect(png, xx - candleWidth / 2, bodyTop, candleWidth, bodyHeight, color);
  });

  for (const level of snapshot.levels) {
    const yy = y(level.price);
    line(png, plotLeft, yy, plotLeft + plotWidth, yy, levelColor(level.key), 2);
    rect(png, plotLeft + plotWidth - 12, yy - 3, 12, 6, levelColor(level.key));
  }
  for (const marker of snapshot.markers) {
    const xx = x(Math.max(0, Math.min(snapshot.candles.length - 1, marker.index)));
    const markerY = marker.direction === "bear" ? plotTop + 22 : plotTop + plotHeight - 22;
    line(png, xx, markerY - 8, xx, markerY + 8, marker.direction === "bear" ? COLORS.bearish : COLORS.bullish, 3);
  }
  return PNG.sync.write(png);
}
