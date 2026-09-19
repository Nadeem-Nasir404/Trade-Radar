"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminUsers, useSuspendUser, useUnsuspendUser } from "@/lib/api/hooks/use-admin";

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const { data: users, isLoading } = useAdminUsers(search);
  const suspend = useSuspendUser();
  const unsuspend = useUnsuspendUser();

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground-subtle" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by email or name" className="pl-9" />
      </div>

      {isLoading && <Skeleton className="h-96 w-full rounded-xl" />}

      <div className="overflow-hidden rounded-xl border border-glass-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-glass-border bg-glass text-left text-xs uppercase tracking-wide text-foreground-subtle">
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Alerts</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users?.map((u) => (
              <tr key={u.id} className="border-b border-glass-border/60 last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium">{u.name || "--"}</p>
                  <p className="text-xs text-foreground-subtle">{u.email}</p>
                </td>
                <td className="px-4 py-3">{u.subscription?.plan ?? "--"}</td>
                <td className="px-4 py-3 font-tabular">{u._count.alerts}</td>
                <td className="px-4 py-3">
                  <Badge variant={u.isSuspended ? "negative" : "positive"}>{u.isSuspended ? "Suspended" : "Active"}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  {u.isSuspended ? (
                    <Button size="sm" variant="glass" onClick={() => unsuspend.mutate(u.id)}>
                      Unsuspend
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => suspend.mutate({ id: u.id, reason: "Admin action" })}>
                      Suspend
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
