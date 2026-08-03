"use client";

import { cn } from "@/lib/utils";

export function ProgressIndicator({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      className={cn("flex items-center gap-2", className)}
      title={`${pct}% complete`}
    >
      <div className="h-1 w-16 overflow-hidden rounded-full bg-[rgba(45,42,38,0.08)] sm:w-20">
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
          style={{ width: `${pct}%`, opacity: 0.75 }}
        />
      </div>
      <span className="font-[family-name:var(--font-ui)] text-[0.65rem] tabular-nums text-[var(--ink-faint)]">
        {pct}%
      </span>
    </div>
  );
}
