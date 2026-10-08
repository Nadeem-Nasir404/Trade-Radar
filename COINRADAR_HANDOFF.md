# CoinRadar: project handoff

Everything built and fixed so far, how it's deployed, and what's still open. Hand this file to a new chat so it can pick up where the last one stopped.

Last updated: 8 Oct 2026. All work below is merged into `master` (PRs #1–#4).

---

## 1. What CoinRadar is

A crypto price-alert app with live charts, watchlists, a trade journal, and shareable P&L cards.

| Part | Path | Tech |
|---|---|---|
| API | `apps/api` | NestJS, Prisma (Postgres), Redis (ioredis), BullMQ queues |
| Mobile app | `apps/mobile` | Expo / React Native, expo-router, React Query, Zustand, Reanimated |
| Web app | `apps/web` | Next.js |
| Shared types | `packages/shared-types` | Plans, queue names, enums |

The monorepo uses pnpm workspaces (`pnpm-workspace.yaml`). The internal package names still use the old `@levelpulse/...` prefix.

---

## 2. Hosting and deployment

### API on Render (native Node runtime)
- **Build command:** `pnpm install --frozen-lockfile && pnpm --filter @levelpulse/shared-types build && pnpm --filter @levelpulse/api prisma:generate && pnpm --filter @levelpulse/api build`
- **Start command:** `pnpm --filter @levelpulse/api prisma:deploy && node apps/api/dist/src/main.js`
- `nest build` writes the entry file to `dist/src/main.js`, not `dist/main.js`. The `start` scripts were fixed to match.
- **Database:** Supabase Postgres (`ap-southeast-1`, Singapore pooler).
- **Redis:** Redis Cloud. The free plan allows 30 connections, and each API process uses about 8.

### Required Render environment variables
- `NODE_ENV=production`
- `ENABLE_MOCK_BILLING=false`. The API refuses to start in production if this is `true`, because it would let anyone upgrade for free.
- `DEMO_MODE=false`. If it's `true`, the API serves simulated prices instead of real ones.
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `MAGIC_LINK_SECRET`: long random values. Placeholders are rejected in production.
- `DATABASE_URL`, `REDIS_URL`, `CORS_ORIGIN`, `FRONTEND_URL`, `TRUST_PROXY`
- Optional:
  - `COINGECKO_API_KEY`: a free Demo key makes market caps reliable.
  - `TELEGRAM_BOT_TOKEN`
  - `SMTP_*`
  - `VAPID_*` (web push)
- The health check path should be `/health`. `/health/ready` also checks Redis and returns 503 when Redis is full.

### Mobile app (EAS)
- Expo project `9277bd9e-6a8b-41d5-8f9c-5c96da4beb97`. In Expo's GitHub settings the base directory is `apps/mobile`.
- Android package: `app.levelpulse.mobile`. This becomes permanent once uploaded to the Play Store, so rename it first if you want a different one.
- `eas.json` has two profiles:
  - `preview`: builds an APK, channel `preview`.
  - `production`: builds an AAB for the Play Store, channel `production`, with auto-incrementing version.
- `expo-updates` is installed (runtimeVersion uses the appVersion policy).
  - JS-only changes can ship with `eas update --channel preview`.
  - A new native package needs a full rebuild.
- Build commands:
  - `eas build -p android --profile preview` for an installable APK.
  - `eas build -p android --profile production` for the Play Store bundle.
- The app reads the server address from `EXPO_PUBLIC_API_URL` (e.g. `https://<service>.onrender.com/api/v1`) and `EXPO_PUBLIC_WS_URL`. Set them in `apps/mobile/.env` or in EAS environment variables. Without them, the app points at localhost.

---

## 3. Features (current state)

### Alerts
- Condition types:
  - Crosses above / crosses below
  - Above / below
  - Hits exactly
  - % change
  - Enters range / exits range
- Delivered by push (Expo), email, Telegram or Discord, chosen per alert.
- Each trigger is claimed atomically, so an alert can't fire twice or get lost.
- Alerts are evaluated on every Binance trade, not just the 1-second ticker.
- An alert whose level is already met fires the moment it's created. Alerts expire on their expiry date.
- The free plan allows 50 active alerts. Paid plans exist, but billing isn't connected yet (no Stripe).

### Charts (mobile and web)
- TradingView Lightweight Charts 5.2.1 runs inside a WebView, bundled offline.
- Timeframes: 1m, 3m, 5m, 15m, 1h, 4h, 1d, 1w.
- Only real exchange candles are shown, cached in Redis.
  - If Binance's main API is blocked, the server falls back to `data-api.binance.vision`.
- Live bars update with every tick, show spikes between screen updates, and display a countdown to the candle close.
- **+ alert button:**
  - Press and hold on the chart to show a line and a + badge that follow your finger, with a vibration when it appears.
  - Tap the + to open a popup for an alert at that price.
- **Alert lines:** drag one to move the alert, swipe it to delete.
- **Empty chart:** a "Set alert at current price" button.
- **Drawing tools:** trend line, level and zone, saved per coin. There's also a full-screen mode.

### Markets and watchlists
- Markets list can be sorted by market cap (from CoinGecko), top gainers, top losers, volume or A–Z.
- Watchlists have a Top gainers / Top losers filter and live rows.
- Search waits until you stop typing, keeps the previous results while loading, and uses virtualized lists.

### Trades and P&L cards
- **My Trades:** a trade journal with P&L.
- **P&L cards:** 1080×1350 images with one shared layout. Themes only change colours and artwork.
  - Each card shows the % and $ P&L figures, and the logo is tinted to match the theme.
  - Families, in picker order, are listed below.
  - Artwork follows the outcome: profit cards for wins, loss cards for losses. Tapping a family shuffles between its styles.
  - **Save** writes to the gallery (`expo-media-library/legacy`). **Share** opens the share sheet (`expo-sharing`) for X, Telegram and others.
  - Card art is drawn with React Native `Image` at an explicit size. Don't switch it to `expo-image`, whose hardware bitmaps break capturing the card as an image.
  - Art is generated by `compose-meme-cards.py` and `generate-card-art.py`.

| Family | Styles |
|---|---|
| Diamond Hands | wolf, wolfpen, wolfyacht, moneyrain, diamond |
| Gigachad | gigachad, bateman, gigaphone, gigadesk, stoic |
| Cartoons | patrick, peter, tom |
| Apu | feelsgood, apuyacht, apucandle, pepedump |
| Wojak | onepercent, wojak, rainy, fine |
| Stonks | stonks, catpump, printer, xmr, bogdanoff, bear |
| Anime | kurumi, atomic, atomicmoon (no Japanese text) |
| Aesthetic | moonlit, noir, blush |
| Minimal | minimal (glass style) |

### Design and UX
- Glass design throughout: blurred surfaces, a soft sheen, drifting background shapes, and a glass tab bar with a centre + button.
- Animations: list items fade in, buttons spring, screens slide between each other, and the tab bar shifts. Reduced-motion settings are respected.
- Fonts: Space Grotesk for numbers and headings, Manrope for body text, Plus Jakarta Sans for display text. Bold and other weights load the matching font file, so they look the same on Android and iOS.
- First-run onboarding, an alert-hit screen with go long / go short, and light and dark modes.
- The Profile screen ends with a "Made by Nad" footer linking to X (https://x.com/NadTrades_) and Discord (https://discord.gg/2w7puUZYY3).

### Security
- Rate limits, single-use magic links, detection of replayed refresh tokens (which revokes the user's sessions), suspension enforced on every sign-in path, and production-config checks at startup.

---

## 4. Recent fixes (7–8 Oct)

| Problem | Cause | Fix |
|---|---|---|
| Render deploy crashed with `ERR max number of clients reached` | Redis Cloud was full, and three code paths crashed on Redis errors: queue/worker errors with no listener, the startup alert-index rebuild, and the unhandled per-tick price write | Workers extend `ResilientWorkerHost`, queues get a `QueueErrorListener`, the alert-index rebuild retries in the background, and tick errors are caught. The API stays up and recovers by itself when Redis frees up (PR #3) |
| Deploy failed with `ENABLE_MOCK_BILLING` error | Env var set to `true` on Render | Set it to `false` on Render (config only, no code change) |
| Charts empty ("No price history") | The history request read the live price from Redis first, and returned 500 when Redis was full | History now looks the coin up in Postgres only (`findActiveBySymbol`) (PR #4) |
| Chart + did nothing | Old APK, plus no candles to read a price from | Working + since PR #2, and a "Set alert at current price" button on empty charts (PR #4) |
| Coin list slow | When CoinGecko rate-limited the server, every list request waited 2.5s | After a failure, the server waits 2 minutes before asking CoinGecko again, and calls time out after 8s (PR #4) |
| Creating an alert slow | Database checks ran one after another, and the form waited for the alert list to reload | Checks run in parallel, and the form closes as soon as the server confirms (PR #4) |
| Every app launch slow | Nothing was cached on the device | Coin list, watchlists and alerts are saved on the phone per user, deleted on logout, and ignored after 24h (`apps/mobile/src/lib/api/query-persistence.ts`) |
| Zoomed card images and failed saves in release builds | Image sizing and the media library API | RN `Image` at an explicit size, `expo-media-library/legacy` |
| EAS build failed | `expo-updates` missing | Added, with a `runtimeVersion` and channels in `eas.json` |

---

## 5. Open to-dos

1. **Change the Redis password.** It appeared in pasted Render logs. Update `REDIS_URL` on Render afterwards.
2. **Reduce Redis connections.** Point local dev at its own Redis (e.g. Docker `redis:7`), or upgrade the Redis Cloud plan.
3. **Rebuild the APK.** Every fix from 7–8 Oct needs a new build, because sharing added a native module.
4. **Check Render settings:**
   - The deploy shows **Live**.
   - Health check path is `/health`.
   - `DEMO_MODE=false`.
   - Region matches Supabase (Singapore).
   - The free plan sleeps when idle, so the first request after a break takes 30–60s.
5. **Play Store launch:**
   - Listing text (drafted earlier):
     - Title: "CoinRadar: Crypto Price Alerts"
     - Short description: "Crypto price alerts, live charts and shareable P&L cards. Never miss a move."
   - Things Play Console requires:
     - A privacy policy URL.
     - The Data safety form (email, account data, user-created alerts and trades).
     - The content rating questionnaire.
     - The financial features declaration (no trading or payments).
   - Upload the **AAB** from the `production` profile, not the APK.
   - New personal developer accounts must first run a closed test with 12 testers for 14 days.
   - Decide on the package name before the first upload.
6. **Billing:** there's no real payment system yet. The Upgrade button returns "Billing is not yet available" while mock billing is off.

---

## 6. How to check changes

**API** (`apps/api`):
```
npx tsc --noEmit -p .
pnpm test        # 63 tests
pnpm build
```

**Mobile** (`apps/mobile`):
```
npx tsc --noEmit
npx eslint .     # 0 errors, 1 old warning in _layout.tsx
EXPO_OFFLINE=1 CI=1 npx expo export --platform android --output-dir /tmp/expo-export
```

---

## 7. Conventions for future chats

- Work on a branch and open a PR into `master`. Merging to `master` makes Render redeploy.
- Commit messages explain why the change was made, and end with the attribution lines the session asks for.
- Never paste secrets (Redis URL, database URL, JWT secrets) into chats or logs.
