import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium w-fit whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-glass-border-strong bg-glass text-foreground",
        brand: "border-brand/30 bg-brand/15 text-brand",
        positive: "border-positive/30 bg-positive/15 text-positive",
        negative: "border-negative/30 bg-negative/15 text-negative",
        warning: "border-warning/30 bg-warning/15 text-warning",
        outline: "border-glass-border text-foreground-muted",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
