import { describe, expect, it, vi } from "vitest";
import { configureTelegramCommandWebhook } from "./telegram";

describe("Telegram webhook configuration", () => {
  it("rejects an invalid verification secret before an outbound Telegram request", async () => {
    const priorSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    const priorFetch = globalThis.fetch;
    const fetchMock = vi.fn();
    process.env.TELEGRAM_WEBHOOK_SECRET = "contains spaces!";
    globalThis.fetch = fetchMock;
    await expect(configureTelegramCommandWebhook("https://snrv-dash-cppgkwva.manus.space/api/telegram/updates")).rejects.toThrow("only letters, numbers, underscores, or hyphens");
    expect(fetchMock).not.toHaveBeenCalled();
    process.env.TELEGRAM_WEBHOOK_SECRET = priorSecret;
    globalThis.fetch = priorFetch;
  });

  it("rejects non-HTTPS webhook addresses before registration", async () => {
    const priorSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    process.env.TELEGRAM_WEBHOOK_SECRET = "telegram_test_secret_1234567890";
    await expect(configureTelegramCommandWebhook("http://localhost/api/telegram/updates")).rejects.toThrow("public HTTPS webhook URL");
    process.env.TELEGRAM_WEBHOOK_SECRET = priorSecret;
  });
});
