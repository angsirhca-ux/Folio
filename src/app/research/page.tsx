"use client";

import { AppShell } from "@/components/Sidebar/AppShell";
import { ResearchPage } from "@/components/Research/ResearchPage";

export default function ResearchRoute() {
  return (
    <AppShell
      className="bg-[#EDE8E0]"
      contentClassName="h-screen overflow-y-auto overscroll-contain"
    >
      <ResearchPage />
    </AppShell>
  );
}
