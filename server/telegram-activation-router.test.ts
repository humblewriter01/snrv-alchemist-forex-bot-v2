import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  configureTelegramCommandWebhook: vi.fn(),
  setTelegramCommandsEnabled: vi.fn(),
  telegramSettingsOwnerOpenId: vi.fn(),
}));

vi.mock("./telegram", () => ({
  configureTelegramCommandWebhook: mocks.configureTelegramCommandWebhook,
  getTelegramHealth: vi.fn(),
}));
vi.mock("./db", () => ({
  setTelegramCommandsEnabled: mocks.setTelegramCommandsEnabled,
  telegramSettingsOwnerOpenId: mocks.telegramSettingsOwnerOpenId,
  dashboardStats: vi.fn(),
  getSettings: vi.fn(),
  listSignals: vi.fn(),
  saveScheduleTaskUid: vi.fn(),
  updateSettings: vi.fn(),
}));
vi.mock("./signal-service", () => ({ analyzeAndPersist: vi.fn() }));
vi.mock("./market-data", () => ({ MarketDataError: class extends Error {} }));
vi.mock("./_core/heartbeat", () => ({ createHeartbeatJob: vi.fn(), deleteHeartbeatJob: vi.fn(), updateHeartbeatJob: vi.fn() }));

import { signalRouter } from "./routers/signal-router";

const context = {
  req: { protocol: "https", headers: { host: "snrv-dash-cppgkwva.manus.space", cookie: "" } },
  res: {},
  user: { openId: "authenticated-owner", role: "admin" },
} as never;

describe("configureTelegramCommands", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "production";
    vi.clearAllMocks();
    mocks.telegramSettingsOwnerOpenId.mockReturnValue("webhook-settings-owner");
    mocks.configureTelegramCommandWebhook.mockResolvedValue({ bot: { username: "snrv_bot" }, webhook: { urlHost: "snrv-dash-cppgkwva.manus.space" } });
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("enables and verifies both the authenticated and webhook settings rows", async () => {
    mocks.setTelegramCommandsEnabled
      .mockResolvedValueOnce({ telegramCommandsEnabled: true })
      .mockResolvedValueOnce({ telegramCommandsEnabled: true });

    const result = await signalRouter.createCaller(context).configureTelegramCommands();

    expect(mocks.configureTelegramCommandWebhook).toHaveBeenCalledWith("https://snrv-dash-cppgkwva.manus.space/api/telegram/updates");
    expect(mocks.setTelegramCommandsEnabled).toHaveBeenNthCalledWith(1, "authenticated-owner", true);
    expect(mocks.setTelegramCommandsEnabled).toHaveBeenNthCalledWith(2, "webhook-settings-owner", true);
    expect(result.telegramCommandsEnabled).toBe(true);
  });

  it("fails activation when a settings row remains disabled", async () => {
    mocks.setTelegramCommandsEnabled
      .mockResolvedValueOnce({ telegramCommandsEnabled: true })
      .mockResolvedValueOnce({ telegramCommandsEnabled: false });

    await expect(signalRouter.createCaller(context).configureTelegramCommands()).rejects.toThrow("Telegram activation did not persist");
  });
});
