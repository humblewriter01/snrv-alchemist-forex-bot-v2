import { TRPCError } from "@trpc/server";
import { parse as parseCookie } from "cookie";
import { z } from "zod";
import { dashboardStats, getSettings, listSignals, saveScheduleTaskUid, setTelegramCommandsEnabled, telegramSettingsOwnerOpenId, updateSettings, type DashboardSettings } from "../db";
import { MarketDataError } from "../market-data";
import { analyzeAndPersist } from "../signal-service";
import { createHeartbeatJob, deleteHeartbeatJob, updateHeartbeatJob } from "../_core/heartbeat";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { configureTelegramCommandWebhook, getTelegramHealth } from "../telegram";

const timeframes = ["1min", "5min", "15min", "30min", "1h", "2h", "4h", "1day"] as const;
const directions = ["BUY", "SELL", "WAIT", "ALERT"] as const;

function analysisSettings(settings: DashboardSettings) {
  return {
    snrvEnabled: settings.snrvEnabled,
    smcEnabled: settings.smcEnabled,
    snrvSwingLength: settings.snrvSwingLength,
    snrvSensitivity: settings.snrvSensitivity,
    minSignalScore: settings.minSignalScore,
    atrStopMultiplier: settings.atrStopMultiplier,
    rewardRiskRatio: settings.rewardRiskRatio,
    maxAtrPct: settings.maxAtrPct,
  };
}

function json(value: string) {
  try { return JSON.parse(value) as unknown; } catch { return null; }
}

function presentSignal(record: Awaited<ReturnType<typeof listSignals>>[number]) {
  return { ...record, entry: record.entry === null ? null : Number(record.entry), stopLoss: record.stopLoss === null ? null : Number(record.stopLoss), takeProfit1: record.takeProfit1 === null ? null : Number(record.takeProfit1), takeProfit2: record.takeProfit2 === null ? null : Number(record.takeProfit2), riskReward: record.riskReward === null ? null : Number(record.riskReward), confluence: json(record.confluenceJson), indicators: json(record.indicatorsJson) };
}

const settingsInput = z.object({
  watchlist: z.array(z.string().trim().min(3).max(32)).min(1).max(25).optional(),
  defaultTimeframe: z.enum(timeframes).optional(),
  snrvEnabled: z.boolean().optional(),
  smcEnabled: z.boolean().optional(),
  snrvSwingLength: z.number().int().min(4).max(60).optional(),
  snrvSensitivity: z.enum(["Low", "Medium", "High"]).optional(),
  minSignalScore: z.number().int().min(1).max(10).optional(),
  atrStopMultiplier: z.number().min(0.5).max(5).optional(),
  rewardRiskRatio: z.number().min(0.5).max(5).optional(),
  maxAtrPct: z.number().min(0.001).max(0.5).optional(),
  telegramEnabled: z.boolean().optional(),
  openRouterEnabled: z.boolean().optional(),
  scanEnabled: z.boolean().optional(),
  scanCron: z.string().regex(/^\S+(\s+\S+){5}$/, "Use a six-field UTC cron expression.").optional(),
});

function sessionToken(cookieHeader: string | undefined) {
  return parseCookie(cookieHeader ?? "").app_session_id ?? "";
}

export function telegramActivationOwnerKeys(authenticatedOwner: string, webhookOwner: string) {
  return Array.from(new Set([authenticatedOwner, webhookOwner].map(value => String(value ?? "").trim()).filter(Boolean)));
}

function requestOrigin(req: { protocol: string; headers: Record<string, string | string[] | undefined> }) {
  const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "").split(",")[0].trim();
  if (!host) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The public site address is unavailable. Please try again from the published dashboard." });
  const proto = process.env.NODE_ENV === "production" ? "https" : String(req.headers["x-forwarded-proto"] ?? req.protocol).split(",")[0].trim();
  return `${proto}://${host}`;
}

