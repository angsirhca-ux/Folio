"use client";

import { AppShell } from "@/components/Sidebar/AppShell";
import { ChroniclePage } from "@/components/Chronicle/ChroniclePage";

export default function ChronicleRoute() {
  return (
    <AppShell
      className="bg-[#EDE8E0]"
      contentClassName="h-screen overflow-y-auto overscroll-contain"
    >
      <ChroniclePage />
    </AppShell>
  );
}
