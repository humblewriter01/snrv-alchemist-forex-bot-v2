import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, signalSettings, signals, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

const DEFAULT_WATCHLIST = ["XAU/USD", "BTC/USD", "EUR/USD", "GBP/USD", "USD/JPY", "XAG/USD", "USD/CHF"];

export type DashboardSettings = {
  watchlist: string[];
  defaultTimeframe: string;
  snrvEnabled: boolean;
  smcEnabled: boolean;
  snrvSwingLength: number;
  snrvSensitivity: "Low" | "Medium" | "High";
  minSignalScore: number;
  atrStopMultiplier: number;
  rewardRiskRatio: number;
  maxAtrPct: number;
  telegramEnabled: boolean;
  telegramCommandsEnabled: boolean;
  openRouterEnabled: boolean;
  scanEnabled: boolean;
  scanCron: string;
  scheduleCronTaskUid: string | null;
  lastScanAt: Date | null;
  lastScanStatus: "idle" | "healthy" | "warning" | "error";
  lastError: string | null;
};

function safeWatchlist(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every(item => typeof item === "string") ? parsed : DEFAULT_WATCHLIST;
  } catch { return DEFAULT_WATCHLIST; }
}

function presentSettings(row: typeof signalSettings.$inferSelect): DashboardSettings {
  return {
    watchlist: safeWatchlist(row.watchlistJson), defaultTimeframe: row.defaultTimeframe, snrvEnabled: row.snrvEnabled, smcEnabled: row.smcEnabled,
    snrvSwingLength: row.snrvSwingLength, snrvSensitivity: row.snrvSensitivity, minSignalScore: row.minSignalScore,
    atrStopMultiplier: Number(row.atrStopMultiplier), rewardRiskRatio: Number(row.rewardRiskRatio), maxAtrPct: Number(row.maxAtrPct),
    telegramEnabled: row.telegramEnabled, telegramCommandsEnabled: row.telegramCommandsEnabled, openRouterEnabled: row.openRouterEnabled, scanEnabled: row.scanEnabled, scanCron: row.scanCron,
    scheduleCronTaskUid: row.scheduleCronTaskUid, lastScanAt: row.lastScanAt, lastScanStatus: row.lastScanStatus, lastError: row.lastError,
  };
}

export function telegramSettingsOwnerOpenId() {
  const owner = String(ENV.ownerOpenId ?? "").trim();
  if (owner) return owner;
  const chatId = String(process.env.TELEGRAM_ADMIN_CHAT_ID ?? "").trim();
  if (chatId) return `telegram-chat:${chatId}`;
  throw new Error("Telegram owner identity is not configured.");
}

export async function getSettings(ownerOpenId: string): Promise<DashboardSettings> {
  const normalizedOwnerOpenId = String(ownerOpenId ?? "").trim();
  if (!normalizedOwnerOpenId) throw new Error("Owner identity is not configured.");
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  let row = (await db.select().from(signalSettings).where(eq(signalSettings.ownerOpenId, normalizedOwnerOpenId)).limit(1))[0];
  if (!row) {
    await db.insert(signalSettings).values({ ownerOpenId: normalizedOwnerOpenId, watchlistJson: JSON.stringify(DEFAULT_WATCHLIST) });
    row = (await db.select().from(signalSettings).where(eq(signalSettings.ownerOpenId, normalizedOwnerOpenId)).limit(1))[0];
  }
  if (!row) throw new Error("Unable to initialize signal settings.");
  return presentSettings(row);
}

export async function updateSettings(ownerOpenId: string, patch: Partial<Omit<DashboardSettings, "scheduleCronTaskUid" | "lastScanAt" | "lastScanStatus" | "lastError">>) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  await getSettings(ownerOpenId);
  const values: Partial<typeof signalSettings.$inferInsert> = {};
  if (patch.watchlist) values.watchlistJson = JSON.stringify(patch.watchlist);
  if (patch.defaultTimeframe) values.defaultTimeframe = patch.defaultTimeframe;
  if (patch.snrvEnabled !== undefined) values.snrvEnabled = patch.snrvEnabled;
  if (patch.smcEnabled !== undefined) values.smcEnabled = patch.smcEnabled;
  if (patch.snrvSwingLength !== undefined) values.snrvSwingLength = patch.snrvSwingLength;
  if (patch.snrvSensitivity) values.snrvSensitivity = patch.snrvSensitivity;
  if (patch.minSignalScore !== undefined) values.minSignalScore = patch.minSignalScore;
  if (patch.atrStopMultiplier !== undefined) values.atrStopMultiplier = String(patch.atrStopMultiplier);
  if (patch.rewardRiskRatio !== undefined) values.rewardRiskRatio = String(patch.rewardRiskRatio);
  if (patch.maxAtrPct !== undefined) values.maxAtrPct = String(patch.maxAtrPct);
  if (patch.telegramEnabled !== undefined) values.telegramEnabled = patch.telegramEnabled;
  if (patch.openRouterEnabled !== undefined) values.openRouterEnabled = patch.openRouterEnabled;
  if (patch.scanEnabled !== undefined) values.scanEnabled = patch.scanEnabled;
  if (patch.scanCron) values.scanCron = patch.scanCron;
  await db.update(signalSettings).set(values).where(eq(signalSettings.ownerOpenId, ownerOpenId));
  return getSettings(ownerOpenId);
}

