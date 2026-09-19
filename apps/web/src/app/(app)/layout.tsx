"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { CreateAlertDialog } from "@/components/alerts/create-alert-dialog";
import { useAlertTriggeredListener } from "@/lib/ws/use-alert-triggered-listener";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  useAlertTriggeredListener();

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-8">{children}</main>
      </div>
      <MobileNav />
      <CreateAlertDialog />
    </div>
  );
}
