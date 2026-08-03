"use client";

import { use } from "react";
import { AppShell } from "@/components/Sidebar/AppShell";
import { LocationWikiPage } from "@/components/Locations/LocationWikiPage";

export default function LocationWikiRoute({
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
      <LocationWikiPage locationId={id} />
    </AppShell>
  );
}