export type StoredSignalInput = {
  ownerOpenId: string;
  source: "manual" | "scheduled";
  symbol: string;
  timeframe: string;
  direction: "BUY" | "SELL" | "WAIT" | "ALERT";
  signalType: string;
  entry: number | null;
  stopLoss: number | null;
  takeProfit1: number | null;
  takeProfit2: number | null;
  riskReward: number | null;
  signalScore: number | null;
  confidence: number | null;
  phase: string | null;
  bias: string | null;
  confluence: unknown;
  indicators: unknown;
  validationOutcome: "accepted" | "rejected" | "pending" | "error";
  validationMessage: string | null;
  deliveryStatus: "not_requested" | "queued" | "sent" | "failed";
  deliveryError?: string | null;
};

const databaseNumber = (value: number | null) => value === null ? null : String(value);

export async function createStoredSignal(input: StoredSignalInput) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const result = await db.insert(signals).values({
    ...input,
    entry: databaseNumber(input.entry), stopLoss: databaseNumber(input.stopLoss), takeProfit1: databaseNumber(input.takeProfit1), takeProfit2: databaseNumber(input.takeProfit2), riskReward: databaseNumber(input.riskReward),
    confluenceJson: JSON.stringify(input.confluence), indicatorsJson: JSON.stringify(input.indicators),
  });
  return { id: Number(result[0].insertId), ...input, createdAt: new Date() };
}

export async function listSignals(ownerOpenId: string, filters?: { symbol?: string; direction?: "BUY" | "SELL" | "WAIT" | "ALERT"; limit?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const clauses = [eq(signals.ownerOpenId, ownerOpenId)];
  if (filters?.symbol) clauses.push(eq(signals.symbol, filters.symbol));
  if (filters?.direction) clauses.push(eq(signals.direction, filters.direction));
  return db.select().from(signals).where(and(...clauses)).orderBy(desc(signals.createdAt)).limit(Math.min(Math.max(filters?.limit ?? 50, 1), 200));
}

export async function dashboardStats(ownerOpenId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [total] = await db.select({ value: count() }).from(signals).where(eq(signals.ownerOpenId, ownerOpenId));
  const [today] = await db.select({ value: count() }).from(signals).where(and(eq(signals.ownerOpenId, ownerOpenId), gte(signals.createdAt, since)));
  const [qualified] = await db.select({ value: count() }).from(signals).where(and(eq(signals.ownerOpenId, ownerOpenId), sql`${signals.direction} in ('BUY', 'SELL')`));
  return { total: Number(total?.value ?? 0), today: Number(today?.value ?? 0), qualified: Number(qualified?.value ?? 0) };
}

export async function updateScanHealth(ownerOpenId: string, status: DashboardSettings["lastScanStatus"], message: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  await db.update(signalSettings).set({ lastScanAt: new Date(), lastScanStatus: status, lastError: message }).where(eq(signalSettings.ownerOpenId, ownerOpenId));
}

export async function getSettingsByScheduleTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const row = (await db.select().from(signalSettings).where(eq(signalSettings.scheduleCronTaskUid, taskUid)).limit(1))[0];
  return row ?? null;
}

export async function saveScheduleTaskUid(ownerOpenId: string, taskUid: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  await db.update(signalSettings).set({ scheduleCronTaskUid: taskUid }).where(eq(signalSettings.ownerOpenId, ownerOpenId));
}

export async function setTelegramCommandsEnabled(ownerOpenId: string, enabled: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  await getSettings(ownerOpenId);
  await db.update(signalSettings).set({ telegramCommandsEnabled: enabled }).where(eq(signalSettings.ownerOpenId, ownerOpenId));
  return getSettings(ownerOpenId);
}

export async function markSignalDelivery(signalId: number, status: StoredSignalInput["deliveryStatus"], error: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  await db.update(signals).set({ deliveryStatus: status, deliveryError: error }).where(eq(signals.id, signalId));
}
