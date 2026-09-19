"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, User } from "lucide-react";
import { MOBILE_NAV_ITEMS } from "./nav-items";
import { cn } from "@/lib/utils";
import { useAlertDraftStore } from "@/lib/stores/alert-draft-store";
import { useMarkets } from "@/lib/api/hooks/use-markets";

export function MobileNav() {
  const pathname = usePathname();
  const startDraft = useAlertDraftStore((s) => s.startDraft);
  const { data: markets } = useMarkets({ limit: 1 });

  const handleFabClick = () => {
    const first = markets?.[0];
    if (first) {
      startDraft({ instrumentId: first.id, symbol: first.displaySymbol, targetValue: first.price ?? 0 });
    }
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-glass-border bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      <div className="relative mx-auto flex h-16 max-w-md items-center justify-between px-2">
        {MOBILE_NAV_ITEMS.slice(0, 2).map((item) => (
          <MobileNavLink key={item.href} item={item} active={pathname.startsWith(item.href)} />
        ))}

        <div className="w-16" />

        {MOBILE_NAV_ITEMS.slice(2).map((item) => (
          <MobileNavLink key={item.href} item={item} active={pathname.startsWith(item.href)} />
        ))}
        <Link
          href="/settings/profile"
          className={cn(
            "flex flex-1 flex-col items-center gap-1 py-2 text-xs",
            pathname.startsWith("/settings") ? "text-brand" : "text-foreground-subtle",
          )}
        >
          <User className="size-5" />
          Profile
        </Link>

        <button
          onClick={handleFabClick}
          aria-label="Create alert"
          className="absolute left-1/2 top-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-[0_0_0_1px_rgba(99,102,241,0.4),0_8px_24px_-6px_rgba(99,102,241,0.7)]"
        >
          <Plus className="size-6" />
        </button>
      </div>
    </nav>
  );
}

function MobileNavLink({ item, active }: { item: (typeof MOBILE_NAV_ITEMS)[number]; active: boolean }) {
  return (
    <Link href={item.href} className={cn("flex flex-1 flex-col items-center gap-1 py-2 text-xs", active ? "text-brand" : "text-foreground-subtle")}>
      <item.icon className="size-5" />
      {item.label}
    </Link>
  );
}
