import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchClosedCandles, MarketDataError, normalizeSymbol } from "./market-data";

describe("market-data symbol normalization and error handling", () => {
  it("normalizes common Telegram aliases without changing the asset", () => {
    expect(normalizeSymbol("XAGU")).toBe("XAG/USD");
    expect(normalizeSymbol("XAUUSD")).toBe("XAU/USD");
    expect(normalizeSymbol("BTCUSD")).toBe("BTC/USD");
  });
  afterEach(() => vi.unstubAllGlobals());

  it("returns a clear configuration error before attempting a provider request when the server key is missing", async () => {
    const original = process.env.TWELVE_DATA_API_KEY;
    delete process.env.TWELVE_DATA_API_KEY;
    await expect(fetchClosedCandles({ symbol: "EUR/USD", interval: "1h" })).rejects.toMatchObject<Partial<MarketDataError>>({ kind: "configuration", message: expect.stringContaining("not configured") });
    if (original) process.env.TWELVE_DATA_API_KEY = original;
  });

  it("classifies a provider rate limit for a controlled scan pause", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Too many requests", { status: 429 })));
    await expect(fetchClosedCandles({ symbol: "EUR/USD", interval: "1h" })).rejects.toMatchObject<Partial<MarketDataError>>({ kind: "rate_limit", message: expect.stringContaining("rate limit") });
  });

  it("classifies a silver HTTP 404 as unavailable instrument data with a safe hint", async () => {
    process.env.TWELVE_DATA_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 404, message: "XAG/USD is not available for this plan", status: "error" }), { status: 404, headers: { "content-type": "application/json" } })));
    await expect(fetchClosedCandles({ symbol: "XAGU", interval: "15min" })).rejects.toMatchObject<Partial<MarketDataError>>({ kind: "data", message: expect.stringContaining("could not find XAG/USD") });
  });
});
