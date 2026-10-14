import type { DrawTool } from "./drawing-tools";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/themed-text";
import { Button } from "@/components/ui/button";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { useTheme } from "@/lib/use-theme";
import { radius } from "@/lib/theme";
import type { Candle } from "@/lib/api/types";
import { bucketStart, TIMEFRAME_SECONDS } from "@/lib/timeframe";
import { CANDLE_PALETTES, useChartSettings } from "@/lib/stores/chart-settings-store";
import { useDrawingsStore, type Drawing } from "@/lib/stores/drawings-store";
import { exchangeNow, subscribeLivePrice, unsubscribeLivePrice, useLivePriceStore, type LivePriceState } from "@/lib/ws/live-price-store";
import { LIGHTWEIGHT_CHARTS_SOURCE } from "./chart-lib.generated";
import { haptics } from "@/lib/haptics";
import type { ChartAlertLevel } from "@/lib/alert-lines";

export type { ChartAlertLevel } from "@/lib/alert-lines";

export type { DrawTool };

export interface TradingChartHandle {
  clearDrawings: () => void;
  /** Removes the most recent drawing. */
  undoDrawing: () => void;
}

interface TradingChartProps {
  candles: Candle[];
  /** Live prices for this instrument are read from the shared live-price store and drawn straight into the chart, without re-rendering the screen. */
  instrumentId?: string;
  /** Called shortly after a bar closes, so the screen can refetch history for the exchange's final OHLC. */
  onBarClose?: () => void;
  /** Called with the live (last) bar whenever it changes - e.g. for an O/H/L/C legend. */
  onLiveBar?: (bar: Candle) => void;
  /** Faint background label, e.g. "BTC/USDT · 1h". */
  watermark?: string;
  /** History is still loading - shows a loading state instead of an empty chart. */
  loading?: boolean;
  /** The history request failed (it is being retried) - says so instead of "no history". */
  failed?: boolean;
  /** Price used for the "set alert" action when there are no candles to tap (the live price wins). */
  fallbackPrice?: number | null;
  alertLevels?: ChartAlertLevel[];
  height?: number;
  onPriceTap?: (price: number) => void;
  /** An alert line was dragged to a new price (only levels marked draggable). */
  onAlertMove?: (alertId: string, price: number) => void;
  /** An alert line was swiped off to the left. */
  onAlertDelete?: (alertId: string) => void;
  onDrawStage?: (stage: "start" | "end") => void;
  /** A shape was finished - the screen goes back to the cursor, as TradingView does. */
  onDrawDone?: () => void;
  timeframe?: string;
  /** Changes when the instrument or timeframe changes, so the view resets instead of preserving zoom. */
  viewKey?: string;
  drawMode?: boolean;
  drawTool?: DrawTool;
  /** Drawings are stored per instrument, so every chart for that symbol shows the same ones. */
  drawingsKey?: string;
}

/**
 * TradingView's lightweight-charts engine inside a WebView. React drives the chart through
 * injected calls to globals the page exposes; the page posts back only taps, draw-stage hints,
 * and readiness. Candles refresh without resetting the user's zoom, and live ticks roll into a
 * new bar as each timeframe bucket starts.
 */
