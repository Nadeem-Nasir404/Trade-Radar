"use client";

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

/** Latest price per instrument. Components select their own entry, so an update re-renders only what shows it. */
export const useLivePriceStore = create<LiveStore>((set) => ({
  byId: {},
  patch: (id, next) =>
    set((s) => {
      const prev = s.byId[id] ?? { price: null, prevPrice: null, changePct24h: null, feedStatus: "UNKNOWN" as const, eventTime: null };
      return { byId: { ...s.byId, [id]: { ...prev, ...next } } };
    }),
}));

// Exchange clock minus this browser's clock, from the latest update, so charts bucket live bars
// by exchange time even when the computer's clock is off.
let clockOffsetMs = 0;

/** Current time on the exchange's clock (ms epoch). */
export function exchangeNow(): number {
  return Date.now() + clockOffsetMs;
}

// One socket listener, one heartbeat, and one room subscription per instrument, shared by every
// component showing it. Reference counts mean one component unmounting can't unsubscribe another
// that still shows the same instrument, and every room is re-joined after a reconnect.
const refCounts = new Map<string, number>();
let boundSocket: Socket | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;

function emitSubscribe(socket: Socket, id: string) {
  socket.emit(WS_EVENTS.SUBSCRIBE_INSTRUMENT, { instrumentId: id });
}

function bind(): Socket {
  const socket = getSocket();
  if (socket === boundSocket) return socket;
  boundSocket = socket;

  socket.on(WS_EVENTS.PRICE_UPDATE, (payload: PriceUpdateEvent) => {
    if (payload.eventTime) clockOffsetMs = payload.eventTime - Date.now();
    useLivePriceStore.getState().patch(payload.instrumentId, {
      price: payload.price,
      prevPrice: payload.prevPrice,
      changePct24h: payload.changePct24h ?? useLivePriceStore.getState().byId[payload.instrumentId]?.changePct24h ?? null,
      feedStatus: "LIVE",
      eventTime: payload.eventTime ?? null,
    });
  });
  socket.on(WS_EVENTS.MARKET_STALE, (payload: MarketStaleEvent) => {
    useLivePriceStore.getState().patch(payload.instrumentId, { feedStatus: "STALE" });
  });
  socket.on(WS_EVENTS.MARKET_RESUMED, (payload: { instrumentId: string }) => {
    useLivePriceStore.getState().patch(payload.instrumentId, { feedStatus: "LIVE" });
  });
  // Socket.IO forgets room joins on every reconnect, so re-join everything still on screen.
  socket.on("connect", () => {
    refCounts.forEach((_, id) => emitSubscribe(socket, id));
  });

  if (!heartbeat) {
    heartbeat = setInterval(() => {
      const current = boundSocket;
      if (!current || !current.connected || refCounts.size === 0) return;
      current.emit(WS_EVENTS.HEARTBEAT, { instrumentIds: Array.from(refCounts.keys()) });
    }, HEARTBEAT_INTERVAL_MS);
  }
  return socket;
}

export function subscribeLivePrice(id: string): void {
  const count = refCounts.get(id) ?? 0;
  refCounts.set(id, count + 1);
  if (count > 0) return;
  emitSubscribe(bind(), id);
}

export function unsubscribeLivePrice(id: string): void {
  const count = refCounts.get(id) ?? 0;
  if (count > 1) {
    refCounts.set(id, count - 1);
    return;
  }
  refCounts.delete(id);
  bind().emit(WS_EVENTS.UNSUBSCRIBE_INSTRUMENT, { instrumentId: id });
}
