import type { ChartSnapshot } from "../../../server/chart-model";
import React, { useMemo, useRef, useState } from "react";

type Props = { snapshot: ChartSnapshot; symbol: string; timeframe: string };
const width = 1000; const height = 520; const top = 28; const right = 92; const bottom = 44; const left = 20;
const tones = { support: "#14b8a6", resistance: "#f87171", orderBlock: "#e6c96e", gold: "#f3d477", red: "#fb7185", green: "#34d399" };

function formatPrice(value: number) { return value >= 100 ? value.toFixed(2) : value >= 1 ? value.toFixed(4) : value.toFixed(6); }

export default function MarketChart({ snapshot, symbol, timeframe }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const chart = useMemo(() => {
    const candles = snapshot.candles;
    const levels = snapshot.levels.map(level => level.price);
    const zonePrices = snapshot.zones.flatMap(zone => [zone.top, zone.bottom]);
    const low = Math.min(...candles.map(candle => candle.low), ...levels, ...zonePrices);
    const high = Math.max(...candles.map(candle => candle.high), ...levels, ...zonePrices);
    const pad = Math.max((high - low) * 0.09, high * 0.0002);
    const minimum = low - pad; const maximum = high + pad;
    const plotWidth = width - left - right; const plotHeight = height - top - bottom;
    const x = (index: number) => left + (index / Math.max(1, candles.length - 1)) * plotWidth;
    const y = (price: number) => top + ((maximum - price) / (maximum - minimum)) * plotHeight;
    const line = (points: Array<number | null>) => points.map((value, index) => value === null ? "" : `${index === 0 || points[index - 1] === null ? "M" : "L"}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
    return { candles, minimum, maximum, plotWidth, plotHeight, x, y, line };
  }, [snapshot]);
  const hover = hovered === null ? null : chart.candles[hovered];
  const onMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const box = ref.current?.getBoundingClientRect(); if (!box) return;
    const relative = (event.clientX - box.left) / box.width; const index = Math.max(0, Math.min(chart.candles.length - 1, Math.round((relative * width - left) / chart.plotWidth * (chart.candles.length - 1)))); setHovered(index);
  };
  const ticks = Array.from({ length: 6 }, (_, index) => chart.minimum + ((chart.maximum - chart.minimum) * index) / 5);
  const timeTick = (index: number) => chart.candles[index]?.timestamp.replace(" ", "\n") ?? "";
  return <div className="relative overflow-hidden rounded-2xl border border-border bg-[#0d1420]">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-[#131d2b]/90 px-4 py-3"><div><p className="font-mono-data text-sm font-bold text-white">{symbol}</p><p className="text-xs text-muted-foreground">{timeframe} · completed candles · UTC</p></div><div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-semibold uppercase tracking-wider"><span className="text-[#f2d378]">● EMA 50</span><span className="text-sky-300">● EMA 200</span><span className="text-slate-300">— Bollinger 20/2</span></div></div>
    {hover ? <div className="absolute left-4 top-16 z-10 rounded-lg border border-border bg-[#101925]/95 px-3 py-2 font-mono-data text-[11px] shadow-xl"><div className="text-slate-400">{hover.timestamp}</div><div className="mt-1 flex gap-2"><span className="text-slate-300">O {formatPrice(hover.open)}</span><span className="text-emerald-300">H {formatPrice(hover.high)}</span><span className="text-rose-300">L {formatPrice(hover.low)}</span><span className="text-[#f4d57b]">C {formatPrice(hover.close)}</span></div></div> : null}
    <svg ref={ref} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${symbol} ${timeframe} candlestick analysis chart`} className="block w-full select-none" onMouseMove={onMove} onMouseLeave={() => setHovered(null)}>
      <rect width={width} height={height} fill="#0d1420" />
      {ticks.map((tick, index) => <g key={index}><line x1={left} x2={width - right} y1={chart.y(tick)} y2={chart.y(tick)} stroke="#334155" strokeOpacity=".45" strokeDasharray="3 5" /><text x={width - right + 10} y={chart.y(tick) + 4} fill="#94a3b8" fontSize="11" fontFamily="ui-monospace, SFMono-Regular">{formatPrice(tick)}</text></g>)}
      {snapshot.zones.map(zone => <g key={zone.key}><rect x={chart.x(Math.max(0, zone.startIndex))} y={chart.y(zone.top)} width={width - right - chart.x(Math.max(0, zone.startIndex))} height={Math.max(2, chart.y(zone.bottom) - chart.y(zone.top))} fill={tones[zone.tone]} fillOpacity=".12" stroke={tones[zone.tone]} strokeOpacity=".52" strokeDasharray="5 5" /><text x={chart.x(Math.max(0, zone.startIndex)) + 8} y={chart.y(zone.top) + 15} fill={tones[zone.tone]} fontSize="10" fontFamily="ui-sans-serif" fontWeight="700">{zone.label}</text></g>)}
      <path d={chart.line(snapshot.bollingerUpper)} fill="none" stroke="#94a3b8" strokeOpacity=".5" strokeWidth="1.2" /><path d={chart.line(snapshot.bollingerMiddle)} fill="none" stroke="#94a3b8" strokeOpacity=".3" strokeWidth="1" strokeDasharray="4 4" /><path d={chart.line(snapshot.bollingerLower)} fill="none" stroke="#94a3b8" strokeOpacity=".5" strokeWidth="1.2" />
      <path d={chart.line(snapshot.ema200)} fill="none" stroke="#38bdf8" strokeWidth="1.6" strokeOpacity=".9" /><path d={chart.line(snapshot.ema50)} fill="none" stroke="#f3d477" strokeWidth="1.8" />
      {chart.candles.map((candle, index) => { const up = candle.close >= candle.open; const color = up ? "#2dd4bf" : "#f87171"; const body = Math.max(1.2, Math.abs(chart.y(candle.close) - chart.y(candle.open))); const candleWidth = Math.max(2, Math.min(7, chart.plotWidth / chart.candles.length * .65)); return <g key={`${candle.timestamp}-${index}`}><line x1={chart.x(index)} x2={chart.x(index)} y1={chart.y(candle.high)} y2={chart.y(candle.low)} stroke={color} strokeWidth="1.1" /><rect x={chart.x(index) - candleWidth / 2} y={Math.min(chart.y(candle.open), chart.y(candle.close))} width={candleWidth} height={body} fill={color} rx=".6" /></g>; })}
      {snapshot.levels.map(level => <g key={level.key}><line x1={left} x2={width - right} y1={chart.y(level.price)} y2={chart.y(level.price)} stroke={tones[level.tone]} strokeWidth="1.3" strokeDasharray="6 4" /><rect x={width - right + 4} y={chart.y(level.price) - 10} width="80" height="20" rx="4" fill={tones[level.tone]} /><text x={width - right + 9} y={chart.y(level.price) + 4} fill="#0f172a" fontSize="10" fontFamily="ui-monospace" fontWeight="800">{level.label} {formatPrice(level.price)}</text></g>)}
      {snapshot.markers.map((marker, index) => { const price = chart.candles[marker.index]?.[marker.direction === "bear" ? "high" : "low"] ?? chart.candles.at(-1)!.close; const y = marker.direction === "bear" ? chart.y(price) - 18 - index * 15 : chart.y(price) + 15 + index * 15; const color = marker.direction === "bear" ? "#fb7185" : marker.direction === "bull" ? "#34d399" : "#e6c96e"; return <g key={`${marker.label}-${index}`}><line x1={chart.x(marker.index)} x2={chart.x(marker.index)} y1={chart.y(price)} y2={y} stroke={color} strokeWidth="1" strokeDasharray="2 2" /><text x={chart.x(marker.index) + 4} y={y} fill={color} fontSize="10" fontFamily="ui-sans-serif" fontWeight="800">{marker.label}</text></g>; })}
      {hovered !== null ? <line x1={chart.x(hovered)} x2={chart.x(hovered)} y1={top} y2={height - bottom} stroke="#e2c672" strokeOpacity=".55" strokeDasharray="3 3" /> : null}
      {Array.from(new Set([0, Math.floor(chart.candles.length / 2), chart.candles.length - 1])).map(index => <text key={index} x={chart.x(index)} y={height - 16} textAnchor={index === 0 ? "start" : index === chart.candles.length - 1 ? "end" : "middle"} fill="#64748b" fontSize="10" fontFamily="ui-monospace">{timeTick(index).slice(5, 16)}</text>)}
    </svg>
    <div className="border-t border-border bg-[#101925] px-4 py-2 text-[11px] text-muted-foreground">SNRV Alchemist visualizes analysis context and price references. It does not connect to a broker or transmit orders.</div>
  </div>;
}
