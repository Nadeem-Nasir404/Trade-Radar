"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "group toast glass-panel !rounded-xl !shadow-2xl !text-foreground group-[.toaster]:!bg-background-elevated/95",
          description: "!text-foreground-muted",
          actionButton: "!bg-brand !text-brand-foreground",
          cancelButton: "!bg-glass !text-foreground-muted",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
