"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlans } from "@/lib/api/hooks/use-subscription";
import { cn } from "@/lib/utils";

const TAGLINES: Record<string, string> = {
  FREE: "For getting started",
  PRO: "For active traders",
  MAX: "For serious multi-market monitoring",
};

export function PricingCards() {
  const { data: plans, isLoading } = usePlans();

  if (isLoading || !plans) {
    return (
      <div className="grid gap-6 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-96 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {plans.map((plan) => {
        const featured = plan.tier === "PRO";
        return (
          <Card
            key={plan.tier}
            className={cn(
              "relative flex flex-col p-7",
              featured && "border-brand/40 shadow-[0_0_0_1px_rgba(99,102,241,0.4),0_20px_60px_-24px_rgba(99,102,241,0.5)]",
            )}
          >
            {featured && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-3 py-1 text-xs font-medium text-brand-foreground">
                Most popular
              </span>
            )}
            <p className="text-sm font-medium uppercase tracking-wide text-foreground-subtle">{plan.label}</p>
            <p className="mt-1 text-sm text-foreground-muted">{TAGLINES[plan.tier]}</p>
            <p className="mt-5 font-tabular text-4xl font-semibold">
              ${plan.priceMonthlyUsd}
              <span className="text-base font-normal text-foreground-subtle">/mo</span>
            </p>
            <p className="mt-2 text-sm text-foreground-muted">
              <span className="font-semibold text-foreground">{plan.maxActiveAlerts.toLocaleString()}</span> active alerts
            </p>

            <ul className="mt-6 flex flex-1 flex-col gap-3">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-foreground-muted">
                  <Check className="mt-0.5 size-4 shrink-0 text-positive" />
                  {f}
                </li>
              ))}
            </ul>

            <Button asChild className="mt-7" variant={featured ? "default" : "glass"}>
              <Link href="/register">{plan.tier === "FREE" ? "Start free" : `Get ${plan.label}`}</Link>
            </Button>
          </Card>
        );
      })}
    </div>
  );
}
