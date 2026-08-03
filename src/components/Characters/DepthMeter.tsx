"use client";

import type {
  CharacterDepth,
  LocationDepth,
  ResearchDepth,
} from "@/lib/types";
import {
  CHARACTER_DEPTH_META,
  LOCATION_DEPTH_META,
  RESEARCH_DEPTH_META,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type WikiDepth = CharacterDepth | LocationDepth | ResearchDepth;

const DEPTH_PROGRESS: Record<WikiDepth, number> = {
  stub: 0.12,
  sketch: 0.35,
  portrait: 0.62,
  living: 1,
};

export function DepthMeter({
  depth,
  completeness,
  compact = false,
  variant = "character",
  className,
}: {
  depth: WikiDepth;
  completeness: number;
  compact?: boolean;
  variant?: "character" | "location" | "research";
  className?: string;
}) {
  const meta =
    variant === "location"
      ? LOCATION_DEPTH_META[depth]
      : variant === "research"
        ? RESEARCH_DEPTH_META[depth]
        : CHARACTER_DEPTH_META[depth];
  const width = Math.max(DEPTH_PROGRESS[depth], completeness) * 100;

  return (
    <div className={cn("min-w-0", className)}>
      {!compact ? (
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <span className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
            {meta.label}
          </span>
          <span className="font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)]">
            {meta.hint}
          </span>
        </div>
      ) : (
        <span className="mb-1 block font-[family-name:var(--font-ui)] text-[0.6rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
          {meta.label}
        </span>
      )}
      <div
        className="h-[2px] w-full overflow-hidden rounded-full bg-[rgba(45,42,38,0.08)]"
        role="progressbar"
        aria-valuenow={Math.round(completeness * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Wiki depth: ${meta.label}`}
      >
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}
