"use client";

import { useEffect, useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, MoreHorizontal, Plus } from "lucide-react";
import { ProgressIndicator } from "@/components/Outline/ProgressIndicator";
import { TimelineConnector } from "@/components/Outline/TimelineConnector";
import { TimelineNode } from "@/components/Outline/TimelineNode";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  chapterProgress,
  chapterWordCount,
} from "@/lib/scenes";
import type { Chapter, OutlineScale, Scene } from "@/lib/types";
import { readingMinutes } from "@/lib/types";
import { cn, formatWordCount } from "@/lib/utils";

export function ChapterLane({
  chapter,
  index,
  scenes,
  scale,
  collapsed,
  onToggle,
  onRename,
  onAddScene,
  onDeleteChapter,
  dropIndex,
}: {
  chapter: Chapter;
  index: number;
  scenes: Scene[];
  scale: OutlineScale;
  collapsed: boolean;
  onToggle: () => void;
  onRename: (title: string) => void;
  onAddScene: () => void;
  onDeleteChapter: () => void;
  dropIndex: number | null;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(chapter.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const words = chapterWordCount({ ...chapter, scenes });
  const progress = chapterProgress({ ...chapter, scenes });
  const mins = readingMinutes(words);

  const { setNodeRef, isOver } = useDroppable({
    id: `lane:${chapter.id}`,
    data: { type: "lane", chapterId: chapter.id },
  });

  useEffect(() => {
    setDraft(chapter.title);
  }, [chapter.title]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commit() {
    setEditing(false);
    const next = draft.trim() || chapter.title;
    setDraft(next);
    if (next !== chapter.title) onRename(next);
  }

  const lanePad =
    scale === "compact" ? "py-4" : scale === "detailed" ? "py-8" : "py-6";

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.04, ease: [0.25, 0.1, 0.25, 1] }}
      className={cn(
        "rounded-3xl border border-transparent px-3 transition-colors duration-300 sm:px-5",
        isOver && "border-[rgba(176,141,87,0.25)] bg-[rgba(176,141,87,0.04)]",
      )}
    >
      <header className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={onToggle}
          className="rounded-lg p-1 text-[var(--ink-faint)] transition-colors hover:text-[var(--ink)]"
          aria-label={collapsed ? "Expand chapter" : "Collapse chapter"}
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-300",
              collapsed && "-rotate-90",
            )}
            strokeWidth={1.5}
          />
        </button>

        <span className="font-[family-name:var(--font-ui)] text-[0.65rem] tabular-nums text-[var(--ink-faint)]">
          {String(index + 1).padStart(2, "0")}
        </span>

        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                setDraft(chapter.title);
                setEditing(false);
              }
            }}
            className="min-w-[8rem] flex-1 bg-transparent font-[family-name:var(--font-display)] text-xl font-medium tracking-wide text-[var(--ink)] outline-none sm:text-2xl"
          />
        ) : (
          <button
            type="button"
            onDoubleClick={() => setEditing(true)}
            onClick={onToggle}
            className="min-w-0 flex-1 text-left font-[family-name:var(--font-display)] text-xl font-medium tracking-wide text-[var(--ink)] sm:text-2xl"
          >
            {chapter.title}
          </button>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-3 sm:gap-4">
          <span className="font-[family-name:var(--font-ui)] text-[0.7rem] text-[var(--ink-faint)]">
            {scenes.length} {scenes.length === 1 ? "scene" : "scenes"}
          </span>
          <span className="font-[family-name:var(--font-ui)] text-[0.7rem] tabular-nums text-[var(--ink-muted)]">
            {formatWordCount(words)} words
          </span>
          <ProgressIndicator value={progress} className="hidden sm:flex" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="rounded-lg p-1.5 text-[var(--ink-faint)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--ink)]"
                aria-label="Chapter menu"
              >
                <MoreHorizontal className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onAddScene}>Add scene</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={onDeleteChapter}>
                Delete chapter
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="mb-2 ml-8 h-px bg-[rgba(45,42,38,0.08)]" />

      <AnimatePresence initial={false}>
        {!collapsed ? (
          <motion.div
            key="lane"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div
              ref={setNodeRef}
              className={cn(
                "relative ml-2 flex items-start overflow-x-auto pb-2 folio-scroll",
                lanePad,
              )}
            >
              <SortableContext
                items={scenes.map((s) => s.id)}
                strategy={horizontalListSortingStrategy}
              >
                <div className="flex min-w-full items-start gap-0 px-2">
                  {scenes.map((scene, i) => (
                    <div key={scene.id} className="flex items-start">
                      {i > 0 ? (
                        <div className="mt-[11px] flex items-center">
                          <TimelineConnector scale={scale} index={i} />
                        </div>
                      ) : null}
                      <TimelineNode
                        scene={scene}
                        index={i}
                        chapterId={chapter.id}
                        scale={scale}
                        insertBefore={dropIndex === i}
                      />
                    </div>
                  ))}
                  {scenes.length === 0 ? (
                    <button
                      type="button"
                      onClick={onAddScene}
                      className="flex items-center gap-2 rounded-2xl border border-dashed border-[rgba(45,42,38,0.12)] px-5 py-4 font-[family-name:var(--font-ui)] text-sm text-[var(--ink-faint)] transition-colors hover:border-[var(--accent)] hover:text-[var(--ink-muted)]"
                    >
                      <Plus className="h-4 w-4" strokeWidth={1.5} />
                      Add first scene
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={onAddScene}
                      className="ml-3 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--ink-faint)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--ink)]"
                      aria-label="Add scene"
                    >
                      <Plus className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                  )}
                </div>
              </SortableContext>
            </div>

            <div className="mb-6 ml-10 flex flex-wrap gap-x-6 gap-y-1 font-[family-name:var(--font-ui)] text-[0.7rem] text-[var(--ink-faint)]">
              <span>Word count: {formatWordCount(words)}</span>
              <span>
                Estimated reading: {mins < 1 ? "< 1 min" : `${mins} min`}
              </span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.section>
  );
}