export const TradingChart = forwardRef<TradingChartHandle, TradingChartProps>(function TradingChart(
  { candles, instrumentId, onBarClose, onLiveBar, watermark = "", loading = false, failed = false, fallbackPrice = null, alertLevels = [], height = 260, onPriceTap, onAlertMove, onAlertDelete, onDrawStage, onDrawDone, timeframe = "1h", viewKey, drawMode = false, drawTool = "trend", drawingsKey = "default" },
  ref,
) {
  // isDark is the theme actually showing; `mode` is the user's setting and can be "system".
  const { colors, isDark } = useTheme();
  const settings = useChartSettings();
  const webviewRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const lastCandleRef = useRef<Candle | null>(null);
  const pushLiveRef = useRef<(() => void) | null>(null);
  const onBarCloseRef = useRef(onBarClose);
  const onLiveBarRef = useRef(onLiveBar);
  onBarCloseRef.current = onBarClose;
  onLiveBarRef.current = onLiveBar;
  const sentAlertLevelsRef = useRef<string | null>(null);
  const loadedViewKeyRef = useRef<string | null>(null);

  const html = useMemo(() => buildChartHtml(), []);

  const drawings = useDrawingsStore((st) => st.bySymbol[drawingsKey] ?? EMPTY_DRAWINGS);

  useImperativeHandle(ref, () => ({
    clearDrawings: () => {
      useDrawingsStore.getState().clear(drawingsKey);
    },
    undoDrawing: () => {
      useDrawingsStore.getState().removeLast(drawingsKey);
    },
  }));

  const theme = {
    background: colors.background,
    textColor: colors.foregroundSubtle,
    gridColor: isDark ? "rgba(255,255,255,0.045)" : "rgba(0,0,0,0.06)",
    borderColor: colors.glassBorder,
    crosshairColor: colors.foregroundMuted,
    brand: colors.brand,
    brandForeground: colors.brandForeground,
    labelBackground: isDark ? "#2a2d3a" : "#4b5563",
    watermarkColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)",
    legendBackground: isDark ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.75)",
  };

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === "ready") setReady(true);
      else if (msg.type === "plusShown" || msg.type === "alertGrab") haptics.selection();
      else if (msg.type === "alertDeleteArmed") (msg.armed ? haptics.warning : haptics.selection)();
      else if (msg.type === "alertMove") {
        haptics.success();
        onAlertMove?.(msg.id, msg.price);
      } else if (msg.type === "alertDelete") {
        haptics.medium();
        onAlertDelete?.(msg.id);
      }
      else if (msg.type === "priceTap") {
        haptics.medium();
        onPriceTap?.(msg.price);
      }
      else if (msg.type === "drawHint") onDrawStage?.(msg.stage);
      else if (msg.type === "drawDone") {
        haptics.success();
        onDrawDone?.();
      }
      else if (msg.type === "drawingAdded") useDrawingsStore.getState().add(drawingsKey, msg.drawing as Drawing);
    } catch {
      // ignore malformed messages
    }
  };

  useEffect(() => {
    if (!ready) return;
    webviewRef.current?.injectJavaScript(`window.applyTheme(${JSON.stringify(theme)}); true;`);
    // theme fields are primitives derived fresh each render - safe to depend on the object itself
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, colors, isDark]);

  useEffect(() => {
    if (!ready) return;
    const palette = CANDLE_PALETTES[settings.palette] ?? CANDLE_PALETTES.classic;
    const payload = {
      up: palette.up,
      down: palette.down,
      grid: settings.showGrid,
      volume: settings.showVolume,
      wicks: settings.showWicks,
    };
    webviewRef.current?.injectJavaScript(`window.applySettings(${JSON.stringify(payload)}); true;`);
  }, [ready, settings.palette, settings.showGrid, settings.showVolume, settings.showWicks]);

  useEffect(() => {
    if (!ready) return;
    if (candles.length === 0) {
      // Another timeframe's bars must not linger under the loading or "no history" state.
      lastCandleRef.current = null;
      webviewRef.current?.injectJavaScript(`window.setCandles([], false); true;`);
      return;
    }
    const keepView = loadedViewKeyRef.current === (viewKey ?? timeframe);
    loadedViewKeyRef.current = viewKey ?? timeframe;
    lastCandleRef.current = candles[candles.length - 1] ?? null;
    webviewRef.current?.injectJavaScript(`window.setCandles(${JSON.stringify(candles)}, ${keepView}); true;`);
    // History can lag the live price by a moment - re-apply it so the live bar never blinks out.
    pushLiveRef.current?.();
  }, [ready, candles, viewKey, timeframe]);

  useEffect(() => {
    if (!ready) return;
    // Callers often rebuild this array every render; only redraw the lines when they really change.
    const serialized = JSON.stringify(alertLevels);
    if (serialized === sentAlertLevelsRef.current) return;
    sentAlertLevelsRef.current = serialized;
    webviewRef.current?.injectJavaScript(`window.setAlertLevels(${serialized}); true;`);
  }, [ready, alertLevels]);

  // The chart keeps its own live-price subscription, so it stays live whatever the screen renders.
  useEffect(() => {
    if (!instrumentId) return;
    subscribeLivePrice(instrumentId);
    return () => {
      unsubscribeLivePrice(instrumentId);
    };
  }, [instrumentId]);

  useEffect(() => {
    if (!ready || !instrumentId) return;
    let barCloseTimer: ReturnType<typeof setTimeout> | null = null;

    // Folds a price at an exchange time into the live bar, opening a new bar when the
    // timeframe's bucket rolls over. Bars follow the exchange clock, not the phone's.
    const apply = (price: number, atMs: number, window?: LiveWindow) => {
      const last = lastCandleRef.current;
      if (!last) return;
      const bucket = bucketStart(Math.floor(atMs / 1000), timeframe);
      if (bucket < last.time) return; // older than the bar on screen
      // Spikes between sampled prices count toward this bar only if they all traded inside it.
      const inBar = window && bucketStart(Math.floor(window.start / 1000), timeframe) === bucket;
      const high = inBar ? Math.max(price, window.high) : price;
      const low = inBar ? Math.min(price, window.low) : price;
      let updated: Candle;
      if (bucket > last.time) {
        // No volume on a bar opened from live prices: the real figure arrives with the refetch.
        updated = { time: bucket, open: last.close, high: Math.max(last.close, high), low: Math.min(last.close, low), close: price };
        // The closed bar was drawn from sampled live prices; fetch the exchange's final OHLC.
        if (barCloseTimer) clearTimeout(barCloseTimer);
        barCloseTimer = setTimeout(() => onBarCloseRef.current?.(), BAR_CLOSE_REFETCH_DELAY_MS);
      } else {
        if (price === last.close && high <= last.high && low >= last.low) return;
        updated = { ...last, close: price, high: Math.max(last.high, high), low: Math.min(last.low, low) };
      }
      lastCandleRef.current = updated;
      webviewRef.current?.injectJavaScript(`window.updateLastCandle(${JSON.stringify(updated)}, ${exchangeNow() - Date.now()}); true;`);
      onLiveBarRef.current?.(updated);
    };

    const pushLatest = () => {
      const entry = useLivePriceStore.getState().byId[instrumentId];
      if (entry?.price != null) apply(entry.price, entry.eventTime ?? exchangeNow(), liveWindow(entry));
    };
    pushLiveRef.current = pushLatest;
    pushLatest();

    const unsubscribe = useLivePriceStore.subscribe((state, prev) => {
      const entry = state.byId[instrumentId];
      if (!entry || entry === prev.byId[instrumentId] || entry.price == null) return;
      apply(entry.price, entry.eventTime ?? exchangeNow(), liveWindow(entry));
    });

    // Quiet markets: still open the next bar on time even when no trade arrives.
    const rollover = setInterval(() => {
      const last = lastCandleRef.current;
      if (last && bucketStart(Math.floor(exchangeNow() / 1000), timeframe) > last.time) apply(last.close, exchangeNow());
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(rollover);
      if (barCloseTimer) clearTimeout(barCloseTimer);
      pushLiveRef.current = null;
    };
  }, [ready, instrumentId, timeframe]);

  useEffect(() => {
    if (!ready) return;
    webviewRef.current?.injectJavaScript(`window.setWatermark(${JSON.stringify(watermark)}); true;`);
  }, [ready, watermark]);

  useEffect(() => {
    if (!ready) return;
    webviewRef.current?.injectJavaScript(`window.setDrawings(${JSON.stringify(drawings)}); true;`);
  }, [ready, drawings]);

  useEffect(() => {
    if (!ready) return;
    webviewRef.current?.injectJavaScript(`window.setDrawMode(${drawMode}); true;`);
  }, [ready, drawMode]);

  useEffect(() => {
    if (!ready) return;
    webviewRef.current?.injectJavaScript(`window.setTf(${TIMEFRAME_SECONDS[timeframe] ?? 3600}); true;`);
  }, [ready, timeframe]);

  useEffect(() => {
    if (!ready) return;
    webviewRef.current?.injectJavaScript(`window.setDrawTool(${JSON.stringify(drawTool)}); true;`);
  }, [ready, drawTool]);

  return (
    <View style={[styles.wrap, { height }]}>
      <WebView
        ref={webviewRef}
        source={{ html }}
        onMessage={onMessage}
        originWhitelist={["*"]}
        scrollEnabled={false}
        overScrollMode="never"
        bounces={false}
        style={styles.webview}
        containerStyle={styles.webview}
        javaScriptEnabled
        domStorageEnabled={false}
      />
      {(!ready || loading) && candles.length === 0 ? (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator color={colors.foregroundSubtle} />
        </View>
      ) : candles.length === 0 ? (
        // Charts only show real exchange data, so a market without history says so instead of drawing a blank grid.
        <View style={styles.overlay} pointerEvents="box-none">
          <Ionicons name={failed ? "cloud-offline-outline" : "bar-chart-outline"} size={22} color={colors.foregroundSubtle} />
          <ThemedText variant="subtle" style={styles.overlayText}>
            {failed ? "Couldn't load the chart. Retrying…" : "No price history for this timeframe yet"}
          </ThemedText>
          {/* The chart's + needs candles to read a price from; without them, alerts start from the live price. */}
          {onPriceTap && (
            <Button
              title="Set alert at current price"
              variant="glass"
              size="sm"
              icon={<Ionicons name="add" size={16} color={colors.foreground} />}
              onPress={() => {
                const price = (instrumentId ? useLivePriceStore.getState().byId[instrumentId]?.price : null) ?? fallbackPrice;
                if (price == null) return;
                haptics.medium();
                onPriceTap(price);
              }}
              style={styles.overlayAction}
            />
          )}
        </View>
      ) : null}
    </View>
  );
});

