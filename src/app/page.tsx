"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WritingApp } from "@/components/WritingApp";

/** On phones, skip the desktop studio and go straight to mobile write. */
export default function HomePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 720px)").matches;
    if (narrow) {
      router.replace("/m");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--paper)] font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)]">
        Opening Folio…
      </div>
    );
  }

  return <WritingApp />;
}
