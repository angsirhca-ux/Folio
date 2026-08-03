"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SceneCardMenu } from "@/components/Storyboard/ContextMenu";
import { StatusBadge } from "@/components/Storyboard/StatusBadge";
import type { Scene, SceneStatus, StoryboardZoom } from "@/lib/types";
import { formatRelativeDate } from "@/lib/scenes";
import { cn, formatWordCount } from "@/lib/utils";

const ZOOM_META: Record<
  StoryboardZoom,
  { synopsisLines: string; pad: string; title: string; showMeta: boolean }
> = {
  tiny: {
    synopsisLines: "line-clamp-2",
    pad: "p-3",
    title: "text-sm",
    showMeta: false,
  },
  small: {
    synopsisLines: "line-clamp-3",
    pad: "p-3.5",
    title: "text-[0.95rem]",
    showMeta: true,
  },
  medium: {
    synopsisLines: "line-clamp-4",
    pad: "p-4",
    title: "text-base",
    showMeta: true,
  },
  large: {
    synopsisLines: "line-clamp-6",
    pad: "p-5",
    title: "text-lg",
    showMeta: true,
  },
};

export interface SceneCardProps {
  scene: Scene;
  chapterId: string;
  zoom: StoryboardZoom;
  onUpdateTitle: (title: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: () => void;
  onConvertToChapter: () => void;
  onStatusChange: (status: SceneStatus) => void;
  onOpen?: () => void;
  onInspect?: () => void;
  overlay?: boolean;
  style?: React.CSSProperties;
}

export const SceneCard = forwardRef<HTMLDivElement, SceneCardProps>(
  function SceneCard(
    {
      scene,
      // Used by SortableSceneCard for dnd data — must not hit the DOM.
      chapterId: _chapterId,
      zoom,
      onUpdateTitle,
      onDuplicate,
      onDelete,
      onMove,
      onConvertToChapter,
      onStatusChange,
      onOpen,
      onInspect,
      overlay,
      style,
      ...rest
    },
    ref,
  ) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(scene.title);
    const inputRef = useRef<HTMLInputElement>(null);
    const meta = ZOOM_META[zoom];
    const isEmpty =
      (!scene.title || scene.title === "Untitled Scene") && !scene.synopsis;

    useEffect(() => {
      setDraft(scene.title);
    }, [scene.title]);

    useEffect(() => {
      if (editing) inputRef.current?.focus();
    }, [editing]);

    function commitTitle() {
      setEditing(false);
      const next = draft.trim() || "Untitled Scene";
      setDraft(next);
      if (next !== scene.title) onUpdateTitle(next);
    }

    return (
      <motion.div
        ref={ref}
        layout={!overlay}
        initial={overlay ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ type: "spring", stiffness: 420, damping: 32 }}
        whileHover={
          overlay
            ? undefined
            : {
                y: -3,
                boxShadow: "0 16px 40px rgba(45,42,38,0.12)",
              }
        }
        style={style}
        className={cn(
          "group relative flex h-full cursor-grab flex-col rounded-2xl border border-[rgba(45,42,38,0.05)]",
          "bg-[#F7F3EA] text-[var(--ink)] shadow-[0_4px_18px_rgba(45,42,38,0.06)]",
          "active:cursor-grabbing",
          overlay &&
            "cursor-grabbing shadow-[0_24px_60px_rgba(45,42,38,0.18)] ring-1 ring-[rgba(176,141,87,0.25)]",
          meta.pad,
        )}
        onDoubleClick={() => setEditing(true)}
        onClick={() => {
          if (!editing) onOpen?.();
        }}
        {...rest}
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <StatusBadge status={scene.status} compact={zoom === "tiny"} />
          {!overlay ? (
            <SceneCardMenu
              actions={{
                onRename: () => setEditing(true),
                onDuplicate,
                onDelete,
                onMove,
                onConvertToChapter,
                onStatusChange,
                onInspect,
              }}
            />
          ) : null}
        </div>

        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitTitle}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitTitle();
              if (e.key === "Escape") {
                setDraft(scene.title);
                setEditing(false);
              }
            }}
            className={cn(
              "mb-2 w-full bg-transparent font-[family-name:var(--font-display)] font-medium tracking-wide text-[var(--ink)] outline-none",
              meta.title,
            )}
          />
        ) : (
          <h3
            className={cn(
              "mb-2 font-[family-name:var(--font-display)] font-medium tracking-wide text-[var(--ink)]",
              meta.title,
            )}
          >
            {scene.title || "Untitled Scene"}
          </h3>
        )}

        <p
          className={cn(
            "flex-1 font-[family-name:var(--font-ui)] text-[0.8rem] leading-relaxed text-[var(--ink-muted)]",
            meta.synopsisLines,
            isEmpty && "italic text-[var(--ink-faint)]",
          )}
        >
          {scene.synopsis?.trim() || "Click to begin writing…"}
        </p>

        {meta.showMeta ? (
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-[rgba(45,42,38,0.06)] pt-3">
            <span className="font-[family-name:var(--font-ui)] text-[0.65rem] tabular-nums text-[var(--ink-faint)]">
              {formatWordCount(scene.wordCount)} words
            </span>
            {scene.pov ? (
              <span className="font-[family-name:var(--font-ui)] text-[0.65rem] text-[var(--ink-muted)]">
                POV · {scene.pov}
              </span>
            ) : null}
            {scene.labels.slice(0, 2).map((label) => (
              <span
                key={label}
                className="rounded-full bg-[rgba(176,141,87,0.1)] px-2 py-0.5 font-[family-name:var(--font-ui)] text-[0.6rem] tracking-wide text-[var(--accent)]"
              >
                {label}
              </span>
            ))}
            <span className="ml-auto font-[family-name:var(--font-ui)] text-[0.6rem] text-[var(--ink-faint)]">
              {formatRelativeDate(scene.updatedAt)}
            </span>
          </div>
        ) : null}
      </motion.div>
    );
  },
);

export function SortableSceneCard(props: SceneCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: props.scene.id,
    data: { type: "scene", chapterId: props.chapterId, scene: props.scene },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    zIndex: isDragging ? 1 : undefined,
  };

  return (
    <SceneCard
      ref={setNodeRef}
      style={style}
      {...props}
      {...attributes}
      {...listeners}
    />
  );
}
