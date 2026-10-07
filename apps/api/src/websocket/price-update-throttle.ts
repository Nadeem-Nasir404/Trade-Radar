import type { PriceUpdateEvent } from "@levelpulse/shared-types";

interface InstrumentState {
  lastSentAt: number;
  lastSentPrice: number | null;
  pending: PriceUpdateEvent | null;
  timer: ReturnType<typeof setTimeout> | null;
  // Extremes of every trade since the last send, so the throttled stream doesn't drop spikes.
  windowHigh: number | null;
  windowLow: number | null;
  windowStartTime: number | null;
}

/**
 * The alert engine sees every trade, but clients only need to repaint a few times a second: busy
 * symbols trade dozens of times a second. Sends at most one update per interval per instrument -
 * the first immediately, the rest on the trailing edge so the latest price always arrives - and
 * each carries the high/low of all trades it stands for, so live bars keep every wick.
 */
export class PriceUpdateThrottle {
  private readonly states = new Map<string, InstrumentState>();

  constructor(
    private readonly send: (update: PriceUpdateEvent) => void,
    private readonly intervalMs: number,
  ) {}

  push(update: PriceUpdateEvent): void {
    let state = this.states.get(update.instrumentId);
    if (!state) {
      state = { lastSentAt: 0, lastSentPrice: null, pending: null, timer: null, windowHigh: null, windowLow: null, windowStartTime: null };
      this.states.set(update.instrumentId, state);
    }

    state.windowHigh = state.windowHigh === null ? update.price : Math.max(state.windowHigh, update.price);
    state.windowLow = state.windowLow === null ? update.price : Math.min(state.windowLow, update.price);
    state.windowStartTime ??= update.eventTime;

    const elapsed = Date.now() - state.lastSentAt;
    if (!state.timer && elapsed >= this.intervalMs) {
      this.flush(update, state);
      return;
    }
    state.pending = update;
    if (!state.timer) {
      const pendingState = state;
      state.timer = setTimeout(() => {
        pendingState.timer = null;
        if (pendingState.pending) this.flush(pendingState.pending, pendingState);
      }, this.intervalMs - elapsed);
    }
  }

  private flush(update: PriceUpdateEvent, state: InstrumentState) {
    const outgoing: PriceUpdateEvent = {
      ...update,
      // prevPrice relative to what clients last saw, so up/down flashes match the screen.
      prevPrice: state.lastSentPrice ?? update.prevPrice,
      windowHigh: state.windowHigh ?? update.price,
      windowLow: state.windowLow ?? update.price,
      windowStartTime: state.windowStartTime ?? update.eventTime,
    };
    state.lastSentAt = Date.now();
    state.lastSentPrice = update.price;
    state.pending = null;
    state.windowHigh = null;
    state.windowLow = null;
    state.windowStartTime = null;
    this.send(outgoing);
  }
}
