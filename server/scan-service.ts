import { getSettings, markSignalDelivery, updateScanHealth, type DashboardSettings } from "./db";
import { MarketDataError } from "./market-data";
import { analyzeAndPersist, signalToTelegramText } from "./signal-service";
import { sendTelegramSignal } from "./telegram";

const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

function analysisSettings(settings: DashboardSettings) {
  return {
    snrvEnabled: settings.snrvEnabled,
    smcEnabled: settings.smcEnabled,
    snrvSwingLength: settings.snrvSwingLength,
    snrvSensitivity: settings.snrvSensitivity,
    minSignalScore: settings.minSignalScore,
    atrStopMultiplier: settings.atrStopMultiplier,
    rewardRiskRatio: settings.rewardRiskRatio,
    maxAtrPct: settings.maxAtrPct,
  };
}

export async function runWatchlistScan(ownerOpenId: string) {
  const settings = await getSettings(ownerOpenId);
  if (!settings.scanEnabled) return { skipped: "Scheduled scan is disabled.", processed: 0, qualified: 0, errors: [] as string[] };
  const results: string[] = [];
  let processed = 0;
  let qualified = 0;
  for (const symbol of settings.watchlist) {
    try {
      const { signal, stored } = await analyzeAndPersist({ ownerOpenId, symbol, timeframe: settings.defaultTimeframe, source: "scheduled", settings: analysisSettings(settings) });
      processed += 1;
      if (signal.direction === "BUY" || signal.direction === "SELL") {
        qualified += 1;
        if (settings.telegramEnabled) {
          await markSignalDelivery(stored.id, "queued", null);
          const delivery = await sendTelegramSignal(signalToTelegramText(signal));
          await markSignalDelivery(stored.id, delivery.delivered ? "sent" : "failed", delivery.reason);
          if (!delivery.delivered) results.push(`${symbol}: ${delivery.reason}`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown scan error";
      results.push(`${symbol}: ${message}`);
      if (error instanceof MarketDataError && error.kind === "rate_limit") break;
    }
    await wait(650);
  }
  const status = results.length === 0 ? "healthy" : processed > 0 ? "warning" : "error";
  await updateScanHealth(ownerOpenId, status, results.length ? results.join(" | ").slice(0, 1000) : null);
  return { skipped: null, processed, qualified, errors: results };
}
