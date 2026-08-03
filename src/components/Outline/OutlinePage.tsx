"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { motion } from "framer-motion";
import { ActBand } from "@/components/Outline/ActBand";
import { ChapterMarker } from "@/components/Outline/ChapterMarker";
import {
  EMPTY_FILTERS,
  type OutlineFilters,
} from "@/components/Outline/FiltersPanel";
import { OutlineToolbar } from "@/components/Outline/OutlineToolbar";
import { PlotBeat, PlotBeatOverlay, type PlotBeatItem } from "@/components/Outline/PlotBeat";
import { ThreadTracksView } from "@/components/Outline/ThreadTracksView";
import { ThreadsManager } from "@/components/Outline/ThreadsManager";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useBook } from "@/providers/BookProvider";
import { findScene } from "@/lib/scenes";
import type { Scene } from "@/lib/types";
import { readingMinutes } from "@/lib/types";
import { formatWordCount } from "@/lib/utils";
import { ClaudeDeepenButton } from "@/components/Characters/ClaudeDeepenButton";
import {
  populatePlotThreadsWithClaude,
  useClaudeStatus,
} from "@/hooks/useClaudeEnrichment";

type TimelineEntry =
  | {
      kind: "chapter";
      chapterId: string;
      index: number;
      sceneCount: number;
    }
  | {
      kind: "act";
      act: string;
      key: string;
    }
  | PlotBeatItem;

