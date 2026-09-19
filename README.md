# LevelPulse

Real-time multi-market price-alert platform. **Set every level. Miss nothing.**

LevelPulse lets traders run hundreds of active price alerts across crypto (and eventually gold/FX/indices) without the tiny alert caps most trading platforms impose. A single market-data subscription per instrument feeds a Redis-backed alert engine capable of evaluating thousands of conditions per tick; triggers fan out through BullMQ to email, browser push, Telegram and Discord.

## Monorepo layout

```
apps/
  api/    NestJS backend - auth, market data, alert engine, notifications, admin API
  web/    Next.js frontend (marketing site + app)
  mobile/ Expo/React Native app (Expo Router)
packages/
  shared-types/  enums, DTO/WS contracts, plan limits, queue names shared by every app
docker/          optional Dockerfiles + docker-compose.yml (see "Running with Docker" below)
```

## Status

- **Backend (`apps/api`)**: complete for this pass - auth (email/password, Google OAuth, magic link), users, plan-gated subscriptions (no real Stripe yet, see below), instruments + CoinGecko discovery, market data (Binance WebSocket + a Mock provider for zero-key demo mode), the alert engine (crossing detection, all 9 condition types, idempotent triggers), notifications (email/web push/Telegram/Discord), alert history, watchlists, admin API, WebSocket gateway for live prices. Typechecks, lints and builds clean; the alert engine has a full Jest suite (`apps/api/src/alert-engine/alert-engine.service.spec.ts`).
- **Frontend (`apps/web`)**: complete for this pass - glassmorphic dark design system, marketing site (hero/problem-solution/how-it-works/features/pricing with the capacity calculator), email+Google+magic-link auth, dashboard, market detail pages with a live Lightweight Charts chart and click-to-create-alert, full alert CRUD (condition builder, pause/resume/clone/groups/history), watchlists with drag-and-drop, Level Map heatmap, notification-channel settings, billing (mock checkout), admin panel, live prices and alert-triggered toasts over WebSocket, PWA manifest + service worker (icons are a placeholder SVG - see note below). Typechecks, lints and production-builds clean.
- **Mobile (`apps/mobile`)**: complete for this pass - Expo Router app hitting the same API (bearer-token auth via `expo-secure-store` instead of cookies, since native has no cookie jar). Auth (email/password), tab navigation (Home/Markets/Alerts/Watchlists/Profile), market list + detail with a live price and an SVG sparkline chart, alert creation via a modal + market picker, live prices and alert-triggered local notifications over the same WebSocket gateway. Typechecks and lints clean, and the Metro bundle builds successfully (2000+ modules, zero errors). See `apps/mobile/README.md` for its specific setup notes and known gaps (Google OAuth, real background push via FCM/APNs, watchlist drag-and-drop, and admin are intentionally out of scope for mobile this pass).

### Known frontend gaps
- PWA icons are a single placeholder SVG (`public/icon.svg`); real PNG icon sizes (192/512/maskable) should be generated before shipping to app-install surfaces that require them.
- No automated frontend test suite yet (backend has the full alert-engine Jest suite; frontend testing - Playwright/Testing Library - wasn't in scope for this pass).
- Mobile push notifications only work while the app is foregrounded (local notifications triggered by the WebSocket event). Real background/killed-app delivery needs real Firebase (FCM) and Apple Developer (APNs) credentials - see `apps/mobile/README.md`.

See `ARCHITECTURE.md` for how the pieces fit together and what's intentionally deferred.

## Prerequisites

- Node.js 20+ (developed against Node 24)
- pnpm (`corepack enable && corepack prepare pnpm@latest --activate`, or `npm i -g pnpm`)
- A local PostgreSQL instance (or a free-tier hosted one - Supabase, Neon, Railway all work)
- A local Redis instance (or a free-tier hosted one - Upstash, Redis Cloud)

Nothing else is required to run the backend in **demo mode**: `DEMO_MODE=true` (the default in `.env.example`) serves simulated BTC/ETH/SOL/XAU price movement instead of hitting Binance, so the whole alert pipeline works with zero external API keys.

## Local setup

```bash
# 1. Install dependencies
pnpm install

# 2. Configure the backend
cd apps/api
cp .env.example .env          # already done for you in this repo with local defaults + generated secrets
# edit DATABASE_URL / REDIS_URL if your Postgres/Redis aren't at the localhost defaults

# 3. Create the database schema and seed demo data
pnpm prisma:migrate           # creates the levelpulse database schema
pnpm prisma:seed              # demo user (demo@levelpulse.app / demo1234), instruments, sample alerts

# 4. Run the backend
pnpm dev                      # http://localhost:4000/api/v1, WS at /ws

# 5. In a second terminal, run the frontend
cd apps/web
cp .env.local.example .env.local   # already done for you with local defaults
pnpm dev                            # http://localhost:3000

# 6. Optionally, in a third terminal, run the mobile app
cd apps/mobile
cp .env.example .env                # already done for you - READ apps/mobile/README.md's
                                     # "localhost" caveat if using an emulator or physical device
pnpm start
```

From the repo root, `pnpm dev` (via Turborepo) starts both `apps/api` and `apps/web` in parallel (mobile isn't part of that pipeline - Expo's dev server has its own interactive CLI, run it separately per step 6). Log in with the seeded demo account (see below), or register a new one - registration works with zero external configuration on both web and mobile.

### Going live with real Binance data

Set `DEMO_MODE=false` in `apps/api/.env`. Binance's public market-data WebSocket streams need no API key - the app will connect directly. Gold/FX/indices remain on the mock provider regardless of `DEMO_MODE` until a Twelve Data integration is added (see ARCHITECTURE.md).

### Notifications in dev

- **Email**: leave `SMTP_HOST` unset and the app auto-creates an Ethereal test inbox; preview links are logged to the console on every send.
- **Web push**: generate VAPID keys with `npx web-push generate-vapid-keys` and set `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`.
- **Telegram**: create a bot via [@BotFather](https://t.me/BotFather), set `TELEGRAM_BOT_TOKEN`. The link flow (`POST /api/v1/notifications/telegram/link`) needs the bot's webhook pointed at `POST /api/v1/notifications/telegram/webhook`, which requires a public HTTPS URL (e.g. via ngrok in dev).
- **Discord**: no server-side config needed - users paste a webhook URL they create in their own Discord server.

## Running with Docker

Docker is **not** the primary dev workflow for this project (Postgres/Redis run natively per above), but `docker/docker-compose.yml` is provided for anyone who prefers containers or wants a simple self-hosted deployment:

```bash
cd docker
docker compose up --build
```

## Testing

```bash
cd apps/api
pnpm test          # unit tests, including the full alert-engine crossing-logic suite
pnpm test:cov       # with coverage
```

The alert engine's tests (`src/alert-engine/alert-engine.service.spec.ts` and `src/market-data/price-cache/price-cache.service.spec.ts`) run against `ioredis-mock`, exercising: single-trigger-on-crossing, a price jump that skips clean over the target, duplicate/out-of-order/replayed ticks, multiple alerts and multiple users on the same instrument, paused/expired/cooldown-recurring alerts, and range enter/exit vs sitting-inside no-ops. This is deliberately the most heavily tested part of the codebase, per the product's core promise.

## Documentation

- `ARCHITECTURE.md` - system design, the alert-engine algorithm, Redis key layout, known simplifications
- `API.md` - REST endpoint reference
- `apps/api/.env.example` - every backend environment variable, documented

## Demo login

After seeding: **demo@levelpulse.app** / **demo1234** (Pro plan, a default watchlist, and a few sample alerts on BTC/ETH/XAU).
