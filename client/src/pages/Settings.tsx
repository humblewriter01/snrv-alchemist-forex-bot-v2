import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { BellRing, Bot, CircleSlash2, Clock3, Cog, DatabaseZap, Loader2, ShieldCheck, SlidersHorizontal } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type Draft = { watchlistText: string; defaultTimeframe: string; snrvEnabled: boolean; smcEnabled: boolean; snrvSwingLength: number; snrvSensitivity: "Low" | "Medium" | "High"; minSignalScore: number; atrStopMultiplier: number; rewardRiskRatio: number; maxAtrPct: number; telegramEnabled: boolean; openRouterEnabled: boolean; scanEnabled: boolean; scanCron: string };
const empty: Draft = { watchlistText: "", defaultTimeframe: "1h", snrvEnabled: true, smcEnabled: true, snrvSwingLength: 20, snrvSensitivity: "Medium", minSignalScore: 3, atrStopMultiplier: 1.5, rewardRiskRatio: 1.8, maxAtrPct: 0.05, telegramEnabled: false, openRouterEnabled: false, scanEnabled: false, scanCron: "0 */15 * * * *" };
const intervalOptions = ["5min", "15min", "30min", "1h", "2h", "4h", "1day"];
const fieldClass = () => "h-10 w-full rounded-xl border border-border bg-[#151f2e] px-3 text-sm text-white outline-none transition focus:border-[#e3c770]";

