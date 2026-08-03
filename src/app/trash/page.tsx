"use client";

import { AppShell } from "@/components/Sidebar/AppShell";
import { TrashPage } from "@/components/Trash/TrashPage";

export default function TrashRoute() {
  return (
    <AppShell
      className="bg-[#EDE8E0]"
      contentClassName="h-screen overflow-y-auto overscroll-contain"
    >
      <TrashPage />
    </AppShell>
  );
}
