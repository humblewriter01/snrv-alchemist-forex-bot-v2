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
- [x] Publish a final checkpoint after automated validation.
- [ ] Owner-verify /start, /status, and one controlled /scan XAUUSD 15min in Telegram.
- [x] Document remaining owner-dependent checks and incident findings without exposing secrets.

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
- [x] Do not mark any gap complete solely from documentation or a partial test.
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
- [x] Send a progress update before requesting the owner smoke test.
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


## New production incident iteration

- [x] Reproduce and diagnose the user-reported Telegram no-reply behavior through the live Bot API webhook state; owner message-reply confirmation remains pending.
- [x] Verify the configured bot identity, webhook URL/path, webhook secret header, admin chat matching, command enablement, and Bot API response status without exposing credentials.
- [x] Verify whether Telegram has pending updates or webhook delivery errors and classify the failure.
- [x] Reproduce XAG/USD analysis failure using the actual provider symbol mapping and live-data response classification.
- [x] Keep XAG/USD canonical and document the provider plan-gated response; do not silently substitute a different silver or currency asset.
- [x] Expand Telegram commands with safe Bot API registration, menu actions, help, status, watchlist, asset aliases, single-symbol analysis, bounded watchlist scan, latest signal, history, performance, risk reference, settings, and cancel flows.
- [x] Ensure every Telegram command and callback response contains an explicit signal-only/no-execution boundary where appropriate.
- [x] Add regression tests for webhook auth, admin chat authorization, duplicate updates, XAG/USD mapping, provider 404/429 handling, commands, menus, callbacks, and formatting; live Bot API registration was separately repaired and verified.
- [x] Run full tests, type check, build, and safe repository secret scan after the incident fixes.
- [x] Publish a new checkpoint only after automated validation passes.
- [ ] Ask the owner to verify `/start`, `/status`, and `/scan XAUUSD 15min` from the configured Telegram chat.
- [x] Report implemented, automated-tested, and owner-verified states separately without claiming perfect operation.


## Final evidence gaps

- [x] Run and record a fresh repository credential/secret scan after the latest Telegram and market-data edits; fix any findings.
- [x] Save and record a new checkpoint/version after the current incident-fix changes and final validation.


## Confirmed Telegram no-reply incident

- [x] Trace a delivered Telegram update through webhook auth, command enablement, database access, command processing, and outbound `sendMessage`.
- [x] Add safe request-path diagnostics with update IDs and stage names only; never log message bodies, tokens, secrets, or raw provider payloads.
- [x] Identify and fix the exact reason a delivered `/start`, `/status`, or `/scan` receives no response.
- [x] Ensure the webhook returns quickly and sends a fallback error reply when command processing fails.
- [x] Add regression coverage for command processing failures and outbound Bot API failures.
- [x] Re-run full tests, type check, build, and secret scan after the response-path fix.
- [ ] Publish a new checkpoint after the fix is validated.
- [ ] Ask the owner to retry `/start`, `/status`, and `/scan XAUUSD 15min` after the new checkpoint.
- [ ] Keep owner verification pending until the bot visibly replies.


## Confirmed production toggle mismatch

- [x] Prevent the webhook from silently dropping authorized updates when `telegramCommandsEnabled` is false; reply with a safe activation/status message instead.
- [x] Allow `/start`, `/help`, and `/status` to remain diagnostic-safe even when the command toggle is off, while keeping scans gated if the owner intentionally disables commands.
- [x] Add regression tests proving authorized updates never disappear silently and that disabled-state replies are delivered through the Bot API client.
- [ ] Re-test the permanent production webhook after publishing this behavior change.


## Response-path evidence gaps

- [x] Add sanitized Telegram webhook stage diagnostics keyed only by update ID: auth, duplicate, admin check, settings fetch, route, send attempt, and send result.
- [x] Add a regression test for command-processing exceptions and assert the fallback reply path is used safely.
- [x] Add a regression test for outbound Bot API delivery failure and assert the handler returns safely without silently dropping the event.
- [x] Mark the new response-path items complete only after tests pass.
- [x] Save a new checkpoint after the response-path diagnostics and failure tests are implemented and validated.


## Remaining delivery-path check

- [x] Normalize configured and incoming Telegram chat IDs with trimming before admin comparison so harmless environment whitespace cannot silently discard updates.
- [x] Add a regression test for normalized administrator chat-ID matching.
- [x] Use safe production stage diagnostics to distinguish non-admin-chat drops from Bot API send failures.
- [ ] Re-publish and ask the owner to retry after the chat-ID comparison hardening.
