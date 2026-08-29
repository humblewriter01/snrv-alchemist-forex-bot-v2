import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({ getSettings: vi.fn(), markSignalDelivery: vi.fn(), listSignals: vi.fn(), dashboardStats: vi.fn() }));
const telegramMocks = vi.hoisted(() => ({ sendTelegramSignal: vi.fn(), answerTelegramCallback: vi.fn() }));
const signalMocks = vi.hoisted(() => ({ analyzeAndPersist: vi.fn(), signalToTelegramText: vi.fn() }));
vi.mock("./db", () => dbMocks);
vi.mock("./telegram", () => telegramMocks);
vi.mock("./signal-service", () => signalMocks);

import { handleTelegramWebhook, isTelegramWebhookAuthorized } from "./telegram-webhook";

function response() { const value = { status: vi.fn(), json: vi.fn() }; value.status.mockReturnValue(value); return value; }

describe("Telegram webhook authentication", () => {
  beforeEach(() => vi.clearAllMocks());
  it("requires the configured server-only secret and rejects a mismatched header", () => {
    expect(process.env.TELEGRAM_WEBHOOK_SECRET).toBeTruthy();
    expect(isTelegramWebhookAuthorized(process.env.TELEGRAM_WEBHOOK_SECRET)).toBe(true);
    expect(isTelegramWebhookAuthorized("incorrect-secret")).toBe(false);
  });

  it("rejects an update without the Telegram secret header before it can process a command", async () => {
    const res = response();
    await handleTelegramWebhook({ header: () => undefined } as never, res as never);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "unauthorized" });
  });

  it("ignores an authorized-looking update from a non-admin chat", async () => {
    dbMocks.getSettings.mockResolvedValue({ telegramCommandsEnabled: true });
    const res = response();
    await handleTelegramWebhook({ header: () => process.env.TELEGRAM_WEBHOOK_SECRET, body: { update_id: 998, message: { chat: { id: "not-the-admin" }, text: "/status" } } } as never, res as never);
    expect(telegramMocks.sendTelegramSignal).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it("accepts commands only from the configured administrator chat and replies without an execution path", async () => {
    dbMocks.getSettings.mockResolvedValue({ telegramCommandsEnabled: true, scanEnabled: false, lastScanStatus: "idle", lastError: null, defaultTimeframe: "1h", watchlist: ["XAU/USD"], snrvEnabled: true, smcEnabled: true, snrvSwingLength: 20, snrvSensitivity: "Medium", minSignalScore: 3, atrStopMultiplier: 1.5, rewardRiskRatio: 1.8, maxAtrPct: 0.05 });
    telegramMocks.sendTelegramSignal.mockResolvedValue({ delivered: true });
    const res = response();
    await handleTelegramWebhook({ header: () => process.env.TELEGRAM_WEBHOOK_SECRET, body: { message: { chat: { id: process.env.TELEGRAM_ADMIN_CHAT_ID }, text: "/status" } } } as never, res as never);
    expect(telegramMocks.sendTelegramSignal).toHaveBeenCalledWith(expect.stringContaining("Signal-only: no orders are placed."), expect.objectContaining({ chatId: process.env.TELEGRAM_ADMIN_CHAT_ID }));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it("responds to an inline status callback with a safe menu", async () => {
    const settings = { telegramCommandsEnabled: true, scanEnabled: false, lastScanStatus: "idle", lastError: null, defaultTimeframe: "1h", watchlist: ["XAU/USD"], snrvEnabled: true, smcEnabled: true, snrvSwingLength: 20, snrvSensitivity: "Medium", minSignalScore: 3, atrStopMultiplier: 1.5, rewardRiskRatio: 1.8, maxAtrPct: 0.05 };
    dbMocks.getSettings.mockResolvedValue(settings);
    telegramMocks.answerTelegramCallback.mockResolvedValue(true);
    telegramMocks.sendTelegramSignal.mockResolvedValue({ delivered: true });
    const res = response();
    await handleTelegramWebhook({ header: () => process.env.TELEGRAM_WEBHOOK_SECRET, body: { update_id: 1001, callback_query: { id: "callback-1", data: "menu:status", message: { chat: { id: process.env.TELEGRAM_ADMIN_CHAT_ID } } } } } as never, res as never);
    expect(telegramMocks.answerTelegramCallback).toHaveBeenCalledWith("callback-1");
    expect(telegramMocks.sendTelegramSignal).toHaveBeenCalledWith(expect.stringContaining("SNRV ALCHEMIST STATUS"), expect.objectContaining({ replyMarkup: expect.any(Object) }));
  });

  it("handles every inline menu callback with a bounded signal-only reply", async () => {
    dbMocks.getSettings.mockResolvedValue({ telegramCommandsEnabled: true, scanEnabled: false, lastScanStatus: "idle", lastError: null, defaultTimeframe: "1h", watchlist: ["XAU/USD"], snrvEnabled: true, smcEnabled: true, snrvSwingLength: 20, snrvSensitivity: "Medium", minSignalScore: 3, atrStopMultiplier: 1.5, rewardRiskRatio: 1.8, maxAtrPct: 0.05 });
    dbMocks.listSignals.mockResolvedValue([]);
    dbMocks.dashboardStats.mockResolvedValue({ total: 0, today: 0, qualified: 0 });
    telegramMocks.answerTelegramCallback.mockResolvedValue(true);
    telegramMocks.sendTelegramSignal.mockResolvedValue({ delivered: true });
    const callbacks = ["menu:analyze", "menu:scan", "menu:signal", "menu:history", "menu:status", "menu:watchlist", "menu:risk", "menu:settings"];
    for (const [index, data] of callbacks.entries()) {
      const res = response();
      await handleTelegramWebhook({ header: () => process.env.TELEGRAM_WEBHOOK_SECRET, body: { update_id: 2000 + index, callback_query: { id: `callback-${index}`, data, message: { chat: { id: process.env.TELEGRAM_ADMIN_CHAT_ID } } } } } as never, res as never);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(telegramMocks.sendTelegramSignal).toHaveBeenLastCalledWith(expect.stringContaining("Signal-only"), expect.objectContaining({ replyMarkup: expect.any(Object) }));
    }
    expect(telegramMocks.answerTelegramCallback).toHaveBeenCalledTimes(callbacks.length);
  });

  it("does not process a duplicate update twice", async () => {
    const settings = { telegramCommandsEnabled: true, scanEnabled: false, lastScanStatus: "idle", lastError: null, defaultTimeframe: "1h", watchlist: ["XAU/USD"], snrvEnabled: true, smcEnabled: true, snrvSwingLength: 20, snrvSensitivity: "Medium", minSignalScore: 3, atrStopMultiplier: 1.5, rewardRiskRatio: 1.8, maxAtrPct: 0.05 };
    dbMocks.getSettings.mockResolvedValue(settings);
    telegramMocks.sendTelegramSignal.mockResolvedValue({ delivered: true });
    const update = { update_id: 1002, message: { chat: { id: process.env.TELEGRAM_ADMIN_CHAT_ID }, text: "/unknown" } };
    const first = response(); const second = response();
    await handleTelegramWebhook({ header: () => process.env.TELEGRAM_WEBHOOK_SECRET, body: update } as never, first as never);
    await handleTelegramWebhook({ header: () => process.env.TELEGRAM_WEBHOOK_SECRET, body: update } as never, second as never);
    expect(telegramMocks.sendTelegramSignal).toHaveBeenCalledTimes(1);
    expect(second.json).toHaveBeenCalledWith({ ok: true, duplicate: true });
  });

  it("serves every documented non-scan command through the webhook", async () => {
    dbMocks.getSettings.mockResolvedValue({ telegramCommandsEnabled: true, scanEnabled: false, lastScanStatus: "idle", lastError: null, defaultTimeframe: "1h", watchlist: ["XAU/USD"], snrvEnabled: true, smcEnabled: true, snrvSwingLength: 20, snrvSensitivity: "Medium", minSignalScore: 3, atrStopMultiplier: 1.5, rewardRiskRatio: 1.8, maxAtrPct: 0.05 });
    dbMocks.listSignals.mockResolvedValue([]);
    dbMocks.dashboardStats.mockResolvedValue({ total: 0, today: 0, qualified: 0 });
    signalMocks.analyzeAndPersist.mockResolvedValue({ stored: { id: 31 }, signal: { direction: "WAIT", symbol: "XAU/USD", score: 0 } });
    signalMocks.signalToTelegramText.mockReturnValue("WAIT — confirmation threshold not met. Signal-only intelligence. No orders are placed.");
    telegramMocks.sendTelegramSignal.mockResolvedValue({ delivered: true });
    const commands = ["/start", "/help", "/status", "/watchlist", "/assets", "/signal", "/last", "/history", "/performance", "/risk", "/settings", "/cancel", "/scanall", "/analyze XAUUSD 15min"];
    for (const [index, text] of commands.entries()) {
      const res = response();
      await handleTelegramWebhook({ header: () => process.env.TELEGRAM_WEBHOOK_SECRET, body: { update_id: 3000 + index, message: { chat: { id: process.env.TELEGRAM_ADMIN_CHAT_ID }, text } } } as never, res as never);
      expect(res.status).toHaveBeenCalledWith(200);
    }
    expect(telegramMocks.sendTelegramSignal).toHaveBeenCalledTimes(commands.length);
  });

  it("replies safely instead of silently dropping an authorized update when commands are disabled", async () => {
    dbMocks.getSettings.mockResolvedValue({ telegramCommandsEnabled: false });
    telegramMocks.sendTelegramSignal.mockResolvedValue({ delivered: true });
    const res = response();
    await handleTelegramWebhook({ header: () => process.env.TELEGRAM_WEBHOOK_SECRET, body: { update_id: 4001, message: { chat: { id: process.env.TELEGRAM_ADMIN_CHAT_ID }, text: "/scan XAUUSD 15min" } } } as never, res as never);
    expect(telegramMocks.sendTelegramSignal).toHaveBeenCalledWith(expect.stringContaining("currently disabled"), expect.objectContaining({ chatId: process.env.TELEGRAM_ADMIN_CHAT_ID }));
    expect(res.json).toHaveBeenCalledWith({ ok: true, disabled: true });
  });

  it("uses the safe fallback reply when command processing throws", async () => {
    dbMocks.getSettings.mockRejectedValue(new Error("database unavailable"));
    telegramMocks.sendTelegramSignal.mockResolvedValue({ delivered: true });
    const res = response();
    await handleTelegramWebhook({ header: () => process.env.TELEGRAM_WEBHOOK_SECRET, body: { update_id: 5001, message: { chat: { id: process.env.TELEGRAM_ADMIN_CHAT_ID }, text: "/status" } } } as never, res as never);
    expect(telegramMocks.sendTelegramSignal).toHaveBeenCalledWith(expect.stringContaining("Unable to complete"), expect.objectContaining({ chatId: process.env.TELEGRAM_ADMIN_CHAT_ID }));
    expect(res.json).toHaveBeenCalledWith({ ok: false });
  });

  it("reports outbound Bot API delivery failure without throwing or silently dropping the update", async () => {
    dbMocks.getSettings.mockResolvedValue({ telegramCommandsEnabled: true, scanEnabled: false, lastScanStatus: "idle", lastError: null, defaultTimeframe: "1h", watchlist: ["XAU/USD"], snrvEnabled: true, smcEnabled: true, snrvSwingLength: 20, snrvSensitivity: "Medium", minSignalScore: 3, atrStopMultiplier: 1.5, rewardRiskRatio: 1.8, maxAtrPct: 0.05 });
    telegramMocks.sendTelegramSignal.mockResolvedValue({ delivered: false, reason: "Telegram sendMessage failed" });
    const res = response();
    await handleTelegramWebhook({ header: () => process.env.TELEGRAM_WEBHOOK_SECRET, body: { update_id: 5002, message: { chat: { id: process.env.TELEGRAM_ADMIN_CHAT_ID }, text: "/status" } } } as never, res as never);
    expect(telegramMocks.sendTelegramSignal).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({ ok: false });
  });

  it("runs an authorized manual scan command and delivers the qualified signal-only format", async () => {
    const settings = { telegramCommandsEnabled: true, scanEnabled: false, lastScanStatus: "idle", lastError: null, defaultTimeframe: "1h", watchlist: ["XAU/USD"], snrvEnabled: true, smcEnabled: true, snrvSwingLength: 20, snrvSensitivity: "Medium", minSignalScore: 3, atrStopMultiplier: 1.5, rewardRiskRatio: 1.8, maxAtrPct: 0.05 };
    dbMocks.getSettings.mockResolvedValue(settings);
    signalMocks.analyzeAndPersist.mockResolvedValue({ stored: { id: 19 }, signal: { direction: "BUY" } });
    signalMocks.signalToTelegramText.mockReturnValue("Entry reference: 2390 | Stop-loss: 2375 | TP1: 2417 | TP2: 2430\nSignal-only intelligence. No orders are placed.");
    telegramMocks.sendTelegramSignal.mockResolvedValue({ delivered: true });
    const res = response();
    await handleTelegramWebhook({ header: () => process.env.TELEGRAM_WEBHOOK_SECRET, body: { message: { chat: { id: process.env.TELEGRAM_ADMIN_CHAT_ID }, text: "/scan XAUUSD 15min" } } } as never, res as never);
    expect(signalMocks.analyzeAndPersist).toHaveBeenCalledWith(expect.objectContaining({ symbol: "XAUUSD", timeframe: "15min", source: "manual" }));
    expect(dbMocks.markSignalDelivery).toHaveBeenCalledWith(19, "queued", null);
    expect(telegramMocks.sendTelegramSignal).toHaveBeenCalledWith(expect.stringContaining("TP2: 2430"), expect.objectContaining({ chatId: process.env.TELEGRAM_ADMIN_CHAT_ID, replyMarkup: expect.any(Object) }));
  });
});
