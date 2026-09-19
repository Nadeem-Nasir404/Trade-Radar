"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const TICKERS = [
  { symbol: "BTC", price: "103,420", change: "+2.41%", positive: true },
  { symbol: "ETH", price: "4,821", change: "+1.08%", positive: true },
  { symbol: "XAU/USD", price: "3,987", change: "-0.32%", positive: false },
];

const NOTIFICATIONS = [
  "BTC crossed $105,000",
  "SOL entered your range",
  "XAU/USD is above $4,000",
];

export function HeroVisualization() {
  const [btcPrice, setBtcPrice] = useState(103420);
  const [notifIndex, setNotifIndex] = useState(0);
  const [showNotif, setShowNotif] = useState(false);

  useEffect(() => {
    const priceInterval = setInterval(() => {
      setBtcPrice((p) => Math.max(102000, p + (Math.random() - 0.48) * 120));
    }, 1800);
    return () => clearInterval(priceInterval);
  }, []);

  useEffect(() => {
    const cycle = setInterval(() => {
      setShowNotif(true);
      setTimeout(() => setShowNotif(false), 2800);
      setNotifIndex((i) => (i + 1) % NOTIFICATIONS.length);
    }, 4200);
    return () => clearInterval(cycle);
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="glass-panel relative overflow-hidden rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-foreground-subtle">Active Alerts</p>
            <p className="text-3xl font-semibold tracking-tight font-tabular">247</p>
          </div>
          <div className="flex size-10 items-center justify-center rounded-full bg-brand/15 text-brand">
            <Bell className="size-5" />
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-glass-border bg-glass p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground-muted">BTC</span>
            <span className="flex items-center gap-1 text-xs text-positive">
              <TrendingUp className="size-3" /> +2.41%
            </span>
          </div>
          <p className="mt-1 font-tabular text-2xl font-semibold">
            ${btcPrice.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </p>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-foreground-subtle">Nearest Alert</span>
            <span className="text-foreground">$105,000 · 1.53% away</span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          {TICKERS.slice(1).map((t) => (
            <div key={t.symbol} className="rounded-xl border border-glass-border bg-glass p-3">
              <p className="text-xs text-foreground-subtle">{t.symbol}</p>
              <p className="font-tabular text-lg font-semibold">${t.price}</p>
              <p className={cn("text-xs", t.positive ? "text-positive" : "text-negative")}>{t.change}</p>
            </div>
          ))}
        </div>

        <AnimatePresence>
          {showNotif && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              className="glass-panel absolute -right-4 top-6 flex items-center gap-2 rounded-xl border-brand/30 px-3 py-2.5 shadow-xl"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand/20 text-brand">
                <Bell className="size-3.5" />
              </span>
              <span className="text-xs font-medium">{NOTIFICATIONS[notifIndex]}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="absolute -inset-8 -z-10 rounded-full bg-brand/10 blur-3xl" />
    </div>
  );
}
