"use client";

import { AppShell } from "@/components/Sidebar/AppShell";
import { LocationsPage } from "@/components/Locations/LocationsPage";

export default function LocationsRoute() {
  return (
    <AppShell
      className="bg-[#EDE8E0]"
      contentClassName="h-screen overflow-y-auto overscroll-contain"
    >
      <LocationsPage />
    </AppShell>
  );
}
