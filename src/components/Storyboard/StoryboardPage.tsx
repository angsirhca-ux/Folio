"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { AnimatePresence, motion } from "framer-motion";
import { ChapterSection } from "@/components/Storyboard/ChapterSection";
import { DragOverlayCard } from "@/components/Storyboard/DragOverlay";
import { SceneWritePopup } from "@/components/Storyboard/SceneWritePopup";
import { StoryboardToolbar } from "@/components/Storyboard/StoryboardToolbar";
import { SceneInspector } from "@/components/SceneInspector/SceneInspector";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBook } from "@/providers/BookProvider";
import type { Chapter, Scene, SceneStatus, StoryboardSort } from "@/lib/types";
import { findScene } from "@/lib/scenes";
import { cn } from "@/lib/utils";

export function StoryboardPage() {
  const {
    book,
    settings,
    hydrated,
    addChapter,
    addScene,
    updateScene,
    updateSceneContent,
    deleteScene,
    duplicateScene,
    moveScene,
    convertSceneToChapter,
    reorderChapters,
    setStoryboardZoom,
  } = useBook();

  const zoom = settings.storyboardZoom ?? "medium";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SceneStatus | "all">("all");
  const [sort, setSort] = useState<StoryboardSort>("manual");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [activeScene, setActiveScene] = useState<Scene | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [moveSceneId, setMoveSceneId] = useState<string | null>(null);
  const [writeSceneId, setWriteSceneId] = useState<string | null>(null);
  const [inspectorSceneId, setInspectorSceneId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const chaptersView = useMemo(() => {
    const q = search.trim().toLowerCase();
    return book.chapters.map((chapter) => {
      let scenes = [...(chapter.scenes ?? [])];
      if (statusFilter !== "all") {
        scenes = scenes.filter((s) => s.status === statusFilter);
      }
      if (q) {
        scenes = scenes.filter(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            s.synopsis.toLowerCase().includes(q) ||
            s.pov.toLowerCase().includes(q) ||
            s.labels.some((l) => l.toLowerCase().includes(q)) ||
            chapter.title.toLowerCase().includes(q),
        );
      }
      if (sort === "title") {
        scenes.sort((a, b) => a.title.localeCompare(b.title));
      } else if (sort === "status") {
        const order = {
          outline: 0,
          draft: 1,
          writing: 2,
          revising: 3,
          final: 4,
        };
        scenes.sort((a, b) => order[a.status] - order[b.status]);
      } else if (sort === "updated") {
        scenes.sort((a, b) => b.updatedAt - a.updatedAt);
      }
      return { chapter, scenes };
    });
  }, [book.chapters, search, statusFilter, sort]);

  const totalScenes = book.chapters.reduce(
    (n, c) => n + (c.scenes?.length ?? 0),
    0,
  );

  function toggleChapter(id: string) {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function onDragStart(event: DragStartEvent) {
    const data = event.active.data.current;
    if (data?.type === "scene" && data.scene) {
      setActiveScene(data.scene as Scene);
    }
  }

  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || sort !== "manual") return;
    const activeData = active.data.current;
    const overData = over.data.current;
    if (activeData?.type !== "scene") return;

    const activeChapterId = activeData.chapterId as string;
    let overChapterId: string | undefined;

    if (overData?.type === "scene") {
      overChapterId = overData.chapterId as string;
    } else if (overData?.type === "chapter-drop" || overData?.type === "chapter") {
      overChapterId = overData.chapterId as string;
    } else if (String(over.id).startsWith("chapter-drop:")) {
      overChapterId = String(over.id).replace("chapter-drop:", "");
    } else if (String(over.id).startsWith("chapter:")) {
      overChapterId = String(over.id).replace("chapter:", "");
    }

    if (!overChapterId || activeChapterId === overChapterId) return;

    const overChapter = book.chapters.find((c) => c.id === overChapterId);
    const toIndex = overChapter?.scenes.length ?? 0;
    moveScene(String(active.id), overChapterId, toIndex);
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveScene(null);
    if (!over || active.id === over.id) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // Chapter reorder
    if (activeData?.type === "chapter") {
      const from = book.chapters.findIndex(
        (c) => `chapter:${c.id}` === active.id,
      );
      let to = book.chapters.findIndex((c) => `chapter:${c.id}` === over.id);
      if (to < 0 && overData?.chapterId) {
        to = book.chapters.findIndex((c) => c.id === overData.chapterId);
      }
      if (from >= 0 && to >= 0 && from !== to) {
        reorderChapters(from, to);
      }
      return;
    }

    if (activeData?.type !== "scene" || sort !== "manual") return;

    const sceneId = String(active.id);
    const found = findScene(book.chapters, sceneId);
    if (!found) return;

    let toChapterId = found.chapter.id;
    let toIndex = found.sceneIndex;

    if (overData?.type === "scene") {
      toChapterId = overData.chapterId as string;
      const overChapter = book.chapters.find((c) => c.id === toChapterId);
      toIndex = overChapter?.scenes.findIndex((s) => s.id === over.id) ?? 0;
      if (toChapterId === found.chapter.id && toIndex > found.sceneIndex) {
        // arrayMove handles within-list; adjust for remove-then-insert
      }
    } else if (
      overData?.type === "chapter-drop" ||
      overData?.type === "chapter"
    ) {
      toChapterId = overData.chapterId as string;
      toIndex =
        book.chapters.find((c) => c.id === toChapterId)?.scenes.length ?? 0;
    }

    if (toChapterId === found.chapter.id) {
      const chapter = book.chapters.find((c) => c.id === toChapterId);
      if (!chapter) return;
      const oldIndex = chapter.scenes.findIndex((s) => s.id === sceneId);
      let newIndex = chapter.scenes.findIndex((s) => s.id === over.id);
      if (newIndex < 0) newIndex = chapter.scenes.length - 1;
      if (oldIndex < 0 || oldIndex === newIndex) return;
      moveScene(sceneId, toChapterId, newIndex);
    } else {
      moveScene(sceneId, toChapterId, toIndex);
    }
  }

  if (!hydrated) {
    return <StoryboardSkeleton />;
  }

  return (
    <div className="storyboard-canvas relative min-h-screen">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 70% 40% at 50% -10%, rgba(176,141,87,0.12), transparent 60%),
            url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")
          `,
        }}
      />

      <StoryboardToolbar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        sort={sort}
        onSortChange={setSort}
        zoom={zoom}
        onZoomChange={setStoryboardZoom}
        onNewChapter={() => addChapter(book.activeChapterId)}
        onNewScene={() => addScene()}
      />

      <div className="relative px-4 pb-28 pt-2 sm:px-6 lg:px-8">
        <header className="mb-8 px-2">
          <p className="font-[family-name:var(--font-display)] text-[0.65rem] uppercase tracking-[0.3em] text-[var(--ink-faint)]">
            Storyboard
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-medium tracking-wide text-[var(--ink)] sm:text-4xl">
            {book.title || "Untitled Manuscript"}
          </h1>
          <p className="mt-2 font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)]">
            {book.chapters.length}{" "}
            {book.chapters.length === 1 ? "chapter" : "chapters"} · {totalScenes}{" "}
            {totalScenes === 1 ? "scene" : "scenes"}
          </p>
        </header>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={book.chapters.map((c) => `chapter:${c.id}`)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-10">
              <AnimatePresence mode="popLayout">
                {chaptersView.map(({ chapter, scenes }, index) => (
                  <ChapterSection
                    key={chapter.id}
                    chapter={chapter}
                    index={index}
                    zoom={zoom}
                    collapsed={Boolean(collapsed[chapter.id])}
                    onToggle={() => toggleChapter(chapter.id)}
                    scenes={scenes}
                    onAddScene={() => addScene(chapter.id)}
                    onUpdateTitle={(sceneId, title) =>
                      updateScene(sceneId, { title })
                    }
                    onDuplicate={duplicateScene}
                    onDelete={(id) => setPendingDelete(id)}
                    onMove={(id) => setMoveSceneId(id)}
                    onConvertToChapter={convertSceneToChapter}
                    onStatusChange={(sceneId, status) =>
                      updateScene(sceneId, { status })
                    }
                    onOpenScene={(sceneId) => setWriteSceneId(sceneId)}
                    onInspectScene={(sceneId) => setInspectorSceneId(sceneId)}
                  />
                ))}
              </AnimatePresence>
            </div>
          </SortableContext>

          <DragOverlay dropAnimation={{
            duration: 280,
            easing: "cubic-bezier(0.25, 0.1, 0.25, 1)",
          }}>
            {activeScene ? (
              <DragOverlayCard scene={activeScene} zoom={zoom} />
            ) : null}
          </DragOverlay>
        </DndContext>

        {totalScenes === 0 ? (
          <EmptyStoryboard
            onNewChapter={() => addChapter(book.activeChapterId)}
            onNewScene={() => addScene()}
          />
        ) : null}
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete scene?"
        description="This scene will move to Trash. You can restore it from there."
        confirmLabel="Move to trash"
        onConfirm={() => {
          if (pendingDelete) deleteScene(pendingDelete);
          setPendingDelete(null);
        }}
      />

      <MoveSceneDialog
        open={Boolean(moveSceneId)}
        sceneId={moveSceneId}
        chapters={book.chapters}
        onClose={() => setMoveSceneId(null)}
        onMove={(chapterId) => {
          if (!moveSceneId) return;
          moveScene(moveSceneId, chapterId, 0);
          setMoveSceneId(null);
        }}
      />

      <SceneWritePopup
        open={Boolean(writeSceneId)}
        sceneId={writeSceneId}
        book={book}
        onClose={() => setWriteSceneId(null)}
        onSave={(sceneId, html) => updateSceneContent(sceneId, html)}
      />

      <SceneInspector
        open={Boolean(inspectorSceneId)}
        sceneId={inspectorSceneId}
        onSceneIdChange={setInspectorSceneId}
        onClose={() => setInspectorSceneId(null)}
      />
    </div>
  );
}

function MoveSceneDialog({
  open,
  sceneId,
  chapters,
  onClose,
  onMove,
}: {
  open: boolean;
  sceneId: string | null;
  chapters: Chapter[];
  onClose: () => void;
  onMove: (chapterId: string) => void;
}) {
  const current = sceneId ? findScene(chapters, sceneId) : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move scene</DialogTitle>
          <DialogDescription>
            Choose a chapter for this scene card.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          {chapters.map((ch) => (
            <button
              key={ch.id}
              type="button"
              disabled={current?.chapter.id === ch.id}
              onClick={() => onMove(ch.id)}
              className={cn(
                "flex w-full rounded-xl px-4 py-3 text-left font-[family-name:var(--font-ui)] text-sm transition-colors",
                current?.chapter.id === ch.id
                  ? "bg-[var(--accent-soft)] text-[var(--ink-muted)]"
                  : "text-[var(--ink)] hover:bg-[var(--accent-soft)]",
              )}
            >
              {ch.title}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmptyStoryboard({
  onNewChapter,
  onNewScene,
}: {
  onNewChapter: () => void;
  onNewScene: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto mt-16 max-w-md rounded-3xl border border-[rgba(45,42,38,0.06)] bg-[rgba(247,243,234,0.65)] px-8 py-14 text-center shadow-[0_8px_40px_rgba(45,42,38,0.05)]"
    >
      <p className="font-[family-name:var(--font-display)] text-2xl font-medium tracking-wide text-[var(--ink)]">
        Your corkboard is clear
      </p>
      <p className="mt-3 font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
        Begin with a chapter, then lay out scenes like index cards—quiet,
        tactile, and yours.
      </p>
      <div className="mt-8 flex justify-center gap-2">
        <button
          type="button"
          onClick={onNewChapter}
          className="rounded-full bg-[var(--accent-soft)] px-4 py-2 font-[family-name:var(--font-ui)] text-sm text-[var(--ink)] transition-colors hover:bg-[rgba(176,141,87,0.2)]"
        >
          New chapter
        </button>
        <button
          type="button"
          onClick={onNewScene}
          className="rounded-full bg-[var(--accent)] px-4 py-2 font-[family-name:var(--font-ui)] text-sm text-[var(--paper)] transition-opacity hover:opacity-90"
        >
          New scene
        </button>
      </div>
    </motion.div>
  );
}

function StoryboardSkeleton() {
  return (
    <div className="min-h-screen px-6 py-8 md:px-10">
      <div className="mb-10 h-12 w-full max-w-3xl animate-pulse rounded-2xl bg-[rgba(45,42,38,0.05)]" />
      <div className="mb-6 h-8 w-48 animate-pulse rounded bg-[rgba(45,42,38,0.05)]" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-44 animate-pulse rounded-2xl bg-[rgba(247,243,234,0.7)] shadow-sm"
            style={{ animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
