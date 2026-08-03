"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { NodePreview } from "@/components/Outline/NodePreview";
import { SpineSegment } from "@/components/Outline/TimelineSpine";
import type { OutlineScale, PlotThread, Scene, SceneStatus } from "@/lib/types";
import { povColor, SCENE_STATUS_META } from "@/lib/types";
import { cn, formatWordCount } from "@/lib/utils";

const STATUS_OPTIONS = Object.keys(SCENE_STATUS_META) as SceneStatus[];

export interface PlotBeatItem {
  kind: "beat";
  scene: Scene;
  chapterId: string;
  chapterTitle: string;
  globalIndex: number;
  sceneIndex: number;
}

export function PlotBeat({
  item,
  scale,
  isFirst,
  isLast,
  showChapterCue,
  threads = [],
  dimmed = false,
  emphasized = false,
  onUpdate,
}: {
  item: PlotBeatItem;
  scale: OutlineScale;
  isFirst: boolean;
  isLast: boolean;
  showChapterCue?: boolean;
  threads?: PlotThread[];
  /** POV/character highlight — keep in view but fade. */
  dimmed?: boolean;
  emphasized?: boolean;
  onUpdate?: (
    sceneId: string,
    partial: Partial<Pick<Scene, "synopsis" | "status" | "title">>,
  ) => void;
}) {
  const { scene, chapterId, globalIndex } = item;
  const threadDots = threads
    .filter((t) => (scene.threadIds ?? []).includes(t.id))
    .slice(0, 3);
  const [hovered, setHovered] = useState(false);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const [editingSynopsis, setEditingSynopsis] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: scene.id,
    data: {
      type: "scene",
      chapterId,
      scene,
      sceneIndex: item.sceneIndex,
    },
  });

  const status = SCENE_STATUS_META[scene.status];
  const ring = povColor(scene.pov);
  const size =
    scale === "compact"
      ? 10
      : scale === "detailed"
        ? 14 + Math.min(4, Math.floor(scene.wordCount / 1000))
        : 12 + Math.min(3, Math.floor(scene.wordCount / 1200));

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : dimmed ? 0.28 : 1,
    zIndex: isDragging || hovered || emphasized ? 30 : 1,
  };

  const editable = Boolean(onUpdate) && scale !== "compact";

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {!isFirst ? <SpineSegment scale={scale} index={globalIndex} /> : null}

      <div
        ref={rowRef}
        className={cn(
          "group relative grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-4 sm:grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,12rem)] sm:gap-x-6",
          scale === "detailed" ? "py-1.5" : "py-0.5",
          emphasized &&
            "rounded-xl bg-[rgba(176,141,87,0.06)] ring-1 ring-[rgba(176,141,87,0.12)]",
        )}
        onMouseEnter={() => {
          if (editingSynopsis) return;
          const el = rowRef.current;
          if (!el) return;
          const rect = el.getBoundingClientRect();
          setAnchor({ x: rect.left + 48, y: rect.top });
          setHovered(true);
        }}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="relative flex justify-center pt-1.5">
          <button
            type="button"
            className="relative z-[1] cursor-grab active:cursor-grabbing"
            title={scene.pov ? `POV · ${scene.pov}` : status.label}
            {...attributes}
            {...listeners}
          >
            <motion.span
              className="flex items-center justify-center rounded-full"
              style={{
                width: size + 8,
                height: size + 8,
                boxShadow: scene.pov
                  ? `0 0 0 ${emphasized ? 2.5 : 1.5}px ${ring}`
                  : undefined,
              }}
              whileHover={{ scale: 1.12 }}
              transition={{ type: "spring", stiffness: 420, damping: 28 }}
            >
              <span
                className="block rounded-full shadow-[0_1px_6px_rgba(45,42,38,0.12)]"
                style={{
                  width: size,
                  height: size,
                  backgroundColor: status.color,
                  opacity: scene.wordCount === 0 ? 0.5 : 0.92,
                }}
              />
            </motion.span>
          </button>
        </div>

        <div
          className={cn(
            "min-w-0 pr-2",
            scale === "compact" ? "py-0.5" : "py-1",
          )}
        >
          {showChapterCue ? (
            <p className="mb-1 font-[family-name:var(--font-ui)] text-[0.6rem] uppercase tracking-[0.2em] text-[var(--ink-faint)]">
              {item.chapterTitle}
            </p>
          ) : null}
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <h3
              className={cn(
                "font-[family-name:var(--font-display)] font-medium tracking-wide text-[var(--ink)]",
                scale === "compact" ? "text-[0.95rem]" : "text-lg",
              )}
            >
              {scene.title || "Untitled Scene"}
            </h3>
            {threadDots.length > 0 ? (
              <span
                className="inline-flex items-center gap-1"
                aria-label="Plot threads"
              >
                {threadDots.map((t) => (
                  <span
                    key={t.id}
                    title={t.name}
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: t.color }}
                  />
                ))}
              </span>
            ) : null}
            {scale !== "compact" ? (
              <span className="font-[family-name:var(--font-ui)] text-[0.65rem] tabular-nums text-[var(--ink-faint)]">
                {String(globalIndex + 1).padStart(2, "0")}
                {scene.wordCount > 0
                  ? ` · ${formatWordCount(scene.wordCount)}w`
                  : ""}
                {scene.act?.trim() ? ` · Act ${scene.act.trim()}` : ""}
              </span>
            ) : null}
          </div>

          {editable ? (
            <div className="mt-1.5 max-w-2xl">
              {editingSynopsis ? (
                <textarea
                  autoFocus
                  defaultValue={scene.synopsis}
                  rows={scale === "detailed" ? 3 : 2}
                  onBlur={(e) => {
                    const next = e.target.value;
                    setEditingSynopsis(false);
                    if (next !== scene.synopsis) {
                      onUpdate?.(scene.id, { synopsis: next });
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setEditingSynopsis(false);
                    }
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.currentTarget.blur();
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full resize-none rounded-lg border border-[rgba(45,42,38,0.12)] bg-[var(--paper)] px-2.5 py-2 font-[family-name:var(--font-ui)] text-[0.85rem] leading-relaxed text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                />
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setHovered(false);
                    setEditingSynopsis(true);
                  }}
                  className={cn(
                    "w-full rounded-lg px-1 py-0.5 text-left font-[family-name:var(--font-ui)] leading-relaxed text-[var(--ink-muted)] transition-colors hover:bg-[rgba(45,42,38,0.04)] hover:text-[var(--ink)]",
                    scale === "detailed"
                      ? "line-clamp-3 text-[0.85rem]"
                      : "line-clamp-2 text-[0.8rem]",
                    !scene.synopsis?.trim() && "italic text-[var(--ink-faint)]",
                  )}
                >
                  {scene.synopsis?.trim() || "Add synopsis…"}
                </button>
              )}

              <div className="mt-2 flex flex-wrap gap-1">
                {STATUS_OPTIONS.map((s) => {
                  const meta = SCENE_STATUS_META[s];
                  const active = scene.status === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!active) onUpdate?.(scene.id, { status: s });
                      }}
                      className={cn(
                        "rounded-full px-2 py-0.5 font-[family-name:var(--font-ui)] text-[0.65rem] transition-opacity",
                        active ? "ring-1 ring-[rgba(45,42,38,0.12)]" : "opacity-55 hover:opacity-100",
                      )}
                      style={{ color: meta.color, backgroundColor: meta.bg }}
                    >
                      {meta.shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : scale !== "compact" ? (
            <p
              className={cn(
                "mt-1 max-w-2xl font-[family-name:var(--font-ui)] leading-relaxed text-[var(--ink-muted)]",
                scale === "detailed"
                  ? "line-clamp-3 text-[0.85rem]"
                  : "line-clamp-2 text-[0.8rem]",
              )}
            >
              {scene.synopsis?.trim() || "—"}
            </p>
          ) : null}

          {scale === "detailed" && !editable ? (
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-[family-name:var(--font-ui)] text-[0.65rem] text-[var(--ink-faint)]">
              <span style={{ color: status.color }}>{status.label}</span>
              {scene.pov ? <span>POV · {scene.pov}</span> : null}
              {scene.location ? <span>{scene.location}</span> : null}
              {scene.labels.slice(0, 2).map((l) => (
                <span key={l}>{l}</span>
              ))}
            </div>
          ) : null}

          {scale === "detailed" && editable && scene.pov ? (
            <p className="mt-1.5 font-[family-name:var(--font-ui)] text-[0.65rem] text-[var(--ink-faint)]">
              POV · {scene.pov}
              {scene.location ? ` · ${scene.location}` : ""}
            </p>
          ) : null}
        </div>

        {scale !== "compact" ? (
          <div className="hidden pt-2 sm:block">
            <p
              className="font-[family-name:var(--font-ui)] text-[0.65rem] tracking-wide"
              style={{ color: status.color }}
            >
              {status.shortLabel}
            </p>
            {scene.pov ? (
              <p
                className="mt-1 font-[family-name:var(--font-ui)] text-[0.65rem]"
                style={{ color: emphasized ? ring : undefined }}
              >
                <span className={emphasized ? "" : "text-[var(--ink-faint)]"}>
                  {scene.pov}
                </span>
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {typeof document !== "undefined" ? (
        <AnimatePresence>
          {hovered && !isDragging && !editingSynopsis && anchor ? (
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
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.98 }}
      transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
      className="pointer-events-none fixed z-[80]"
      style={{
        left: Math.min(x + 24, window.innerWidth - 300),
        top: Math.max(12, y),
      }}
    >
      <NodePreview scene={scene} />
    </motion.div>,
    document.body,
  );
}

export function PlotBeatOverlay({
  scene,
  scale,
}: {
  scene: Scene;
  scale: OutlineScale;
}) {
  const status = SCENE_STATUS_META[scene.status];
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[rgba(45,42,38,0.06)] bg-[rgba(247,243,234,0.95)] px-4 py-3 shadow-[0_16px_40px_rgba(45,42,38,0.14)] backdrop-blur-xl">
      <span
        className="h-3 w-3 rounded-full"
        style={{ backgroundColor: status.color }}
      />
      <div>
        <p className="font-[family-name:var(--font-display)] text-base font-medium tracking-wide text-[var(--ink)]">
          {scene.title}
        </p>
        {scale !== "compact" && scene.synopsis ? (
          <p className="mt-0.5 max-w-[14rem] truncate font-[family-name:var(--font-ui)] text-[0.7rem] text-[var(--ink-muted)]">
            {scene.synopsis}
          </p>
        ) : null}
      </div>
    </div>
  );
}
