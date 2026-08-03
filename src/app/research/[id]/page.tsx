"use client";

import { use } from "react";
import { AppShell } from "@/components/Sidebar/AppShell";
import { ResearchWikiPage } from "@/components/Research/ResearchWikiPage";

export default function ResearchWikiRoute({
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
      <ResearchWikiPage entryId={id} />
    </AppShell>
  );
}
