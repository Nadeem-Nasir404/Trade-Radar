"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, LogOut, Settings, User as UserIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentUser, useLogout } from "@/lib/api/hooks/use-auth";

export function Topbar() {
  const router = useRouter();
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const [search, setSearch] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) router.push(`/markets?search=${encodeURIComponent(search.trim())}`);
  };

  const handleLogout = async () => {
    await logout.mutateAsync();
    router.push("/login");
  };

  const initials = (user?.name || user?.email || "?").slice(0, 1).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-glass-border bg-background/80 px-4 backdrop-blur-2xl sm:px-6 shadow-[0_4px_30px_rgba(0,0,0,0.3)]">
      <form onSubmit={handleSearch} className="relative flex-1 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground-subtle" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search BTC, ETH, Solana, Gold..."
          className="pl-9 bg-background-elevated/40 border-glass-border focus-visible:border-brand/60 focus-visible:ring-brand/20 transition-all text-xs sm:text-sm"
        />
      </form>

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2 rounded-full border border-glass-border bg-background-elevated/40 px-3 py-1 text-xs font-semibold text-foreground-muted">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          Engine Connected
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-full outline-none ring-offset-background transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-brand/40">
            <Avatar className="size-9 border border-brand/40 shadow-[0_0_15px_-3px_rgba(99,102,241,0.3)]">
              <AvatarImage src={user?.avatarUrl ?? undefined} />
              <AvatarFallback className="bg-brand/20 font-bold text-brand">{initials}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-3 py-2">
              <p className="truncate text-sm font-semibold text-foreground">{user?.name || "Trader"}</p>
              <p className="truncate text-xs text-foreground-subtle">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings/profile" className="cursor-pointer gap-2">
                <UserIcon className="size-4" /> Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings/notifications" className="cursor-pointer gap-2">
                <Settings className="size-4" /> Settings & Channels
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={handleLogout} className="cursor-pointer gap-2 text-rose-400 focus:text-rose-300">
              <LogOut className="size-4" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

