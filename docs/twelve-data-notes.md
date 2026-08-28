# Twelve Data integration notes

Twelve Data’s official developer documentation states that the `/time_series` endpoint accepts symbols such as `EUR/USD` and that the provider returns structured `code`, `message`, and `status` error fields. It documents HTTP 404 as “Not Found” for data that could not be found, while 401/403 represent credential or access issues and 429 represents rate limiting.

The official Twelve Data market page for Silver Spot / US Dollar identifies the instrument as `XAG/USD`, classifies it under commodities, and links it to the `/time_series` API. The current application should therefore preserve `XAG/USD` as the canonical user-facing alias, while classifying a provider-side 404 as “instrument unavailable for this key/endpoint/plan” rather than silently substituting another asset.

References:

1. [Twelve Data developer documentation](https://twelvedata.com/docs)
2. [Twelve Data Silver Spot / US Dollar market page](https://twelvedata.com/markets/979600/commodity/xag-usd/historical-data)
3. [Twelve Data commodities API page](https://twelvedata.com/commodities)


## 28 August 2026 live verification

A server-side live check tested `XAG/USD`, `XAGUSD`, `XAGU`, and `XAG/USDT` with the configured environment key. `XAG/USD` was recognized by the provider but returned HTTP 404 with a plan-access message stating that the symbol is available starting with the Grow or Venture plan. The other forms were rejected as invalid symbols. The application must therefore keep `XAG/USD` as the canonical alias and must not silently analyze a different instrument; the user-facing response should explain that silver time-series access is plan-gated.

The official documentation consulted was [Twelve Data API documentation](https://twelvedata.com/docs/introduction/overview). The provider’s live response is the source of truth for this account’s entitlement.
