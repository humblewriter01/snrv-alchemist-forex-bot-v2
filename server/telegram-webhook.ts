import { timingSafeEqual } from "crypto";
import type { Request as ExpressRequest, Response as ExpressResponse } from "express";
import { ENV } from "./_core/env";
import { dashboardStats, getSettings, listSignals, markSignalDelivery } from "./db";
import { MarketDataError, normalizeSymbol } from "./market-data";
import { analyzeAndPersist, signalToTelegramText } from "./signal-service";
import { answerTelegramCallback, sendTelegramSignal } from "./telegram";

export const TELEGRAM_TIMEFRAMES = new Set(["1min", "5min", "15min", "30min", "1h", "2h", "4h", "1day"]);
const seenUpdateIds = new Map<number, number>();
const MAX_SEEN_UPDATES = 512;
const NO_EXECUTION = "Signal-only intelligence. No orders are placed.";

type TelegramChat = { id?: number | string };
type TelegramMessage = { chat?: TelegramChat; text?: string };
type TelegramCallbackQuery = { id?: string; data?: string; message?: { chat?: TelegramChat } };
type TelegramUpdate = { update_id?: number; message?: TelegramMessage; callback_query?: TelegramCallbackQuery };

type TelegramReply = { text: string; replyMarkup?: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } };

function constantTimeEqual(value: string, expected: string) {
  const a = Buffer.from(value); const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isTelegramWebhookAuthorized(header: string | undefined) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  return Boolean(expected && header && constantTimeEqual(header, expected));
}

function menu() {
  return {
    inline_keyboard: [
      [{ text: "Analyze a pair", callback_data: "menu:analyze" }, { text: "Scan watchlist", callback_data: "menu:scan" }],
      [{ text: "Latest signal", callback_data: "menu:signal" }, { text: "History", callback_data: "menu:history" }],
      [{ text: "Status", callback_data: "menu:status" }, { text: "Watchlist", callback_data: "menu:watchlist" }],
      [{ text: "Risk reference", callback_data: "menu:risk" }, { text: "Settings", callback_data: "menu:settings" }],
    ],
  };
}

function commandHelp(): TelegramReply {
  return {
    text: [
      "SNRV ALCHEMIST — SIGNAL INTELLIGENCE",
      "",
      "/start — open the control menu",
      "/status — service, data, and webhook posture",
      "/watchlist — configured market universe",
      "/assets — supported aliases and plan notes",
      "/scan SYMBOL TIMEFRAME — closed-candle analysis",
      "/scanall — bounded watchlist scan",

      "/analyze SYMBOL TIMEFRAME — alias for /scan",
      "/signal — latest stored signal",
      "/last — latest stored signal alias",
      "/history — recent signal history", 
      "/performance — signal counts, not realized P&L",
      "/risk — analytical reference-level explanation",
      "/settings — safe strategy settings summary",
      "/cancel — clear a pending menu action",
      "",
      "Example: /scan XAUUSD 15min",
      "Signal-only intelligence. No orders are placed.",
    ].join("\n"),
    replyMarkup: menu(),
  };
}

function settingsInput(settings: Awaited<ReturnType<typeof getSettings>>) {
  return { snrvEnabled: settings.snrvEnabled, smcEnabled: settings.smcEnabled, snrvSwingLength: settings.snrvSwingLength, snrvSensitivity: settings.snrvSensitivity, minSignalScore: settings.minSignalScore, atrStopMultiplier: settings.atrStopMultiplier, rewardRiskRatio: settings.rewardRiskRatio, maxAtrPct: settings.maxAtrPct };
}

function assetsText() {
  return [
    "SUPPORTED ASSET ALIASES",
    "Forex: EURUSD, GBPUSD, USDJPY, USDCHF, AUDUSD, USDCAD, NZDUSD",
    "Crypto: BTCUSD, ETHUSD",
    "Metals: XAUUSD / GOLD -> XAU/USD; XAGU / XAGUSD / SILVER -> XAG/USD",
    "Use the canonical slash form or a listed alias. Provider plan access still applies.",
    NO_EXECUTION,
  ].join("\n");
}

function settingsText(settings: Awaited<ReturnType<typeof getSettings>>) {
  return [
    "SNRV ALCHEMIST SETTINGS",
    `Watchlist: ${settings.watchlist.join(", ")}`,
    `Default timeframe: ${settings.defaultTimeframe}`,
    `SNRV: ${settings.snrvEnabled ? "on" : "off"} | SMC: ${settings.smcEnabled ? "on" : "off"}`,
    `Sensitivity: ${settings.snrvSensitivity} | Minimum score: ${settings.minSignalScore}`,
    `ATR stop reference: ${settings.atrStopMultiplier}x | R:R reference: ${settings.rewardRiskRatio}x`,
    "These are analytical settings only; no orders are placed.", NO_EXECUTION,
  ].join("\n");
}

