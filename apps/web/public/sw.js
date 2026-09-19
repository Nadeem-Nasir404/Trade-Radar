// Minimal service worker: enables Web Push (the core requirement) and a light app-shell cache
// for PWA installability. Not a full offline-first strategy - LevelPulse's data is inherently
// real-time, so aggressive caching of API responses would be actively misleading.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "LevelPulse", body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "LevelPulse", {
      body: payload.body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      data: { url: payload.url ?? "/alerts" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/alerts";
  event.waitUntil(self.clients.openWindow(url));
});
