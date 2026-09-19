import type { Metadata } from "next";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { CapacityCalculator } from "@/components/marketing/capacity-calculator";

export const metadata: Metadata = { title: "Pricing" };

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Simple, generous pricing</h1>
        <p className="mx-auto mt-4 max-w-xl text-foreground-muted">
          No arbitrary 3-alert ceiling. Pick the capacity that matches how many markets you actually watch.
        </p>
      </div>
      <div className="mt-14">
        <PricingCards />
      </div>
      <div className="mt-20">
        <CapacityCalculator />
      </div>
    </div>
  );
}
