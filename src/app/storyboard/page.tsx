"use client";

import { AppShell } from "@/components/Sidebar/AppShell";
import { StoryboardPage } from "@/components/Storyboard/StoryboardPage";

export default function StoryboardRoute() {
  return (
    <AppShell
      className="bg-[#EDE8E0]"
      contentClassName="h-screen overflow-y-auto overscroll-contain"
    >
      <StoryboardPage />
    </AppShell>
  );
}
