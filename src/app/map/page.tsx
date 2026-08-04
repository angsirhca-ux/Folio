"use client";

import { Suspense } from "react";
import { AppShell } from "@/components/Sidebar/AppShell";
import { MapPage } from "@/components/Map/MapPage";

export default function MapRoute() {
  return (
    <AppShell
      className="bg-[#EDE8E0]"
      contentClassName="h-screen overflow-hidden"
    >
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center">
            <div className="h-1 w-16 overflow-hidden rounded-full bg-[rgba(176,141,87,0.2)]">
              <div className="folio-loading-bar h-full w-1/2 rounded-full bg-[var(--accent)]" />
            </div>
          </div>
        }
      >
        <MapPage />
      </Suspense>
    </AppShell>
  );
}
