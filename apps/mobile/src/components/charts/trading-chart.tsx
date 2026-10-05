import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { View, StyleSheet } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { useTheme } from "@/lib/use-theme";
import { radius } from "@/lib/theme";
import type { Candle } from "@/lib/api/types";
import { bucketStart } from "@/lib/timeframe";

export interface ChartAlertLevel {
  price: number;
  up: boolean;
}

export interface TradingChartHandle {
  clearDrawings: () => void;
}

interface TradingChartProps {
  candles: Candle[];
  livePrice?: number | null;
  alertLevels?: ChartAlertLevel[];
  height?: number;
  onPriceTap?: (price: number) => void;
  onDrawStage?: (stage: "start" | "end") => void;
  timeframe?: string;
  drawMode?: boolean;
}

/**
 * Mirrors the web app's lightweight-charts (TradingView's engine) setup - same series colors,
 * grid, and crosshair config - inside a WebView, rather than a lesser native-only charting
 * library. RN->chart is one-directional (injectJavaScript calling globals the page exposes);
 * the page only ever posts back messages ("ready" once at init, "priceTap" on each chart tap)
 * so the native side knows the chart finished initializing before pushing data at it.
 */
export const TradingChart = forwardRef<TradingChartHandle, TradingChartProps>(function TradingChart(
  { candles, livePrice, alertLevels = [], height = 260, onPriceTap, onDrawStage, drawMode = false, timeframe = "1h" },
  ref,
) {
  const { colors, mode } = useTheme();
  const webviewRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const lastCandleRef = useRef<Candle | null>(null);
  const livePriceRef = useRef<number | null>(null);

  const html = useMemo(() => buildChartHtml(), []);

  useImperativeHandle(ref, () => ({
    clearDrawings: () => webviewRef.current?.injectJavaScript("window.clearDrawings(); true;"),
  }));

  const theme = {
    background: colors.background,
    textColor: colors.foregroundSubtle,
    gridColor: mode === "light" ? "rgba(0,0,0,0.045)" : "rgba(255,255,255,0.045)",
    borderColor: colors.glassBorder,
    upColor: colors.positive,
    downColor: colors.negative,
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
    if (!ready || candles.length === 0) return;
    lastCandleRef.current = candles[candles.length - 1] ?? null;
    webviewRef.current?.injectJavaScript(`window.setCandles(${JSON.stringify(candles)}); true;`);
  }, [ready, candles]);

  useEffect(() => {
    if (!ready) return;
    webviewRef.current?.injectJavaScript(`window.setAlertLevels(${JSON.stringify(alertLevels)}); true;`);
  }, [ready, alertLevels]);

  livePriceRef.current = livePrice ?? null;

  useEffect(() => {
    if (!ready) return;
    const pushLive = () => {
      const price = livePriceRef.current;
      const last = lastCandleRef.current;
      if (price == null || !last) return;
      const currentBucket = bucketStart(Math.floor(Date.now() / 1000), timeframe);
      if (currentBucket === last.time && price === last.close) return;
      const updated: Candle =
        currentBucket > last.time
          ? { time: currentBucket, open: last.close, high: Math.max(last.close, price), low: Math.min(last.close, price), close: price, volume: 0 }
          : { ...last, close: price, high: Math.max(last.high, price), low: Math.min(last.low, price) };
      lastCandleRef.current = updated;
      webviewRef.current?.injectJavaScript(`window.updateLastCandle(${JSON.stringify(updated)}); true;`);
    };
    pushLive();
    const id = setInterval(pushLive, 1000);
    return () => clearInterval(id);
  }, [ready, timeframe, livePrice]);

  useEffect(() => {
    if (!ready) return;
    webviewRef.current?.injectJavaScript(`window.setDrawMode(${drawMode}); true;`);
  }, [ready, drawMode]);

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
    </style>
  </head>
  <body>
    <div id="chart"></div>
    <div id="ohlc"></div>
    <div id="tapMarker">
      <svg width="14" height="14" viewBox="0 0 24 24"><path d="M12 5V19M5 12H19" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/lightweight-charts@5.2.1/dist/lightweight-charts.standalone.production.js"></script>
    <script>
      var chart, candleSeries, volumeSeries, priceLines = [], theme = null;
      var drawMode = false, drawLines = [], pendingPoint = null;
      var tapMarkerTimer = null;

      function init() {
        var container = document.getElementById('chart');
        chart = LightweightCharts.createChart(container, {
          layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#9598a3', fontSize: 11, attributionLogo: false },
          grid: { vertLines: { color: 'rgba(255,255,255,0.04)' }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
          rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
          timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true },
          crosshair: { mode: 0 },
          handleScroll: { horzTouchDrag: true, vertTouchDrag: true },
          handleScale: { pinch: true, axisPressedMouseMove: true },
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
          var time = chart.timeScale().coordinateToTime(x);
          var linePrice = candleSeries.coordinateToPrice(y);
          if (time === null || linePrice === null) return;
          if (!pendingPoint) {
            pendingPoint = { time: time, price: linePrice };
            showTapMarker(x, y);
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'drawHint', stage: 'end' }));
            return;
          }
          var line = chart.addSeries(LightweightCharts.LineSeries, {
            color: theme ? theme.brand : '#a855f7',
            lineWidth: 2,
            lastValueVisible: false,
            priceLineVisible: false,
            crosshairMarkerVisible: false,
          });
          line.setData([pendingPoint, { time: time, price: linePrice }].sort(function (a, b) { return a.time - b.time; }));
          drawLines.push(line);
          pendingPoint = null;
          hideTapMarker();
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'drawHint', stage: 'start' }));
        }

        var pressTimer = null;
        var pressStart = null;
        var PRESS_MS = 450;
        var MOVE_TOLERANCE_PX = 8;
        var chartEl = document.getElementById('chart');
        chartEl.addEventListener('pointerdown', function (e) {
          var rect = chartEl.getBoundingClientRect();
          pressStart = { x: e.clientX - rect.left, y: e.clientY - rect.top, cx: e.clientX, cy: e.clientY };
          clearTimeout(pressTimer);
          pressTimer = setTimeout(function () {
            if (!pressStart || drawMode) return;
            var price = candleSeries.coordinateToPrice(pressStart.y);
            if (price === null) return;
            showTapMarker(pressStart.x, pressStart.y);
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'priceTap', price: Number(fmt(price)) }));
            pressStart = null;
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

        chart.timeScale().subscribeVisibleTimeRangeChange(hideTapMarker);

        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
      }

      function showTapMarker(x, y) {
        var el = document.getElementById('tapMarker');
        el.style.left = x + 'px';
        el.style.top = y + 'px';
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

      window.clearDrawings = function () {
        drawLines.forEach(function (l) { chart.removeSeries(l); });
        drawLines = [];
        pendingPoint = null;
        hideTapMarker();
      };

      function fmt(n) {
        return n < 1 ? n.toFixed(6) : n < 100 ? n.toFixed(4) : n.toFixed(2);
      }

      function volColor(c) {
        var base = c.close >= c.open ? '#22c55e' : '#f43f5e';
        return base + '55';
      }

      window.setCandles = function (candles) {
        candleSeries.setData(candles.map(function (c) {
          return { time: c.time, open: c.open, high: c.high, low: c.low, close: c.close };
        }));
        volumeSeries.setData(candles.filter(function (c) { return c.volume != null; }).map(function (c) {
          return { time: c.time, value: c.volume, color: volColor(c) };
        }));
        chart.timeScale().fitContent();
      };

      window.updateLastCandle = function (c) {
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

      window.applyTheme = function (t) {
        theme = t;
        var tapEl = document.getElementById('tapMarker');
        tapEl.style.backgroundColor = t.brand;
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
