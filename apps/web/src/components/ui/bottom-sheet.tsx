"use client";

import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { cn } from "@/lib/utils";

/** Mobile bottom sheet (per spec: bottom sheets, not desktop-style modals, on mobile). */
function BottomSheet(props: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return <DrawerPrimitive.Root {...props} />;
}

const BottomSheetTrigger = DrawerPrimitive.Trigger;
const BottomSheetClose = DrawerPrimitive.Close;

function BottomSheetContent({ className, children, ...props }: React.ComponentProps<typeof DrawerPrimitive.Content>) {
  return (
    <DrawerPrimitive.Portal>
      <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
      <DrawerPrimitive.Content
        className={cn(
          "glass-panel fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto max-h-[88vh] flex-col rounded-t-2xl border-b-0 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] outline-none",
          className,
        )}
        {...props}
      >
        <div className="mx-auto mb-4 h-1.5 w-10 shrink-0 rounded-full bg-glass-border-strong" />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPrimitive.Portal>
  );
}

function BottomSheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mb-4 flex flex-col gap-1", className)} {...props} />;
}

function BottomSheetTitle({ className, ...props }: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return <DrawerPrimitive.Title className={cn("text-lg font-semibold", className)} {...props} />;
}

function BottomSheetDescription({ className, ...props }: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return <DrawerPrimitive.Description className={cn("text-sm text-foreground-muted", className)} {...props} />;
}

export { BottomSheet, BottomSheetTrigger, BottomSheetClose, BottomSheetContent, BottomSheetHeader, BottomSheetTitle, BottomSheetDescription };
