"use client";

import { Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useSubscription, usePlans, useCheckout } from "@/lib/api/hooks/use-subscription";
import { useAlerts } from "@/lib/api/hooks/use-alerts";
import { cn } from "@/lib/utils";
import type { PlanTier } from "@levelpulse/shared-types";

export default function BillingSettingsPage() {
  const { data: subscription, isLoading } = useSubscription();
  const { data: plans } = usePlans();
  const { data: activeAlerts } = useAlerts({ status: "ACTIVE" });
  const checkout = useCheckout();

  if (isLoading || !subscription || !plans) return <Skeleton className="h-80 w-full rounded-xl" />;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Current plan</CardTitle>
          <CardDescription>
            {activeAlerts?.length ?? 0} of {subscription.maxActiveAlerts} active alerts used
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant="brand" className="text-sm">
            {subscription.plan}
          </Badge>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.tier === subscription.plan;
          return (
            <Card key={plan.tier} className={cn("flex flex-col p-5", isCurrent && "border-brand/50")}>
              <p className="text-sm font-medium">{plan.label}</p>
              <p className="mt-1 font-tabular text-2xl font-semibold">
                ${plan.priceMonthlyUsd}
                <span className="text-sm font-normal text-foreground-subtle">/mo</span>
              </p>
              <ul className="mt-4 flex flex-1 flex-col gap-2">
                {plan.features.slice(0, 3).map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-xs text-foreground-muted">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-positive" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                className="mt-4"
                variant={isCurrent ? "glass" : "default"}
                disabled={isCurrent || checkout.isPending}
                onClick={() => checkout.mutate(plan.tier as PlanTier)}
              >
                {isCurrent ? "Current plan" : `Switch to ${plan.label}`}
              </Button>
            </Card>
          );
        })}
      </div>
      <p className="text-xs text-foreground-subtle">
        Billing is in preview - plan switches apply instantly without payment while LevelPulse finalizes its Stripe
        integration.
      </p>
    </div>
  );
}
