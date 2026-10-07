import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { View, StyleSheet } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { useTheme } from "@/lib/use-theme";
import { radius } from "@/lib/theme";
import type { Candle } from "@/lib/api/types";
import { bucketStart, TIMEFRAME_SECONDS } from "@/lib/timeframe";
import { CANDLE_PALETTES, useChartSettings } from "@/lib/stores/chart-settings-store";
import { useDrawingsStore, type Drawing } from "@/lib/stores/drawings-store";
import { exchangeNow, subscribeLivePrice, unsubscribeLivePrice, useLivePriceStore, type LivePriceState } from "@/lib/ws/live-price-store";
import { LIGHTWEIGHT_CHARTS_SOURCE } from "./chart-lib.generated";

export interface ChartAlertLevel {
  price: number;
  up: boolean;
}

export type DrawTool = "trend" | "horizontal" | "rect";

export interface TradingChartHandle {
  clearDrawings: () => void;
}

interface TradingChartProps {
  candles: Candle[];
  /** Live prices for this instrument are read from the shared live-price store and drawn straight into the chart, without re-rendering the screen. */
  instrumentId?: string;
  /** Called shortly after a bar closes, so the screen can refetch history for the exchange's final OHLC. */
  onBarClose?: () => void;
  /** Called with the live (last) bar whenever it changes - e.g. for an O/H/L/C legend. */
  onLiveBar?: (bar: Candle) => void;
  alertLevels?: ChartAlertLevel[];
  height?: number;
  onPriceTap?: (price: number) => void;
  onDrawStage?: (stage: "start" | "end") => void;
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
  { candles, instrumentId, onBarClose, onLiveBar, alertLevels = [], height = 260, onPriceTap, onDrawStage, timeframe = "1h", viewKey, drawMode = false, drawTool = "trend", drawingsKey = "default" },
  ref,
) {
  const { colors, mode } = useTheme();
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
  }));

  const theme = {
    background: colors.background,
    textColor: colors.foregroundSubtle,
    gridColor: mode === "light" ? "rgba(0,0,0,0.045)" : "rgba(255,255,255,0.045)",
    borderColor: colors.glassBorder,
    crosshairColor: colors.foregroundMuted,
    brand: colors.brand,
    brandForeground: colors.brandForeground,
  };

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === "ready") setReady(true);
      else if (msg.type === "priceTap") onPriceTap?.(msg.price);
      else if (msg.type === "drawHint") onDrawStage?.(msg.stage);
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
  }, [ready, colors, mode]);

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
    if (!ready || candles.length === 0) return;
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
      #chart { width: 100%; height: 100%; }
      #ohlc {
        position: absolute; top: 4px; left: 8px; font: 11px -apple-system, Roboto, sans-serif;
        pointer-events: none; opacity: 0; transition: opacity 0.1s; white-space: nowrap;
      }
      #tapMarker {
        position: absolute; width: 26px; height: 26px; margin-left: -13px; margin-top: -13px;
        border-radius: 999px; align-items: center; justify-content: center; display: flex;
        pointer-events: none; opacity: 0; transform: scale(0.6);
        transition: opacity 0.18s ease-out, transform 0.18s ease-out;
      }
      #tapMarker svg { display: block; }
      #plusLine { position: absolute; left: 0; right: 0; height: 1px; display: none; pointer-events: none; }
      #plusBadge {
        position: absolute; right: 6px; width: 28px; height: 28px; margin-top: 0; border-radius: 999px;
        display: none; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.35);
        -webkit-tap-highlight-color: transparent;
      }
      #plusBadge svg { display: block; }
      #countdown { position: absolute; right: 2px; font: 600 11px -apple-system, Roboto, sans-serif; color: #9598a3; pointer-events: none; background: transparent; text-align: right; font-variant-numeric: tabular-nums; }
    </style>
  </head>
  <body>
    <div id="chart"></div>
    <svg id="overlay" style="position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;overflow:visible"></svg>
    <div id="ohlc"></div>
    <div id="countdown"></div>
    <div id="tapMarker">
      <svg width="14" height="14" viewBox="0 0 24 24"><path d="M12 5V19M5 12H19" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>
    </div>
    <div id="plusLine"></div>
    <div id="plusBadge">
      <svg width="14" height="14" viewBox="0 0 24 24"><path d="M12 5V19M5 12H19" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>
    </div>
    <script>${LIGHTWEIGHT_CHARTS_SOURCE}</script>
    <script>
      var chart, candleSeries, volumeSeries, priceLines = [], theme = null;
      var drawMode = false, drawTool = 'trend', drawSeries = [], drawPriceLines = [], pendingPoint = null;
      var rects = [], overlayRunning = false;
      var tapMarkerTimer = null, hasData = false, gridColor = 'rgba(255,255,255,0.045)';

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
          layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#9598a3', fontSize: 11, attributionLogo: false },
          grid: { vertLines: { color: gridColor }, horzLines: { color: gridColor } },
          rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
          timeScale: {
            borderColor: 'rgba(255,255,255,0.08)', timeVisible: true,
            rightOffset: 6, barSpacing: 7, minBarSpacing: 2, fixLeftEdge: false,
          },
          crosshair: { mode: 0 },
          handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
          handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true, axisDoubleClickReset: true },
          kineticScroll: { touch: true, mouse: false },
          autoSize: true,
        });

        candleSeries = chart.addSeries(LightweightCharts.CandlestickSeries, {
          upColor: '#22c55e', downColor: '#f43f5e', borderVisible: false,
          wickUpColor: '#22c55e', wickDownColor: '#f43f5e',
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
          ohlcEl.innerHTML = 'O ' + fmt(bar.open) + '  H ' + fmt(bar.high) + '  L ' + fmt(bar.low) + '  C ' + fmt(bar.close);
          ohlcEl.style.opacity = 1;
        });

        function handleDrawTap(x, y) {
          var p = candleSeries.coordinateToPrice(y);
          if (p === null) return;
          if (drawTool === 'horizontal') {
            addDrawing({ id: uid(), type: 'horizontal', price: p }, true);
            post({ type: 'drawHint', stage: 'start' });
            return;
          }
          var time = chart.timeScale().coordinateToTime(x);
          if (time === null) return;
          if (!pendingPoint) {
            pendingPoint = { time: time, price: p };
            showTapMarker(x, y);
            post({ type: 'drawHint', stage: 'end' });
            return;
          }
          var a = pendingPoint, b = { time: time, price: p };
          pendingPoint = null;
          hideTapMarker();
          post({ type: 'drawHint', stage: 'start' });

          if (drawTool === 'rect') {
            var t1 = Math.min(a.time, b.time), t2 = Math.max(a.time, b.time);
            if (t1 === t2) return;
            addDrawing({ id: uid(), type: 'rect', a: { time: a.time, price: a.price }, b: { time: b.time, price: b.price } }, true);
            return;
          }

          addDrawing({ id: uid(), type: 'trend', a: a, b: b }, true);
        }

        var pressTimer = null, pressStart = null, PRESS_MS = 450, MOVE_TOLERANCE_PX = 8;
        var chartEl = document.getElementById('chart');
        chartEl.addEventListener('pointerdown', function (e) {
          if (plusPrice !== null) hidePlus();
          var rect = chartEl.getBoundingClientRect();
          pressStart = { x: e.clientX - rect.left, y: e.clientY - rect.top, cx: e.clientX, cy: e.clientY };
          clearTimeout(pressTimer);
          pressTimer = setTimeout(function () {
            if (!pressStart || drawMode) return;
            var price = candleSeries.coordinateToPrice(pressStart.y);
            if (price === null) return;
            pressStart = null;
            showPlus(Number(fmt(price)));
          }, PRESS_MS);
        });
        chartEl.addEventListener('pointermove', function (e) {
          if (!pressStart) return;
          if (Math.abs(e.clientX - pressStart.cx) > MOVE_TOLERANCE_PX || Math.abs(e.clientY - pressStart.cy) > MOVE_TOLERANCE_PX) {
            clearTimeout(pressTimer);
            pressStart = null;
          }
        });
        chartEl.addEventListener('pointerup', function (e) {
          clearTimeout(pressTimer);
          var start = pressStart;
          pressStart = null;
          if (!drawMode || !start) return;
          if (Math.abs(e.clientX - start.cx) > MOVE_TOLERANCE_PX || Math.abs(e.clientY - start.cy) > MOVE_TOLERANCE_PX) return;
          handleDrawTap(start.x, start.y);
        });
        ['pointercancel', 'pointerleave'].forEach(function (type) {
          chartEl.addEventListener(type, function () {
            clearTimeout(pressTimer);
            pressStart = null;
          });
        });

        chart.timeScale().subscribeVisibleTimeRangeChange(function () {
          hideTapMarker();
          placePlus();
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
        if (!on) hideTapMarker();
      };

      window.setDrawTool = function (tool) {
        drawTool = tool;
        pendingPoint = null;
        hideTapMarker();
      };

      // "+" badge: shown on long-press at the held price, pinned to the right edge at that price
      // level (it follows the price when the chart scrolls or rescales). Tapping it opens the sheet.
      var plusPrice = null;
      function placePlus() {
        if (plusPrice === null || !candleSeries) return;
        var y = candleSeries.priceToCoordinate(plusPrice);
        if (y === null) return;
        document.getElementById('plusLine').style.top = y + 'px';
        document.getElementById('plusBadge').style.top = (y - 14) + 'px';
      }
      function showPlus(price) {
        plusPrice = price;
        var line = document.getElementById('plusLine'), badge = document.getElementById('plusBadge');
        line.style.background = accentAlpha(0.8);
        badge.style.backgroundColor = accent();
        line.style.display = 'block';
        badge.style.display = 'flex';
        placePlus();
      }
      function hidePlus() {
        plusPrice = null;
        document.getElementById('plusLine').style.display = 'none';
        document.getElementById('plusBadge').style.display = 'none';
      }
      document.getElementById('plusBadge').addEventListener('click', function () {
        var p = plusPrice;
        hidePlus();
        if (p !== null) post({ type: 'priceTap', price: Number(fmt(p)) });
      });

      function drawOverlay() {
        var svg = document.getElementById('overlay');
        var ts = chart.timeScale();
        var parts = [];
        rects.forEach(function (r) {
          var x1 = ts.timeToCoordinate(r.t1), x2 = ts.timeToCoordinate(r.t2);
          var y1 = candleSeries.priceToCoordinate(r.p1), y2 = candleSeries.priceToCoordinate(r.p2);
          if (x1 === null || x2 === null || y1 === null || y2 === null) return;
          var x = Math.min(x1, x2), y = Math.min(y1, y2), w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);
          parts.push('<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + accentAlpha(0.18) + '" stroke="' + accent() + '" stroke-width="1"/>');
        });
        svg.innerHTML = parts.join('');
      }

      function ensureOverlayLoop() {
        if (overlayRunning) return;
        overlayRunning = true;
        (function frame() {
          if (rects.length === 0) { overlayRunning = false; document.getElementById('overlay').innerHTML = ''; return; }
          drawOverlay();
          requestAnimationFrame(frame);
        })();
      }

      var drawingList = [];
      function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
      function renderDrawing(d) {
        if (d.type === 'horizontal') {
          drawPriceLines.push(candleSeries.createPriceLine({ price: d.price, color: accent(), lineWidth: 1, lineStyle: 0, axisLabelVisible: true, title: '' }));
        } else if (d.type === 'rect') {
          rects.push({ t1: Math.min(d.a.time, d.b.time), t2: Math.max(d.a.time, d.b.time), p1: d.a.price, p2: d.b.price });
          ensureOverlayLoop();
        } else {
          var line = chart.addSeries(LightweightCharts.LineSeries, {
            color: accent(), lineWidth: 2, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
          });
          line.setData([d.a, d.b].sort(function (x1, x2) { return x1.time - x2.time; }));
          drawSeries.push(line);
        }
      }
      function addDrawing(d, report) {
        drawingList.push(d);
        renderDrawing(d);
        if (report) post({ type: 'drawingAdded', drawing: d });
      }
      window.setDrawings = function (list) {
        rects = [];
        document.getElementById('overlay').innerHTML = '';
        drawSeries.forEach(function (s) { chart.removeSeries(s); });
        drawPriceLines.forEach(function (l) { candleSeries.removePriceLine(l); });
        drawSeries = [];
        drawPriceLines = [];
        drawingList = [];
        (list || []).forEach(function (d) { addDrawing(d, false); });
      };
      window.clearDrawings = function () {
        window.setDrawings([]);
        pendingPoint = null;
        hideTapMarker();
      };

      function fmt(n) {
        return n < 1 ? n.toFixed(6) : n < 100 ? n.toFixed(4) : n.toFixed(2);
      }

      function volColor(c) {
        var up = c.close >= c.open;
        return (up ? upHex : downHex) + '55';
      }
      var upHex = '#22c55e', downHex = '#f43f5e';

      window.setCandles = function (candles, keepView) {
        var lastC = candles[candles.length - 1];
        if (lastC) { lastBarTime = lastC.time; lastBarClose = lastC.close; }
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

      var tfSeconds = 60, lastBarTime = null, lastBarClose = null;
      window.setTf = function (sec) { tfSeconds = sec; };
      function updateCountdown() {
        var el = document.getElementById('countdown');
        if (!candleSeries || lastBarTime === null || lastBarClose === null) { el.style.opacity = 0; return; }
        var y = candleSeries.priceToCoordinate(lastBarClose);
        if (y === null) { el.style.opacity = 0; return; }
        var remaining = Math.max(0, lastBarTime + tfSeconds - Math.floor((Date.now() + clockOffsetMs) / 1000));
        var h = Math.floor(remaining / 3600), m = Math.floor((remaining % 3600) / 60), sec = remaining % 60;
        var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
        el.textContent = (h > 0 ? pad(h) + ':' : '') + pad(m) + ':' + pad(sec);
        el.style.top = (y + 14) + 'px';
        el.style.opacity = 1;
      }
      setInterval(function () {
        updateCountdown();
        placePlus();
      }, 250);

      var clockOffsetMs = 0;
      window.updateLastCandle = function (c, offsetMs) {
        if (typeof offsetMs === 'number') clockOffsetMs = offsetMs;
        lastBarTime = c.time; lastBarClose = c.close;
        candleSeries.update({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close });
        if (c.volume != null) volumeSeries.update({ time: c.time, value: c.volume, color: volColor(c) });
      };

      window.setAlertLevels = function (levels) {
        priceLines.forEach(function (l) { candleSeries.removePriceLine(l); });
        priceLines = levels.map(function (level) {
          return candleSeries.createPriceLine({
            price: level.price,
            color: level.up ? '#22c55e' : '#f43f5e',
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: 'alert',
          });
        });
      };

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
            vertLines: { visible: s.grid, color: gridColor },
            horzLines: { visible: s.grid, color: gridColor },
          },
        });
      };

      window.applyTheme = function (t) {
        theme = t;
        gridColor = t.gridColor;
        chart.applyOptions({
          layout: { textColor: t.textColor },
          grid: { vertLines: { color: t.gridColor }, horzLines: { color: t.gridColor } },
          rightPriceScale: { borderColor: t.borderColor },
          timeScale: { borderColor: t.borderColor },
          crosshair: { vertLine: { color: t.crosshairColor }, horzLine: { color: t.crosshairColor } },
        });
      };

      init();
    </script>
  </body>
</html>`;
}

const styles = StyleSheet.create({
  wrap: { width: "100%", borderRadius: radius.sm, overflow: "hidden" },
  webview: { backgroundColor: "transparent" },
});
