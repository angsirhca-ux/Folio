"use client";

import { Suspense } from "react";
import { MobileWriteApp } from "@/components/MobileWrite/MobileWriteApp";

export default function MobileWriteRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--paper)] text-[var(--ink-muted)]">
          Loading…
        </div>
      }
    >
      <MobileWriteApp />
    </Suspense>
  );
}
