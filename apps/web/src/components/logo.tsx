import { cn } from "@/lib/utils";

export function Logo({ className, iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span className="relative flex size-7 items-center justify-center rounded-lg bg-brand shadow-[0_0_20px_-4px_var(--brand-glow)]">
        <svg viewBox="0 0 24 24" fill="none" className="size-4 text-white">
          <path d="M3 14L8 9L12 13L21 4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M15 4H21V10" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {!iconOnly && <span className="text-lg">LevelPulse</span>}
    </span>
  );
}
