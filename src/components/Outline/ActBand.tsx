"use client";

import { cn } from "@/lib/utils";

export function ActBand({
  act,
  isFirst,
}: {
  act: string;
  isFirst?: boolean;
}) {
  const label = act.trim() || "Unassigned";
  return (
    <div
      className={cn(
        "relative ml-0 flex items-center gap-3 py-4 sm:ml-0",
        !isFirst && "mt-2",
      )}
    >
      <div className="flex w-[1.25rem] justify-center sm:w-[1.5rem]">
        <span className="h-2 w-2 rounded-sm bg-[var(--accent)] opacity-70" />
      </div>
      <div className="min-w-0 flex-1 border-b border-[rgba(45,42,38,0.1)] pb-2">
        <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.28em] text-[var(--ink-faint)]">
          Act
        </p>
        <h2 className="mt-0.5 font-[family-name:var(--font-display)] text-xl font-medium tracking-wide text-[var(--ink)]">
          {label}
        </h2>
      </div>
    </div>
  );
}