export const signalRouter = router({
  overview: protectedProcedure.query(async ({ ctx }) => {
    const [settings, stats, recent, telegramHealth] = await Promise.all([getSettings(ctx.user.openId), dashboardStats(ctx.user.openId), listSignals(ctx.user.openId, { limit: 6 }), getTelegramHealth()]);
    return {
      settings,
      stats,
      recent: recent.map(presentSignal),
      service: {
        executionEnabled: false,
        signalOnly: true,
        marketDataConfigured: Boolean(process.env.TWELVE_DATA_API_KEY),
        telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ADMIN_CHAT_ID),
        telegramCommandsEnabled: settings.telegramCommandsEnabled,
        telegramBot: telegramHealth.bot,
        telegramWebhook: telegramHealth.webhook,
        optionalAiConfigured: Boolean(process.env.OPENROUTER_API_KEY),
        scanStatus: settings.lastScanStatus,
        lastScanAt: settings.lastScanAt,
        lastError: settings.lastError,
      },
      canManage: ctx.user.role === "admin",
    };
  }),
  history: protectedProcedure.input(z.object({ symbol: z.string().max(32).optional(), direction: z.enum(directions).optional(), limit: z.number().int().min(1).max(200).optional() })).query(async ({ ctx, input }) => {
    const records = await listSignals(ctx.user.openId, input);
    return records.map(presentSignal);
  }),
  settings: adminProcedure.query(({ ctx }) => getSettings(ctx.user.openId)),
  updateSettings: adminProcedure.input(settingsInput).mutation(({ ctx, input }) => updateSettings(ctx.user.openId, input)),
  configureTelegramCommands: adminProcedure.mutation(async ({ ctx }) => {
    if (process.env.NODE_ENV !== "production") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Publish the site before activating Telegram bot commands." });
    const webhookUrl = `${requestOrigin(ctx.req)}/api/telegram/updates`;
    try {
      const result = await configureTelegramCommandWebhook(webhookUrl);
      const ownerKeys = telegramActivationOwnerKeys(ctx.user.openId, telegramSettingsOwnerOpenId());
      const enabledSettings = await Promise.all(ownerKeys.map(ownerKey => setTelegramCommandsEnabled(ownerKey, true)));
      if (enabledSettings.length < 1 || enabledSettings.some(settings => !settings.telegramCommandsEnabled)) {
        throw new Error("Telegram activation did not persist the enabled state for the webhook settings row.");
      }
      return { ...result, telegramCommandsEnabled: true };
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Telegram command activation failed." });
    }
  }),
  configureScanSchedule: adminProcedure.input(z.object({ enabled: z.boolean(), cron: z.string().regex(/^\S+(\s+\S+){5}$/, "Use a six-field UTC cron expression.") })).mutation(async ({ ctx, input }) => {
    if (process.env.NODE_ENV !== "production") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Publish the site before creating a managed recurring scan." });
    const settings = await updateSettings(ctx.user.openId, { scanEnabled: input.enabled, scanCron: input.cron });
    const token = sessionToken(ctx.req.headers.cookie);
    if (!settings.scheduleCronTaskUid) {
      const job = await createHeartbeatJob({ name: `snrv-scan-${ctx.user.openId}`, cron: input.cron, path: "/api/scheduled/market-scan", payload: {}, description: "SNRV Alchemist signal-only watchlist scan" }, token);
      await saveScheduleTaskUid(ctx.user.openId, job.taskUid);
      if (!input.enabled) await updateHeartbeatJob(job.taskUid, { enable: false }, token);
      return { taskUid: job.taskUid, enabled: input.enabled, nextExecutionAt: job.nextExecutionAt ?? null };
    }
    const job = await updateHeartbeatJob(settings.scheduleCronTaskUid, { cron: input.cron, enable: input.enabled }, token);
    return { taskUid: settings.scheduleCronTaskUid, enabled: input.enabled, nextExecutionAt: job.nextExecutionAt ?? null };
  }),
  removeScanSchedule: adminProcedure.mutation(async ({ ctx }) => {
    const settings = await getSettings(ctx.user.openId);
    if (!settings.scheduleCronTaskUid) return { deleted: false };
    await deleteHeartbeatJob(settings.scheduleCronTaskUid, sessionToken(ctx.req.headers.cookie));
    await saveScheduleTaskUid(ctx.user.openId, null);
    return { deleted: true };
  }),
  analyze: adminProcedure.input(z.object({ symbol: z.string().trim().min(3).max(32), timeframe: z.enum(timeframes) })).mutation(async ({ ctx, input }) => {
    const settings = await getSettings(ctx.user.openId);
    try {
      const result = await analyzeAndPersist({ ownerOpenId: ctx.user.openId, symbol: input.symbol, timeframe: input.timeframe, source: "manual", settings: analysisSettings(settings) });
      return { signal: result.signal, stored: result.stored, chart: result.chart };
    } catch (error) {
      if (error instanceof MarketDataError) throw new TRPCError({ code: error.kind === "rate_limit" ? "TOO_MANY_REQUESTS" : "BAD_REQUEST", message: error.message });
      throw error;
    }
  }),
});
