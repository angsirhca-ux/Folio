"use client";

import { use } from "react";
import { AppShell } from "@/components/Sidebar/AppShell";
import { CharacterWikiPage } from "@/components/Characters/CharacterWikiPage";

export default function CharacterWikiRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <AppShell
      className="bg-[#EDE8E0]"
      contentClassName="h-screen overflow-y-auto overscroll-contain"
    >
      <CharacterWikiPage characterId={id} />
    </AppShell>
  );
}
