"use client";

import type { SceneStatus } from "@/lib/types";
import { SCENE_STATUS_META } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SceneStatusDot({
  status,
  size = "sm",
  className,
  title,
  onClick,
}: {
  status: SceneStatus;
  size?: "sm" | "md";
  className?: string;
  title?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const meta = SCENE_STATUS_META[status];
  const dim = size === "md" ? "h-2 w-2" : "h-1.5 w-1.5";

  return (
    <span
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={
        onClick ? `Status: ${meta.label}. Click to change.` : undefined
      }
      title={title ?? meta.label}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onClick(e as unknown as React.MouseEvent);
              }
            }
          : undefined
      }
      className={cn(
        "mt-1.5 shrink-0 rounded-full transition-transform duration-200",
        dim,
        onClick &&
          "cursor-pointer hover:scale-125 focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--accent)]",
        className,
      )}
      style={{ backgroundColor: meta.color }}
    />
  );
}
