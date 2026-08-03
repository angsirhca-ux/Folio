"use client";

import { use } from "react";
import { AppShell } from "@/components/Sidebar/AppShell";
import { EncyclopediaWikiPage } from "@/components/Encyclopedia/EncyclopediaWikiPage";

export default function EncyclopediaWikiRoute({
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
      <EncyclopediaWikiPage entryId={id} />
    </AppShell>
  );
}