function signalHistoryText(rows: Awaited<ReturnType<typeof listSignals>>) {
  if (!rows.length) return `No stored signals yet. Run /scan SYMBOL TIMEFRAME to create one.\n${NO_EXECUTION}`;
  return ["RECENT SIGNAL HISTORY", ...rows.slice(0, 8).map(row => `${row.symbol} ${row.timeframe} — ${row.direction} | score ${row.signalScore ?? "n/a"} | ${new Date(row.createdAt).toISOString()}`), "",     "History contains analytical signals, not executed trades.", NO_EXECUTION].join("\n");
}

function performanceText(stats: Awaited<ReturnType<typeof dashboardStats>>) {
  return ["SIGNAL PERFORMANCE SUMMARY", `Total stored signals: ${stats.total}`, `Last 24 hours: ${stats.today}`, `Qualified BUY/SELL references: ${stats.qualified}`, "No realized P&L, win rate, or profitability is inferred from these counts.", NO_EXECUTION].join("\n");
}

function riskText() {
  return ["RISK REFERENCE", "Entry, stop-loss, and target values are analytical levels derived from the configured ATR and reward/risk settings.", "They are not instructions, financial advice, or orders. Position sizing, broker routing, and execution are intentionally not supported.", "WAIT results do not issue Entry, SL, TP1, or TP2 levels.", NO_EXECUTION].join("\n");
}

async function processCommand(text: string): Promise<TelegramReply> {
  const parts = text.trim().split(/\s+/);
  const command = (parts[0] ?? "").toLowerCase().split("@")[0];
  const settings = await getSettings(ENV.ownerOpenId);
  if (["/start", "/help"].includes(command)) return commandHelp();
  if (command === "/cancel") return { text: `Pending Telegram action cleared. Use /start to open the menu.\n${NO_EXECUTION}`, replyMarkup: menu() };
  if (command === "/status") return { text: ["SNRV ALCHEMIST STATUS", `Market data: ${process.env.TWELVE_DATA_API_KEY ? "configured" : "missing"}`, `Telegram commands: ${settings.telegramCommandsEnabled ? "enabled" : "disabled"}`, `Scheduled scans: ${settings.scanEnabled ? "enabled" : "off"}`, `Last scan: ${settings.lastScanStatus}${settings.lastError ? ` — ${settings.lastError}` : ""}`, "Signal-only: no orders are placed."].join("\n"), replyMarkup: menu() };
  if (command === "/watchlist") return { text: [`WATCHLIST · ${settings.defaultTimeframe}`, ...settings.watchlist.map((symbol, index) => `${index + 1}. ${symbol}`), "", "Use /scan SYMBOL TIMEFRAME for a manual closed-candle analysis.", NO_EXECUTION].join("\n"), replyMarkup: menu() };
  if (command === "/assets") return { text: assetsText(), replyMarkup: menu() };
  if (command === "/settings") return { text: settingsText(settings), replyMarkup: menu() };
  if (command === "/risk") return { text: riskText(), replyMarkup: menu() };
  if (command === "/performance") return { text: performanceText(await dashboardStats(ENV.ownerOpenId)), replyMarkup: menu() };
  if (command === "/history") return { text: signalHistoryText(await listSignals(ENV.ownerOpenId, { limit: 8 })), replyMarkup: menu() };
  if (command === "/signal" || (command === "/get" && parts[1]?.toLowerCase() === "signal")) {
    const latest = await listSignals(ENV.ownerOpenId, { limit: 1 });
    return { text: latest.length ? signalHistoryText(latest) : `No stored signal is available yet. Use /scan SYMBOL TIMEFRAME.\n${NO_EXECUTION}`, replyMarkup: menu() };
  }
  if (command === "/scanall") {
    const symbols = settings.watchlist.slice(0, 8);
    const results: string[] = ["WATCHLIST SCAN", `Timeframe: ${settings.defaultTimeframe}`, `Symbols checked: ${symbols.length}`, ""];
    for (const symbol of symbols) {
      try {
        const result = await analyzeAndPersist({ ownerOpenId: ENV.ownerOpenId, symbol, timeframe: settings.defaultTimeframe, source: "manual", settings: settingsInput(settings) });
        await markSignalDelivery(result.stored.id, "queued", null);
        results.push(`${result.signal.symbol} — ${result.signal.direction} | score ${result.signal.score}`);
      } catch (error) {
        results.push(`${symbol} — ${error instanceof MarketDataError ? error.message : "analysis unavailable"}`);
      }
    }
    results.push("", "Use /scan SYMBOL TIMEFRAME for full Entry/SL/TP1/TP2 detail on one asset.", NO_EXECUTION);
    return { text: results.join("\n"), replyMarkup: menu() };
  }
  if (command === "/last") {
    const latest = await listSignals(ENV.ownerOpenId, { limit: 1 });
    return { text: latest.length ? signalHistoryText(latest) : `No stored signal is available yet. Use /scan SYMBOL TIMEFRAME.\n${NO_EXECUTION}`, replyMarkup: menu() };
  }
  if (command === "/scan" || command === "/analyze") {
    const rawSymbol = parts[1]; const rawTimeframe = parts[2];
    if (!rawSymbol || !rawTimeframe || !TELEGRAM_TIMEFRAMES.has(rawTimeframe)) return { text: `Usage: /scan SYMBOL TIMEFRAME\nExample: /scan XAUUSD 15min\nTimeframes: 1min, 5min, 15min, 30min, 1h, 2h, 4h, 1day.\n${NO_EXECUTION}`, replyMarkup: menu() };
    normalizeSymbol(rawSymbol);
    const result = await analyzeAndPersist({ ownerOpenId: ENV.ownerOpenId, symbol: rawSymbol, timeframe: rawTimeframe, source: "manual", settings: settingsInput(settings) });
    await markSignalDelivery(result.stored.id, "queued", null);
    return { text: signalToTelegramText(result.signal), replyMarkup: menu() };
  }
  return commandHelp();
}

