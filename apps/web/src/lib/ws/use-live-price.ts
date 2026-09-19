"use client";

import { useEffect, useState } from "react";
import { WS_EVENTS, type PriceUpdateEvent, type MarketStaleEvent } from "@levelpulse/shared-types";
import { getSocket } from "./socket";

export interface LivePriceState {
  price: number | null;
  prevPrice: number | null;
  changePct24h: number | null;
  feedStatus: "LIVE" | "STALE" | "UNKNOWN";
  eventTime: number | null;
}

const HEARTBEAT_INTERVAL_MS = 20_000;

/**
 * Joins the `instrument:{id}` room for live price updates for as long as this hook is mounted,
 * and leaves on unmount - this drives the server-side viewer refcount (see
 * SubscriptionRegistryService) that decides whether the market-data layer stays subscribed.
 */
export function useLivePrice(instrumentId: string | undefined, initial?: { price: number | null; changePct24h: number | null }) {
  const [state, setState] = useState<LivePriceState>({
    price: initial?.price ?? null,
    prevPrice: null,
    changePct24h: initial?.changePct24h ?? null,
    feedStatus: "UNKNOWN",
    eventTime: null,
  });
  useEffect(() => {
    if (!instrumentId) return;
    const socket = getSocket();

    const onPriceUpdate = (payload: PriceUpdateEvent) => {
      if (payload.instrumentId !== instrumentId) return;
      setState((prev) => ({
        price: payload.price,
        prevPrice: payload.prevPrice,
        changePct24h: payload.changePct24h ?? prev.changePct24h,
        feedStatus: "LIVE",
        eventTime: payload.eventTime,
      }));
    };
    const onStale = (payload: MarketStaleEvent) => {
      if (payload.instrumentId !== instrumentId) return;
      setState((prev) => ({ ...prev, feedStatus: "STALE" }));
    };
    const onResumed = (payload: { instrumentId: string }) => {
      if (payload.instrumentId !== instrumentId) return;
      setState((prev) => ({ ...prev, feedStatus: "LIVE" }));
    };

    socket.on(WS_EVENTS.PRICE_UPDATE, onPriceUpdate);
    socket.on(WS_EVENTS.MARKET_STALE, onStale);
    socket.on(WS_EVENTS.MARKET_RESUMED, onResumed);
    socket.emit(WS_EVENTS.SUBSCRIBE_INSTRUMENT, { instrumentId });

    const heartbeat = setInterval(() => {
      socket.emit(WS_EVENTS.HEARTBEAT, { instrumentIds: [instrumentId] });
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      clearInterval(heartbeat);
      socket.emit(WS_EVENTS.UNSUBSCRIBE_INSTRUMENT, { instrumentId });
      socket.off(WS_EVENTS.PRICE_UPDATE, onPriceUpdate);
      socket.off(WS_EVENTS.MARKET_STALE, onStale);
      socket.off(WS_EVENTS.MARKET_RESUMED, onResumed);
    };
  }, [instrumentId]);

  return state;
}
