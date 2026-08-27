import type { Request, Response } from "express";
import { timingSafeEqual } from "crypto";
import { ENV } from "./_core/env";
import { getSettings, markSignalDelivery } from "./db";
import { MarketDataError } from "./market-data";
import { analyzeAndPersist, signalToTelegramText } from "./signal-service";
import { sendTelegramSignal } from "./telegram";

const timeframes = new Set(["1min", "5min", "15min", "30min", "1h", "2h", "4h", "1day"]);
type TelegramMessage = { chat?: { id?: number | string }; text?: string };
type TelegramUpdate = { message?: TelegramMessage };

function constantTimeEqual(value: string, expected: string) {
  const a = Buffer.from(value); const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isTelegramWebhookAuthorized(header: string | undefined) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  return Boolean(expected && header && constantTimeEqual(header, expected));
}

function commandHelp() {
  return ["SNRV Alchemist commands", "/status — service and scan posture", "/watchlist — current universe", "/scan SYMBOL TIMEFRAME — run a closed-candle signal analysis", "Example: /scan XAUUSD 15min", "Signal-only: no order execution."].join("\n");
}

function settingInput(settings: Awaited<ReturnType<typeof getSettings>>) {
  return { snrvEnabled: settings.snrvEnabled, smcEnabled: settings.smcEnabled, snrvSwingLength: settings.snrvSwingLength, snrvSensitivity: settings.snrvSensitivity, minSignalScore: settings.minSignalScore, atrStopMultiplier: settings.atrStopMultiplier, rewardRiskRatio: settings.rewardRiskRatio, maxAtrPct: settings.maxAtrPct };
}

async function processCommand(text: string) {
  const [command, rawSymbol, rawTimeframe] = text.trim().split(/\s+/);
  const settings = await getSettings(ENV.ownerOpenId);
  if (["/start", "/help"].includes(command.toLowerCase())) return commandHelp();
  if (command.toLowerCase() === "/status") return [`SNRV Alchemist status`, `Market data: ${process.env.TWELVE_DATA_API_KEY ? "configured" : "missing"}`, `Scheduled scans: ${settings.scanEnabled ? "enabled" : "off"}`, `Last scan: ${settings.lastScanStatus}${settings.lastError ? ` — ${settings.lastError}` : ""}`, "Signal-only: no order execution."].join("\n");
  if (command.toLowerCase() === "/watchlist") return [`Watchlist (${settings.defaultTimeframe})`, settings.watchlist.join(", "), "Use /scan SYMBOL TIMEFRAME for a manual closed-candle analysis."].join("\n");
  if (command.toLowerCase() === "/scan") {
    if (!rawSymbol || !rawTimeframe || !timeframes.has(rawTimeframe)) return "Usage: /scan SYMBOL TIMEFRAME\nExample: /scan XAUUSD 15min\nTimeframes: 1min, 5min, 15min, 30min, 1h, 2h, 4h, 1day.";
    const result = await analyzeAndPersist({ ownerOpenId: ENV.ownerOpenId, symbol: rawSymbol, timeframe: rawTimeframe, source: "manual", settings: settingInput(settings) });
    await markSignalDelivery(result.stored.id, "queued", null);
    return signalToTelegramText(result.signal);
  }
  return commandHelp();
}

export async function handleTelegramWebhook(req: Request, res: Response) {
  if (!isTelegramWebhookAuthorized(req.header("x-telegram-bot-api-secret-token"))) return res.status(401).json({ error: "unauthorized" });
  const update = req.body as TelegramUpdate;
  const message = update?.message;
  if (!message?.text || String(message.chat?.id ?? "") !== String(process.env.TELEGRAM_ADMIN_CHAT_ID ?? "")) return res.status(200).json({ ok: true });
  try {
    const currentSettings = await getSettings(ENV.ownerOpenId);
    if (!currentSettings.telegramCommandsEnabled) return res.status(200).json({ ok: true, disabled: true });
    const reply = await processCommand(message.text);
    const delivered = await sendTelegramSignal(reply);
    return res.status(200).json({ ok: delivered.delivered });
  } catch (error) {
    const messageText = error instanceof MarketDataError ? error.message : "Unable to complete that SNRV Alchemist request right now. Please try again.";
    await sendTelegramSignal(`SNRV Alchemist\n${messageText}\nSignal-only: no order execution.`);
    return res.status(200).json({ ok: false });
  }
}
