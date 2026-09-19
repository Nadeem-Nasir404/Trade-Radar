"use client";

import { useState } from "react";
import { Users, Pause, Play, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useAlertGroups, useCreateAlertGroup, useSetGroupPaused } from "@/lib/api/hooks/use-alerts";

export default function AlertGroupsPage() {
  const { data: groups, isLoading } = useAlertGroups();
  const createGroup = useCreateAlertGroup();
  const setPaused = useSetGroupPaused();
  const [newName, setNewName] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await createGroup.mutateAsync(newName.trim());
    setNewName("");
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Alert Groups</h1>
        <p className="text-sm text-foreground-muted">Organize alerts and pause them together.</p>
      </div>

      <form onSubmit={handleCreate} className="flex gap-2">
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. NY Session, BTC Levels" className="max-w-xs" />
        <Button type="submit" disabled={createGroup.isPending}>
          <Plus className="size-4" /> New group
        </Button>
      </form>

      {isLoading && <Skeleton className="h-40 w-full rounded-xl" />}

      {!isLoading && groups?.length === 0 && (
        <EmptyState icon={Users} title="No groups yet" description="Create a group to organize and bulk-pause related alerts." />
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups?.map((group) => (
          <Card key={group.id} className="flex flex-col gap-3 p-5">
            <div>
              <p className="font-medium">{group.name}</p>
              <p className="text-sm text-foreground-subtle">{group._count.alerts} alerts</p>
            </div>
            <Button
              size="sm"
              variant="glass"
              onClick={() => setPaused.mutate({ id: group.id, paused: !group.isPaused })}
              disabled={setPaused.isPending}
            >
              {group.isPaused ? <Play className="size-4" /> : <Pause className="size-4" />}
              {group.isPaused ? "Resume group" : "Pause group"}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
