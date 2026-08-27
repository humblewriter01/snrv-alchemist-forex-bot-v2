# SNRV Alchemist Telegram Operations Guide

## Purpose and boundary

The SNRV Alchemist Telegram bot is a **signal-intelligence and control channel** for the authenticated dashboard. It analyzes closed candles with the configured SNRV, SMC, EMA, RSI, MACD, Bollinger Bands, and ATR logic. It does not connect to a brokerage account, create orders, manage positions, or guarantee outcomes. A qualifying BUY or SELL result can include an entry reference, ATR-derived stop-loss reference, TP1, TP2, signal score, confidence guide, and SNRV/SMC context. A WAIT response does not issue those levels.

## Activate the bot commands

Sign in as the project owner at <https://snrv-dash-cppgkwva.manus.space>, open **Control room**, and select **Connect Telegram commands**. The published dashboard registers the bot webhook at `/api/telegram/updates` on the permanent HTTPS origin and registers Telegram command autocomplete. Command processing is enabled only after Telegram confirms the registration.

Credentials remain server-side. Do not paste bot tokens, webhook secrets, market-data keys, or private chat identifiers into Telegram or chat messages. Rotate them through secure project settings when needed.

## Commands

| Command | Result |
|---|---|
| `/start` | Opens the main menu and explains the signal-only scope. |
| `/help` | Lists the supported commands and an example scan. |
| `/status` | Reports safe market-data, command, schedule, and last-scan state. |
| `/watchlist` | Returns the current dashboard watchlist and default timeframe. |
| `/scan SYMBOL TIMEFRAME` | Runs one closed-candle analysis, for example `/scan XAUUSD 15min`. |
| `/analyze SYMBOL TIMEFRAME` | Alias for `/scan`. |
| `/signal` | Shows the latest stored analytical signal. |
| `/history` | Shows a bounded recent signal history. |
| `/performance` | Shows signal counts only, not realized P&L or profitability. |
| `/risk` | Explains Entry, SL, TP1, and TP2 as analytical reference levels. |
| `/settings` | Shows safe strategy and watchlist settings without secrets. |
| `/cancel` | Clears a pending menu action and returns to the main menu. |

The inline menu provides the same safe actions. Analyze and scan buttons show usage instructions rather than silently choosing an asset or timeframe.

## Signal output

A qualified BUY or SELL response contains Entry, SL, TP1, and TP2 references when the strategy produces them. A WAIT response states that confirmation was not sufficient and keeps the trade levels unissued. Every signal includes the timeframe, phase/bias context, indicator summary, UTC snapshot context where available, and an explicit no-execution disclaimer.

## Symbols and provider errors

Common input forms such as `XAUUSD`, `XAU/USD`, `BTCUSD`, `BTC/USD`, `EURUSD`, `EUR/USD`, `USDJPY`, `USD/JPY`, `XAGUSD`, `XAG/USD`, and `XAGU` are normalized before provider requests where the underlying instrument is supported. Twelve Data identifies Silver Spot / US Dollar as `XAG/USD` under commodities, but intraday commodity access can depend on the API key and plan. A provider HTTP 404 is therefore reported as unavailable data for that instrument/key/endpoint rather than silently substituting another market. HTTP 401/403 indicate credential or access restrictions; HTTP 429 indicates rate limiting.

## Troubleshooting

If Telegram does not reply, confirm that commands are enabled in the authenticated Control room, that the bot identity is the intended bot, and that the message is sent from the configured administrator chat. Reconnect from the published site rather than using a temporary preview URL. The webhook requires public HTTPS and a Telegram-compatible secret containing only letters, numbers, underscores, or hyphens.

If `/status` reports configured but not healthy, inspect the connection state in Control room and reconnect. If the bot identity is wrong, rotate the server-side bot token without sending it in chat. Unknown commands return the help menu, while unauthorized chats are ignored safely.

## Scheduled notifications

Manual Telegram scans do not enable recurring scans. Turn on **Telegram notifications** and save the Control room to allow qualifying scheduled BUY or SELL signals to be delivered. Then explicitly enable a managed scan schedule. Recurring work uses the managed Heartbeat path rather than an in-process polling loop. Scans pause for that run on a provider rate-limit result and record delivery status in dashboard history.

## Security and scope

Only the configured administrator chat can receive a command reply. The server validates Telegram’s secret webhook header before processing updates, bounds message size, ignores duplicate update IDs within a bounded runtime window, and never returns provider payloads, bot tokens, webhook secrets, or database credentials. The dashboard remains the source of truth for settings and history; Telegram is not a second strategy engine.

TradingView webhook intake and Finnhub are outside the current product scope. Risk and performance views are analytical references only. No command places an order or touches a broker account.

## References

1. [Twelve Data developer documentation](https://twelvedata.com/docs)
2. [Twelve Data Silver Spot / US Dollar market page](https://twelvedata.com/markets/979600/commodity/xag-usd/historical-data)
3. [Twelve Data commodities API page](https://twelvedata.com/commodities)
