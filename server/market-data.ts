import type { Candle } from "./signal-engine";

const SYMBOL_ALIASES: Record<string, string> = {
  GOLD: "XAU/USD", XAUUSD: "XAU/USD", "XAU/USD": "XAU/USD",
  SILVER: "XAG/USD", XAGU: "XAG/USD", XAGUSD: "XAG/USD", "XAG/USD": "XAG/USD",
  BTCUSD: "BTC/USD", "BTC/USD": "BTC/USD", ETHUSD: "ETH/USD", "ETH/USD": "ETH/USD",
  EURUSD: "EUR/USD", "EUR/USD": "EUR/USD", GBPUSD: "GBP/USD", "GBP/USD": "GBP/USD",
  USDJPY: "USD/JPY", "USD/JPY": "USD/JPY", USDCHF: "USD/CHF", "USD/CHF": "USD/CHF",
  AUDUSD: "AUD/USD", "AUD/USD": "AUD/USD", USDCAD: "USD/CAD", "USD/CAD": "USD/CAD",
  NZDUSD: "NZD/USD", "NZD/USD": "NZD/USD",
};

export class MarketDataError extends Error {
  constructor(message: string, public readonly kind: "configuration" | "rate_limit" | "provider" | "data" = "provider") {
    super(message);
    this.name = "MarketDataError";
  }
}

export function normalizeSymbol(value: string) {
  const compact = value.trim().toUpperCase().replace(/[-\s]/g, "/").replace(/\/{2,}/g, "/");
  if (SYMBOL_ALIASES[compact]) return SYMBOL_ALIASES[compact];
  const noSlash = compact.replace("/", "");
  if (/^[A-Z]{6}$/.test(noSlash)) return `${noSlash.slice(0, 3)}/${noSlash.slice(3)}`;
  throw new MarketDataError(`Unsupported symbol format: ${value}`, "data");
}

type TwelveDataValue = { datetime?: string; open?: string; high?: string; low?: string; close?: string; volume?: string };
type TwelveDataResponse = { values?: TwelveDataValue[]; status?: string; code?: number; message?: string };

function numeric(value: string | undefined, field: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new MarketDataError(`Market data contains an invalid ${field} value.`, "data");
  return parsed;
}

export async function fetchClosedCandles(input: { symbol: string; interval: string; outputsize?: number }) {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) throw new MarketDataError("Twelve Data is not configured. Add the server-side API key in Settings.", "configuration");
  const symbol = normalizeSymbol(input.symbol);
  const params = new URLSearchParams({ symbol, interval: input.interval, outputsize: String(input.outputsize ?? 250), order: "asc", timezone: "UTC" });
  let response: Response;
  try {
    response = await fetch(`https://api.twelvedata.com/time_series?${params}`, { headers: { Authorization: `apikey ${apiKey}` }, signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new MarketDataError("Twelve Data is temporarily unreachable. Please try again.", "provider");
  }
  if (response.status === 429) throw new MarketDataError("Twelve Data rate limit reached. The scan has been paused for this run.", "rate_limit");
  if (response.status === 401 || response.status === 403) throw new MarketDataError("Twelve Data key is invalid or lacks access to this market.", "configuration");
  if (!response.ok) throw new MarketDataError(`Twelve Data request failed with HTTP ${response.status}.`, "provider");
  const payload = await response.json() as TwelveDataResponse;
  if (payload.status === "error" || payload.code) throw new MarketDataError((payload.message ?? "Twelve Data rejected the request.").slice(0, 240), "provider");
  if (!Array.isArray(payload.values) || payload.values.length < 211) throw new MarketDataError("Twelve Data returned too few candles for a reliable closed-candle signal.", "data");
  const candles: Candle[] = payload.values.map(row => ({ timestamp: row.datetime ?? "", open: numeric(row.open, "open"), high: numeric(row.high, "high"), low: numeric(row.low, "low"), close: numeric(row.close, "close"), volume: row.volume ? numeric(row.volume, "volume") : null }));
  candles.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return { symbol, candles: candles.slice(0, -1) };
}
