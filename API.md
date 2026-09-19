# LevelPulse API Reference

Base URL: `http://localhost:4000/api/v1` (configurable via `API_PREFIX`/`PORT`). WebSocket: `ws://localhost:4000/ws`.

Auth: JWT access/refresh tokens, supported two ways simultaneously:
- **Web**: httpOnly cookies (`lp_access_token`, `lp_refresh_token`), set automatically by the auth endpoints below.
- **Mobile/native**: every token-issuing endpoint (register/login/refresh/magic-link-verify) also returns `{accessToken, refreshToken}` in the JSON body, since native clients have no cookie jar. Store them (e.g. `expo-secure-store`) and send `Authorization: Bearer <accessToken>` on subsequent requests; `/auth/refresh` and `/auth/logout` accept `{refreshToken}` in the body as an alternative to the cookie.

Every route requires authentication by default except those marked **Public**. All request/response bodies are JSON.

## Auth (`/auth`)

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register` | **Public**. `{email, password, name?}` → creates user + FREE subscription, returns `{user, accessToken, refreshToken}`, sets cookies |
| POST | `/auth/login` | **Public**. `{email, password}` → same response shape as register |
| POST | `/auth/refresh` | **Public**. `{refreshToken?}` (mobile) or cookie (web). Rotates the refresh token (reuse detection revokes all sessions) |
| POST | `/auth/logout` | `{refreshToken?}` (mobile) or cookie (web). Revokes the current session, clears cookies |
| GET | `/auth/me` | Returns `{id, email, role}` from the access token |
| GET | `/auth/google` | **Public**. Redirects to Google OAuth. Web only - see ARCHITECTURE.md for the mobile gap |
| GET | `/auth/google/callback` | **Public**. Sets cookies, redirects to `FRONTEND_URL/dashboard` |
| POST | `/auth/magic-link/request` | **Public**. `{email}` → emails a sign-in link |
| POST | `/auth/magic-link/verify` | **Public**. `{token}` → same response shape as register |

## Users (`/users`)

| Method | Path | Notes |
|---|---|---|
| GET | `/users/me` | Full profile (password hash stripped) |
| PATCH | `/users/me` | `{name?, timezone?, currency?}` |
| PATCH | `/users/me/settings` | `{theme?, defaultChartInterval?, emailDigestEnabled?, soundEnabled?}` |
| GET | `/users/me/subscription` | Current plan + quota |

## Subscription (`/subscription`)

| Method | Path | Notes |
|---|---|---|
| GET | `/subscription` | Current plan, status, `maxActiveAlerts` |
| GET | `/subscription/plans` | **Public**. The FREE/PRO/MAX catalog (limits + features) |
| POST | `/subscription/checkout` | `{plan}`. Stubbed - only works if `ENABLE_MOCK_BILLING=true`, instantly switches plan |

## Markets (`/markets`)

| Method | Path | Notes |
|---|---|---|
| GET | `/markets` | **Public**. `?assetType=&search=&limit=`. Merges live Redis price snapshot with Postgres metadata |
| GET | `/markets/discover` | **Public**. `?q=`. Proxies CoinGecko `/search` for coin discovery |
| GET | `/markets/:symbol` | **Public**. Single instrument, live price, `feedStatus`, `isDemo` |
| GET | `/markets/:symbol/history` | **Public**. `?timeframe=1m\|5m\|15m\|1h\|4h\|1d\|1w`. OHLCV candles |

## Alerts (`/alerts`)

| Method | Path | Notes |
|---|---|---|
| GET | `/alerts` | `?status=&assetType=&search=&sort=recent\|nearest\|recently_triggered\|asset&alertGroupId=` |
| POST | `/alerts` | Create. See `CreateAlertDto` - `instrumentId`, `conditionType`, `targetValue`, `secondaryValue?` (range upper bound), `timeframe?`, `isRecurring?`, `cooldownSeconds?`, `expiresAt?`, `notes?`, `tags?`, `channels?: [{channelType, isEnabled}]`. 403 if over plan quota. |
| GET | `/alerts/:id` | Includes `currentPrice`, `distancePct` |
| PATCH | `/alerts/:id` | Partial update; re-indexes in Redis if `targetValue`/`secondaryValue` changes |
| DELETE | `/alerts/:id` | 204 |
| POST | `/alerts/:id/pause` | |
| POST | `/alerts/:id/resume` | 403 if resuming would exceed plan quota |
| POST | `/alerts/:id/clone` | Duplicates condition/target/channels onto a new alert |
| GET | `/alerts/groups` | List with alert counts |
| POST | `/alerts/groups` | `{name}` |
| POST | `/alerts/groups/:id/pause` | Pauses every active alert in the group |
| POST | `/alerts/groups/:id/resume` | Resumes every paused alert in the group (quota-checked per alert) |

`conditionType` values: `ABOVE`, `BELOW`, `CROSSES_ABOVE`, `CROSSES_BELOW`, `ENTERS_RANGE`, `EXITS_RANGE`, `EQUALS`, `PCT_CHANGE`, `PCT_CHANGE_WINDOW`.

## Alert history (`/alert-events`)

| Method | Path | Notes |
|---|---|---|
| GET | `/alert-events` | `?instrumentId=&alertId=&cursor=&limit=`. Cursor-paginated, includes notification delivery status per event |
| GET | `/alert-events/:id` | Single event with full delivery breakdown |

## Watchlists (`/watchlists`)

| Method | Path | Notes |
|---|---|---|
| GET | `/watchlists` | Includes live price, 24h change, alert count per item |
| POST | `/watchlists` | `{name}`. 403 if over plan quota |
| DELETE | `/watchlists/:id` | 204 |
| POST | `/watchlists/:id/items` | `{instrumentId}` |
| DELETE | `/watchlists/:id/items/:itemId` | 204 |
| POST | `/watchlists/:id/reorder` | `{itemIdsInOrder: string[]}` - drag-and-drop persistence |

## Notifications (`/notifications`)

| Method | Path | Notes |
|---|---|---|
| GET | `/notifications/channels` | List connected channels |
| GET | `/notifications/webpush/vapid-public-key` | **Public**. For the browser's `PushManager.subscribe()` |
| POST | `/notifications/webpush/subscribe` | `{endpoint, keys: {p256dh, auth}}` |
| POST | `/notifications/webpush/unsubscribe` | `{endpoint}` |
| POST | `/notifications/discord/connect` | `{webhookUrl}` |
| POST | `/notifications/email/toggle` | `{isEnabled}` |
| POST | `/notifications/telegram/link` | Returns `{code, deepLink}` - user sends `/start <code>` to the bot |
| POST | `/notifications/telegram/webhook` | **Public**. Telegram calls this (needs a public HTTPS URL registered with the bot) |
| DELETE | `/notifications/channels/:type` | 204 |
| POST | `/notifications/test` | `{channelType}` - sends a synthetic test notification |

## Admin (`/admin`, requires `role: ADMIN`)

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/dashboard` | Totals, provider health, BullMQ queue depths |
| GET | `/admin/users` | `?search=` |
| PATCH | `/admin/users/:id/suspend` | `{reason}` |
| PATCH | `/admin/users/:id/unsuspend` | |
| GET | `/admin/providers` | |
| PATCH | `/admin/providers/:id` | `{isEnabled}` |
| GET | `/admin/instruments` | |
| PATCH | `/admin/instruments/:id` | `{isActive}` |
| GET | `/admin/notifications/failed` | Last 100 failed deliveries |
| GET | `/admin/logs` | Last 200 `SystemEvent` rows |

## Health (`/health`, `/health/ready`)

**Public**, outside the `/api/v1` prefix. `@nestjs/terminus` checks against Postgres and Redis.

## WebSocket (`/ws` namespace)

Auth via `socket.handshake.auth.token` or the `lp_access_token` cookie. Every connection auto-joins `user:{userId}`.

Client → server: `subscribe:instrument {instrumentId}`, `unsubscribe:instrument {instrumentId}`, `heartbeat {instrumentIds: string[]}` (keeps the server-side viewer refcount alive - see ARCHITECTURE.md).

Server → client (only to rooms that asked for them, never a raw tick firehose): `price:update`, `market:stale`, `market:resumed`, `alert:triggered` (to `user:{userId}`), `alert:status-changed`.
