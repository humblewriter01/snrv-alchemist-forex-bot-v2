import { describe, expect, it } from "vitest";

describe("server secrets", () => {
  it("authenticates to Twelve Data without exposing the API key", async () => {
    const apiKey = process.env.TWELVE_DATA_API_KEY;
    expect(apiKey).toBeTruthy();

    const response = await fetch("https://api.twelvedata.com/price?symbol=EUR%2FUSD", {
      headers: { Authorization: `apikey ${apiKey}` },
      signal: AbortSignal.timeout(15_000),
    });
    const payload = await response.json() as { price?: string; status?: string; message?: string };

    expect(response.ok, payload.message ?? "Twelve Data request failed").toBe(true);
    expect(payload.status).not.toBe("error");
    expect(Number(payload.price)).toBeGreaterThan(0);
  }, 20_000);
});
