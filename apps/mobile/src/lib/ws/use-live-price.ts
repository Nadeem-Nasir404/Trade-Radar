import { useEffect, useState } from "react";
import { WS_EVENTS, type PriceUpdateEvent, type MarketStaleEvent } from "@levelpulse/shared-types";
import { getSocket } from "./socket";

export interface LivePriceState {
  price: number | null;
  prevPrice: number | null;
  changePct24h: number | null;
  feedStatus: "LIVE" | "STALE" | "UNKNOWN";
}

const HEARTBEAT_INTERVAL_MS = 20_000;

export function useLivePrice(instrumentId: string | undefined, initial?: { price: number | null; changePct24h: number | null }) {
  const [state, setState] = useState<LivePriceState>({
    price: initial?.price ?? null,
    prevPrice: null,
    changePct24h: initial?.changePct24h ?? null,
    feedStatus: "UNKNOWN",
  });

  useEffect(() => {
    if (!instrumentId) return;
    let cancelled = false;
    let heartbeat: ReturnType<typeof setInterval> | undefined;

    const onPriceUpdate = (payload: PriceUpdateEvent) => {
      if (payload.instrumentId !== instrumentId) return;
      setState((prev) => ({
        price: payload.price,
        prevPrice: payload.prevPrice,
        changePct24h: payload.changePct24h ?? prev.changePct24h,
        feedStatus: "LIVE",
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
    // Socket.IO reconnects transparently after any drop (network blip, background/foreground,
    // Render cold start), but the server has no memory of a *previous* connection's room joins -
    // each reconnect is a brand new socket.id there. Without re-subscribing on every "connect",
    // a screen that was live before a drop just goes silent forever until it's unmounted and
    // remounted - this is what "chart/price gets stuck" actually was.
    const subscribe = (socket: Awaited<ReturnType<typeof getSocket>>) =>
      socket.emit(WS_EVENTS.SUBSCRIBE_INSTRUMENT, { instrumentId });

    let socketRef: Awaited<ReturnType<typeof getSocket>> | null = null;
    let onConnect: (() => void) | null = null;

    getSocket().then((socket) => {
      if (cancelled) return;
      socketRef = socket;
      socket.on(WS_EVENTS.PRICE_UPDATE, onPriceUpdate);
      socket.on(WS_EVENTS.MARKET_STALE, onStale);
      socket.on(WS_EVENTS.MARKET_RESUMED, onResumed);

      onConnect = () => subscribe(socket);
      socket.on("connect", onConnect);
      if (socket.connected) subscribe(socket);

      heartbeat = setInterval(() => {
        socket.emit(WS_EVENTS.HEARTBEAT, { instrumentIds: [instrumentId] });
      }, HEARTBEAT_INTERVAL_MS);
    });

    return () => {
      cancelled = true;
      if (heartbeat) clearInterval(heartbeat);
      if (socketRef) {
        socketRef.emit(WS_EVENTS.UNSUBSCRIBE_INSTRUMENT, { instrumentId });
        socketRef.off(WS_EVENTS.PRICE_UPDATE, onPriceUpdate);
        socketRef.off(WS_EVENTS.MARKET_STALE, onStale);
        socketRef.off(WS_EVENTS.MARKET_RESUMED, onResumed);
        if (onConnect) socketRef.off("connect", onConnect);
      }
    };
  }, [instrumentId]);

  return state;
}
