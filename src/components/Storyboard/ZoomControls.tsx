"use client";

import type { StoryboardZoom } from "@/lib/types";
import { cn } from "@/lib/utils";

const LEVELS: StoryboardZoom[] = ["tiny", "small", "medium", "large"];

export function ZoomControls({
  value,
  onChange,
  className,
}: {
  value: StoryboardZoom;
  onChange: (zoom: StoryboardZoom) => void;
  className?: string;
}) {
  const index = LEVELS.indexOf(value);

  return (
    <div
      className={cn("flex items-center gap-2.5", className)}
      title={`Zoom: ${value}`}
    >
      <span className="hidden font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)] sm:inline">
        Zoom
      </span>
      <input
        type="range"
        min={0}
        max={3}
        step={1}
        value={index}
        aria-label="Storyboard zoom"
        onChange={(e) => onChange(LEVELS[Number(e.target.value)] ?? "medium")}
        className="storyboard-zoom h-1 w-20 cursor-pointer appearance-none rounded-full bg-[rgba(45,42,38,0.12)] accent-[var(--accent)] sm:w-28"
      />
      <span className="w-12 font-[family-name:var(--font-ui)] text-[0.7rem] capitalize text-[var(--ink-muted)]">
        {value}
      </span>
    </div>
  );
}
