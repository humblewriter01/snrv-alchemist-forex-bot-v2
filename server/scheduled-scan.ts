import type { Request, Response } from "express";
import { getSettingsByScheduleTaskUid } from "./db";
import { runWatchlistScan } from "./scan-service";
import { sdk } from "./_core/sdk";

export async function handleScheduledScan(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const settings = await getSettingsByScheduleTaskUid(user.taskUid);
    if (!settings) return res.json({ ok: true, skipped: "orphan" });
    const result = await runWatchlistScan(settings.ownerOpenId);
    return res.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown scheduled scan error";
    return res.status(500).json({ error: message, timestamp: new Date().toISOString() });
  }
}