const EMPTY_DRAWINGS: Drawing[] = [];

interface LiveWindow {
  high: number;
  low: number;
  start: number;
}

function liveWindow(entry: LivePriceState): LiveWindow | undefined {
  if (entry.windowHigh == null || entry.windowLow == null || entry.windowStartTime == null) return undefined;
  return { high: entry.windowHigh, low: entry.windowLow, start: entry.windowStartTime };
}

/** Wait after a bar closes before refetching, so the exchange has finalized that bar. */
const BAR_CLOSE_REFETCH_DELAY_MS = 1500;

function buildChartHtml(): string {
  return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <style>
      html, body { margin: 0; padding: 0; background: transparent; overflow: hidden; height: 100%; }
      /* touch-action none: the chart library handles every gesture itself. Without it, turning off
         the chart's own drag while drawing would let the WebView claim the drag and cancel it. */
      #chart { width: 100%; height: 100%; touch-action: none; }
      /* Soft light from the top in the theme's brand colour, behind the (transparent) plot. z-index
         -1 keeps it under everything without giving #chart a stacking context of its own, which
         would push the absolutely positioned overlays (OHLC, markers) underneath the canvas. */
      #glow { position: absolute; left: 0; top: 0; right: 0; bottom: 0; z-index: -1; pointer-events: none; }
      #ohlc {
        position: absolute; top: 6px; left: 8px; font: 500 11px -apple-system, Roboto, sans-serif;
        font-variant-numeric: tabular-nums; padding: 3px 7px; border-radius: 6px;
        background: rgba(0,0,0,0.35); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
        pointer-events: none; opacity: 0; transition: opacity 0.1s; z-index: 5;
        display: flex; flex-wrap: wrap; column-gap: 8px; row-gap: 1px;
      }
      #ohlc > span { white-space: nowrap; }
      #ohlc b { font-weight: 500; opacity: 0.55; margin-right: 2px; }
      #tapMarker {
        position: absolute; width: 26px; height: 26px; margin-left: -13px; margin-top: -13px;
        border-radius: 999px; align-items: center; justify-content: center; display: flex;
        pointer-events: none; opacity: 0; transform: scale(0.6);
        transition: opacity 0.18s ease-out, transform 0.18s ease-out;
      }
      #tapMarker svg { display: block; }
      /* TradingView-style "+": rides the crosshair's price, just left of the price scale. The
         outer box is the touch target; z-index keeps it above the chart's canvases so taps reach it. */
      #plusBadge {
        position: absolute; width: 40px; height: 40px; transform: translateY(-50%); z-index: 20;
        display: none; align-items: center; justify-content: center;
        -webkit-tap-highlight-color: transparent; touch-action: none; cursor: pointer;
      }
      #plusFace {
        width: 26px; height: 26px; border-radius: 7px; display: flex; align-items: center; justify-content: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.35); transition: transform 0.08s ease-out;
      }
      #plusBadge.pressed #plusFace { transform: scale(0.88); }
      #plusFace svg { display: block; }
      /* Alert line handles: grab to drag the level, swipe left to delete. Siblings of the chart
         (above its canvases), so touches on them never scroll the chart. */
      #alertHandles { position: absolute; left: 0; top: 0; width: 100%; height: 100%; pointer-events: none; z-index: 15; }
      .alertHandle {
        position: absolute; height: 32px; min-width: 40px; transform: translateY(-50%); pointer-events: auto;
        display: flex; align-items: center; justify-content: flex-end; touch-action: none; -webkit-tap-highlight-color: transparent;
      }
      .alertGrip {
        height: 20px; padding: 0 6px; border-radius: 10px; display: flex; align-items: center; justify-content: center;
        box-shadow: 0 1px 6px rgba(0,0,0,0.35); transition: transform 0.1s ease-out, background-color 0.12s;
      }
      .alertGrip svg { display: block; }
      .alertHandle.dragging .alertGrip { transform: scale(1.15); }
      .alertHandle.deleting .alertGrip { background: #ef4444 !important; }
      /* Last price and time left in the bar, as one tag on the price axis (the series' own label is off). */
      #lastTag {
        position: absolute; right: 0; transform: translateY(-50%); box-sizing: border-box;
        padding: 3px 5px; border-radius: 4px 0 0 4px; color: #fff; text-align: left;
        font: 600 11px -apple-system, Roboto, sans-serif; font-variant-numeric: tabular-nums; line-height: 1.25;
        pointer-events: none; opacity: 0; box-shadow: 0 1px 6px rgba(0,0,0,0.3); white-space: nowrap;
        z-index: 5; /* above the chart's own label canvas, so axis ticks never show through */
      }
      #lastTag span { display: block; font-size: 10px; font-weight: 500; opacity: 0.85; }
    </style>
  </head>
  <body>
    <div id="glow"></div>
    <div id="chart"></div>
    <svg id="overlay" style="position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;overflow:visible"></svg>
    <div id="ohlc"></div>
    <div id="lastTag"><div id="lastTagPrice"></div><span id="lastTagTime"></span></div>
    <div id="tapMarker">
      <svg width="14" height="14" viewBox="0 0 24 24"><path d="M12 5V19M5 12H19" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>
    </div>
    <div id="alertHandles"></div>
    <div id="plusBadge" role="button" aria-label="Add alert at this price">
      <div id="plusFace">
        <svg width="14" height="14" viewBox="0 0 24 24"><path d="M12 5V19M5 12H19" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>
      </div>
    </div>
    <script>${LIGHTWEIGHT_CHARTS_SOURCE}</script>
    <script>
      var chart, candleSeries, volumeSeries, priceLines = [], theme = null;
      var drawMode = false, drawTool = 'trend', drawPriceLines = [], pendingPoint = null;
      // Trend lines and zones are drawn in the SVG overlay (not as chart series), so two points on
      // the same candle can't break the chart and a line doesn't stretch the price scale. preview
      // is the shape following the finger while it's being drawn.
      var shapes = [], preview = null, overlayRunning = false, lastOverlay = '';
      var ONE_POINT_TOOLS = { horizontal: true, hray: true, vline: true };
      var SCROLL_OPTS = { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true };
      var SCALE_OPTS = { mouseWheel: true, pinch: true, axisPressedMouseMove: true, axisDoubleClickReset: true };
      var tapMarkerTimer = null, hasData = false, gridColor = 'rgba(255,255,255,0.045)', watermark = null, watermarkText = '';

      function accent() { return theme ? theme.brand : '#a855f7'; }
      function accentAlpha(a) {
        var h = accent().replace('#', '');
        var n = parseInt(h.length === 3 ? h.split('').map(function (c) { return c + c; }).join('') : h, 16);
        return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
      }
      function post(obj) { window.ReactNativeWebView.postMessage(JSON.stringify(obj)); }

      function init() {
        var container = document.getElementById('chart');
        chart = LightweightCharts.createChart(container, {
          layout: {
            background: { type: 'solid', color: 'transparent' }, textColor: '#9598a3', fontSize: 11, attributionLogo: false,
            fontFamily: '-apple-system, Roboto, "Segoe UI", sans-serif',
          },
          localization: { priceFormatter: function (p) { return fmt(p); } },
          // Horizontal guides only: vertical lines add noise without helping read a level.
          grid: { vertLines: { visible: false }, horzLines: { color: gridColor } },
          // Drag the price axis to zoom vertically and the time axis to zoom horizontally (as in
          // TradingView). Both are wider than the library's default so a thumb can grab them.
          rightPriceScale: { borderVisible: false, minimumWidth: 78 },
          timeScale: {
            borderVisible: false, timeVisible: true, secondsVisible: false, minimumHeight: 36,
            rightOffset: 8, barSpacing: 8, minBarSpacing: 2, fixLeftEdge: false,
          },
          trackingMode: { exitMode: 1 /* OnNextTap */ },
          crosshair: {
            mode: 0,
            vertLine: { width: 1, style: 3, labelBackgroundColor: '#2a2d3a' },
            horzLine: { width: 1, style: 3, labelBackgroundColor: '#a855f7' },
          },
          handleScroll: SCROLL_OPTS,
          handleScale: SCALE_OPTS,
          kineticScroll: { touch: true, mouse: false },
          autoSize: true,
        });

        candleSeries = chart.addSeries(LightweightCharts.CandlestickSeries, {
          upColor: '#22c55e', downColor: '#f43f5e', borderVisible: false,
          wickUpColor: '#22c55e', wickDownColor: '#f43f5e',
          lastValueVisible: false, priceLineStyle: 3, priceLineWidth: 1,
        });
        watermark = LightweightCharts.createTextWatermark(chart.panes()[0], {
          horzAlign: 'center', vertAlign: 'center',
          lines: [{ text: '', color: 'rgba(255,255,255,0.05)', fontSize: 30, fontStyle: '700' }],
        });

        volumeSeries = chart.addSeries(LightweightCharts.HistogramSeries, {
          priceFormat: { type: 'volume' },
          priceScaleId: 'volume',
          lastValueVisible: false,
          priceLineVisible: false,
        });
        chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
        candleSeries.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.22 } });

        var ohlcEl = document.getElementById('ohlc');
        chart.subscribeCrosshairMove(function (param) {
          if (!param.time || !param.seriesData) { ohlcEl.style.opacity = 0; return; }
          var bar = param.seriesData.get(candleSeries);
          if (!bar) { ohlcEl.style.opacity = 0; return; }
          var up = bar.close >= bar.open;
          ohlcEl.style.color = up ? '#22c55e' : '#f43f5e';
          var pct = bar.open ? ((bar.close - bar.open) / bar.open) * 100 : 0;
          // Wraps within the plot area on narrow screens instead of running under the price axis.
          ohlcEl.style.maxWidth = (container.clientWidth - chart.priceScale('right').width() - 24) + 'px';
          ohlcEl.innerHTML = '<span><b>O</b>' + fmt(bar.open) + '</span><span><b>H</b>' + fmt(bar.high) + '</span><span><b>L</b>' + fmt(bar.low) +
            '</span><span><b>C</b>' + fmt(bar.close) + '</span><span>' + (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%</span>';
          ohlcEl.style.opacity = 1;
        });

        chart.subscribeCrosshairMove(function (param) {
          if (drawMode || !param.point) { hidePlus(); return; }
          var price = candleSeries.coordinateToPrice(param.point.y);
          if (price === null) { hidePlus(); return; }
          showPlus(price, param.point.y);
        });

        // Drawing works like TradingView on a phone: press and drag from one point to the other
        // with the shape following the finger, or tap the first point and then the second. A
        // horizontal line goes where the finger lifts. While drawing, the chart doesn't pan or
        // zoom (see setDrawMode), so a drag draws instead of moving the chart.
        var drawStart = null;
        function toPoint(x, y) {
          var time = xToTime(x), price = candleSeries.coordinateToPrice(y);
          return time === null || price === null ? null : { time: time, price: price };
        }
        function localXY(e) {
          var rect = chartEl.getBoundingClientRect();
          return { x: e.clientX - rect.left, y: e.clientY - rect.top };
        }
        function showPreview(a, b) {
          // One-point tools preview at the finger; two-point tools from the first point to it.
          preview = ONE_POINT_TOOLS[drawTool] ? { type: drawTool, a: b, price: b.price } : { type: drawTool, a: a, b: b };
          ensureOverlayLoop();
        }
        function onDrawDown(e) {
          var at = localXY(e), pt = toPoint(at.x, at.y);
          if (!pt) return;
          // Keep receiving the drag even if the finger slides off the plot, so it always ends.
          try { chartEl.setPointerCapture(e.pointerId); } catch (err) {}
          drawStart = { cx: e.clientX, cy: e.clientY, pt: pt };
          showPreview(pendingPoint || pt, pt);
        }
        function onDrawMove(e) {
          if (!drawStart) return;
          var at = localXY(e), pt = toPoint(at.x, at.y);
          if (pt) showPreview(pendingPoint || drawStart.pt, pt);
        }
        function onDrawUp(e) {
          if (!drawStart) return;
          var start = drawStart;
          drawStart = null;
          var at = localXY(e), end = toPoint(at.x, at.y) || start.pt;
          var moved = Math.abs(e.clientX - start.cx) > MOVE_TOLERANCE_PX || Math.abs(e.clientY - start.cy) > MOVE_TOLERANCE_PX;

          if (drawTool === 'horizontal') return finishDrawing({ id: uid(), type: 'horizontal', price: end.price });
          if (ONE_POINT_TOOLS[drawTool]) return finishDrawing({ id: uid(), type: drawTool, a: end });
          if (pendingPoint) return finishTwoPoint(pendingPoint, end);
          if (moved) return finishTwoPoint(start.pt, end);
          // A tap: this is the first point; the next tap (or drag) sets the second.
          pendingPoint = start.pt;
          var px = timeToX(start.pt.time), py = candleSeries.priceToCoordinate(start.pt.price);
          if (px !== null && py !== null) showTapMarker(px, py);
          post({ type: 'drawHint', stage: 'end' });
        }
        function finishTwoPoint(a, b) {
          if (a.time === b.time && Math.abs(a.price - b.price) < 1e-12) { cancelDraft(); return; }
          // A box with no width is invisible; every other two-point tool only needs two distinct points.
          if (drawTool === 'rect' && a.time === b.time) { cancelDraft(); return; }
          finishDrawing({ id: uid(), type: drawTool, a: a, b: b });
        }
        function finishDrawing(d) {
          cancelDraft();
          addDrawing(d, true);
          // One shape per tool pick, then back to the cursor - TradingView's default.
          post({ type: 'drawDone' });
        }
        function cancelDraft() {
          pendingPoint = null;
          preview = null;
          hideTapMarker();
          post({ type: 'drawHint', stage: 'start' });
        }

        var pressStart = null, MOVE_TOLERANCE_PX = 8;
        // The "+" badge used to rely only on the chart library's own crosshair/trackingMode to
        // detect a hold - which depends on touch-gesture internals we can't verify across every
        // Android WebView/device. This timer is a self-contained long-press detector on the same
        // element the (already working) draw-mode tap detection uses, so showing the "+" no
        // longer depends on the library noticing the hold on its own.
        var plusPressTimer = null, PLUS_PRESS_MS = 450;
        var chartEl = document.getElementById('chart');
        chartEl.addEventListener('pointerdown', function (e) {
          if (drawMode) return onDrawDown(e);
          var at = localXY(e);
          pressStart = { x: at.x, y: at.y, cx: e.clientX, cy: e.clientY };
          clearTimeout(plusPressTimer);
          plusPressTimer = setTimeout(function () {
            if (!pressStart) return;
            var price = candleSeries.coordinateToPrice(pressStart.y);
            if (price !== null) showPlus(price, pressStart.y);
          }, PLUS_PRESS_MS);
        });
        chartEl.addEventListener('pointermove', function (e) {
          if (drawMode) return onDrawMove(e);
          if (!pressStart) return;
          if (Math.abs(e.clientX - pressStart.cx) > MOVE_TOLERANCE_PX || Math.abs(e.clientY - pressStart.cy) > MOVE_TOLERANCE_PX) {
            pressStart = null;
            clearTimeout(plusPressTimer);
          }
        });
        chartEl.addEventListener('pointerup', function (e) {
          if (drawMode) return onDrawUp(e);
          clearTimeout(plusPressTimer);
          pressStart = null;
        });
        chartEl.addEventListener('pointercancel', function () {
          pressStart = null;
          clearTimeout(plusPressTimer);
          // An interrupted drag drops its preview, but a first point already tapped is kept.
          if (drawStart) { drawStart = null; preview = null; }
        });

        chart.timeScale().subscribeVisibleTimeRangeChange(function () {
          hideTapMarker();
          placeAlertHandles();
        });
        post({ type: 'ready' });
      }

      function showTapMarker(x, y) {
        var el = document.getElementById('tapMarker');
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        el.style.backgroundColor = accent();
        el.style.opacity = 1;
        el.style.transform = 'scale(1)';
        if (tapMarkerTimer) clearTimeout(tapMarkerTimer);
        if (!drawMode) tapMarkerTimer = setTimeout(hideTapMarker, 3500);
      }

      function hideTapMarker() {
        var el = document.getElementById('tapMarker');
        el.style.opacity = 0;
        el.style.transform = 'scale(0.6)';
      }

      window.setDrawMode = function (on) {
        drawMode = on;
        pendingPoint = null;
        preview = null;
        hideTapMarker();
        // While drawing the chart holds still, so a drag draws the shape instead of panning.
        chart.applyOptions({ handleScroll: on ? false : SCROLL_OPTS, handleScale: on ? false : SCALE_OPTS });
        if (on) { hidePlus(); chart.clearCrosshairPosition(); }
      };

      window.setDrawTool = function (tool) {
        drawTool = tool;
        pendingPoint = null;
        preview = null;
        hideTapMarker();
      };

      // Bar time <-> x, extended past the last bar (and before the first) at one bar per
      // timeframe step, so a line can be drawn into the empty space to the right of the price.
      function lastBarLogical() {
        if (lastBarTime === null) return null;
        var x = chart.timeScale().timeToCoordinate(lastBarTime);
        return x === null ? null : chart.timeScale().coordinateToLogical(x);
      }
      function timeToX(t) {
        var x = chart.timeScale().timeToCoordinate(t);
        if (x !== null) return x;
        var last = lastBarLogical();
        return last === null ? null : chart.timeScale().logicalToCoordinate(last + (t - lastBarTime) / tfSeconds);
      }
      function xToTime(x) {
        var t = chart.timeScale().coordinateToTime(x);
        if (t !== null) return t;
        var logical = chart.timeScale().coordinateToLogical(x), last = lastBarLogical();
        if (logical === null || last === null) return null;
        return lastBarTime + Math.round(logical - last) * tfSeconds;
      }

      // "+" on the crosshair: appears with the crosshair (long-press the chart), follows it, and
      // tapping it opens the alert sheet at that price. The app buzzes when it appears.
      var plusPrice = null, plusPressed = false;
      var plusBadge = document.getElementById('plusBadge'), plusFace = document.getElementById('plusFace');
      function showPlus(price, y) {
        plusPrice = price;
        plusBadge.style.top = y + 'px';
        plusBadge.style.right = (chart.priceScale('right').width() - 4) + 'px';
        if (plusBadge.style.display !== 'flex') {
          plusFace.style.backgroundColor = accent();
          plusBadge.style.display = 'flex';
          post({ type: 'plusShown' });
        }
      }
      function hidePlus() {
        plusPrice = null;
        plusPressed = false;
        plusBadge.classList.remove('pressed');
        plusBadge.style.display = 'none';
      }
      // hidePlus() already clears plusPrice, so calling this twice for the same tap (see the
      // click fallback below) is harmless - the second call just sees plusPrice === null.
      function activatePlus() {
        if (plusPrice === null) return;
        var p = plusPrice;
        hidePlus();
        chart.clearCrosshairPosition();
        post({ type: 'priceTap', price: Number(fmt(p)) });
      }
      // Primarily handled on pointerup (not click) so the tap registers at once, and kept from
      // reaching the chart so it doesn't count as the tap that dismisses the crosshair. click is
      // a fallback: pointerdown/pointerup don't always pair up on a touch-action:none, absolutely
      // positioned element in every Android WebView build, and a tap that only fires pointerdown
      // would otherwise leave the button stuck "pressed" with nothing happening.
      plusBadge.addEventListener('pointerdown', function (e) {
        e.stopPropagation();
        plusPressed = true;
        plusBadge.classList.add('pressed');
      });
      plusBadge.addEventListener('pointerup', function (e) {
        e.stopPropagation();
        if (!plusPressed) return;
        activatePlus();
      });
      plusBadge.addEventListener('click', function (e) {
        e.stopPropagation();
        activatePlus();
      });
      plusBadge.addEventListener('pointercancel', function () {
        plusPressed = false;
        plusBadge.classList.remove('pressed');
      });

      function pointXY(pt) {
        var x = timeToX(pt.time), y = candleSeries.priceToCoordinate(pt.price);
        return x === null || y === null ? null : { x: x, y: y };
      }
      function svgLine(p, q, stroke, width, dash) {
        return '<line x1="' + p.x + '" y1="' + p.y + '" x2="' + q.x + '" y2="' + q.y + '" stroke="' + stroke + '" stroke-width="' + width + '"' +
          (dash ? ' stroke-dasharray="5 4"' : '') + ' stroke-linecap="round"/>';
      }
      function svgRect(p, q, fill, stroke) {
        return '<rect x="' + Math.min(p.x, q.x) + '" y="' + Math.min(p.y, q.y) + '" width="' + Math.abs(q.x - p.x) + '" height="' + Math.abs(q.y - p.y) +
          '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1"/>';
      }
      function svgDot(p, fill) {
        return '<circle cx="' + p.x + '" cy="' + p.y + '" r="5" fill="' + fill + '" stroke="#fff" stroke-width="1.5"/>';
      }
      function svgText(x, y, text, fill, anchor) {
        return '<text x="' + x + '" y="' + y + '" fill="' + fill + '" font-size="10" font-weight="600" font-family="-apple-system, Roboto, sans-serif"' +
          (anchor ? ' text-anchor="' + anchor + '"' : '') + '>' + text + '</text>';
      }
      // TradingView's Fibonacci levels and colours.
      var FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
      var FIB_COLORS = ['#787b86', '#f23645', '#ff9800', '#4caf50', '#089981', '#00bcd4', '#787b86'];

      /** SVG for one drawing (or the in-progress preview), clipped later to the plot area. */
      function shapeSVG(d, draft) {
        var stroke = accent(), w = plotRight(), h = plotBottom(), out = [];
        if (d.type === 'horizontal') {
          var hy = candleSeries.priceToCoordinate(d.price);
          if (hy !== null) out.push(svgLine({ x: 0, y: hy }, { x: w, y: hy }, stroke, 1.5, true));
          return out.join('');
        }
        var p = pointXY(d.a);
        if (!p) return '';
        if (d.type === 'hray') {
          out.push(svgLine(p, { x: w, y: p.y }, stroke, 2, draft));
        } else if (d.type === 'vline') {
          out.push(svgLine({ x: p.x, y: 0 }, { x: p.x, y: h }, stroke, 2, draft));
        } else {
          var q = pointXY(d.b);
          if (!q) return '';
          if (d.type === 'trend') {
            out.push(svgLine(p, q, stroke, 2, draft));
          } else if (d.type === 'ray') {
            // Run from the first point through the second to the edge of the plot.
            var dx = q.x - p.x, dy = q.y - p.y, end;
            if (Math.abs(dx) < 0.5) end = { x: p.x, y: dy > 0 ? h : 0 };
            else { var ex = dx > 0 ? w : 0; end = { x: ex, y: p.y + (dy * (ex - p.x)) / dx }; }
            out.push(svgLine(p, end, stroke, 2, draft));
          } else if (d.type === 'rect') {
            out.push(svgRect(p, q, accentAlpha(draft ? 0.12 : 0.18), stroke));
          } else if (d.type === 'fib') {
            var left = Math.min(p.x, q.x), right = Math.max(Math.max(p.x, q.x), left + 60);
            FIB_LEVELS.forEach(function (lv, i) {
              var price = d.b.price + (d.a.price - d.b.price) * lv;
              var y = candleSeries.priceToCoordinate(price);
              if (y === null) return;
              if (i > 0) {
                var prevY = candleSeries.priceToCoordinate(d.b.price + (d.a.price - d.b.price) * FIB_LEVELS[i - 1]);
                if (prevY !== null) out.push('<rect x="' + left + '" y="' + Math.min(y, prevY) + '" width="' + (right - left) + '" height="' + Math.abs(y - prevY) + '" fill="' + FIB_COLORS[i] + '" fill-opacity="0.08"/>');
              }
              out.push(svgLine({ x: left, y: y }, { x: right, y: y }, FIB_COLORS[i], 1, false));
              out.push(svgText(left + 3, y - 3, lv + ' (' + fmt(price) + ')', FIB_COLORS[i]));
            });
            out.push(svgLine(p, q, '#787b86', 1, true));
          } else if (d.type === 'measure') {
            var diff = d.b.price - d.a.price, up = diff >= 0, tone = up ? '#22c55e' : '#f43f5e';
            var pct = d.a.price ? (diff / d.a.price) * 100 : 0;
            var bars = Math.round(Math.abs(d.b.time - d.a.time) / tfSeconds);
            out.push('<rect x="' + Math.min(p.x, q.x) + '" y="' + Math.min(p.y, q.y) + '" width="' + Math.abs(q.x - p.x) + '" height="' + Math.abs(q.y - p.y) + '" fill="' + tone + '" fill-opacity="0.15" stroke="' + tone + '" stroke-width="1"/>');
            var cx = (p.x + q.x) / 2, labelY = up ? Math.min(p.y, q.y) - 6 : Math.max(p.y, q.y) + 14;
            out.push(svgText(cx, labelY, (up ? '+' : '') + fmt(diff) + ' (' + (up ? '+' : '') + pct.toFixed(2) + '%) · ' + bars + ' bars', tone, 'middle'));
          }
        }
        if (draft) {
          out.push(svgDot(p, stroke));
          if (d.b) { var qq = pointXY(d.b); if (qq) out.push(svgDot(qq, stroke)); }
        }
        return out.join('');
      }
      function plotRight() { return document.getElementById('chart').clientWidth - chart.priceScale('right').width(); }
      function plotBottom() { return document.getElementById('chart').clientHeight - chart.timeScale().height(); }

      function drawOverlay() {
        var parts = [];
        shapes.forEach(function (d) { parts.push(shapeSVG(d, false)); });
        if (preview) parts.push(shapeSVG(preview, true));
        // Clip to the plot so nothing is drawn over the price or time axes.
        var html = '<defs><clipPath id="plot"><rect x="0" y="0" width="' + plotRight() + '" height="' + plotBottom() + '"/></clipPath></defs>' +
          '<g clip-path="url(#plot)">' + parts.join('') + '</g>';
        // Only touch the DOM when something actually moved.
        if (html !== lastOverlay) { lastOverlay = html; document.getElementById('overlay').innerHTML = html; }
      }

      // Redraws every frame while there's anything to draw: shapes are pinned to time and price,
      // so they have to follow every pan, zoom and rescale of the chart.
      function ensureOverlayLoop() {
        if (overlayRunning) return;
        overlayRunning = true;
        (function frame() {
          if (shapes.length === 0 && !preview) {
            overlayRunning = false;
            lastOverlay = '';
            document.getElementById('overlay').innerHTML = '';
            return;
          }
          drawOverlay();
          requestAnimationFrame(frame);
        })();
      }

      var drawingList = [];
      function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
      function renderDrawing(d) {
        if (d.type === 'horizontal') {
          // A real price line, so its price shows on the axis like TradingView's.
          drawPriceLines.push(candleSeries.createPriceLine({ price: d.price, color: accent(), lineWidth: 1, lineStyle: 0, axisLabelVisible: true, title: '' }));
        } else {
          shapes.push(d);
          ensureOverlayLoop();
        }
      }
      function addDrawing(d, report) {
        drawingList.push(d);
        renderDrawing(d);
        if (report) post({ type: 'drawingAdded', drawing: d });
      }
      window.setDrawings = function (list) {
        shapes = [];
        drawPriceLines.forEach(function (l) { candleSeries.removePriceLine(l); });
        drawPriceLines = [];
        drawingList = [];
        (list || []).forEach(function (d) { addDrawing(d, false); });
        ensureOverlayLoop(); // clears the overlay when the list is now empty
      };
      window.clearDrawings = function () {
        window.setDrawings([]);
        pendingPoint = null;
        preview = null;
        hideTapMarker();
      };

      // Decimals by magnitude, with thousands separators: 100,600.00 / 3.4512 / 0.000123.
      function fmt(n) {
        var digits = n < 1 ? 6 : n < 100 ? 4 : 2;
        return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
      }

      function volColor(c) {
        var up = c.close >= c.open;
        return (up ? upHex : downHex) + '40';
      }
      var upHex = '#22c55e', downHex = '#f43f5e';

      window.setCandles = function (candles, keepView) {
        var lastC = candles[candles.length - 1];
        if (lastC) { lastBarTime = lastC.time; lastBarClose = lastC.close; lastBarOpen = lastC.open; }
        else { lastBarTime = null; lastBarClose = null; lastBarOpen = null; }
        var range = keepView && hasData ? chart.timeScale().getVisibleLogicalRange() : null;
        candleSeries.setData(candles.map(function (c) {
          return { time: c.time, open: c.open, high: c.high, low: c.low, close: c.close };
        }));
        volumeSeries.setData(candles.filter(function (c) { return c.volume != null; }).map(function (c) {
          return { time: c.time, value: c.volume, color: volColor(c) };
        }));
        if (range) chart.timeScale().setVisibleLogicalRange(range);
        else chart.timeScale().fitContent();
        hasData = true;
      };

      var tfSeconds = 60, lastBarTime = null, lastBarClose = null, lastBarOpen = null;
      window.setTf = function (sec) { tfSeconds = sec; };
      function updateLastTag() {
        var el = document.getElementById('lastTag');
        if (!candleSeries || lastBarTime === null || lastBarClose === null) { el.style.opacity = 0; return; }
        var y = candleSeries.priceToCoordinate(lastBarClose);
        var width = chart.priceScale('right').width();
        if (y === null || !width) { el.style.opacity = 0; return; }
        var remaining = Math.max(0, lastBarTime + tfSeconds - Math.floor((Date.now() + clockOffsetMs) / 1000));
        var h = Math.floor(remaining / 3600), m = Math.floor((remaining % 3600) / 60), sec = remaining % 60;
        var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
        document.getElementById('lastTagPrice').textContent = fmt(lastBarClose);
        document.getElementById('lastTagTime').textContent = (h > 0 ? pad(h) + ':' : '') + pad(m) + ':' + pad(sec);
        el.style.background = lastBarClose >= (lastBarOpen === null ? lastBarClose : lastBarOpen) ? upHex : downHex;
        el.style.width = width + 'px';
        el.style.top = y + 'px';
        el.style.opacity = 1;
      }
      setInterval(function () {
        updateLastTag();
        placeAlertHandles(); // the price scale rescales as prices move
      }, 250);

      var clockOffsetMs = 0, tagFrame = 0;
      window.updateLastCandle = function (c, offsetMs) {
        if (typeof offsetMs === 'number') clockOffsetMs = offsetMs;
        lastBarTime = c.time; lastBarClose = c.close; lastBarOpen = c.open;
        candleSeries.update({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close });
        if (c.volume != null) volumeSeries.update({ time: c.time, value: c.volume, color: volColor(c) });
        // Repaint the price tag with the next frame rather than inside every update.
        if (!tagFrame) tagFrame = requestAnimationFrame(function () { tagFrame = 0; updateLastTag(); });
      };

      window.setWatermark = function (text) {
        watermarkText = text;
        if (watermark) watermark.applyOptions({ lines: [{ text: text, color: theme ? theme.watermarkColor : 'rgba(255,255,255,0.05)', fontSize: 30, fontStyle: '700' }] });
      };

      // ---- Alert lines: dashed price lines with a draggable handle per editable alert.
      var alertLevels = [], alertDrag = null, DELETE_SWIPE_PX = 70;
      var GRIP_SVG = '<svg width="10" height="12" viewBox="0 0 10 12" fill="#fff"><circle cx="2.5" cy="2" r="1.3"/><circle cx="7.5" cy="2" r="1.3"/><circle cx="2.5" cy="6" r="1.3"/><circle cx="7.5" cy="6" r="1.3"/><circle cx="2.5" cy="10" r="1.3"/><circle cx="7.5" cy="10" r="1.3"/></svg>';
      function levelColor(level, price) {
        // While dragging, the colour follows which side of the live price the line is on.
        var up = lastBarClose === null || price === undefined ? level.up : price > lastBarClose;
        return up ? upHex : downHex;
      }
      window.setAlertLevels = function (levels) {
        if (alertDrag) return; // never rebuild under the finger; the next update after release applies
        priceLines.forEach(function (l) { if (l) candleSeries.removePriceLine(l); });
        alertLevels = levels;
        priceLines = levels.map(function (level) {
          return candleSeries.createPriceLine({
            price: level.price, color: level.up ? upHex : downHex, lineWidth: 1, lineStyle: 2,
            axisLabelVisible: true, title: '\uD83D\uDD14',
          });
        });
        renderAlertHandles();
      };
      function renderAlertHandles() {
        var box = document.getElementById('alertHandles');
        box.innerHTML = '';
        alertLevels.forEach(function (level, i) {
          if (!level.draggable) return;
          var el = document.createElement('div');
          el.className = 'alertHandle';
          el.setAttribute('data-index', String(i));
          el.setAttribute('role', 'button');
          el.setAttribute('aria-label', 'Drag to move this alert, swipe left to delete');
          el.innerHTML = '<div class="alertGrip">' + GRIP_SVG + '</div>';
          el.firstChild.style.backgroundColor = level.up ? upHex : downHex;
          attachAlertDrag(el, i);
          box.appendChild(el);
        });
        placeAlertHandles();
      }
      function placeAlertHandles() {
        if (!candleSeries) return;
        var right = chart.priceScale('right').width() + 2;
        var els = document.querySelectorAll('.alertHandle');
        for (var n = 0; n < els.length; n++) {
          var el = els[n], i = Number(el.getAttribute('data-index'));
          var price = alertDrag && alertDrag.index === i ? alertDrag.price : alertLevels[i].price;
          var y = candleSeries.priceToCoordinate(price);
          if (y === null) { el.style.display = 'none'; continue; }
          el.style.display = 'flex';
          el.style.top = y + 'px';
          el.style.right = right + 'px';
        }
      }
      function attachAlertDrag(el, index) {
        el.addEventListener('pointerdown', function (e) {
          e.stopPropagation();
          e.preventDefault();
          try { el.setPointerCapture(e.pointerId); } catch (err) {}
          var level = alertLevels[index];
          alertDrag = {
            index: index, el: el, id: level.id, startPrice: level.price, price: level.price,
            startX: e.clientX, startY: e.clientY, y0: candleSeries.priceToCoordinate(level.price), moved: false, deleting: false,
          };
          el.classList.add('dragging');
          hidePlus();
          chart.clearCrosshairPosition();
          post({ type: 'alertGrab' });
        });
        el.addEventListener('pointermove', function (e) {
          var d = alertDrag;
          if (!d || d.index !== index || d.y0 === null) return;
          e.stopPropagation();
          var dx = e.clientX - d.startX, dy = e.clientY - d.startY;
          if (Math.abs(dx) > 4 || Math.abs(dy) > 4) d.moved = true;
          // A mostly-horizontal swipe to the left arms delete; sliding back disarms it.
          var deleting = dx < -DELETE_SWIPE_PX && Math.abs(dx) > Math.abs(dy);
          if (deleting !== d.deleting) {
            d.deleting = deleting;
            el.classList.toggle('deleting', deleting);
            post({ type: 'alertDeleteArmed', armed: deleting });
          }
          var line = priceLines[index], level = alertLevels[index];
          if (deleting) {
            el.style.transform = 'translate(' + dx + 'px, -50%)';
            el.style.opacity = '0.8';
            line.applyOptions({ price: d.startPrice, color: '#ef4444' });
            d.price = d.startPrice;
            placeAlertHandles();
            return;
          }
          el.style.transform = '';
          el.style.opacity = '';
          var p = candleSeries.coordinateToPrice(d.y0 + dy);
          if (p === null) return;
          d.price = p;
          var color = levelColor(level, p);
          line.applyOptions({ price: p, color: color });
          el.firstChild.style.backgroundColor = color;
          placeAlertHandles();
        });
        el.addEventListener('pointerup', function (e) { e.stopPropagation(); endAlertDrag(false); });
        el.addEventListener('pointercancel', function () { endAlertDrag(true); });
      }
      function endAlertDrag(cancelled) {
        var d = alertDrag;
        if (!d) return;
        alertDrag = null;
        var i = d.index, line = priceLines[i], level = alertLevels[i];
        d.el.classList.remove('dragging', 'deleting');
        d.el.style.transform = '';
        d.el.style.opacity = '';
        // Back where it started (a tap, or a swipe that slid back): nothing to save.
        var unchanged = !d.deleting && Number(fmt(d.price)) === Number(fmt(d.startPrice));
        if (cancelled || unchanged || (!d.moved && !d.deleting)) {
          line.applyOptions({ price: d.startPrice, color: level.up ? upHex : downHex });
          d.el.firstChild.style.backgroundColor = level.up ? upHex : downHex;
          placeAlertHandles();
          return;
        }
        if (d.deleting) {
          // Gone at once; the app deletes it (and puts it back if that fails).
          candleSeries.removePriceLine(line);
          priceLines[i] = null;
          d.el.remove();
          post({ type: 'alertDelete', id: d.id });
          return;
        }
        var price = Number(fmt(d.price));
        level.price = price;
        line.applyOptions({ price: price });
        placeAlertHandles();
        post({ type: 'alertMove', id: d.id, price: price });
      }

      window.applySettings = function (s) {
        upHex = s.up; downHex = s.down;
        candleSeries.applyOptions({
          upColor: s.up, downColor: s.down,
          wickUpColor: s.up, wickDownColor: s.down,
          wickVisible: s.wicks,
        });
        volumeSeries.applyOptions({ visible: s.volume });
        chart.applyOptions({
          grid: {
            vertLines: { visible: false },
            horzLines: { visible: s.grid, color: gridColor },
          },
        });
      };

      window.applyTheme = function (t) {
        theme = t;
        gridColor = t.gridColor;
        chart.applyOptions({
          layout: { textColor: t.textColor },
          grid: { horzLines: { color: t.gridColor } },
          crosshair: {
            vertLine: { color: t.crosshairColor, labelBackgroundColor: t.labelBackground },
            horzLine: { color: t.crosshairColor, labelBackgroundColor: t.brand },
          },
        });
        document.getElementById('ohlc').style.background = t.legendBackground;
        document.getElementById('glow').style.background =
          'radial-gradient(120% 75% at 50% 0%, ' + accentAlpha(0.16) + ', transparent 70%)';
        window.setWatermark(watermarkText);
      };

      init();
    </script>
  </body>
</html>`;
}

const styles = StyleSheet.create({
  wrap: { width: "100%", borderRadius: radius.sm, overflow: "hidden" },
  webview: { backgroundColor: "transparent" },
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", gap: 8 },
  overlayText: { fontSize: 13 },
  overlayAction: { marginTop: 4 },
});
