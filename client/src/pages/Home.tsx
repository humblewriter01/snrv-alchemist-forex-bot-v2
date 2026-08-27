import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, BellRing, Bot, CandlestickChart, ChevronRight, CircleSlash2, Clock3, Loader2, Radar, ShieldCheck, Sparkles, Waves } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ComputedSignal } from "../../../server/signal-engine";

const directionTone: Record<string, string> = { BUY: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300", SELL: "border-rose-400/25 bg-rose-400/10 text-rose-300", WAIT: "border-amber-300/25 bg-amber-300/10 text-amber-200" };
const signalIcon: Record<string, typeof ArrowUpRight> = { BUY: ArrowUpRight, SELL: ArrowDownRight, WAIT: Waves };

function formatTime(value: Date | string | null | undefined) {
  return value ? new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Not yet";
}

export default function Home() {
  const utils = trpc.useUtils();
  const overview = trpc.signal.overview.useQuery(undefined, { refetchInterval: 60_000 });
  const [symbol, setSymbol] = useState("XAU/USD");
  const [timeframe, setTimeframe] = useState("1h");
  const [latest, setLatest] = useState<ComputedSignal | null>(null);
  const initializedSettings = useRef(false);
  const analyze = trpc.signal.analyze.useMutation({
    onSuccess: result => { setLatest(result.signal); utils.signal.overview.invalidate(); utils.signal.history.invalidate(); toast.success(`${result.signal.symbol} analysis completed.`); },
    onError: error => toast.error(error.message),
  });

  useEffect(() => {
    if (overview.data?.settings && !initializedSettings.current) { initializedSettings.current = true; setSymbol(current => overview.data.settings.watchlist.includes(current) ? current : overview.data.settings.watchlist[0] ?? "XAU/USD"); setTimeframe(overview.data.settings.defaultTimeframe); }
  }, [overview.data?.settings]);

  const data = overview.data;
  const runAnalysis = () => analyze.mutate({ symbol, timeframe: timeframe as "1min" | "5min" | "15min" | "30min" | "1h" | "2h" | "4h" | "1day" });

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1540px] space-y-6">
        <section className="relative overflow-hidden rounded-3xl border border-[#e4c76e]/20 bg-[#172335]/90 px-5 py-6 shadow-[0_24px_80px_-40px_rgba(3,7,18,0.95)] sm:px-8 sm:py-8">
          <div className="absolute right-[-2rem] top-[-5rem] h-48 w-48 rounded-full bg-[#e4c76e]/10 blur-3xl" />
          <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <div className="mb-3 flex items-center gap-2 text-[#f0d783]"><Sparkles className="h-4 w-4" /><span className="eyebrow !text-[#f0d783]">Intelligence workspace</span></div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">SNRV <span className="text-[#efd27a]">Alchemist</span></h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Closed-candle market structure intelligence across your watchlist. Every result is research-only and remains outside any order-routing system.</p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-[#e8cd7b]/25 bg-[#101a29]/80 px-4 py-3 text-sm text-slate-200">
              <CircleSlash2 className="h-5 w-5 text-[#efcf71]" />
              <div><p className="font-bold text-white">Execution is disabled</p><p className="text-xs text-slate-400">Signal-only boundary is enforced server-side.</p></div>
            </div>
          </div>
        </section>

        {overview.isLoading ? <div className="grid gap-4 md:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-32 rounded-2xl bg-card" />)}</div> : null}
        {data ? <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Service posture" value={data.service.marketDataConfigured ? "Provider configured" : "Needs setup"} detail={data.service.marketDataConfigured ? "Twelve Data server key present" : "Add a server key"} icon={Activity} tone={data.service.marketDataConfigured ? "text-emerald-300" : "text-amber-200"} />
            <Metric label="Signals stored" value={String(data.stats.total)} detail={`${data.stats.today} in the last 24 hours`} icon={BarChart3} tone="text-[#ecd071]" />
            <Metric label="Qualified setups" value={String(data.stats.qualified)} detail="BUY / SELL only" icon={Radar} tone="text-sky-300" />
            <Metric label="Scan health" value={data.service.scanStatus === "healthy" ? "Nominal" : data.service.scanStatus} detail={data.service.lastScanAt ? `Last scan ${formatTime(data.service.lastScanAt)}` : "Automations are off"} icon={data.service.scanStatus === "error" ? AlertTriangle : ShieldCheck} tone={data.service.scanStatus === "error" ? "text-rose-300" : "text-emerald-300"} />
          </section>

          {data.service.lastError ? <div className="flex gap-3 rounded-2xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm text-amber-100"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div><strong>Service attention required.</strong> {data.service.lastError}</div></div> : null}

          <section className="grid gap-6 xl:grid-cols-[1.16fr_.84fr]">
            <div className="glass-panel p-5 sm:p-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p className="eyebrow">Direct analysis</p><h2 className="mt-1 text-xl font-bold text-white">Run a closed-candle scan</h2><p className="mt-1 text-sm text-muted-foreground">The engine waits for completed candles and records the result in signal history.</p></div><Badge variant="outline" className="w-fit border-[#e8cd7b]/30 bg-[#e8cd7b]/10 text-[#f1d886]">No execution</Badge></div>
              <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <label className="space-y-1.5"><span className="eyebrow">Asset</span><select aria-label="Asset" value={symbol} onChange={event => setSymbol(event.target.value)} className="h-11 w-full rounded-xl border border-border bg-[#151f2e] px-3 text-sm text-white outline-none transition focus:border-[#e3c770]">{data.settings.watchlist.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
                <label className="space-y-1.5"><span className="eyebrow">Timeframe</span><select aria-label="Timeframe" value={timeframe} onChange={event => setTimeframe(event.target.value)} className="h-11 w-full rounded-xl border border-border bg-[#151f2e] px-3 text-sm text-white outline-none transition focus:border-[#e3c770]">{["5min", "15min", "30min", "1h", "2h", "4h", "1day"].map(item => <option key={item} value={item}>{item}</option>)}</select></label>
                <Button disabled={analyze.isPending || !data.canManage} onClick={runAnalysis} className="mt-[25px] h-11 rounded-xl bg-[#e4c76e] px-5 font-bold text-[#172033] hover:bg-[#f4da89]">{analyze.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CandlestickChart className="h-4 w-4" />}Analyze</Button>
              </div>
              {!data.canManage ? <p className="mt-3 text-xs text-amber-200">This account has read-only dashboard access. Only the workspace owner can initiate scans or change settings.</p> : null}
              {latest ? <LatestSignal signal={latest} /> : <div className="mt-6 flex items-center gap-3 rounded-2xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground"><Bot className="h-5 w-5 text-[#e2c672]" />Choose an asset and start an analysis. Your first result will appear here and in the permanent signal history.</div>}
            </div>
            <div className="glass-panel overflow-hidden p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="eyebrow">Market model</p><h2 className="mt-1 text-xl font-bold text-white">Confluence stack</h2></div><Waves className="h-5 w-5 text-[#e6cb75]" /></div><div className="mt-6 space-y-3">{[
              ["SNRV / Alchemist", data.settings.snrvEnabled, "Phases, zone logic, void behavior"], ["SMC confluence", data.settings.smcEnabled, "BOS, FVG, sweeps, order-block context"], ["Trend + momentum", true, "EMA 50/200, RSI and MACD"], ["Volatility + levels", true, "Bollinger Bands and ATR references"],
            ].map(([name, enabled, detail]) => <div key={String(name)} className="flex items-center gap-3 rounded-xl bg-[#151f2e]/75 px-3 py-3"><div className={`status-dot ${enabled ? "bg-emerald-400 text-emerald-400" : "bg-slate-500 text-slate-500"}`} /><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-100">{name}</p><p className="truncate text-xs text-muted-foreground">{detail}</p></div><span className={`text-[10px] font-bold uppercase tracking-wider ${enabled ? "text-emerald-300" : "text-slate-500"}`}>{enabled ? "Active" : "Off"}</span></div>)}</div><div className="mt-5 rounded-xl border border-sky-300/15 bg-sky-300/5 px-3 py-3 text-xs leading-5 text-sky-100"><ShieldCheck className="mr-1.5 inline h-3.5 w-3.5" />Signal levels are risk references, not orders, account instructions, or a guarantee of outcome.</div></div>
          </section>

          <section className="glass-panel overflow-hidden"><div className="flex flex-col justify-between gap-3 border-b border-border px-5 py-5 sm:flex-row sm:items-center sm:px-6"><div><p className="eyebrow">Permanent record</p><h2 className="mt-1 text-xl font-bold text-white">Recent signal intelligence</h2></div><a href="/history" className="inline-flex items-center gap-1 text-sm font-semibold text-[#ead079] transition hover:text-white">View history <ChevronRight className="h-4 w-4" /></a></div><div className="overflow-x-auto"><table className="mobile-condense w-full min-w-[760px] text-left"><thead className="bg-[#151f2e]/55 text-[10px] uppercase tracking-[0.14em] text-muted-foreground"><tr><th className="px-6 py-3 font-bold">Signal</th><th className="px-4 py-3 font-bold">Direction</th><th className="px-4 py-3 font-bold">Phase</th><th className="px-4 py-3 font-bold">Reference</th><th className="px-4 py-3 font-bold">Delivery</th><th className="px-6 py-3 font-bold">Recorded</th></tr></thead><tbody>{data.recent.length ? data.recent.map(record => { const Icon = signalIcon[record.direction] ?? Waves; return <tr key={record.id} className="border-t border-border/70 text-sm text-slate-200"><td className="px-6 py-4"><div className="flex items-center gap-2"><Icon className="h-4 w-4 text-[#e8cc78]" /><span className="font-mono-data font-medium">{record.symbol}</span><span className="text-xs text-muted-foreground">{record.timeframe}</span></div></td><td className="px-4 py-4"><span className={`rounded-md border px-2 py-1 text-xs font-bold ${directionTone[record.direction]}`}>{record.direction}</span></td><td className="px-4 py-4 text-sm text-slate-300">{record.phase ?? "—"}</td><td className="font-mono-data px-4 py-4 text-xs">{record.entry ?? "—"}</td><td className="px-4 py-4 text-xs text-muted-foreground">{record.deliveryStatus.replace("_", " ")}</td><td className="px-6 py-4 text-xs text-muted-foreground">{formatTime(record.createdAt)}</td></tr>; }) : <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-muted-foreground">No signal records yet. Run a manual closed-candle analysis to establish your first audit entry.</td></tr>}</tbody></table></div></section>
        </> : null}
      </div>
    </DashboardLayout>
  );
}

function Metric({ label, value, detail, icon: Icon, tone }: { label: string; value: string; detail: string; icon: typeof Activity; tone: string }) { return <div className="glass-panel p-5"><div className="flex items-start justify-between"><p className="eyebrow">{label}</p><Icon className={`h-5 w-5 ${tone}`} /></div><p className="mt-4 text-xl font-extrabold tracking-tight text-white">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>; }

function LatestSignal({ signal }: { signal: { symbol: string; timeframe: string; direction: string; score: number; confidence: number; entry: number; stopLoss: number | null; takeProfit1: number | null; phase: string; bias: string; reasons: string[]; warnings: string[]; indicators: { rsi: number; macdLine: number; macdSignal: number; bollingerPercentB: number } } }) { const Icon = signalIcon[signal.direction] ?? Waves; return <div className="mt-6 rounded-2xl border border-[#e4c76e]/25 bg-[#121c2a] p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e4c76e]/15 text-[#e6cc77]"><Icon className="h-5 w-5" /></div><div><p className="font-mono-data text-sm font-bold text-white">{signal.symbol} <span className="font-sans text-xs font-normal text-muted-foreground">{signal.timeframe}</span></p><p className="text-xs text-muted-foreground">{signal.phase} · {signal.bias}</p></div></div><span className={`rounded-lg border px-3 py-1.5 text-sm font-extrabold ${directionTone[signal.direction]}`}>{signal.direction}</span></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><DataPoint label="Reference" value={signal.entry} /><DataPoint label="Stop" value={signal.stopLoss} /><DataPoint label="TP1" value={signal.takeProfit1} /><DataPoint label="Confidence" value={`${signal.confidence}%`} /></div><p className="mt-4 text-xs leading-5 text-slate-300">{signal.reasons.length ? signal.reasons.join(" ") : signal.warnings.join(" ")}</p><div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground"><span className="rounded-md bg-white/5 px-2 py-1">RSI {signal.indicators.rsi}</span><span className="rounded-md bg-white/5 px-2 py-1">MACD {signal.indicators.macdLine} / {signal.indicators.macdSignal}</span><span className="rounded-md bg-white/5 px-2 py-1">Bollinger %B {signal.indicators.bollingerPercentB}</span></div></div>; }
function DataPoint({ label, value }: { label: string; value: number | string | null }) { return <div className="rounded-xl bg-white/[0.035] px-3 py-2"><p className="eyebrow !text-[9px]">{label}</p><p className="font-mono-data mt-1 text-sm text-slate-100">{value ?? "—"}</p></div>; }
