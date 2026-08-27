# Schema audit

The canonical Drizzle schema defines `signal_settings` and `signals`, including Telegram command flags, scan status, signal levels, JSON indicator/confluence fields, and owner/time indexes.

The production database was queried non-destructively on 27 August 2026. Both `signals` and `signal_settings` exist, and the returned columns include the canonical signal fields (`ownerOpenId`, `source`, `symbol`, `timeframe`, `direction`, `signalType`, `entry`, `stopLoss`, `takeProfit1`, `takeProfit2`, `riskReward`, `signalScore`, `confidence`, `phase`, and `bias`) as well as the Telegram and scan settings fields. This means the runtime tables required by the current signal and Telegram history code are present.

The repository’s `drizzle/migrations` directory currently contains only `.gitkeep`; production schema presence was established by the existing managed database rather than by a checked-in generated migration. No destructive SQL was run. Future schema changes should be additive, generated, reviewed, and applied through the managed migration workflow before checkpoint publication.

The earlier exploratory table name `signal_history` is not canonical. Runtime history uses `signals` through `listSignals`, and Telegram history should not assume any other table name.
