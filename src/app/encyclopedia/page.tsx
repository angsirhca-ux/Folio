"use client";

import { AppShell } from "@/components/Sidebar/AppShell";
import { EncyclopediaPage } from "@/components/Encyclopedia/EncyclopediaPage";

export default function EncyclopediaRoute() {
  return (
    <AppShell
      className="bg-[#EDE8E0]"
      contentClassName="h-screen overflow-y-auto overscroll-contain"
    >
      <EncyclopediaPage />
    </AppShell>
  );
}
