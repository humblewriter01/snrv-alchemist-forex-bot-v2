import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchClosedCandles, MarketDataError } from "./market-data";

describe("market-data error handling", () => {
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
});
