"use client";

import { AppShell } from "@/components/Sidebar/AppShell";
import { SoundtrackPage } from "@/components/Soundtrack/SoundtrackPage";

export default function SoundtrackRoute() {
  return (
    <AppShell
      className="bg-[#EDE8E0]"
      contentClassName="h-screen overflow-y-auto overscroll-contain"
    >
      <SoundtrackPage />
    </AppShell>
  );
}
