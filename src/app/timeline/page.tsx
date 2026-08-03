"use client";

import { AppShell } from "@/components/Sidebar/AppShell";
import { OutlinePage } from "@/components/Outline/OutlinePage";

export default function TimelineRoute() {
  return (
    <AppShell
      className="bg-[#EDE8E0]"
      contentClassName="h-screen overflow-y-auto overscroll-contain"
    >
      <OutlinePage />
    </AppShell>
  );
}
