import { describe, expect, it, vi } from "vitest";
import { configureTelegramCommandWebhook, sendTelegramPhoto } from "./telegram";

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

  it("uploads a PNG as a Telegram photo with a bounded caption", async () => {
    const priorFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const result = await sendTelegramPhoto(Buffer.from("png-bytes"), { chatId: "123", caption: "SNRV signal" });
    expect(result).toEqual({ delivered: true, reason: null });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/sendPhoto"), expect.objectContaining({ method: "POST", body: expect.any(FormData) }));
    const body = fetchMock.mock.calls[0][1].body as FormData;
    expect(body.get("chat_id")).toBe("123");
    expect(body.get("caption")).toBe("SNRV signal");
    expect(body.get("photo")).toBeInstanceOf(Blob);
    globalThis.fetch = priorFetch;
  });
});
