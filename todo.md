# Project TODO

- [x] Authenticated SNRV/SMC signal dashboard with Twelve Data and EMA/RSI/MACD/Bollinger/ATR analysis.
- [x] Permanent HTTPS deployment and server-side secret handling.
- [x] Initial Telegram webhook validation and signal-only command path.
- [ ] Complete live admin-chat reply delivery verification for the published Telegram webhook; offline routing and safe health checks are complete.
- [x] Fix Telegram command replies and outbound signal delivery with sanitized diagnostics.
- [x] Fix Twelve Data symbol aliases and classify authentication, rate-limit, symbol, data, and transient failures.
- [x] Add secure menu-driven commands: /start, /help, /status, /watchlist, /scan, /analyze, /signal, /history, /performance, /risk, /settings, /cancel.
- [x] Add inline-button menus, bounded command state, WAIT explanations, and qualified Entry/SL/TP1/TP2 references.
- [x] Preserve administrator authorization, webhook-secret validation, idempotency, and the strict signal-only/no-execution boundary.
- [x] Reconcile production schema/migrations before relying on persisted signal history.
- [x] Add regression tests for commands, callbacks, unauthorized chats, duplicate updates, provider aliases/errors, and formatting.
- [x] Add TELEGRAM_GUIDE.md with setup, commands, troubleshooting, aliases, and limitations.
- [x] Run tests, type checks, build, and visual smoke review.
- [ ] Publish a final checkpoint after automated validation.
- [ ] Owner-verify /start, /status, and one controlled /scan XAUUSD 15min in Telegram.
- [ ] Document remaining owner-dependent checks and incident findings without exposing secrets.

## Historical notes

- TradingView webhook intake is intentionally out of scope for the current product.
- Finnhub is intentionally out of scope; Twelve Data is the primary market-data provider.
- The canonical signal table is `signals`; no destructive SQL should be used.
- The production-log CLI previously returned EOF; use sanitized local logs and safe health responses as fallback diagnostics.
- Permanent site: https://snrv-dash-cppgkwva.manus.space

## Safety gate

- [x] No broker, exchange, order, position, or execution integration.
- [x] No Telegram message implies guaranteed outcomes, realized profitability, or financial advice.
- [x] Risk and performance features remain analytical references only.
- [x] No secrets, raw provider payloads, raw Telegram updates, reviews, ratings, testimonials, or fabricated data are added.


## Verification gaps to resolve before checkpoint

- [x] Add explicit tests for non-admin chat rejection and symbol alias normalization such as `XAGU -> XAG/USD` and `XAUUSD -> XAU/USD`.
- [x] Add tests for every documented Telegram command and the complete inline menu/state flow, or narrow the guide to commands actually implemented.
- [x] Add a concrete schema/migration consistency check for the canonical `signals` history table and document the result.
- [ ] Perform and record live admin-chat reply verification for `/start`, `/status`, and a controlled scan without exposing credentials.
- [x] Keep the final checkpoint pending until offline implementation gaps are addressed; owner-dependent smoke verification remains a post-checkpoint action.
- [ ] Do not mark any gap complete solely from documentation or a partial test.
- [x] Record the exact production webhook health result without exposing the full URL or secret.
- [x] Record that the current bot identity is safe metadata only and must still be owner-confirmed.
- [x] Record that pending Telegram updates were zero at the time of health inspection.
- [x] Record that production settings show Telegram commands enabled and recurring scans disabled.
- [x] Record that the dashboard visual smoke review completed, while authenticated owner verification remains pending.
- [x] Record that the Twelve Data XAG/USD 404 path is classified as unavailable data and never silently substituted.
- [x] Record that the full deterministic suite passed before the final checkpoint.
- [x] Record that the production build passed with a non-blocking bundle-size warning.
- [ ] Do not claim the live Telegram reply path is fixed until the owner sends the smoke-test commands.
- [x] Do not publish a final checkpoint until the implementation and docs match the tested command surface.
- [x] Re-read todo.md before checkpoint creation and mark only evidence-backed items complete.
- [ ] Send a progress update before requesting the owner smoke test.
- [ ] Keep the final handoff separate from the current progress update.
- [x] Keep no-execution wording in all new command and menu responses.
- [x] Keep provider and Telegram diagnostics sanitized in all new tests and documentation.
- [x] Keep live verification bounded and avoid writing artificial production signals.
- [x] Keep the production site permanent and HTTPS.
- [x] Keep all new work within the existing full-stack scaffold.
- [x] Keep recurring work on managed Heartbeat rather than in-process polling.
- [x] Keep secret rotation out of chat.
- [x] Keep screenshot references informational only.
- [ ] Keep the next user request tracked separately if it changes scope.
- [ ] Close the task only after the final checkpoint and truthful handoff.


## Final gap corrections

- [x] Add regression coverage for every inline menu callback: analyze, scan, signal, history, status, watchlist, risk, and settings.
- [x] Add explicit signal-only/no-execution wording to watchlist, cancel, and usage-only callback replies.
- [x] Reconcile checklist marks after the inline coverage and wording fixes; do not checkpoint before that review.
