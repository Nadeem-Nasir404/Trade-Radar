"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo";
import { NAV_ITEMS } from "./nav-items";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/api/hooks/use-auth";
import { useSubscription } from "@/lib/api/hooks/use-subscription";
import { Progress } from "@/components/ui/progress";
import { useAlerts } from "@/lib/api/hooks/use-alerts";

export function Sidebar() {
  const pathname = usePathname();
  const { data: user } = useCurrentUser();
  const { data: subscription } = useSubscription();
  const { data: activeAlerts } = useAlerts({ status: "ACTIVE" });

  const usedAlerts = activeAlerts?.length ?? 0;
  const maxAlerts = subscription?.maxActiveAlerts ?? 1;

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-glass-border bg-background-elevated/60 lg:flex">
      <div className="flex h-16 items-center px-6">
        <Link href="/dashboard">
          <Logo />
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-brand/15 text-brand" : "text-foreground-muted hover:bg-glass hover:text-foreground",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}

        {user?.role === "ADMIN" && (
          <Link
            href="/admin"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              pathname.startsWith("/admin") ? "bg-brand/15 text-brand" : "text-foreground-muted hover:bg-glass hover:text-foreground",
            )}
          >
            <ShieldCheck className="size-4" />
            Admin
          </Link>
        )}
      </nav>

      {subscription && (
        <div className="mx-3 mb-4 rounded-xl border border-glass-border bg-glass p-3.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-foreground-muted">Alert capacity</span>
            <span className="font-medium">
              {usedAlerts}/{maxAlerts}
            </span>
          </div>
          <Progress value={Math.min(100, (usedAlerts / maxAlerts) * 100)} className="mt-2 h-1.5" />
          {usedAlerts >= maxAlerts && (
            <Link href="/settings/billing" className="mt-2 block text-xs font-medium text-brand hover:underline">
              Upgrade for more →
            </Link>
          )}
        </div>
      )}
    </aside>
  );
}
