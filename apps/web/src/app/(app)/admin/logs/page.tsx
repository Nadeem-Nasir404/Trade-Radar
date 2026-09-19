"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { FileText } from "lucide-react";
import { useAdminLogs } from "@/lib/api/hooks/use-admin";
import { formatDateTime } from "@/lib/utils";

const SEVERITY_VARIANT = { info: "outline", warning: "warning", error: "negative" } as const;

export default function AdminLogsPage() {
  const { data: logs, isLoading } = useAdminLogs();

  if (isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;
  if (!logs || logs.length === 0) return <EmptyState icon={FileText} title="No system events yet" description="Provider and system events will appear here." />;

  return (
    <div className="flex flex-col gap-2">
      {logs.map((log) => (
        <Card key={log.id} className="flex items-center justify-between p-4">
          <div>
            <p className="text-sm font-medium">{log.message}</p>
            <p className="text-xs text-foreground-subtle">
              {log.type} · {formatDateTime(log.createdAt)}
            </p>
          </div>
          <Badge variant={SEVERITY_VARIANT[log.severity as keyof typeof SEVERITY_VARIANT] ?? "outline"}>{log.severity}</Badge>
        </Card>
      ))}
    </div>
  );
}
