# LevelPulse Mobile

Expo Router / React Native app. Talks to the exact same NestJS API as `apps/web` - same auth,
same alert engine, same WebSocket gateway - via bearer-token auth (native has no cookie jar, so
`apps/api`'s auth endpoints return tokens in the JSON body too, stored here in
`expo-secure-store`; see `ARCHITECTURE.md` at the repo root).

## Setup

```bash
pnpm install            # from the repo root
cd apps/mobile
cp .env.example .env    # already done for you with localhost defaults - READ THE CAVEAT BELOW
pnpm start
```

Then press `a` for Android, `i` for iOS (macOS only), or scan the QR code with Expo Go on a
physical device.

### The "localhost" caveat

`.env`'s `EXPO_PUBLIC_API_URL`/`EXPO_PUBLIC_WS_URL` point at `localhost:4000`, which means a
different machine depending on where the app runs:

| Target | Host to use |
|---|---|
| iOS Simulator | `localhost` (works as-is) |
| Android Emulator | `10.0.2.2` (the emulator's alias for your host machine) |
| Physical device (Expo Go) | Your computer's LAN IP, e.g. `192.168.1.20` - and the device must be on the same network |

If you're not on the iOS Simulator, edit `.env` accordingly before starting.

## What's built

- Auth: email/password login and registration (bearer tokens in `expo-secure-store`, auto-refresh on 401).
- Tabs: Home (dashboard), Markets (list + detail with a live price and a lightweight SVG sparkline chart), Alerts (filterable list), Watchlists, Profile.
- Create Alert: a modal reachable from the tab bar's center FAB or from a market detail screen, with a market picker and the same condition-builder concept as web (chip-based condition/channel selection).
- Live prices and alert-triggered notifications over the same Socket.IO gateway as web.

## Known gaps vs. the web app (by design, not oversight)

- **Google OAuth** isn't wired up on mobile - it needs an in-app browser + deep-link callback flow (`expo-auth-session`) that wasn't in scope for this pass. Email/password works fully.
- **Chart interactivity**: web's Lightweight Charts candlestick view with click-to-set-an-alert-at-that-price doesn't have a native RN equivalent in this stack. Mobile shows a simpler SVG line sparkline with alert levels overlaid as dashed lines; creating an alert is a market-picker + typed price instead of a chart tap.
- **Push notifications are stubbed.** While the app is open, an `alert:triggered` WebSocket event shows a local notification via `expo-notifications`. Real background/killed-app delivery needs:
  1. A Firebase project (FCM) for Android push.
  2. An Apple Developer account + APNs key for iOS push.
  3. Registering each device's push token with the backend (a `PushSubscription`-equivalent table/endpoint for native tokens, separate from the web-push `PushSubscription` model which is browser-specific) and having `NotificationsModule`'s dispatch logic send through FCM/APNs alongside the existing web-push/email/Telegram/Discord channels.

  None of this can be wired up without real credentials only you can provide - it's a clean, isolated next step once you have them.
- **Watchlist drag-and-drop reorder** (web has this) isn't implemented on mobile in this pass.
- **Admin panel** isn't built for mobile - it's a desktop-oriented surface and the web admin panel covers it.

## Building for real devices / app stores

This pass only covers local development via Expo Go / dev client. Producing installable builds
uses [EAS Build](https://docs.expo.dev/build/introduction/) (`eas build --platform android` /
`--platform ios`), which needs an Expo account and, for iOS, an Apple Developer account - neither
configured here.
