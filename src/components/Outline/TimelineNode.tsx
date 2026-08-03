"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { NodePreview } from "@/components/Outline/NodePreview";
import type { OutlineScale, Scene } from "@/lib/types";
import { povColor, SCENE_STATUS_META } from "@/lib/types";
import { cn, formatWordCount } from "@/lib/utils";

function nodeSize(wordCount: number, scale: OutlineScale): number {
  const base = scale === "compact" ? 10 : scale === "detailed" ? 14 : 12;
  const bump = Math.min(6, Math.floor(wordCount / 800));
  return base + bump;
}

export function TimelineNode({
  scene,
  index,
  chapterId,
  scale,
  insertBefore,
}: {
  scene: Scene;
  index: number;
  chapterId: string;
  scale: OutlineScale;
  insertBefore?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: scene.id,
    data: { type: "scene", chapterId, scene },
  });

  const size = nodeSize(scene.wordCount, scale);
  const statusColor = SCENE_STATUS_META[scene.status].color;
  const ring = povColor(scene.pov);
  const showLabels = scale !== "compact";

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    zIndex: isDragging || hovered ? 20 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative flex shrink-0 flex-col items-center"
      onMouseEnter={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setAnchor({ x: rect.left + rect.width / 2, y: rect.top });
        setHovered(true);
      }}
      onMouseLeave={() => setHovered(false)}
    >
      {insertBefore ? (
        <motion.div
          layoutId="outline-insert"
          className="absolute -left-1.5 top-[11px] h-5 w-0.5 rounded-full bg-[var(--accent)]"
          initial={{ opacity: 0, scaleY: 0.5 }}
          animate={{ opacity: 1, scaleY: 1 }}
        />
      ) : null}

      <button
        type="button"
        className="group relative flex cursor-grab flex-col items-center active:cursor-grabbing"
        title={scene.pov ? `POV · ${scene.pov}` : scene.title}
        {...attributes}
        {...listeners}
      >
        <motion.span
          className="relative flex items-center justify-center rounded-full"
          style={{
            width: size + 8,
            height: size + 8,
            boxShadow: scene.pov ? `0 0 0 2px ${ring}` : undefined,
          }}
          whileHover={{ scale: 1.12, y: -2 }}
          transition={{ type: "spring", stiffness: 420, damping: 28 }}
        >
          <span
            className="block rounded-full shadow-[0_2px_8px_rgba(45,42,38,0.12)]"
            style={{
              width: size,
              height: size,
              backgroundColor: statusColor,
              opacity: scene.wordCount === 0 ? 0.45 : 0.9,
            }}
          />
        </motion.span>

        {showLabels ? (
          <div
            className={cn(
              "mt-3 max-w-[5.5rem] text-center sm:max-w-[7rem]",
              scale === "detailed" && "max-w-[8.5rem] sm:max-w-[9.5rem]",
            )}
          >
            <p className="truncate font-[family-name:var(--font-display)] text-[0.8rem] font-medium tracking-wide text-[var(--ink)] sm:text-[0.9rem]">
              {scene.title || "Untitled"}
            </p>
            {scale === "detailed" ? (
              <p className="mt-0.5 font-[family-name:var(--font-ui)] text-[0.6rem] tabular-nums text-[var(--ink-faint)]">
                {String(index + 1).padStart(2, "0")} ·{" "}
                {formatWordCount(scene.wordCount)}w
                {scene.pov ? ` · ${scene.pov}` : ""}
              </p>
            ) : (
              <p className="mt-0.5 font-[family-name:var(--font-ui)] text-[0.6rem] tabular-nums text-[var(--ink-faint)]">
                {String(index + 1).padStart(2, "0")}
              </p>
            )}
          </div>
        ) : null}
      </button>

      {typeof document !== "undefined" ? (
        <AnimatePresence>
          {hovered && !isDragging && anchor ? (
            <PreviewPortal x={anchor.x} y={anchor.y} scene={scene} />
          ) : null}
        </AnimatePresence>
      ) : null}
    </div>
  );
}

function PreviewPortal({
  x,
  y,
  scene,
}: {
  x: number;
  y: number;
  scene: Scene;
}) {
  return createPortal(
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.98 }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      className="pointer-events-none fixed z-[80]"
      style={{
        left: Math.min(x, window.innerWidth - 300),
        top: Math.max(12, y - 12),
        transform: "translate(-50%, -100%)",
      }}
    >
      <NodePreview scene={scene} />
    </motion.div>,
    document.body,
  );
}

export function TimelineNodeOverlay({
  scene,
  scale,
}: {
  scene: Scene;
  scale: OutlineScale;
}) {
  const size = nodeSize(scene.wordCount, scale);
  const statusColor = SCENE_STATUS_META[scene.status].color;
  const ring = povColor(scene.pov);
  return (
    <div className="flex flex-col items-center">
      <span
        className="flex items-center justify-center rounded-full shadow-[0_12px_32px_rgba(45,42,38,0.18)]"
        style={{
          width: size + 10,
          height: size + 10,
          boxShadow: scene.pov
            ? `0 0 0 2px ${ring}, 0 12px 32px rgba(45,42,38,0.18)`
            : "0 12px 32px rgba(45,42,38,0.18)",
        }}
      >
        <span
          className="block rounded-full"
          style={{
            width: size,
            height: size,
            backgroundColor: statusColor,
          }}
        />
      </span>
      <p className="mt-2 max-w-[7rem] truncate text-center font-[family-name:var(--font-display)] text-sm font-medium text-[var(--ink)]">
        {scene.title}
      </p>
    </div>
  );
}
