import AsyncStorage from "@react-native-async-storage/async-storage";
import { dehydrate, hydrate, type Query, type QueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../stores/auth-store";

/**
 * Keeps the last coin list, watchlists and alerts on the device, so screens open with them at once
 * on launch and refresh in the background, instead of waiting on the network every cold start.
 * Saved per user and wiped on sign-out.
 */
const STORAGE_KEY = "query-cache-v1";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SAVE_DELAY_MS = 2_000;
/** Android's AsyncStorage can't read back a single value much over 2MB; stay well under. */
const MAX_BYTES = 1_000_000;
const PERSISTED_ROOTS = new Set(["me", "subscription", "plans", "markets", "alerts", "alert-groups", "watchlists"]);

interface Saved {
  userId: string;
  savedAt: number;
  state: ReturnType<typeof dehydrate>;
}

function shouldPersist(query: Query): boolean {
  if (query.state.status !== "success") return false;
  const [root, second, third] = query.queryKey;
  if (!PERSISTED_ROOTS.has(String(root))) return false;
  // Candles are large and stale within minutes; searches are throwaway.
  if (third === "history") return false;
  if (root === "markets" && typeof second === "object" && second !== null && "search" in second && (second as { search?: string }).search) return false;
  return true;
}

/** Puts the saved cache for `userId` back into the client. Never throws; a bad or old save is ignored. */
export async function restoreQueryCache(client: QueryClient, userId: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as Saved;
    if (saved.userId !== userId || Date.now() - saved.savedAt > MAX_AGE_MS) return;
    // Restored data keeps its original timestamp, so it shows at once and is refetched as stale.
    hydrate(client, saved.state);
  } catch {
    // a corrupt save just means a normal cold load
  }
}

/** Saves the cache (debounced) while someone is signed in, and deletes it when they sign out. */
export function persistQueryCache(client: QueryClient): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const save = () => {
    timer = null;
    const user = useAuthStore.getState().user;
    if (!user) return;
    try {
      const body = JSON.stringify({ userId: user.id, savedAt: Date.now(), state: dehydrate(client, { shouldDehydrateQuery: shouldPersist }) } satisfies Saved);
      if (body.length > MAX_BYTES) return;
      AsyncStorage.setItem(STORAGE_KEY, body).catch(() => undefined);
    } catch {
      // skip this save; the next change tries again
    }
  };

  const unsubscribeCache = client.getQueryCache().subscribe((event) => {
    if (event.type !== "updated" || event.action.type !== "success") return;
    if (!timer) timer = setTimeout(save, SAVE_DELAY_MS);
  });

  const unsubscribeAuth = useAuthStore.subscribe((state, prev) => {
    if (state.status === "unauthenticated" && prev.status !== "unauthenticated") {
      if (timer) clearTimeout(timer);
      timer = null;
      AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
    }
  });

  return () => {
    unsubscribeCache();
    unsubscribeAuth();
    if (timer) clearTimeout(timer);
  };
}
