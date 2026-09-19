"use client";

import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminProviders, useSetProviderEnabled, useAdminInstruments, useSetInstrumentActive } from "@/lib/api/hooks/use-admin";

export default function AdminProvidersPage() {
  const { data: providers, isLoading } = useAdminProviders();
  const setProviderEnabled = useSetProviderEnabled();
  const { data: instruments } = useAdminInstruments();
  const setInstrumentActive = useSetInstrumentActive();

  if (isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-5">
        <p className="mb-4 text-sm font-medium">Providers</p>
        <div className="flex flex-col gap-3">
          {providers?.map((p) => (
            <div key={p.id} className="flex items-center justify-between border-b border-glass-border/60 pb-3 last:border-0 last:pb-0">
              <div>
                <p className="font-medium capitalize">{p.name}</p>
                <p className="text-xs text-foreground-subtle">{p.type}</p>
              </div>
              <Switch checked={p.isEnabled} onCheckedChange={(v) => setProviderEnabled.mutate({ id: p.id, isEnabled: v })} />
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <p className="mb-4 text-sm font-medium">Instruments</p>
        <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
          {instruments?.map((i) => (
            <div key={i.id} className="flex items-center justify-between border-b border-glass-border/60 py-2 last:border-0">
              <div>
                <p className="text-sm font-medium">{i.displaySymbol}</p>
                <p className="text-xs text-foreground-subtle">
                  {i.assetType} · {i.provider.name}
                </p>
              </div>
              <Switch checked={i.isActive} onCheckedChange={(v) => setInstrumentActive.mutate({ id: i.id, isActive: v })} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
