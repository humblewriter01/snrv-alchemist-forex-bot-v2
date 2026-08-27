import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({ getSettings: vi.fn(), markSignalDelivery: vi.fn(), updateScanHealth: vi.fn() }));
const signalMocks = vi.hoisted(() => ({ analyzeAndPersist: vi.fn(), signalToTelegramText: vi.fn() }));
const telegramMocks = vi.hoisted(() => ({ sendTelegramSignal: vi.fn() }));

vi.mock("./db", () => dbMocks);
vi.mock("./signal-service", () => signalMocks);
vi.mock("./telegram", () => telegramMocks);

import { runWatchlistScan } from "./scan-service";

const settings = {
  watchlist: ["XAU/USD"], defaultTimeframe: "1h", snrvEnabled: true, smcEnabled: true, snrvSwingLength: 20, snrvSensitivity: "Medium" as const,
  minSignalScore: 3, atrStopMultiplier: 1.5, rewardRiskRatio: 1.8, maxAtrPct: 0.05, telegramEnabled: true, openRouterEnabled: false,
  scanEnabled: true, scanCron: "0 */15 * * * *", scheduleCronTaskUid: "cron-test", lastScanAt: null, lastScanStatus: "idle" as const, lastError: null,
};

describe("scheduled scanning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.getSettings.mockResolvedValue(settings);
    dbMocks.markSignalDelivery.mockResolvedValue(undefined);
    dbMocks.updateScanHealth.mockResolvedValue(undefined);
    signalMocks.analyzeAndPersist.mockResolvedValue({ stored: { id: 42 }, signal: { direction: "BUY" } });
    signalMocks.signalToTelegramText.mockReturnValue("Signal-only intelligence. No orders are placed.");
    telegramMocks.sendTelegramSignal.mockResolvedValue({ delivered: true, reason: null });
  });

  it("persists scheduled source signals and records Telegram delivery state without execution", async () => {
    const result = await runWatchlistScan("owner-1");

    expect(result).toMatchObject({ processed: 1, qualified: 1, errors: [] });
    expect(signalMocks.analyzeAndPersist).toHaveBeenCalledWith(expect.objectContaining({ ownerOpenId: "owner-1", symbol: "XAU/USD", timeframe: "1h", source: "scheduled" }));
    expect(dbMocks.markSignalDelivery).toHaveBeenNthCalledWith(1, 42, "queued", null);
    expect(dbMocks.markSignalDelivery).toHaveBeenNthCalledWith(2, 42, "sent", null);
    expect(telegramMocks.sendTelegramSignal).toHaveBeenCalledTimes(1);
    expect(dbMocks.updateScanHealth).toHaveBeenCalledWith("owner-1", "healthy", null);
  }, 5_000);

  it("does not scan when the owner has disabled the schedule", async () => {
    dbMocks.getSettings.mockResolvedValue({ ...settings, scanEnabled: false });
    const result = await runWatchlistScan("owner-1");
    expect(result.skipped).toContain("disabled");
    expect(signalMocks.analyzeAndPersist).not.toHaveBeenCalled();
  });
});
