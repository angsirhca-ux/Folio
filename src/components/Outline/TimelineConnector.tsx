"use client";

import { motion } from "framer-motion";
import type { OutlineScale } from "@/lib/types";
import { cn } from "@/lib/utils";

const LENGTH: Record<OutlineScale, number> = {
  compact: 28,
  balanced: 48,
  detailed: 72,
};

export function TimelineConnector({
  scale,
  index,
  className,
}: {
  scale: OutlineScale;
  index: number;
  className?: string;
}) {
  const width = LENGTH[scale];
  return (
    <div
      className={cn("relative flex h-3 flex-1 items-center", className)}
      style={{ minWidth: width, maxWidth: scale === "detailed" ? 120 : 96 }}
      aria-hidden
    >
      <motion.div
        className="h-px w-full origin-left bg-[rgba(45,42,38,0.18)]"
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{
          duration: 0.55,
          delay: 0.08 + index * 0.05,
          ease: [0.25, 0.1, 0.25, 1],
        }}
      />
    </div>
  );
}
