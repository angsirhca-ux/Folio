"use client";

import { Building2, Mountain, Waves } from "lucide-react";
import { featureMarkerStyle } from "@/lib/map";
import type { StoryMapRegionKind } from "@/lib/types";
import { cn } from "@/lib/utils";

const FEATURE_ICON = {
  mountains: Mountain,
  water: Waves,
  building: Building2,
} as const;

/** Standalone feature glyph — placed on the corkboard like a pin. */
export function MapFeatureIcon({
  kind,
  active,
  name,
  color,
  className,
}: {
  kind: Exclude<StoryMapRegionKind, "territory">;
  active?: boolean;
  name?: string;
  /** Palette id — used especially for color-coded buildings. */
  color?: string;
  className?: string;
}) {
  const Icon = FEATURE_ICON[kind];
  const marker = featureMarkerStyle(color, kind);
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1",
        className,
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full border shadow-[0_6px_16px_rgba(45,42,38,0.12)]",
          active && "ring-2 ring-[rgba(45,42,38,0.22)]",
        )}
        style={{
          background: marker.fill,
          borderColor: marker.border,
          color: marker.ink,
        }}
      >
        <Icon className="h-5 w-5" strokeWidth={1.6} />
      </span>
      {name ? (
        <span className="max-w-[7rem] truncate text-center font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.12em] text-[var(--ink-muted)]">
          {name}
        </span>
      ) : null}
    </div>
  );
}
