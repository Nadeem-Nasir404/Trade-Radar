"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  createTextWatermark,
  CandlestickSeries,
  HistogramSeries,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type ITextWatermarkPluginApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle } from "@/lib/api/types";
import { exchangeNow, subscribeLivePrice, unsubscribeLivePrice, useLivePriceStore, type LivePriceState } from "@/lib/ws/live-price-store";

const TIMEFRAME_SECONDS: Record<string, number> = { "1m": 60, "3m": 180, "5m": 300, "15m": 900, "1h": 3600, "4h": 14_400, "1d": 86_400, "1w": 604_800 };

interface LiveWindow {
  high: number;
  low: number;
  start: number;
}

function liveWindow(entry: LivePriceState): LiveWindow | undefined {
  if (entry.windowHigh == null || entry.windowLow == null || entry.windowStartTime == null) return undefined;
  return { high: entry.windowHigh, low: entry.windowLow, start: entry.windowStartTime };
}

const UP = "#22c55e";
const DOWN = "#f43f5e";

/** Decimals by magnitude, with thousands separators: 100,600.00 / 3.4512 / 0.000123. */
function formatPrice(n: number): string {
  const digits = n < 1 ? 6 : n < 100 ? 4 : 2;
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function formatCountdown(seconds: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(seconds / 3600);
  return `${h > 0 ? `${pad(h)}:` : ""}${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;
}

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
  /** Faint background label, e.g. "BTC/USDT · 1h". */
  watermark?: string;
  /** History is still loading - shows a loading state instead of an empty chart. */
  loading?: boolean;
}

export function PriceChart({
  candles,
  instrumentId,
  timeframe = "1h",
  onBarClose,
  alertLevels = [],
  onPriceClick,
  height = 420,
  watermark = "",
  loading = false,
}: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const watermarkRef = useRef<ITextWatermarkPluginApi<Time> | null>(null);
  const legendRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLDivElement>(null);
  const timeframeRef = useRef(timeframe);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const onPriceClickRef = useRef(onPriceClick);
  const onBarCloseRef = useRef(onBarClose);
  const lastBarRef = useRef<Candle | null>(null);
  const pushLiveRef = useRef<(() => void) | null>(null);
  const loadedViewRef = useRef<string | null>(null);
  const refreshOverlaysRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    onPriceClickRef.current = onPriceClick;
    onBarCloseRef.current = onBarClose;
    timeframeRef.current = timeframe;
  }, [onPriceClick, onBarClose, timeframe]);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#8b8fa3",
        fontSize: 12,
        fontFamily: "inherit",
        attributionLogo: false,
      },
      // Horizontal guides only: vertical lines add noise without helping read a level.
      grid: { vertLines: { visible: false }, horzLines: { color: "rgba(255,255,255,0.045)" } },
      rightPriceScale: { borderVisible: false, minimumWidth: 80 },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false, rightOffset: 8, barSpacing: 8 },
      crosshair: {
        mode: 0,
        vertLine: { width: 1, style: 3, color: "rgba(255,255,255,0.25)", labelBackgroundColor: "#2a2d3a" },
        horzLine: { width: 1, style: 3, color: "rgba(255,255,255,0.25)", labelBackgroundColor: "#6366f1" },
      },
      localization: { priceFormatter: formatPrice },
      autoSize: true,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      borderVisible: false,
      wickUpColor: UP,
      wickDownColor: DOWN,
      // The last-price tag (with the bar countdown) is drawn as an overlay below.
      lastValueVisible: false,
      priceLineStyle: 3,
      priceLineWidth: 1,
    });
    series.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.22 } });

    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    watermarkRef.current = createTextWatermark(chart.panes()[0], {
      horzAlign: "center",
      vertAlign: "center",
      lines: [{ text: "", color: "rgba(255,255,255,0.05)", fontSize: 40, fontStyle: "700" }],
    });

    // O/H/L/C of the hovered bar, or the live bar when the pointer is off the chart.
    const showLegend = (bar: { open: number; high: number; low: number; close: number } | null) => {
      const el = legendRef.current;
      if (!el) return;
      if (!bar) {
        el.style.opacity = "0";
        return;
      }
      const pct = bar.open ? ((bar.close - bar.open) / bar.open) * 100 : 0;
      const color = bar.close >= bar.open ? UP : DOWN;
      el.innerHTML = [["O", bar.open], ["H", bar.high], ["L", bar.low], ["C", bar.close]]
        .map(([label, value]) => `<span><b>${label}</b>${formatPrice(value as number)}</span>`)
        .concat(`<span>${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%</span>`)
        .join("");
      el.style.color = color;
      el.style.opacity = "1";
    };
    chart.subscribeCrosshairMove((param) => {
      const hovered = param.time ? (param.seriesData.get(series) as { open: number; high: number; low: number; close: number } | undefined) : undefined;
      showLegend(hovered ?? lastBarRef.current);
    });

    // Last price plus time left in the bar, as one tag on the price axis.
    const updateTag = () => {
      const el = tagRef.current;
      const last = lastBarRef.current;
      const y = last ? series.priceToCoordinate(last.close) : null;
      const width = chart.priceScale("right").width();
      if (!el || !last || y === null || !width) {
        if (el) el.style.opacity = "0";
        return;
      }
      const bucket = TIMEFRAME_SECONDS[timeframeRef.current] ?? 3600;
      const remaining = Math.max(0, last.time + bucket - Math.floor(exchangeNow() / 1000));
      el.innerHTML = `<div>${formatPrice(last.close)}</div><span>${formatCountdown(remaining)}</span>`;
      el.style.background = last.close >= last.open ? UP : DOWN;
      el.style.width = `${width}px`;
      el.style.top = `${y}px`;
      el.style.opacity = "1";
    };
    const tagTimer = setInterval(updateTag, 250);
    chart.timeScale().subscribeVisibleLogicalRangeChange(updateTag);
    refreshOverlaysRef.current = () => {
      updateTag();
      showLegend(lastBarRef.current);
    };

    chart.subscribeClick((param) => {
      if (!param.point || !seriesRef.current) return;
      const price = seriesRef.current.coordinateToPrice(param.point.y);
      if (price !== null && onPriceClickRef.current) onPriceClickRef.current(Number(price.toFixed(price < 10 ? 6 : 2)));
    });

    chartRef.current = chart;
    seriesRef.current = series;
    volumeRef.current = volume;

    return () => {
      clearInterval(tagTimer);
      refreshOverlaysRef.current = null;
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeRef.current = null;
      watermarkRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current) return;
    if (candles.length === 0) {
      // Another timeframe's bars must not linger under the loading or "no history" state.
      seriesRef.current.setData([]);
      volumeRef.current?.setData([]);
      lastBarRef.current = null;
      refreshOverlaysRef.current?.();
      return;
    }
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
    volumeRef.current?.setData(
      candles
        .filter((c) => c.volume != null)
        .map((c) => ({ time: c.time as UTCTimestamp, value: c.volume as number, color: (c.close >= c.open ? UP : DOWN) + "40" })),
    );
    lastBarRef.current = candles[candles.length - 1];
    if (range) chartRef.current?.timeScale().setVisibleLogicalRange(range);
    else chartRef.current?.timeScale().fitContent();
    // History can lag the live price by a moment - re-apply it so the live bar never blinks out.
    pushLiveRef.current?.();
    refreshOverlaysRef.current?.();
  }, [candles, instrumentId, timeframe]);

  useEffect(() => {
    watermarkRef.current?.applyOptions({ lines: [{ text: watermark, color: "rgba(255,255,255,0.05)", fontSize: 40, fontStyle: "700" }] });
  }, [watermark]);

  useEffect(() => {
    if (!instrumentId) return;
    subscribeLivePrice(instrumentId);
    const bucketSize = TIMEFRAME_SECONDS[timeframe] ?? 3600;
    let barCloseTimer: ReturnType<typeof setTimeout> | null = null;

    // Folds a price at an exchange time into the live bar, opening a new bar when the bucket
    // rolls over. Bars follow the exchange clock, not this computer's.
    const apply = (price: number, atMs: number, window?: LiveWindow) => {
      const last = lastBarRef.current;
      if (!last || !seriesRef.current) return;
      const bucket = Math.floor(atMs / 1000 / bucketSize) * bucketSize;
      if (bucket < last.time) return;
      // Spikes between sampled prices count toward this bar only if they all traded inside it.
      const inBar = window && Math.floor(window.start / 1000 / bucketSize) * bucketSize === bucket;
      const high = inBar ? Math.max(price, window.high) : price;
      const low = inBar ? Math.min(price, window.low) : price;
      let updated: Candle;
      if (bucket > last.time) {
        updated = { time: bucket, open: last.close, high: Math.max(last.close, high), low: Math.min(last.close, low), close: price };
        if (barCloseTimer) clearTimeout(barCloseTimer);
        barCloseTimer = setTimeout(() => onBarCloseRef.current?.(), BAR_CLOSE_REFETCH_DELAY_MS);
      } else {
        if (price === last.close && high <= last.high && low >= last.low) return;
        updated = { ...last, close: price, high: Math.max(last.high, high), low: Math.min(last.low, low) };
      }
      lastBarRef.current = updated;
      seriesRef.current.update({ time: updated.time as UTCTimestamp, open: updated.open, high: updated.high, low: updated.low, close: updated.close });
      refreshOverlaysRef.current?.();
    };

    const pushLatest = () => {
      const entry = useLivePriceStore.getState().byId[instrumentId];
      if (entry?.price != null) apply(entry.price, entry.eventTime ?? exchangeNow(), liveWindow(entry));
    };
    pushLiveRef.current = pushLatest;
    pushLatest();

    const unsubscribeStore = useLivePriceStore.subscribe((state, prev) => {
      const entry = state.byId[instrumentId];
      if (!entry || entry === prev.byId[instrumentId] || entry.price == null) return;
      apply(entry.price, entry.eventTime ?? exchangeNow(), liveWindow(entry));
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
        color: level.up ? UP : DOWN,
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: "\u{1F514}",
      }),
    );
    // Keyed on content: callers rebuild this array every render, and lines only need redrawing when they change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertLevelsKey]);

  return (
    <div className="relative w-full" style={{ height }}>
      <div ref={containerRef} className="h-full w-full" />
      <div
        ref={legendRef}
        className="pointer-events-none absolute left-2 top-2 z-10 flex flex-wrap gap-x-3 rounded-md bg-black/35 px-2 py-1 font-tabular text-xs font-medium opacity-0 backdrop-blur-sm transition-opacity [&_b]:mr-1 [&_b]:font-medium [&_b]:opacity-55"
      />
      <div
        ref={tagRef}
        className="pointer-events-none absolute right-0 z-10 -translate-y-1/2 rounded-l px-1.5 py-0.5 font-tabular text-xs font-semibold leading-tight text-white opacity-0 shadow-md [&_span]:block [&_span]:text-[11px] [&_span]:font-medium [&_span]:opacity-85"
      />
      {candles.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-foreground-subtle">
          {loading ? (
            <span className="size-5 animate-spin rounded-full border-2 border-foreground-subtle border-t-transparent" />
          ) : (
            // Charts only show real exchange data, so a market without history says so instead of drawing a blank grid.
            <span>No price history for this timeframe yet</span>
          )}
        </div>
      )}
    </div>
  );
}
