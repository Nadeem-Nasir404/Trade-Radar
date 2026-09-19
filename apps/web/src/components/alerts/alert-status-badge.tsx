import { Badge } from "@/components/ui/badge";
import type { AlertStatus } from "@levelpulse/shared-types";

const VARIANTS: Record<AlertStatus, { label: string; variant: "positive" | "warning" | "brand" | "outline" | "negative" }> = {
  ACTIVE: { label: "Active", variant: "positive" },
  PAUSED: { label: "Paused", variant: "warning" },
  TRIGGERED: { label: "Triggered", variant: "brand" },
  EXPIRED: { label: "Expired", variant: "outline" },
  CANCELLED: { label: "Cancelled", variant: "outline" },
};

export function AlertStatusBadge({ status }: { status: AlertStatus }) {
  const config = VARIANTS[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
