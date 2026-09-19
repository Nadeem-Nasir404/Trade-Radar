# LevelPulse Architecture

## System overview

```
apps/web (Next.js)         apps/mobile (Expo/RN)
        \                         /
         \                       /
          v                     v
              apps/api (NestJS)
                    |
     -------------------------------------
     |              |                    |
 PostgreSQL       Redis              BullMQ queues
 (source of      (hot-path                 |
  truth for      price cache,       AlertTriggerProcessor
  alerts/users/   alert registries,  + per-channel notification
  history)        idempotency)       processors
                       ^
                       |
              MarketDataService
                 /          \
     BinanceProvider    MockMarketDataProvider
     (real, WS)          (simulated, zero API keys)
```

Every client (web, mobile) talks to the same NestJS REST API and Socket.IO gateway - there is no client-specific backend logic. Alert evaluation and notification delivery happen entirely server-side, so an alert fires whether or not any client is connected.

## Why this stack

- **NestJS + Prisma + PostgreSQL + Redis + BullMQ**: as specified. Prisma is the source of truth for everything durable (users, alerts, history, subscriptions); Redis is a *rebuildable cache* for the hot path (see "Redis is disposable" below) - never authoritative.
- **pnpm workspaces + Turborepo**: one `packages/shared-types` package gives the API, web and mobile apps a single typed contract (enums, DTO shapes, WebSocket event names, plan limits) instead of three copies drifting apart.
- **Mobile is native (Expo/React Native + Expo Router), not a wrapped web app.** The original plan considered Capacitor-wrapping the PWA, but for a product where "many people will use this and it needs Play Store presence" is a stated goal, a real native app (native push via FCM/APNs once configured, deep links, proper store listing) is worth the separate codebase. It talks to the exact same NestJS API as the web app, using its own `apps/mobile/src/lib/api` client (currently a hand-mirrored copy of `apps/web/src/lib/api`'s shapes rather than a shared `packages/api-client` - a reasonable consolidation for later, not done in this pass to keep the two frontends decoupled while both were being built).
- **Two auth transports, one backend.** The web app uses httpOnly cookies (`AuthController.setTokenCookies`); native has no cookie jar, so `AuthController` also returns `{accessToken, refreshToken}` in the JSON body of every token-issuing endpoint, which the mobile app stores in `expo-secure-store` (iOS Keychain / Android Keystore) and sends back as `Authorization: Bearer`. `JwtStrategy` accepts either extractor, and `/auth/refresh`/`/auth/logout` accept the refresh token from either the cookie or the request body - one set of endpoints, two valid ways to authenticate.

## The alert crossing algorithm (the most important part of the system)

Single entry point: `AlertEngineService.evaluateTick()` (`apps/api/src/alert-engine/alert-engine.service.ts`), invoked via `@OnEvent(MARKET_TICK_EVENT)` for every accepted tick. It depends only on `AlertRegistryService` (Redis) and a BullMQ `Queue`, so it's unit-testable by constructing `MarketTickEvent` fixtures directly - no live socket, timers, or Postgres needed. See `alert-engine.service.spec.ts` for the full test matrix (price jump over target, duplicate/out-of-order ticks, multi-alert/multi-user, cooldown, paused/expired, range enter/exit).

### 1. Tick admission (upstream, in `PriceCacheService.applyTick`)

Before `evaluateTick` ever runs, every tick passes through a single atomic Redis Lua script (`price-cache/tick-guard.lua.ts`) keyed on `price:{instrumentId}`:

```
if tick.eventTime <= lastKnownEventTime: reject   -- duplicate, out-of-order, or a reconnect replay
else: advance price/prevPrice/seq, accept
```

This is the *only* place tick admission happens - `MarketDataService` calls it once per raw provider tick and only emits `MARKET_TICK_EVENT` (which `AlertEngineService` reacts to) for accepted ticks. This guarantees the alert engine never sees a duplicate or stale tick in the first place, rather than needing to re-derive that itself.

### 2. Threshold crossing (ABOVE / BELOW / CROSSES_ABOVE / CROSSES_BELOW)

Alerts are indexed in Redis ZSETs scored by target price: `alerts:above:{instrumentId}`, `alerts:below:{instrumentId}`. For an upward tick, candidates are `ZRANGEBYSCORE alerts:above (prevPrice currentPrice` - the target only needs to lie in `(prev, curr]`, which is what correctly catches a price *jump* that skips clean over the target in a single tick (e.g. prev=99,900, curr=100,300, target=100,000 still fires exactly once). Downward alerts mirror this against `alerts:below`.

### 3. Range alerts (ENTERS_RANGE / EXITS_RANGE)

A range has two boundaries, so it's indexed in **two** ZSETs - `alerts:range-lower:{instrumentId}` and `alerts:range-upper:{instrumentId}` - scored by the lower and upper bound respectively. Candidates are the union of both ZSETs' `ZRANGEBYSCORE` over `[min(prev,curr), max(prev,curr)]`, since a transition can happen via either boundary (entering from below, entering from above, exiting above, exiting below). For each candidate, `wasInside`/`isInside` are computed against `[lower, upper]`; only an actual transition (`wasInside !== isInside`) fires, never "currently sitting inside."

*(Known limitation: a single tick that jumps clean over an entire narrow range without either boundary falling in `[prev, curr]` - i.e. price enters and exits the range within one tick - is not detected, since only boundary-interval membership is checked, not full path integration. This mirrors how most real-time alerting systems handle tick data and would require historical backtesting to close.)*

### 4. EQUALS

Since exact-price ticks are rare, EQUALS is treated as "target lies between prev and curr" - the same logic as threshold alerts, just without a direction requirement.

### 5. PCT_CHANGE and PCT_CHANGE_WINDOW

`PCT_CHANGE` ("BTC +5% since I created this alert") resolves to a static absolute threshold at creation time (`baseline * (1 + pct/100)`, baseline captured once and stored in `Alert.secondaryValue`) and is indexed into the same ABOVE/BELOW ZSETs - no special-cased evaluator needed.

`PCT_CHANGE_WINDOW` ("moved 5% in the last hour") needs a genuinely moving baseline, which a static ZSET can't express. It's evaluated by `PctWindowEvaluatorService` on a one-minute cron instead: reads the current price, compares against a baseline stored in `alert:pctbaseline:{alertId}`, and rolls the baseline forward once per `timeframe` window elapsed. **This is a tumbling window, not a true sliding window** (a known, documented simplification - a real sliding window needs continuous historical price storage, e.g. Redis Streams, which is a reasonable fast-follow but wasn't necessary to prove out the core architecture). It funnels into the exact same `AlertEngineService.triggerAlert()` path as tick-driven alerts, so idempotency/cooldown/notification behavior is identical either way.

### 6. Trigger and idempotency

`triggerAlert()` re-checks status/expiry/cooldown against the `alert:{id}` Redis hash (a second guard against races with pause/delete), then claims an idempotency key `alert:{alertId}:trigger:{alertId}:{seq}` via `SET NX` before enqueueing. `seq` is the per-instrument monotonic accepted-tick counter from the tick guard (or, for `PCT_CHANGE_WINDOW`, a Redis `INCR` counter scoped to that alert) - deterministic and unique per real crossing event, so a duplicate evaluation (concurrent request, BullMQ redelivery) can never double-fire. Non-recurring alerts flip to `TRIGGERED` and are removed from their registry; recurring alerts stay indexed and re-arm after `cooldownSeconds`.

## Redis is disposable

Every Redis structure the alert engine reads (`alerts:above:*`, `alerts:below:*`, `alerts:range-*:*`, `alert:{id}` hashes) is rebuilt from PostgreSQL on API boot by `AlertIndexerService.reconcileFromDatabase()`. A Redis flush or restart never loses alert configuration - only in-flight idempotency claims and the live price cache, both of which self-heal from the next tick/trigger.

## Market-data subscription lifecycle

`SubscriptionRegistryService` reference-counts *why* an instrument needs a live subscription: `md:refsources:alerts:{id}` (a Redis SET of alert IDs) and `md:refsources:viewers:{id}` (a Redis ZSET of WebSocket connection IDs, scored by last heartbeat). `MarketDataService` subscribes to a symbol on the underlying provider only when the combined ref count goes 0→1, and unsubscribes on 1→0 - so one market-data connection genuinely serves an unbounded number of alerts and viewers, never one subscription per alert. A 30-second sweep expires stale viewer refs from disconnected clients that didn't clean up gracefully.

## Provider routing

`MarketDataProvider` (in `packages/shared-types`) is the interface every data source implements: `connect/disconnect/subscribe/unsubscribe/getPrice/getHistoricalData/getHealth/onTick`. Today: `BinanceProvider` (real, combined-stream WebSocket, reconnect with exponential backoff + jitter, resubscribes on reconnect, a stale-feed watchdog that force-reconnects after 30s of silence) and `MockMarketDataProvider` (simulated random walk for BTC/ETH/SOL/XAU, zero external calls). Routing: `DEMO_MODE=true` sends *everything* through the mock provider; otherwise CRYPTO instruments go to Binance and everything else (gold/FX/indices - Twelve Data is not implemented in this pass) still falls back to the mock provider. Every tick carries an `isDemo` flag through the price cache and API responses specifically so simulated data is never presented as real market data.

## Notification pipeline

`AlertTriggerProcessor` (consuming the `alert-trigger` BullMQ queue) is the durability boundary: it persists the `AlertEvent`, updates the `Alert` row, and emits an internal `alert.triggered` event - it does not re-derive whether the alert should have fired (the engine already decided and claimed idempotency). `NotificationDispatchService` reacts to that event and enqueues one job per enabled+connected channel onto **separate** queues (`notify-email`, `notify-webpush`, `notify-telegram`, `notify-discord`), each with its own BullMQ worker, `attempts: 5` and exponential backoff. This is deliberate: a slow or rate-limited channel (Telegram 429s, say) can never delay another channel's delivery, and a delivery-time idempotency check in each processor guards against a retried job double-sending after a partial success.

## Module boundaries and why

A few non-obvious import directions exist to avoid circular dependencies:

- `PriceCacheModule` is a standalone leaf module (Redis-only, no Postgres, no knowledge of `Instrument` rows) so both `InstrumentsModule` and `MarketDataModule` can depend on it without depending on each other.
- Cross-cutting fan-out (market ticks, alert triggers) goes through Nest's `EventEmitter2` (`@OnEvent`/`emit`) rather than direct module imports, so `MarketDataModule`, `AlertEngineModule`, `NotificationsModule` and `WebsocketModule` stay decoupled from each other - each only knows about the event contracts in `market-data.events.ts` / `alert-engine.events.ts`.
- The JWT auth guard is registered globally (`APP_GUARD` in `AuthModule`) with an opt-out `@Public()` decorator, rather than applied per-route - the default is "every route requires auth," which is safer for a product where "a user must never access another user's alerts" is a hard requirement.

## Billing

No real Stripe integration in this pass. `Subscription.plan`/`maxActiveAlerts` and `SubscriptionsService.assertCanCreateAlert()` (the actual quota enforcement every alert-creating path calls) are fully real; `POST /subscription/checkout` is stubbed behind `ENABLE_MOCK_BILLING` so the frontend can exercise the full upgrade flow, with a real Stripe Checkout session creation swapped in later without touching the quota logic.

## What's deferred

- Real Twelve Data integration for gold/FX/indices (interface is ready; only the mock fallback is implemented).
- A true sliding window for `PCT_CHANGE_WINDOW` (currently tumbling, see above).
- Real Stripe billing (mock/stub only).
- Real PWA icon assets for web (currently one placeholder SVG) and app-store-ready native icons for mobile (currently the generic Expo template assets) - see each app's README.
- Native push delivery (FCM/APNs) for the mobile app - it currently shows local notifications only while foregrounded, driven by the same WebSocket event web uses for toasts. Wiring real push needs a Firebase project, an Apple Developer account, a device-token registration endpoint, and an FCM/APNs sender added to `NotificationsModule` alongside the existing web-push/email/Telegram/Discord channels - see `apps/mobile/README.md`.
- Google OAuth on mobile (needs `expo-auth-session` + a deep-link callback; email/password works fully) and watchlist drag-and-drop reorder on mobile.
- Alert templates (reusable checklist structures) and public alert sharing - noted in the spec, not yet built.
- Automated frontend/mobile tests (Playwright/Testing Library, or React Native Testing Library) - the backend's alert-engine suite is the one place automated tests were prioritized this pass.
- Consolidating `apps/web/src/lib/api` and `apps/mobile/src/lib/api` (currently hand-mirrored copies of the same request/response shapes) into a shared `packages/api-client`.
