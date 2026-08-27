# Telegram Operations Guide

## Purpose and boundary

The SNRV Alchemist Telegram bot provides **signal intelligence only**. It does not connect to a brokerage account, create orders, or transmit execution instructions. A qualifying BUY or SELL result includes an entry reference, an ATR-derived stop-loss reference, TP1, TP2, signal score, confidence guide, and SNRV/SMC context. A WAIT response explicitly marks stop and targets as **Not issued**.

## Activate the bot commands

After the next published update is live, sign in as the project owner, navigate to **Control room**, and select **Connect Telegram commands**. This configures the bot to send updates to the permanent HTTPS endpoint and enables command processing only after Telegram confirms the connection.

| Command | Result |
|---|---|
| `/status` | Reports configured provider posture, scheduled scan state, and the latest scan health state. |
| `/watchlist` | Returns the current dashboard watchlist and its default timeframe. |
| `/scan XAUUSD 15min` | Runs a closed-candle, signal-only scan for a supported asset and timeframe. |
| `/help` | Lists the available commands. |

Only the configured administrator chat can receive a reply. The server also validates Telegram’s secret webhook header before it processes any update. Provider credentials, Telegram bot credentials, and the webhook verification value remain server-side.

## Scheduled notifications

Turn on **Telegram notifications** and save the Control room to allow qualifying scheduled BUY or SELL signals to be delivered. Then explicitly enable a managed scan schedule. Scans pause for that run on a provider rate-limit result and record delivery status in the dashboard history.
