import Link from "next/link";
import {
  Bell,
  Bitcoin,
  Gauge,
  Gem,
  ListChecks,
  MessageCircle,
  Radar,
  Search,
  Smartphone,
  SlidersHorizontal,
  Star,
  Waves,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HeroVisualization } from "@/components/marketing/hero-visualization";
import { CapacityCalculator } from "@/components/marketing/capacity-calculator";
import { PricingCards } from "@/components/marketing/pricing-cards";

const FEATURES = [
  { icon: Gauge, title: "Massive alert capacity", desc: "Hundreds of active alerts on Pro, thousands on Max - no artificial 3-alert ceiling." },
  { icon: Waves, title: "Real-time prices", desc: "Direct exchange WebSocket feeds. No polling, no delay, no TradingView dependency." },
  { icon: Bitcoin, title: "Crypto + Gold", desc: "BTC, ETH, altcoins today - gold, FX and indices on the same alert engine, coming next." },
  { icon: SlidersHorizontal, title: "Multi-condition alerts", desc: "Price, percentage, range, volatility and volume conditions, combined with AND logic." },
  { icon: MessageCircle, title: "Telegram & Discord", desc: "Get pinged wherever you actually look - browser, email, Telegram, or your own Discord server." },
  { icon: Star, title: "Watchlists", desc: "Drag-and-drop watchlists with live price, 24h change, and distance to your nearest alert." },
  { icon: Radar, title: "Level Map", desc: "A visual heatmap of exactly where you've stacked levels, so you see your own conviction at a glance." },
  { icon: ListChecks, title: "Alert history", desc: "Every trigger, every price, every notification's delivery status - fully auditable." },
  { icon: Smartphone, title: "Mobile & PWA", desc: "Install LevelPulse to your home screen for an app-like experience, or grab the native app." },
];

const STEPS = [
  { title: "Find your market", desc: "Search any coin, pair, or - soon - gold and FX. BTC, Bitcoin, BTCUSDT all find the same market." },
  { title: "Set your level", desc: "Click directly on the chart at the price that matters, or type it in." },
  { title: "Choose where to be notified", desc: "Browser, email, Telegram, Discord - pick any combination, per alert." },
  { title: "Keep trading", desc: "Close the tab. Put your phone away. The server is watching, not your browser." },
  { title: "LevelPulse watches it for you", desc: "The instant your level crosses, you're notified - once, not on every tick." },
];

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pb-24 pt-16 sm:px-6 sm:pt-24 lg:px-8">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2 lg:gap-8">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-glass-border-strong bg-glass px-3 py-1 text-xs font-medium text-foreground-muted">
              <Bell className="size-3.5 text-brand" /> Real-time alerts, zero tiny limits
            </span>
            <h1 className="mt-5 text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              Set Every Level.
              <br />
              <span className="bg-gradient-to-r from-brand to-indigo-300 bg-clip-text text-transparent">Miss Nothing.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-foreground-muted">
              Real-time crypto and market alerts without tiny alert limits. Track thousands of levels across the markets
              you actually trade.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/register">Start Tracking Free</Link>
              </Button>
              <Button asChild size="lg" variant="glass">
                <Link href="/markets">Explore Live Markets</Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-foreground-subtle">No credit card required · Free plan includes 50 active alerts</p>
          </div>
          <HeroVisualization />
        </div>
      </section>

      {/* Problem / Solution */}
      <section className="border-y border-glass-border bg-background-elevated/50 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-2">
          <Card className="p-8">
            <p className="text-xs font-medium uppercase tracking-wide text-negative">The problem</p>
            <p className="mt-3 text-2xl font-semibold leading-snug">
              3 alerts aren&apos;t enough for a trader watching 50 markets.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-foreground-muted">
              Every major platform caps how many alerts you can run at once. You end up choosing which few levels matter
              and hoping the rest don&apos;t move without you.
            </p>
          </Card>
          <Card className="p-8">
            <p className="text-xs font-medium uppercase tracking-wide text-positive">The solution</p>
            <p className="mt-3 text-2xl font-semibold leading-snug">Set levels across the entire market.</p>
            <p className="mt-3 text-sm leading-relaxed text-foreground-muted">
              LevelPulse makes alert capacity the product. One shared market-data subscription evaluates thousands of
              alert conditions per tick, so your plan - not arbitrary platform limits - decides how much you can watch.
            </p>
          </Card>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">How it works</h2>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {STEPS.map((step, i) => (
              <div key={step.title} className="relative">
                <div className="flex size-9 items-center justify-center rounded-full border border-glass-border-strong bg-glass font-tabular text-sm font-semibold text-brand">
                  {i + 1}
                </div>
                <p className="mt-4 font-medium">{step.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-foreground-muted">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-glass-border px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">Built for traders who watch everything</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-foreground-muted">
            Other platforms make you choose which few alerts matter. LevelPulse lets you watch the levels that actually
            matter to you.
          </p>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.title} className="p-6 transition-colors hover:bg-glass-hover">
                <div className="flex size-10 items-center justify-center rounded-lg bg-brand/15 text-brand">
                  <f.icon className="size-5" />
                </div>
                <p className="mt-4 font-medium">{f.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-foreground-muted">{f.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Capacity calculator */}
      <section className="border-t border-glass-border px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Unlimited-style alerting</h2>
          <p className="mx-auto mt-3 max-w-xl text-foreground-muted">
            We don&apos;t claim infinite infrastructure - we claim no arbitrary 3-alert ceiling. Backend safeguards keep
            the platform healthy; your plan decides your capacity.
          </p>
        </div>
        <div className="mt-12">
          <CapacityCalculator />
        </div>
      </section>

      {/* Pricing */}
      <section className="border-t border-glass-border px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">Simple, generous pricing</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-foreground-muted">
            Every plan includes real-time alerts on real market data. Upgrade for more capacity and channels, not more
            features held hostage.
          </p>
          <div className="mt-14">
            <PricingCards />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 pb-28 pt-4 sm:px-6 lg:px-8">
        <Card className="mx-auto max-w-4xl overflow-hidden p-12 text-center">
          <Gem className="mx-auto size-8 text-brand" />
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Set every level. Miss nothing.</h2>
          <p className="mx-auto mt-3 max-w-md text-foreground-muted">Start free in under a minute. No credit card required.</p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/register">Start Tracking Free</Link>
            </Button>
            <Button asChild size="lg" variant="glass">
              <Link href="/markets">
                <Search className="size-4" /> Explore Live Markets
              </Link>
            </Button>
          </div>
        </Card>
      </section>
    </>
  );
}
