# Telegram and XAG/USD incident note

## Verified findings

The live Telegram Bot API identified the configured bot and the permanent webhook host/path. The webhook had zero pending updates and no Telegram-reported delivery error, but the live Bot API state had no registered commands and only `message` in `allowed_updates`. That partial state explains why the bot could appear connected while the expected command/menu behavior was unavailable.

The Bot API state was repaired using the existing server-side credentials. Commands were registered and the permanent webhook was re-registered with both `message` and `callback_query` updates. The repair output was restricted to safe host/path, update-type, pending-count, and error metadata.

## XAG/USD finding

The application correctly normalizes `XAGU`, `XAGUSD`, `SILVER`, and `XAG/USD` to the canonical `XAG/USD` instrument. A live Twelve Data check showed that `XAG/USD` is recognized but returns HTTP 404 with a plan-access message requiring the Grow or Venture plan. `XAGUSD`, `XAGU`, and `XAG/USDT` are not valid substitute forms for this endpoint. The application therefore explains the entitlement limitation and never silently analyzes a different asset.

## Implemented changes

The Telegram command surface now includes `/start`, `/help`, `/status`, `/watchlist`, `/assets`, `/scan`, `/scanall`, `/analyze`, `/signal`, `/last`, `/history`, `/performance`, `/risk`, `/settings`, and `/cancel`. The watchlist scan is bounded to eight symbols per request. Menu responses and error/empty states retain the signal-only boundary; no order, broker, exchange, position, or execution path exists.

Telegram health metadata now includes safe bot identity, webhook update types, pending updates, last error, and registered command count. Activation registers commands before the webhook so a failed command registration cannot leave the expected interaction surface silently incomplete.

## Validation

The focused Telegram/provider tests pass, followed by the complete suite: 14 files and 36 tests. TypeScript checking and the production build pass. The repository credential-like literal scan found zero files, and the temporary heredoc-marker scan found zero files. The production build retains a non-blocking large-client-chunk warning.

## Owner smoke test

The owner must send `/start`, `/status`, and `/scan XAUUSD 15min` from the configured administrator Telegram chat and report only whether each command replies and whether the scan returns a signal or WAIT. Credentials must not be sent in chat. XAG/USD requires a Twelve Data plan that includes the instrument’s time-series access before it can produce live candles.


## Final settings-row remediation

The disabled-state reply was traced to duplicate settings rows: Control room activation enabled the authenticated owner row, while the production webhook resolved a different settings key. Telegram Bot API delivery was healthy, but the webhook correctly saw command replies disabled. The repair now normalizes the settings owner key, prevents blank-owner lookup, enables both the authenticated owner row and the webhook-resolved row during activation, and verifies the persisted enabled flag before reporting success. Production smoke coverage confirmed the permanent webhook accepted the controlled scan request after the row correction. Owner-visible Telegram confirmation remains the final manual check.
