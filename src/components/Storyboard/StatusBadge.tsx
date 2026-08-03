"use client";

import type { SceneStatus } from "@/lib/types";
import { SCENE_STATUS_META } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StatusBadge({
  status,
  className,
  compact,
}: {
  status: SceneStatus;
  className?: string;
  compact?: boolean;
}) {
  const meta = SCENE_STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-[family-name:var(--font-ui)] tracking-wide",
        compact ? "px-1.5 py-0.5 text-[0.6rem]" : "px-2 py-0.5 text-[0.65rem]",
        className,
      )}
      style={{ color: meta.color, backgroundColor: meta.bg }}
    >
      {meta.label}
    </span>
  );
}
