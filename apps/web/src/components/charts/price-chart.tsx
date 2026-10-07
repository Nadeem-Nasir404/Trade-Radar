"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle } from "@/lib/api/types";
import { exchangeNow, subscribeLivePrice, unsubscribeLivePrice, useLivePriceStore } from "@/lib/ws/live-price-store";

const TIMEFRAME_SECONDS: Record<string, number> = { "1m": 60, "3m": 180, "5m": 300, "15m": 900, "1h": 3600, "4h": 14_400, "1d": 86_400, "1w": 604_800 };

/** Wait after a bar closes before refetching, so the exchange has finalized that bar. */
const BAR_CLOSE_REFETCH_DELAY_MS = 1500;

export interface ChartAlertLevel {
  id: string;
  price: number;
  up: boolean;
}

interface PriceChartProps {
  candles: Candle[];
  /** Draws this instrument's live price into the current bar, straight from the live-price store. */
  instrumentId?: string;
  timeframe?: string;
  /** Called shortly after a bar closes, so the page can refetch history for the exchange's final OHLC. */
  onBarClose?: () => void;
  alertLevels?: ChartAlertLevel[];
  onPriceClick?: (price: number) => void;
  height?: number;
}

export function PriceChart({ candles, instrumentId, timeframe = "1h", onBarClose, alertLevels = [], onPriceClick, height = 420 }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const onPriceClickRef = useRef(onPriceClick);
  const onBarCloseRef = useRef(onBarClose);
  const lastBarRef = useRef<Candle | null>(null);
  const pushLiveRef = useRef<(() => void) | null>(null);
  const loadedViewRef = useRef<string | null>(null);
  useEffect(() => {
    onPriceClickRef.current = onPriceClick;
    onBarCloseRef.current = onBarClose;
  }, [onPriceClick, onBarClose]);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9598a3",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.08)" },
      timeScale: { borderColor: "rgba(255,255,255,0.08)", timeVisible: true },
      crosshair: { mode: 0 },
      autoSize: true,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#f43f5e",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#f43f5e",
    });

    chart.subscribeClick((param) => {
      if (!param.point || !seriesRef.current) return;
      const price = seriesRef.current.coordinateToPrice(param.point.y);
      if (price !== null && onPriceClickRef.current) onPriceClickRef.current(Number(price.toFixed(price < 10 ? 6 : 2)));
    });

    chartRef.current = chart;
    seriesRef.current = series;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current || candles.length === 0) return;
    // A refetch of the same series keeps the user's zoom and scroll; a new instrument or timeframe fits.
    const viewKey = `${instrumentId ?? ""}|${timeframe}`;
    const range = loadedViewRef.current === viewKey ? chartRef.current?.timeScale().getVisibleLogicalRange() : null;
    loadedViewRef.current = viewKey;
    seriesRef.current.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );
    lastBarRef.current = candles[candles.length - 1];
    if (range) chartRef.current?.timeScale().setVisibleLogicalRange(range);
    else chartRef.current?.timeScale().fitContent();
    // History can lag the live price by a moment - re-apply it so the live bar never blinks out.
    pushLiveRef.current?.();
  }, [candles, instrumentId, timeframe]);

  useEffect(() => {
    if (!instrumentId) return;
    subscribeLivePrice(instrumentId);
    const bucketSize = TIMEFRAME_SECONDS[timeframe] ?? 3600;
    let barCloseTimer: ReturnType<typeof setTimeout> | null = null;

    // Folds a price at an exchange time into the live bar, opening a new bar when the bucket
    // rolls over. Bars follow the exchange clock, not this computer's.
    const apply = (price: number, atMs: number) => {
      const last = lastBarRef.current;
      if (!last || !seriesRef.current) return;
      const bucket = Math.floor(atMs / 1000 / bucketSize) * bucketSize;
      if (bucket < last.time) return;
      let updated: Candle;
      if (bucket > last.time) {
        updated = { time: bucket, open: last.close, high: Math.max(last.close, price), low: Math.min(last.close, price), close: price };
        if (barCloseTimer) clearTimeout(barCloseTimer);
        barCloseTimer = setTimeout(() => onBarCloseRef.current?.(), BAR_CLOSE_REFETCH_DELAY_MS);
      } else {
        if (price === last.close && price <= last.high && price >= last.low) return;
        updated = { ...last, close: price, high: Math.max(last.high, price), low: Math.min(last.low, price) };
      }
      lastBarRef.current = updated;
      seriesRef.current.update({ time: updated.time as UTCTimestamp, open: updated.open, high: updated.high, low: updated.low, close: updated.close });
    };

    const pushLatest = () => {
      const entry = useLivePriceStore.getState().byId[instrumentId];
      if (entry?.price != null) apply(entry.price, entry.eventTime ?? exchangeNow());
    };
    pushLiveRef.current = pushLatest;
    pushLatest();

    const unsubscribeStore = useLivePriceStore.subscribe((state, prev) => {
      const entry = state.byId[instrumentId];
      if (!entry || entry === prev.byId[instrumentId] || entry.price == null) return;
      apply(entry.price, entry.eventTime ?? exchangeNow());
    });
    // Quiet markets: still open the next bar on time even when no trade arrives.
    const rollover = setInterval(() => {
      const last = lastBarRef.current;
      if (last && Math.floor(exchangeNow() / 1000 / bucketSize) * bucketSize > last.time) apply(last.close, exchangeNow());
    }, 1000);

    return () => {
      unsubscribeStore();
      clearInterval(rollover);
      if (barCloseTimer) clearTimeout(barCloseTimer);
      pushLiveRef.current = null;
      unsubscribeLivePrice(instrumentId);
    };
  }, [instrumentId, timeframe]);

  const alertLevelsKey = JSON.stringify(alertLevels);
  useEffect(() => {
    if (!seriesRef.current) return;
    priceLinesRef.current.forEach((line) => seriesRef.current?.removePriceLine(line));
    priceLinesRef.current = alertLevels.map((level) =>
      seriesRef.current!.createPriceLine({
        price: level.price,
        color: level.up ? "#22c55e" : "#f43f5e",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: "alert",
      }),
    );
    // Keyed on content: callers rebuild this array every render, and lines only need redrawing when they change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertLevelsKey]);

  return <div ref={containerRef} style={{ height }} className="w-full" />;
}
