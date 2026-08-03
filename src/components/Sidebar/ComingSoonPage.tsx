"use client";

import Link from "next/link";
import { AppShell } from "@/components/Sidebar/AppShell";

export default function ComingSoonPage({
  title,
  blurb,
}: {
  title: string;
  blurb: string;
}) {
  return (
    <AppShell className="bg-[#EDE8E0]">
      <div className="flex min-h-screen flex-col items-center justify-center px-8 text-center">
        <p className="font-[family-name:var(--font-display)] text-[0.65rem] uppercase tracking-[0.3em] text-[var(--ink-faint)]">
          Folio
        </p>
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl font-medium tracking-wide text-[var(--ink)]">
          {title}
        </h1>
        <p className="mt-4 max-w-md font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
          {blurb}
        </p>
        <Link
          href="/storyboard"
          className="mt-10 rounded-full bg-[var(--accent-soft)] px-5 py-2.5 font-[family-name:var(--font-ui)] text-sm text-[var(--ink)] transition-colors hover:bg-[rgba(176,141,87,0.2)]"
        >
          Back to Storyboard
        </Link>
      </div>
    </AppShell>
  );
}
