import { boolean, decimal, index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const signalSettings = mysqlTable("signal_settings", {
  id: int("id").autoincrement().primaryKey(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull().unique(),
  watchlistJson: text("watchlistJson").notNull(),
  defaultTimeframe: varchar("defaultTimeframe", { length: 16 }).notNull().default("1h"),
  snrvEnabled: boolean("snrvEnabled").notNull().default(true),
  smcEnabled: boolean("smcEnabled").notNull().default(true),
  snrvSwingLength: int("snrvSwingLength").notNull().default(20),
  snrvSensitivity: mysqlEnum("snrvSensitivity", ["Low", "Medium", "High"]).notNull().default("Medium"),
  minSignalScore: int("minSignalScore").notNull().default(3),
  atrStopMultiplier: decimal("atrStopMultiplier", { precision: 8, scale: 3 }).notNull().default("1.500"),
  rewardRiskRatio: decimal("rewardRiskRatio", { precision: 8, scale: 3 }).notNull().default("1.800"),
  maxAtrPct: decimal("maxAtrPct", { precision: 8, scale: 5 }).notNull().default("0.05000"),
  telegramEnabled: boolean("telegramEnabled").notNull().default(false),
  openRouterEnabled: boolean("openRouterEnabled").notNull().default(false),
  scanEnabled: boolean("scanEnabled").notNull().default(false),
  scanCron: varchar("scanCron", { length: 64 }).notNull().default("0 */15 * * * *"),
  scheduleCronTaskUid: varchar("schedule_cron_task_uid", { length: 65 }),
  lastScanAt: timestamp("lastScanAt"),
  lastScanStatus: mysqlEnum("lastScanStatus", ["idle", "healthy", "warning", "error"]).notNull().default("idle"),
  lastError: text("lastError"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  index("signal_settings_schedule_uid_idx").on(table.scheduleCronTaskUid),
]);

export const signals = mysqlTable("signals", {
  id: int("id").autoincrement().primaryKey(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  source: mysqlEnum("source", ["manual", "scheduled"]).notNull(),
  symbol: varchar("symbol", { length: 32 }).notNull(),
  timeframe: varchar("timeframe", { length: 16 }).notNull(),
  direction: mysqlEnum("direction", ["BUY", "SELL", "WAIT", "ALERT"]).notNull(),
  signalType: varchar("signalType", { length: 32 }).notNull().default("SNRV_SIGNAL"),
  entry: decimal("entry", { precision: 20, scale: 8 }),
  stopLoss: decimal("stopLoss", { precision: 20, scale: 8 }),
  takeProfit1: decimal("takeProfit1", { precision: 20, scale: 8 }),
  takeProfit2: decimal("takeProfit2", { precision: 20, scale: 8 }),
  riskReward: decimal("riskReward", { precision: 8, scale: 3 }),
  signalScore: int("signalScore"),
  confidence: int("confidence"),
  phase: varchar("phase", { length: 32 }),
  bias: varchar("bias", { length: 32 }),
  confluenceJson: text("confluenceJson").notNull(),
  indicatorsJson: text("indicatorsJson").notNull(),
  validationOutcome: mysqlEnum("validationOutcome", ["accepted", "rejected", "pending", "error"]).notNull(),
  validationMessage: text("validationMessage"),
  deliveryStatus: mysqlEnum("deliveryStatus", ["not_requested", "queued", "sent", "failed"]).notNull().default("not_requested"),
  deliveryError: text("deliveryError"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  index("signals_owner_created_idx").on(table.ownerOpenId, table.createdAt),
  index("signals_symbol_created_idx").on(table.symbol, table.createdAt),
  index("signals_source_created_idx").on(table.source, table.createdAt),
]);

export type SignalSettings = typeof signalSettings.$inferSelect;
export type Signal = typeof signals.$inferSelect;
