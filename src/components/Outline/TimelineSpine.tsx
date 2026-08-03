"use client";

import { motion } from "framer-motion";
import type { OutlineScale, Scene } from "@/lib/types";
import { cn } from "@/lib/utils";

const GAP: Record<OutlineScale, string> = {
  compact: "h-6",
  balanced: "h-10",
  detailed: "h-14",
};

export function TimelineSpine({
  scale,
  className,
  animate = true,
}: {
  scale: OutlineScale;
  className?: string;
  animate?: boolean;
}) {
  return (
    <div
      className={cn("relative flex w-5 shrink-0 justify-center", className)}
      aria-hidden
    >
      <motion.div
        className={cn(
          "w-px origin-top bg-[rgba(45,42,38,0.16)]",
          GAP[scale],
          "min-h-full absolute inset-y-0 left-1/2 -translate-x-1/2",
        )}
        initial={animate ? { scaleY: 0, opacity: 0 } : false}
        animate={{ scaleY: 1, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
      />
    </div>
  );
}

/** Continuous connector segment between two beats. */
export function SpineSegment({
  scale,
  index,
}: {
  scale: OutlineScale;
  index: number;
}) {
  const height =
    scale === "compact" ? 20 : scale === "detailed" ? 36 : 28;

  return (
    <motion.div
      aria-hidden
      className="mx-auto w-px origin-top bg-[rgba(45,42,38,0.18)]"
      style={{ height }}
      initial={{ scaleY: 0, opacity: 0 }}
      animate={{ scaleY: 1, opacity: 1 }}
      transition={{
        duration: 0.45,
        delay: 0.04 + index * 0.02,
        ease: [0.25, 0.1, 0.25, 1],
      }}
    />
  );
}
