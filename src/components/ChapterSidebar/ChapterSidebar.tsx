"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  GripVertical,
  PanelLeftClose,
  Plus,
  Trash2,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SceneStatusDot } from "@/components/SceneStatusDot";
import { nextSceneStatus, type SceneStatus } from "@/lib/types";
import { useBook } from "@/providers/BookProvider";
import { cn } from "@/lib/utils";

export function ChapterSidebar() {
  const {
    book,
    settings,
    selectChapter,
    selectAdjacentChapter,
    addChapter,
    deleteChapter,
    updateChapterTitle,
    moveChapter,
    reorderChapters,
    focusScene,
    updateScene,
    toggleSidebar,
  } = useBook();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [activeSceneIndex, setActiveSceneIndex] = useState<number | null>(null);

  const pendingChapter = book.chapters.find((c) => c.id === pendingDeleteId);
  const isLastChapter = book.chapters.length <= 1;

  // Keep the active chapter’s scene list open so the arrow feels immediate
  useEffect(() => {
    const id = book.activeChapterId;
    setExpandedIds((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
  }, [book.activeChapterId]);

  function onDragStart(index: number) {
    setDragIndex(index);
  }

  function onDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) {
      setOverIndex(null);
      return;
    }
    setOverIndex(index);
  }

  function onDrop(index: number) {
    if (dragIndex !== null && dragIndex !== index) {
      reorderChapters(dragIndex, index);
    }
    setDragIndex(null);
    setOverIndex(null);
  }

  function onDragEnd() {
    setDragIndex(null);
    setOverIndex(null);
  }

  function toggleExpanded(chapterId: string) {
    setExpandedIds((prev) => ({ ...prev, [chapterId]: !prev[chapterId] }));
  }

  const navOpen = settings.appNavOpen ?? true;

  return (
    <>
      <AnimatePresence initial={false}>
        {settings.sidebarOpen && !settings.fullscreen ? (
          <motion.aside
            key="sidebar"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            className={cn(
              "folio-chrome folio-scroll fixed bottom-0 top-0 z-30 flex w-[15.5rem] flex-col border-r border-[var(--border)] bg-[var(--sidebar)] px-4 py-8 transition-[left] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
              navOpen ? "left-[4.75rem] md:left-[13.5rem]" : "left-0",
            )}
          >
            <div className="mb-8 flex items-start justify-between gap-2 px-2">
              <div className="min-w-0">
                <p className="font-[family-name:var(--font-display)] text-[0.65rem] uppercase tracking-[0.3em] text-[var(--ink-faint)]">
                  Contents
                </p>
                <h2 className="mt-2 truncate font-[family-name:var(--font-display)] text-lg font-medium tracking-wide text-[var(--ink)]">
                  {book.title || "Untitled"}
                </h2>
              </div>
              <button
                type="button"
                onClick={toggleSidebar}
                aria-label="Collapse contents"
                title="Collapse contents"
                className="mt-0.5 shrink-0 rounded-lg p-1.5 text-[var(--ink-faint)] transition-colors hover:bg-[rgba(45,42,38,0.05)] hover:text-[var(--ink)]"
              >
                <PanelLeftClose className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>

            <nav
              data-chapter-nav
              className="flex-1 space-y-0.5 overflow-y-auto pr-1 outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
              tabIndex={0}
              aria-label="Chapters"
              onKeyDown={(e) => {
                if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                if ((e.target as HTMLElement).tagName === "INPUT") return;
                e.preventDefault();
                selectAdjacentChapter(e.key === "ArrowUp" ? "up" : "down");
                window.requestAnimationFrame(() => {
                  const active = document.querySelector<HTMLButtonElement>(
                    "[data-chapter-nav] [data-chapter-active='true']",
                  );
                  active?.focus();
                });
              }}
            >
              {book.chapters.map((chapter, index) => {
                const active = chapter.id === book.activeChapterId;
                const isDragging = dragIndex === index;
                const isOver = overIndex === index && dragIndex !== index;
                const canMoveUp = index > 0;
                const canMoveDown = index < book.chapters.length - 1;
                // Use storyboard scene cards — don't re-parse HTML on every keystroke flush.
                const scenes = chapter.scenes ?? [];
                const hasScenes = scenes.length > 1;
                const expanded = Boolean(expandedIds[chapter.id]);

                return (
                  <div
                    key={chapter.id}
                    className={cn(
                      "rounded-md transition-all duration-300",
                      active && "bg-[var(--accent-soft)]",
                    )}
                  >
                    <div
                      draggable={editingId !== chapter.id}
                      onDragStart={() => onDragStart(index)}
                      onDragOver={(e) => onDragOver(e, index)}
                      onDrop={() => onDrop(index)}
                      onDragEnd={onDragEnd}
                      className={cn(
                        "group relative flex items-center rounded-md transition-all duration-300",
                        !active && "hover:bg-[var(--accent-soft)]",
                        isDragging && "opacity-40",
                        isOver && "ring-1 ring-[var(--accent)]/40",
                      )}
                    >
                      {hasScenes ? (
                        <button
                          type="button"
                          aria-label={
                            expanded
                              ? `Hide scenes in ${chapter.title}`
                              : `Show scenes in ${chapter.title}`
                          }
                          aria-expanded={expanded}
                          onClick={(e) => {
                            e.stopPropagation();
                            selectChapter(chapter.id);
                            toggleExpanded(chapter.id);
                          }}
                          className="flex h-8 w-5 shrink-0 items-center justify-center text-[var(--ink-faint)] transition-colors hover:text-[var(--ink)]"
                        >
                          {expanded ? (
                            <ChevronDown className="h-3 w-3" strokeWidth={1.75} />
                          ) : (
                            <ChevronRight className="h-3 w-3" strokeWidth={1.75} />
                          )}
                        </button>
                      ) : (
                        <span
                          aria-hidden
                          className="flex h-8 w-5 shrink-0 cursor-grab items-center justify-center text-[var(--ink-faint)] opacity-0 transition-opacity duration-300 active:cursor-grabbing group-hover:opacity-70"
                          title="Drag to reorder"
                        >
                          <GripVertical
                            className="h-3.5 w-3.5"
                            strokeWidth={1.5}
                          />
                        </span>
                      )}

                      <button
                        type="button"
                        data-chapter-active={active ? "true" : undefined}
                        onClick={() => {
                          selectChapter(chapter.id);
                          if (hasScenes) {
                            setExpandedIds((prev) => ({
                              ...prev,
                              [chapter.id]: true,
                            }));
                          }
                          setActiveSceneIndex(null);
                        }}
                        onDoubleClick={() => setEditingId(chapter.id)}
                        className="flex min-w-0 flex-1 items-center gap-2 py-2.5 pr-1 text-left"
                      >
                        <span className="w-5 shrink-0 font-[family-name:var(--font-ui)] text-[0.65rem] tabular-nums leading-5 text-[var(--ink-faint)]">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        {editingId === chapter.id ? (
                          <input
                            autoFocus
                            value={chapter.title}
                            onChange={(e) =>
                              updateChapterTitle(chapter.id, e.target.value)
                            }
                            onBlur={() => setEditingId(null)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === "Escape") {
                                setEditingId(null);
                              }
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="h-5 min-w-0 flex-1 bg-transparent font-[family-name:var(--font-ui)] text-sm leading-5 text-[var(--ink)]"
                          />
                        ) : (
                          <span
                            className={cn(
                              "block min-w-0 flex-1 truncate font-[family-name:var(--font-ui)] text-sm leading-5 transition-colors",
                              active
                                ? "text-[var(--ink)]"
                                : "text-[var(--ink-muted)] group-hover:text-[var(--ink)]",
                            )}
                          >
                            {chapter.title}
                          </span>
                        )}
                      </button>

                      <div className="mr-1 flex shrink-0 flex-col opacity-0 transition-opacity duration-300 group-hover:opacity-70 group-focus-within:opacity-70">
                        <button
                          type="button"
                          aria-label={`Move ${chapter.title} up`}
                          disabled={!canMoveUp}
                          onClick={(e) => {
                            e.stopPropagation();
                            moveChapter(chapter.id, "up");
                          }}
                          className="rounded p-0.5 text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] disabled:opacity-20"
                        >
                          <ChevronUp className="h-3 w-3" strokeWidth={1.75} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Move ${chapter.title} down`}
                          disabled={!canMoveDown}
                          onClick={(e) => {
                            e.stopPropagation();
                            moveChapter(chapter.id, "down");
                          }}
                          className="rounded p-0.5 text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] disabled:opacity-20"
                        >
                          <ChevronDown className="h-3 w-3" strokeWidth={1.75} />
                        </button>
                      </div>

                      <button
                        type="button"
                        aria-label={`Delete ${chapter.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingDeleteId(chapter.id);
                        }}
                        className="mr-1.5 rounded p-1 opacity-0 transition-opacity duration-300 group-hover:opacity-60 hover:!opacity-100"
                      >
                        <Trash2
                          className="h-3.5 w-3.5 text-[var(--ink-muted)]"
                          strokeWidth={1.5}
                        />
                      </button>
                    </div>

                    <AnimatePresence initial={false}>
                      {hasScenes && expanded ? (
                        <motion.ul
                          key="scenes"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{
                            duration: 0.28,
                            ease: [0.25, 0.1, 0.25, 1],
                          }}
                          className="overflow-hidden pb-1.5 pl-5 pr-1"
                        >
                          {scenes.map((scene, sceneIndex) => {
                            const sceneActive =
                              active && activeSceneIndex === sceneIndex;
                            const status: SceneStatus =
                              scene.status ??
                              (scene.wordCount > 0 ? "draft" : "outline");
                            return (
                              <li key={scene.id}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveSceneIndex(sceneIndex);
                                    focusScene(chapter.id, sceneIndex);
                                  }}
                                  className={cn(
                                    "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors duration-200",
                                    sceneActive
                                      ? "bg-[rgba(176,141,87,0.14)] text-[var(--ink)]"
                                      : "text-[var(--ink-muted)] hover:bg-[rgba(45,42,38,0.04)] hover:text-[var(--ink)]",
                                  )}
                                  title={scene.synopsis || scene.title}
                                >
                                  <SceneStatusDot
                                    status={status}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateScene(scene.id, {
                                        status: nextSceneStatus(status),
                                      });
                                    }}
                                  />
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate font-[family-name:var(--font-ui)] text-[0.75rem] leading-snug">
                                      {scene.title}
                                    </span>
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </motion.ul>
                      ) : null}
                    </AnimatePresence>
                  </div>
                );
              })}
            </nav>

            <button
              type="button"
              onClick={addChapter}
              className="mt-4 flex items-center gap-2 rounded-md px-3 py-2.5 font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)] transition-colors duration-300 hover:bg-[var(--accent-soft)] hover:text-[var(--ink)]"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
              New chapter
            </button>

            <div className="mt-4 space-y-1.5 border-t border-[var(--border)] px-2 pt-4">
              <p className="font-[family-name:var(--font-ui)] text-[0.6rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                Scene status
              </p>
              {(
                [
                  ["outline", "Not started"],
                  ["draft", "Come back to"],
                  ["revising", "Needs revision"],
                  ["final", "Finished"],
                ] as const
              ).map(([id, label]) => (
                <div
                  key={id}
                  className="flex items-center gap-2 font-[family-name:var(--font-ui)] text-[0.65rem] text-[var(--ink-muted)]"
                >
                  <SceneStatusDot status={id} className="mt-0" />
                  {label}
                </div>
              ))}
              <p className="pt-1 font-[family-name:var(--font-ui)] text-[0.6rem] leading-relaxed text-[var(--ink-faint)]">
                Click a scene’s dot to cycle status.
              </p>
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>

      <ConfirmDialog
        open={Boolean(pendingDeleteId)}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
        title={isLastChapter ? "Clear this chapter?" : "Delete chapter?"}
        description={
          isLastChapter
            ? `“${pendingChapter?.title ?? "This chapter"}” is your only chapter. Clearing it shelves the writing in Trash and leaves a blank page.`
            : `“${pendingChapter?.title ?? "This chapter"}” and its text will move to Trash. You can restore them from there.`
        }
        confirmLabel={isLastChapter ? "Clear chapter" : "Move to trash"}
        onConfirm={() => {
          if (pendingDeleteId) deleteChapter(pendingDeleteId);
          setPendingDeleteId(null);
        }}
      />
    </>
  );
}