export default function Settings() {
  const utils = trpc.useUtils();
  const query = trpc.signal.settings.useQuery();
  const [draft, setDraft] = useState<Draft>(empty);
  const [telegramError, setTelegramError] = useState<string | null>(null);
  const initializedSettings = useRef(false);
  useEffect(() => {
    const data = query.data;
    if (data && !initializedSettings.current) {
      initializedSettings.current = true;
      setDraft({ watchlistText: data.watchlist.join(", "), defaultTimeframe: data.defaultTimeframe, snrvEnabled: data.snrvEnabled, smcEnabled: data.smcEnabled, snrvSwingLength: data.snrvSwingLength, snrvSensitivity: data.snrvSensitivity, minSignalScore: data.minSignalScore, atrStopMultiplier: data.atrStopMultiplier, rewardRiskRatio: data.rewardRiskRatio, maxAtrPct: data.maxAtrPct, telegramEnabled: data.telegramEnabled, openRouterEnabled: data.openRouterEnabled, scanEnabled: data.scanEnabled, scanCron: data.scanCron });
    }
  }, [query.data]);
  const update = trpc.signal.updateSettings.useMutation({ onSuccess: () => { utils.signal.settings.invalidate(); utils.signal.overview.invalidate(); toast.success("Control room settings saved."); }, onError: error => toast.error(error.message) });
  const schedule = trpc.signal.configureScanSchedule.useMutation({ onSuccess: () => { utils.signal.settings.invalidate(); utils.signal.overview.invalidate(); toast.success("Scheduled scan configuration saved."); }, onError: error => toast.error(error.message) });
  const telegramCommands = trpc.signal.configureTelegramCommands.useMutation({ onSuccess: () => { setTelegramError(null); utils.signal.settings.invalidate(); utils.signal.overview.invalidate(); toast.success("Telegram commands are connected."); }, onError: error => { setTelegramError(error.message); toast.error(error.message); } });
  const patch = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft(current => ({ ...current, [key]: value }));
  const save = () => {
    const watchlist = Array.from(new Set(draft.watchlistText.split(/[\n,]/).map(item => item.trim().toUpperCase()).filter(Boolean)));
    if (!watchlist.length) return toast.error("Add at least one watchlist symbol.");
    update.mutate({ watchlist, defaultTimeframe: draft.defaultTimeframe as "5min" | "15min" | "30min" | "1h" | "2h" | "4h" | "1day", snrvEnabled: draft.snrvEnabled, smcEnabled: draft.smcEnabled, snrvSwingLength: draft.snrvSwingLength, snrvSensitivity: draft.snrvSensitivity, minSignalScore: draft.minSignalScore, atrStopMultiplier: draft.atrStopMultiplier, rewardRiskRatio: draft.rewardRiskRatio, maxAtrPct: draft.maxAtrPct, telegramEnabled: draft.telegramEnabled, openRouterEnabled: draft.openRouterEnabled });
  };
  const configureSchedule = () => schedule.mutate({ enabled: draft.scanEnabled, cron: draft.scanCron });
  if (query.isLoading) return <DashboardLayout><Skeleton className="mx-auto h-[640px] max-w-[1540px] rounded-3xl bg-card" /></DashboardLayout>;
  if (query.error) return <DashboardLayout><div className="mx-auto max-w-xl rounded-2xl border border-rose-300/25 bg-rose-300/10 p-6 text-rose-100"><p className="font-bold">Owner access required</p><p className="mt-2 text-sm">{query.error.message}</p></div></DashboardLayout>;
  const commandsConnected = Boolean(query.data?.telegramCommandsEnabled);

  return <DashboardLayout><div className="mx-auto max-w-[1540px] space-y-6">
    <section className="flex flex-col justify-between gap-5 rounded-3xl border border-border bg-[#172335]/85 px-5 py-6 sm:px-8 sm:py-7 lg:flex-row lg:items-end">
      <div><div className="mb-3 flex items-center gap-2 text-[#eed27a]"><Cog className="h-4 w-4" /><span className="eyebrow !text-[#eed27a]">Owner control room</span></div><h1 className="text-3xl font-extrabold tracking-tight text-white">Tune the <span className="text-[#efd27a]">model</span></h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">All controls change signal-intelligence behavior only. There is no broker connection, order route, or execution setting.</p></div>
      <div className="flex items-center gap-3 rounded-2xl border border-[#e8cd7b]/25 bg-[#101a29]/80 px-4 py-3 text-sm text-slate-200"><CircleSlash2 className="h-5 w-5 text-[#efcf71]" /><div><p className="font-bold text-white">No-execution boundary</p><p className="text-xs text-slate-400">Fixed and not configurable.</p></div></div>
    </section>
    <section className="grid gap-6 xl:grid-cols-[1.06fr_.94fr]">
      <div className="space-y-6">
        <Panel icon={DatabaseZap} title="Market universe" detail="Use provider-supported symbols. Aliases such as GOLD, XAUUSD and XAGU are normalized at analysis time.">
          <label className="space-y-1.5"><span className="eyebrow">Watchlist</span><textarea value={draft.watchlistText} onChange={event => patch("watchlistText", event.target.value)} rows={4} className="w-full rounded-xl border border-border bg-[#151f2e] px-3 py-3 text-sm text-white outline-none focus:border-[#e3c770]" placeholder="XAU/USD, BTC/USD, EUR/USD" /></label>
          <div className="mt-3 grid grid-cols-2 gap-3"><label className="space-y-1.5"><span className="eyebrow">Default timeframe</span><select value={draft.defaultTimeframe} onChange={event => patch("defaultTimeframe", event.target.value)} className={fieldClass()}>{intervalOptions.map(value => <option key={value}>{value}</option>)}</select></label><label className="space-y-1.5"><span className="eyebrow">Minimum score</span><input type="number" min="1" max="10" value={draft.minSignalScore} onChange={event => patch("minSignalScore", Number(event.target.value))} className={fieldClass()} /></label></div>
        </Panel>
        <Panel icon={SlidersHorizontal} title="SNRV / SMC structure" detail="Closed-candle phase, zone, break, sweep and imbalance confirmation.">
          <div className="space-y-3"><Toggle label="Enable SNRV / Alchemist" detail="Zones, Void behavior and phase context" checked={draft.snrvEnabled} onChange={value => patch("snrvEnabled", value)} /><Toggle label="Require SMC confluence" detail="BOS-style breaks, FVGs, sweeps and order blocks" checked={draft.smcEnabled} onChange={value => patch("smcEnabled", value)} /></div>
          <div className="mt-4 grid grid-cols-2 gap-3"><label className="space-y-1.5"><span className="eyebrow">Swing length</span><input type="number" min="4" max="60" value={draft.snrvSwingLength} onChange={event => patch("snrvSwingLength", Number(event.target.value))} className={fieldClass()} /></label><label className="space-y-1.5"><span className="eyebrow">Zone sensitivity</span><select value={draft.snrvSensitivity} onChange={event => patch("snrvSensitivity", event.target.value as Draft["snrvSensitivity"])} className={fieldClass()}><option>Low</option><option>Medium</option><option>High</option></select></label></div>
        </Panel>
      </div>
      <div className="space-y-6">
        <Panel icon={Bot} title="Risk references" detail="These produce reference levels inside a signal. They never create, modify or submit a trade.">
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1"><label className="space-y-1.5"><span className="eyebrow">ATR stop multiplier</span><input type="number" step="0.1" min="0.5" max="5" value={draft.atrStopMultiplier} onChange={event => patch("atrStopMultiplier", Number(event.target.value))} className={fieldClass()} /></label><label className="space-y-1.5"><span className="eyebrow">Reward / risk</span><input type="number" step="0.1" min="0.5" max="5" value={draft.rewardRiskRatio} onChange={event => patch("rewardRiskRatio", Number(event.target.value))} className={fieldClass()} /></label><label className="space-y-1.5"><span className="eyebrow">Maximum ATR fraction</span><input type="number" step="0.005" min="0.001" max="0.5" value={draft.maxAtrPct} onChange={event => patch("maxAtrPct", Number(event.target.value))} className={fieldClass()} /></label></div>
        </Panel>
        <Panel icon={BellRing} title="Telegram" detail="Qualified scheduled signals and owner-only command replies are sent through your Telegram bot.">
          <Toggle label="Telegram notifications" detail="Send qualified BUY / SELL signals from scheduled scans" checked={draft.telegramEnabled} onChange={value => patch("telegramEnabled", value)} />
          <Toggle label="AI signal summaries" detail="Optional concise explanation; rules and levels remain deterministic" checked={draft.openRouterEnabled} onChange={value => patch("openRouterEnabled", value)} />
          {telegramError ? <div role="alert" className="mt-4 rounded-xl border border-amber-300/25 bg-amber-300/10 px-3 py-3 text-xs leading-5 text-amber-50"><p className="font-bold text-amber-100">Telegram connection needs attention</p><p className="mt-1">{telegramError}</p><p className="mt-2 text-amber-100/80">Confirm that the server-side <code>TELEGRAM_WEBHOOK_SECRET</code> uses only letters, numbers, <code>_</code>, or <code>-</code>, with no spaces or punctuation. Telegram commands require the published HTTPS site; keep all credentials in project secrets, never in chat.</p></div> : null}
          <div className="mt-4 rounded-xl border border-border bg-[#151f2e] p-3"><p className="text-sm font-semibold text-white">Bot commands: {commandsConnected ? <span className="text-emerald-300">connected</span> : <span className="text-amber-200">not connected</span>}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Connect once, then use <strong>/status</strong>, <strong>/watchlist</strong>, or <strong>/scan XAUUSD 15min</strong> in your administrator chat.</p><Button type="button" disabled={telegramCommands.isPending || commandsConnected} onClick={() => telegramCommands.mutate()} variant="outline" className="mt-3 w-full border-[#e1c56e]/35 bg-[#e1c56e]/10 text-[#f2d982] hover:bg-[#e1c56e]/15 hover:text-white">{telegramCommands.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}{commandsConnected ? "Telegram commands connected" : "Connect Telegram commands"}</Button></div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">Provider keys, chat identifiers, and webhook secrets are not shown here, never returned by this dashboard, and never stored in signal history.</p>
        </Panel>
        <Panel icon={Clock3} title="Recurring scans" detail="Managed HTTP scheduling runs only after the site is published. Use a six-field UTC cron expression.">
          <Toggle label="Enable managed scans" detail="Sequentially checks your watchlist and stops on a provider rate-limit response" checked={draft.scanEnabled} onChange={value => patch("scanEnabled", value)} />
          <label className="mt-4 block space-y-1.5"><span className="eyebrow">UTC cron</span><input value={draft.scanCron} onChange={event => patch("scanCron", event.target.value)} className={fieldClass()} placeholder="0 */15 * * * *" /></label><Button disabled={schedule.isPending} onClick={configureSchedule} variant="outline" className="mt-4 w-full border-[#e1c56e]/35 bg-[#e1c56e]/10 text-[#f2d982] hover:bg-[#e1c56e]/15 hover:text-white">{schedule.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock3 className="h-4 w-4" />}Save schedule after publishing</Button><p className="mt-3 text-xs leading-5 text-amber-100/80"><ShieldCheck className="mr-1 inline h-3.5 w-3.5" />Do not enable until the managed HTTPS site is published; the public scheduled callback cannot reach a development preview.</p>
        </Panel>
      </div>
    </section>
    <div className="flex justify-end border-t border-border/70 pt-5"><Button disabled={update.isPending} onClick={save} className="h-12 rounded-xl bg-[#e4c76e] px-6 font-bold text-[#172033] shadow-lg shadow-black/30 hover:bg-[#f4da89]">{update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}Save control room</Button></div>
  </div></DashboardLayout>;
}

function Panel({ icon: Icon, title, detail, children }: { icon: typeof Cog; title: string; detail: string; children: React.ReactNode }) { return <section className="glass-panel p-5 sm:p-6"><div className="flex gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e4c76e]/10 text-[#e4c76e]"><Icon className="h-4 w-4" /></div><div><h2 className="text-base font-bold text-white">{title}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p></div></div><div className="mt-5">{children}</div></section>; }
function Toggle({ label, detail, checked, onChange }: { label: string; detail: string; checked: boolean; onChange: (value: boolean) => void }) { return <div className="flex items-center justify-between gap-4 rounded-xl bg-white/[0.035] px-3 py-3"><div><p className="text-sm font-semibold text-slate-100">{label}</p><p className="mt-0.5 text-xs text-muted-foreground">{detail}</p></div><Switch checked={checked} onCheckedChange={onChange} /></div>; }
