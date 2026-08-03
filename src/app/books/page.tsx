"use client";

import { Suspense } from "react";
import { AppShell } from "@/components/Sidebar/AppShell";
import { BooksPage } from "@/components/Books/BooksPage";

export default function BooksRoute() {
  return (
    <AppShell
      className="bg-[#EDE8E0]"
      contentClassName="h-screen overflow-y-auto overscroll-contain"
    >
      <Suspense fallback={null}>
        <BooksPage />
      </Suspense>
    </AppShell>
  );
}