export function OutlinePage() {
  const router = useRouter();
  const {
    book,
    settings,
    hydrated,
    addChapter,
    addScene,
    updateChapterTitle,
    updateChapterSummary,
    deleteChapter,
    moveScene,
    focusScene,
    setOutlineScale,
    toggleSceneThread,
    deletePlotThread,
    applyPlotThreadsFromClaude,
    updateScene,
  } = useBook();

  const scale = settings.outlineScale ?? "balanced";
  const [viewMode, setViewMode] = useState<"tracks" | "beats">("tracks");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<OutlineFilters>(EMPTY_FILTERS);
  const [collapsedChapters, setCollapsedChapters] = useState<
    Record<string, boolean>
  >({});
  const [activeScene, setActiveScene] = useState<Scene | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [threadsOpen, setThreadsOpen] = useState(false);
  const [highlightThreadId, setHighlightThreadId] = useState<string | null>(
    null,
  );
  const [populateBusy, setPopulateBusy] = useState(false);
  const [populateError, setPopulateError] = useState<string | null>(null);
  const [populateMessage, setPopulateMessage] = useState<string | null>(null);
  const claudeStatus = useClaudeStatus();


  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const filterOptions = useMemo(() => {
    const povs = new Set<string>();
    const characters = new Set<string>();
    const locations = new Set<string>();
    const tags = new Set<string>();
    const acts = new Set<string>();
    for (const ch of book.chapters) {
      for (const s of ch.scenes ?? []) {
        if (s.pov) povs.add(s.pov);
        s.characters?.forEach((c) => characters.add(c));
        if (s.location) locations.add(s.location);
        s.labels?.forEach((t) => tags.add(t));
        if (s.act) acts.add(s.act);
      }
    }
    return {
      povs: [...povs].sort(),
      characters: [...characters].sort(),
      locations: [...locations].sort(),
      tags: [...tags].sort(),
      acts: [...acts].sort(),
    };
  }, [book.chapters]);

  const { entries, beatIds, totals, filteredEmpty } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list: TimelineEntry[] = [];
    const ids: string[] = [];
    let globalIndex = 0;
    let totalScenes = 0;
    let totalWords = 0;
    let anyVisibleBeat = false;
    let lastActKey: string | null = null;
    let actBandIndex = 0;

    // POV / character reshape via highlight (keep in view).
    // Status / location / tag / act still narrow the list.
    book.chapters.forEach((chapter, chapterIndex) => {
      let scenes = [...(chapter.scenes ?? [])];
      if (filters.status !== "all") {
        scenes = scenes.filter((s) => s.status === filters.status);
      }
      if (filters.location !== "all") {
        scenes = scenes.filter((s) => s.location === filters.location);
      }
      if (filters.tag !== "all") {
        scenes = scenes.filter((s) =>
          s.labels?.includes(filters.tag as string),
        );
      }
      if (filters.act !== "all") {
        scenes = scenes.filter((s) => s.act === filters.act);
      }
      if (q) {
        scenes = scenes.filter(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            s.synopsis.toLowerCase().includes(q) ||
            s.pov.toLowerCase().includes(q) ||
            s.location.toLowerCase().includes(q) ||
            chapter.title.toLowerCase().includes(q) ||
            (chapter.summary ?? "").toLowerCase().includes(q),
        );
      }

      totalScenes += chapter.scenes?.length ?? 0;
      totalWords += (chapter.scenes ?? []).reduce(
        (n, s) => n + (s.wordCount || 0),
        0,
      );

      const collapsed = Boolean(collapsedChapters[chapter.id]);

      list.push({
        kind: "chapter",
        chapterId: chapter.id,
        index: chapterIndex,
        sceneCount: scenes.length,
      });

      if (!collapsed) {
        scenes.forEach((scene, sceneIndex) => {
          anyVisibleBeat = true;
          const actKey = scene.act?.trim() || "";
          if (actKey !== lastActKey) {
            lastActKey = actKey;
            list.push({
              kind: "act",
              act: actKey || "Unassigned",
              key: `act-${actBandIndex++}-${actKey || "none"}`,
            });
          }
          const realIndex =
            chapter.scenes.findIndex((s) => s.id === scene.id) ?? sceneIndex;
          list.push({
            kind: "beat",
            scene,
            chapterId: chapter.id,
            chapterTitle: chapter.title,
            globalIndex: globalIndex++,
            sceneIndex: realIndex,
          });
          ids.push(scene.id);
        });
      }
    });

    return {
      entries: list,
      beatIds: ids,
      totals: {
        scenes: totalScenes,
        words: totalWords,
        minutes: readingMinutes(totalWords),
      },
      filteredEmpty: !anyVisibleBeat && book.chapters.length > 0,
    };
  }, [book.chapters, search, filters, collapsedChapters]);

  const highlightActive =
    filters.pov !== "all" || filters.character !== "all";

  function beatMatchesHighlight(scene: Scene): boolean {
    if (filters.pov !== "all" && scene.pov !== filters.pov) return false;
    if (
      filters.character !== "all" &&
      !(scene.characters ?? []).includes(filters.character)
    ) {
      return false;
    }
    return true;
  }

  function collapseAll() {
    const next: Record<string, boolean> = {};
    for (const ch of book.chapters) next[ch.id] = true;
    setCollapsedChapters(next);
  }

  function expandAll() {
    setCollapsedChapters({});
  }

  async function runPopulateThreads() {
    setPopulateBusy(true);
    setPopulateError(null);
    setPopulateMessage(null);
    try {
      const payload = await populatePlotThreadsWithClaude(book);
      if (!payload.threads.length) {
        setPopulateError("Claude found no clear plot threads to add.");
        return;
      }
      applyPlotThreadsFromClaude(payload);
      setViewMode("tracks");
      setPopulateMessage(
        `Added ${payload.threads.length} thread${payload.threads.length === 1 ? "" : "s"} across ${payload.assignments.length} scene${payload.assignments.length === 1 ? "" : "s"}.`,
      );
      window.setTimeout(() => setPopulateMessage(null), 4200);
    } catch (e) {
      setPopulateError(
        e instanceof Error ? e.message : "Could not populate threads.",
      );
    } finally {
      setPopulateBusy(false);
    }
  }

  function onDragStart(event: DragStartEvent) {
    const data = event.active.data.current;
    if (data?.type === "scene" && data.scene) {
      setActiveScene(data.scene as Scene);
    }
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveScene(null);
    if (!over || active.id === over.id) return;

    const activeData = active.data.current;
    if (activeData?.type !== "scene") return;

    const overData = over.data.current;
    const sceneId = String(active.id);
    const found = findScene(book.chapters, sceneId);
    if (!found) return;

    if (overData?.type === "scene") {
      const toChapterId = overData.chapterId as string;
      const toIndex = overData.sceneIndex as number;
      moveScene(sceneId, toChapterId, toIndex);
      return;
    }
  }

  if (!hydrated) {
    return <OutlineSkeleton />;
  }

  const showEmpty =
    book.chapters.length === 0 ||
    (book.chapters.length === 1 &&
      (book.chapters[0].scenes?.length ?? 0) <= 1 &&
      book.chapters[0].scenes.every(
        (s) =>
          (!s.title || s.title === "Untitled Scene") &&
          !s.synopsis &&
          !s.wordCount,
      ));

  return (
    <div className="outline-canvas relative min-h-full">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 55% 30% at 50% 0%, rgba(176,141,87,0.1), transparent 55%),
            linear-gradient(180deg, transparent 0%, rgba(237,232,224,0.4) 100%)
          `,
        }}
      />

      <OutlineToolbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        search={search}
        onSearchChange={setSearch}
        filters={filters}
        onFiltersChange={setFilters}
        filterOptions={filterOptions}
        scale={scale}
        onScaleChange={setOutlineScale}
        onCollapseAll={collapseAll}
        onExpandAll={expandAll}
        onAddChapter={() => addChapter()}
        onManageThreads={() => setThreadsOpen(true)}
        populateSlot={
          <ClaudeDeepenButton
            configured={claudeStatus?.configured ?? null}
            busy={populateBusy}
            onClick={() => void runPopulateThreads()}
            label="Populate with Claude"
            title="Read the manuscript and propose colored plot threads across scenes"
          />
        }
        threads={book.plotThreads ?? []}
        highlightThreadId={highlightThreadId}
        onHighlightThreadId={setHighlightThreadId}
      />

      {populateError || populateMessage ? (
        <p
          className={`px-4 pb-1 font-[family-name:var(--font-ui)] text-sm sm:px-6 lg:px-10 ${
            populateError ? "text-[#6B3A2A]" : "text-[var(--accent)]"
          }`}
        >
          {populateError || populateMessage}
        </p>
      ) : null}

      <div
        className={
          viewMode === "tracks"
            ? "relative flex min-h-[calc(100vh-8rem)] flex-col"
            : "relative mx-auto max-w-4xl px-4 pb-32 pt-2 sm:px-6 lg:px-8"
        }
      >
        <header
          className={
            viewMode === "tracks"
              ? "mb-6 max-w-2xl px-4 sm:px-6 lg:px-10"
              : "mb-12 max-w-2xl"
          }
        >
          <p className="font-[family-name:var(--font-display)] text-[0.65rem] uppercase tracking-[0.3em] text-[var(--ink-faint)]">
            Timeline
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-medium tracking-wide text-[var(--ink)] sm:text-4xl">
            {book.title || "Untitled Manuscript"}
          </h1>
          <p className="mt-3 max-w-xl font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
            {viewMode === "tracks"
              ? "Plot threads across scenes—spot quiet stretches and weave strands back in."
              : "Every plot beat in reading order—act bands mark structure; click a synopsis to edit."}
          </p>
          <p className="mt-4 font-[family-name:var(--font-ui)] text-sm text-[var(--ink-faint)]">
            {book.chapters.length}{" "}
            {book.chapters.length === 1 ? "chapter" : "chapters"} ·{" "}
            {totals.scenes} {totals.scenes === 1 ? "beat" : "beats"} ·{" "}
            {formatWordCount(totals.words)} words · ~{totals.minutes} min
            {(book.plotThreads ?? []).length > 0
              ? ` · ${(book.plotThreads ?? []).length} ${(book.plotThreads ?? []).length === 1 ? "thread" : "threads"}`
              : ""}
          </p>
        </header>

        {showEmpty ? (
          <EmptyOutline onCreate={() => addChapter()} />
        ) : viewMode === "tracks" ? (
          <ThreadTracksView
            chapters={book.chapters}
            threads={book.plotThreads ?? []}
            highlightThreadId={highlightThreadId}
            highlightPov={filters.pov !== "all" ? filters.pov : null}
            highlightCharacter={
              filters.character !== "all" ? filters.character : null
            }
            onToggleCell={toggleSceneThread}
            onOpenScene={(chapterId, sceneIndex) => {
              focusScene(chapterId, sceneIndex);
              router.push("/");
            }}
            onManageThreads={() => setThreadsOpen(true)}
            onDeleteThread={(threadId) => {
              deletePlotThread(threadId);
              setHighlightThreadId((id) => (id === threadId ? null : id));
            }}
          />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={beatIds}
              strategy={verticalListSortingStrategy}
            >
              <div className="relative">
                <div
                  aria-hidden
                  className="pointer-events-none absolute bottom-4 left-[0.55rem] top-4 w-px bg-[rgba(45,42,38,0.1)] sm:left-[0.65rem]"
                />

                {entries.map((entry, entryIndex) => {
                  if (entry.kind === "chapter") {
                    const chapter = book.chapters.find(
                      (c) => c.id === entry.chapterId,
                    );
                    if (!chapter) return null;
                    const collapsed = Boolean(collapsedChapters[chapter.id]);
                    return (
                      <div key={`ch-${chapter.id}`}>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() =>
                            setCollapsedChapters((prev) => ({
                              ...prev,
                              [chapter.id]: !prev[chapter.id],
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setCollapsedChapters((prev) => ({
                                ...prev,
                                [chapter.id]: !prev[chapter.id],
                              }));
                            }
                          }}
                          className="cursor-pointer text-left"
                        >
                          <ChapterMarker
                            chapter={chapter}
                            index={entry.index}
                            scale={scale}
                            sceneCount={entry.sceneCount}
                            isFirst={entry.index === 0}
                            onRename={(title) =>
                              updateChapterTitle(chapter.id, title)
                            }
                            onSummaryChange={(summary) =>
                              updateChapterSummary(chapter.id, summary)
                            }
                          />
                        </div>
                        {collapsed ? (
                          <p className="mb-2 ml-9 font-[family-name:var(--font-ui)] text-[0.7rem] text-[var(--ink-faint)] sm:ml-12">
                            {entry.sceneCount} collapsed{" "}
                            {entry.sceneCount === 1 ? "beat" : "beats"} · click
                            to expand
                          </p>
                        ) : null}
                        {!collapsed && entry.sceneCount === 0 ? (
                          <button
                            type="button"
                            onClick={() => addScene(chapter.id)}
                            className="mb-4 ml-9 rounded-xl border border-dashed border-[rgba(45,42,38,0.12)] px-4 py-3 font-[family-name:var(--font-ui)] text-sm text-[var(--ink-faint)] transition-colors hover:border-[var(--accent)] hover:text-[var(--ink-muted)] sm:ml-12"
                          >
                            Add the first beat in this chapter
                          </button>
                        ) : null}
                      </div>
                    );
                  }

                  if (entry.kind === "act") {
                    return (
                      <ActBand
                        key={entry.key}
                        act={entry.act}
                        isFirst={entryIndex === 0}
                      />
                    );
                  }

                  const beats = entries.filter(
                    (e): e is PlotBeatItem => e.kind === "beat",
                  );
                  const beatPos = beats.findIndex(
                    (b) => b.scene.id === entry.scene.id,
                  );
                  const match = beatMatchesHighlight(entry.scene);

                  return (
                    <div
                      key={entry.scene.id}
                      onDoubleClick={() => {
                        focusScene(entry.chapterId, entry.sceneIndex);
                        router.push("/");
                      }}
                    >
                      <PlotBeat
                        item={entry}
                        scale={scale}
                        isFirst={beatPos === 0}
                        isLast={beatPos === beats.length - 1}
                        threads={book.plotThreads ?? []}
                        dimmed={highlightActive && !match}
                        emphasized={highlightActive && match}
                        onUpdate={(sceneId, partial) =>
                          updateScene(sceneId, partial)
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </SortableContext>

            <DragOverlay>
              {activeScene ? (
                <PlotBeatOverlay scene={activeScene} scale={scale} />
              ) : null}
            </DragOverlay>
          </DndContext>
        )}

        {filteredEmpty && !showEmpty && viewMode === "beats" ? (
          <p className="mt-10 text-center font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)]">
            No beats match these filters.
          </p>
        ) : null}
      </div>

      <ThreadsManager
        open={threadsOpen}
        onClose={() => setThreadsOpen(false)}
        onDeleted={(threadId) =>
          setHighlightThreadId((id) => (id === threadId ? null : id))
        }
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete chapter?"
        description="This chapter and its scenes will move to Trash. You can restore them from there."
        confirmLabel="Move to trash"
        onConfirm={() => {
          if (pendingDelete) deleteChapter(pendingDelete);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}

function EmptyOutline({ onCreate }: { onCreate: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.25, 0.1, 0.25, 1] }}
      className="mx-auto mt-8 flex max-w-md flex-col items-center px-6 py-16 text-center"
    >
      <svg
        width="48"
        height="120"
        viewBox="0 0 48 120"
        fill="none"
        aria-hidden
        className="mb-8 opacity-70"
      >
        <path
          d="M24 8v104"
          stroke="rgba(45,42,38,0.18)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="24" cy="20" r="5" fill="#9C9590" opacity="0.7" />
        <circle cx="24" cy="48" r="6" fill="#B89A5E" opacity="0.75" />
        <circle cx="24" cy="76" r="5" fill="#B07D6A" opacity="0.7" />
        <circle cx="24" cy="104" r="7" fill="#7A9588" opacity="0.8" />
      </svg>
      <p className="font-[family-name:var(--font-display)] text-2xl font-medium tracking-wide text-[var(--ink)] sm:text-3xl">
        Every great story begins with a single chapter.
      </p>
      <p className="mt-3 font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
        Build a connected spine of plot beats—one glance from opening to end.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-8 rounded-full bg-[var(--accent)] px-5 py-2.5 font-[family-name:var(--font-ui)] text-sm text-[var(--paper)] transition-opacity hover:opacity-90"
      >
        Create First Chapter
      </button>
    </motion.div>
  );
}

function OutlineSkeleton() {
  return (
    <div className="min-h-screen px-6 py-8 md:px-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="h-10 w-64 animate-pulse rounded bg-[rgba(45,42,38,0.05)]" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <div className="h-3 w-3 animate-pulse rounded-full bg-[rgba(45,42,38,0.08)]" />
            <div className="h-12 flex-1 animate-pulse rounded-xl bg-[rgba(45,42,38,0.04)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
