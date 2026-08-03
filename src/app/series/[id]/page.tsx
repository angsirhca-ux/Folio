"use client";

import { use } from "react";
import { AppShell } from "@/components/Sidebar/AppShell";
import { SeriesPage } from "@/components/Series/SeriesPage";

export default function SeriesRoutePage({
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
      <SeriesPage seriesId={id} />
    </AppShell>
  );
}
