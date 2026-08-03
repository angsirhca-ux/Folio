"use client";

import { AppShell } from "@/components/Sidebar/AppShell";
import { CharactersPage } from "@/components/Characters/CharactersPage";

export default function CharactersRoute() {
  return (
    <AppShell
      className="bg-[#EDE8E0]"
      contentClassName="h-screen overflow-y-auto overscroll-contain"
    >
      <CharactersPage />
    </AppShell>
  );
}
