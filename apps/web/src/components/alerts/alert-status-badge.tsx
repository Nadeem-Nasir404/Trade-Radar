import type { AlertStatus } from "@levelpulse/shared-types";
import { cn } from "@/lib/utils";

const STYLES: Record<AlertStatus, { label: string; className: string; dot: string; pulse?: boolean }> = {
  ACTIVE: {
    label: "Active",
    className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
    dot: "bg-emerald-400",
    pulse: true,
  },
  PAUSED: {
    label: "Paused",
    className: "border-amber-500/25 bg-amber-500/10 text-amber-400",
    dot: "bg-amber-400",
  },
  TRIGGERED: {
    label: "Triggered",
    className: "border-indigo-500/25 bg-indigo-500/10 text-indigo-400",
    dot: "bg-indigo-400",
    pulse: true,
  },
  EXPIRED: {
    label: "Expired",
    className: "border-neutral-500/25 bg-neutral-500/10 text-neutral-400",
    dot: "bg-neutral-400",
  },
  CANCELLED: {
    label: "Cancelled",
    className: "border-rose-500/25 bg-rose-500/10 text-rose-400",
    dot: "bg-rose-400",
  },
};

export function AlertStatusBadge({ status }: { status: AlertStatus }) {
  const config = STYLES[status] ?? STYLES.ACTIVE;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide", config.className)}>
      <span className="relative flex size-1.5">
        {config.pulse && (
          <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-75", config.dot)} />
        )}
        <span className={cn("relative inline-flex size-1.5 rounded-full", config.dot)} />
      </span>
      {config.label}
    </span>
  );
}

