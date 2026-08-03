"use client";

import type { OutlineScale } from "@/lib/types";
import { cn } from "@/lib/utils";

const SCALES: { id: OutlineScale; label: string }[] = [
  { id: "compact", label: "Compact" },
  { id: "balanced", label: "Balanced" },
  { id: "detailed", label: "Detailed" },
];

export function ZoomControl({
  value,
  onChange,
  className,
}: {
  value: OutlineScale;
  onChange: (scale: OutlineScale) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full bg-[rgba(45,42,38,0.04)] p-0.5",
        className,
      )}
      role="group"
      aria-label="Timeline scale"
    >
      {SCALES.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onChange(s.id)}
          className={cn(
            "rounded-full px-2.5 py-1.5 font-[family-name:var(--font-ui)] text-[0.7rem] tracking-wide transition-all duration-300",
            value === s.id
              ? "bg-[rgba(247,243,234,0.95)] text-[var(--ink)] shadow-sm"
              : "text-[var(--ink-faint)] hover:text-[var(--ink-muted)]",
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