function callbackCommand(data: string | undefined): string | null {
  const mapping: Record<string, string> = { "menu:analyze": `Use /scan SYMBOL TIMEFRAME to analyze one pair.\n${NO_EXECUTION}`, "menu:scan": `Use /scan SYMBOL TIMEFRAME to run a closed-candle scan.\n${NO_EXECUTION}`, "menu:signal": "/signal", "menu:history": "/history", "menu:status": "/status", "menu:watchlist": "/watchlist", "menu:risk": "/risk", "menu:settings": "/settings" };
  return data && mapping[data] ? mapping[data] : null;
}

function updateChatId(update: TelegramUpdate) {
  return update.message?.chat?.id ?? update.callback_query?.message?.chat?.id;
}

function isAdminChat(chatId: number | string | undefined) {
  return chatId !== undefined && String(chatId) === String(process.env.TELEGRAM_ADMIN_CHAT_ID ?? "");
}

function isDuplicate(updateId: number | undefined) {
  if (updateId === undefined) return false;
  const now = Date.now();
  seenUpdateIds.forEach((timestamp, id) => { if (now - timestamp > 10 * 60_000) seenUpdateIds.delete(id); });
  if (seenUpdateIds.has(updateId)) return true;
  seenUpdateIds.set(updateId, now);
  while (seenUpdateIds.size > MAX_SEEN_UPDATES) seenUpdateIds.delete(seenUpdateIds.keys().next().value as number);
  return false;
}

export async function handleTelegramWebhook(req: ExpressRequest, res: ExpressResponse) {
  if (!isTelegramWebhookAuthorized(req.header("x-telegram-bot-api-secret-token"))) return res.status(401).json({ error: "unauthorized" });
  const update = req.body as TelegramUpdate;
  if (isDuplicate(update?.update_id)) return res.status(200).json({ ok: true, duplicate: true });
  const chatId = updateChatId(update);
  if (!isAdminChat(chatId)) return res.status(200).json({ ok: true });
  try {
    const currentSettings = await getSettings(ENV.ownerOpenId);
    if (!currentSettings.telegramCommandsEnabled) return res.status(200).json({ ok: true, disabled: true });
    const callbackText = callbackCommand(update.callback_query?.data);
    if (update.callback_query?.id) await answerTelegramCallback(update.callback_query.id);
    const reply = callbackText?.startsWith("/") ? await processCommand(callbackText) : callbackText ? { text: callbackText, replyMarkup: menu() } : await processCommand(update.message?.text ?? "/help");
    const delivered = await sendTelegramSignal(reply.text, { chatId, replyMarkup: reply.replyMarkup });
    return res.status(200).json({ ok: delivered.delivered });
  } catch (error) {
    const messageText = error instanceof MarketDataError ? error.message : "Unable to complete that SNRV Alchemist request right now. Please try again.";
    await sendTelegramSignal(`SNRV Alchemist\n${messageText}\nSignal-only: no orders are placed.`, { chatId, replyMarkup: menu() });
    return res.status(200).json({ ok: false });
  }
}
