"use client";

import { AppShell } from "@/components/Sidebar/AppShell";
import { MapPage } from "@/components/Map/MapPage";

export default function MapRoute() {
  return (
    <AppShell
      className="bg-[#EDE8E0]"
      contentClassName="h-screen overflow-hidden"
    >
      <MapPage />
    </AppShell>
  );
}
