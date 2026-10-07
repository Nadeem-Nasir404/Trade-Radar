import { create } from "zustand";
import { WS_EVENTS, type PriceUpdateEvent, type MarketStaleEvent } from "@levelpulse/shared-types";
import type { Socket } from "socket.io-client";
import { getSocket } from "./socket";

export interface LivePriceState {
  price: number | null;
  prevPrice: number | null;
  changePct24h: number | null;
  feedStatus: "LIVE" | "STALE" | "UNKNOWN";
  /** Exchange time of the trade behind `price` (ms epoch), or null before the first live update. */
  eventTime: number | null;
}

const HEARTBEAT_INTERVAL_MS = 20_000;

interface LiveStore {
  byId: Record<string, LivePriceState>;
  patch: (id: string, next: Partial<LivePriceState>) => void;
}

/** Latest price per instrument. Components select their own entry, so a tick re-renders only that row. */
export const useLivePriceStore = create<LiveStore>((set) => ({
  byId: {},
  patch: (id, next) =>
    set((s) => {
      const prev = s.byId[id] ?? { price: null, prevPrice: null, changePct24h: null, feedStatus: "UNKNOWN" as const, eventTime: null };
      return { byId: { ...s.byId, [id]: { ...prev, ...next } } };
    }),
}));

// Exchange clock minus this device's clock, from the latest price update. Phones drift by
// seconds; charts bucket live bars by exchange time so bars open and close when the exchange's do.
let clockOffsetMs = 0;

/** Current time on the exchange's clock (ms epoch). */
export function exchangeNow(): number {
  return Date.now() + clockOffsetMs;
}

// One socket listener, one heartbeat, and one subscription per instrument, shared by every
// component that displays it - a 250-row list costs the same as a single row.
const refCounts = new Map<string, number>();
let boundSocket: Socket | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;

function emitSubscribe(socket: Socket, id: string) {
  socket.emit(WS_EVENTS.SUBSCRIBE_INSTRUMENT, { instrumentId: id });
}

async function bind(): Promise<Socket> {
  const socket = await getSocket();
  if (socket === boundSocket) return socket;
  boundSocket = socket;

  socket.on(WS_EVENTS.PRICE_UPDATE, (payload: PriceUpdateEvent) => {
    if (payload.eventTime) clockOffsetMs = payload.eventTime - Date.now();
    useLivePriceStore.getState().patch(payload.instrumentId, {
      eventTime: payload.eventTime ?? null,
      price: payload.price,
      prevPrice: payload.prevPrice,
      changePct24h: payload.changePct24h ?? useLivePriceStore.getState().byId[payload.instrumentId]?.changePct24h ?? null,
      feedStatus: "LIVE",
    });
  });
  socket.on(WS_EVENTS.MARKET_STALE, (payload: MarketStaleEvent) => {
    useLivePriceStore.getState().patch(payload.instrumentId, { feedStatus: "STALE" });
  });
  socket.on(WS_EVENTS.MARKET_RESUMED, (payload: { instrumentId: string }) => {
    useLivePriceStore.getState().patch(payload.instrumentId, { feedStatus: "LIVE" });
  });
  // Socket.IO forgets room joins on every reconnect, so re-subscribe everything we're showing.
  socket.on("connect", () => {
    refCounts.forEach((_, id) => emitSubscribe(socket, id));
  });

  refCounts.forEach((_, id) => emitSubscribe(socket, id));

  if (!heartbeat) {
    heartbeat = setInterval(() => {
      const current = boundSocket;
      if (!current || !current.connected || refCounts.size === 0) return;
      current.emit(WS_EVENTS.HEARTBEAT, { instrumentIds: Array.from(refCounts.keys()) });
    }, HEARTBEAT_INTERVAL_MS);
  }
  return socket;
}

export async function subscribeLivePrice(id: string): Promise<void> {
  const count = refCounts.get(id) ?? 0;
  refCounts.set(id, count + 1);
  if (count > 0) return;
  const socket = await bind();
  emitSubscribe(socket, id);
}

export async function unsubscribeLivePrice(id: string): Promise<void> {
  const count = refCounts.get(id) ?? 0;
  if (count > 1) {
    refCounts.set(id, count - 1);
    return;
  }
  refCounts.delete(id);
  const socket = await bind();
  socket.emit(WS_EVENTS.UNSUBSCRIBE_INSTRUMENT, { instrumentId: id });
}
