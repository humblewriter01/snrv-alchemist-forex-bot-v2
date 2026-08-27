import { describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({ getSettings: vi.fn(), markSignalDelivery: vi.fn() }));
const telegramMocks = vi.hoisted(() => ({ sendTelegramSignal: vi.fn() }));
const signalMocks = vi.hoisted(() => ({ analyzeAndPersist: vi.fn(), signalToTelegramText: vi.fn() }));
vi.mock("./db", () => dbMocks);
vi.mock("./telegram", () => telegramMocks);
vi.mock("./signal-service", () => signalMocks);

import { handleTelegramWebhook, isTelegramWebhookAuthorized } from "./telegram-webhook";

function response() { const value = { status: vi.fn(), json: vi.fn() }; value.status.mockReturnValue(value); return value; }

describe("Telegram webhook authentication", () => {
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

  it("accepts commands only from the configured administrator chat and replies without an execution path", async () => {
    dbMocks.getSettings.mockResolvedValue({ telegramCommandsEnabled: true, scanEnabled: false, lastScanStatus: "idle", lastError: null, defaultTimeframe: "1h", watchlist: ["XAU/USD"], snrvEnabled: true, smcEnabled: true, snrvSwingLength: 20, snrvSensitivity: "Medium", minSignalScore: 3, atrStopMultiplier: 1.5, rewardRiskRatio: 1.8, maxAtrPct: 0.05 });
    telegramMocks.sendTelegramSignal.mockResolvedValue({ delivered: true });
    const res = response();
    await handleTelegramWebhook({ header: () => process.env.TELEGRAM_WEBHOOK_SECRET, body: { message: { chat: { id: process.env.TELEGRAM_ADMIN_CHAT_ID }, text: "/status" } } } as never, res as never);
    expect(telegramMocks.sendTelegramSignal).toHaveBeenCalledWith(expect.stringContaining("Signal-only: no order execution."));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
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
    expect(telegramMocks.sendTelegramSignal).toHaveBeenCalledWith(expect.stringContaining("TP2: 2430"));
  });
});
