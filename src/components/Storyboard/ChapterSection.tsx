"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, GripVertical, Plus } from "lucide-react";
import { SortableSceneCard } from "@/components/Storyboard/SceneCard";
import type { Chapter, Scene, StoryboardZoom } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ChapterSection({
  chapter,
  index,
  zoom,
  collapsed,
  onToggle,
  scenes,
  onAddScene,
  onUpdateTitle,
  onDuplicate,
  onDelete,
  onMove,
  onConvertToChapter,
  onStatusChange,
  onOpenScene,
  onInspectScene,
}: {
  chapter: Chapter;
  index: number;
  zoom: StoryboardZoom;
  collapsed: boolean;
  onToggle: () => void;
  scenes: Scene[];
  onAddScene: () => void;
  onUpdateTitle: (sceneId: string, title: string) => void;
  onDuplicate: (sceneId: string) => void;
  onDelete: (sceneId: string) => void;
  onMove: (sceneId: string) => void;
  onConvertToChapter: (sceneId: string) => void;
  onStatusChange: (sceneId: string, status: Scene["status"]) => void;
  onOpenScene: (sceneId: string) => void;
  onInspectScene: (sceneId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `chapter:${chapter.id}`,
    data: { type: "chapter", chapterId: chapter.id },
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `chapter-drop:${chapter.id}`,
    data: { type: "chapter-drop", chapterId: chapter.id },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const cardWidth =
    zoom === "tiny"
      ? "w-[9.5rem] min-w-[9.5rem]"
      : zoom === "small"
        ? "w-[12rem] min-w-[12rem]"
        : zoom === "large"
          ? "w-[18rem] min-w-[18rem]"
          : "w-[15rem] min-w-[15rem]";

  return (
    <motion.section
      ref={setSortableRef}
      style={style}
      layout
      className={cn(
        "relative rounded-3xl px-1 py-2 transition-colors duration-300",
        isOver && "bg-[rgba(176,141,87,0.06)]",
      )}
    >
      <header className="mb-4 flex items-center gap-2 px-2">
        <button
          type="button"
          className="cursor-grab rounded-lg p-1 text-[var(--ink-faint)] opacity-50 transition-opacity hover:opacity-100 active:cursor-grabbing"
          aria-label={`Drag ${chapter.title}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" strokeWidth={1.5} />
        </button>

        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="font-[family-name:var(--font-ui)] text-[0.65rem] tabular-nums text-[var(--ink-faint)]">
            {String(index + 1).padStart(2, "0")}
          </span>
          <h2 className="truncate font-[family-name:var(--font-display)] text-xl font-medium tracking-wide text-[var(--ink)] sm:text-2xl">
            {chapter.title}
          </h2>
          <span className="font-[family-name:var(--font-ui)] text-[0.7rem] text-[var(--ink-faint)]">
            {scenes.length} {scenes.length === 1 ? "scene" : "scenes"}
          </span>
          <ChevronDown
            className={cn(
              "ml-auto h-4 w-4 shrink-0 text-[var(--ink-faint)] transition-transform duration-300",
              collapsed && "-rotate-90",
            )}
            strokeWidth={1.5}
          />
        </button>

        <button
          type="button"
          onClick={onAddScene}
          className="rounded-full p-2 text-[var(--ink-muted)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--ink)]"
          aria-label={`Add scene to ${chapter.title}`}
        >
          <Plus className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </header>

      <AnimatePresence initial={false}>
        {!collapsed ? (
          <motion.div
            key="body"
            ref={setDropRef}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <SortableContext
              items={scenes.map((s) => s.id)}
              strategy={horizontalListSortingStrategy}
            >
              <div className="folio-scroll flex items-stretch gap-4 overflow-x-auto px-2 pb-3 pt-1">
                <AnimatePresence mode="popLayout">
                  {scenes.map((scene) => (
                    <div key={scene.id} className={cn("shrink-0", cardWidth)}>
                      <SortableSceneCard
                        scene={scene}
                        chapterId={chapter.id}
                        zoom={zoom}
                        onUpdateTitle={(title) =>
                          onUpdateTitle(scene.id, title)
                        }
                        onDuplicate={() => onDuplicate(scene.id)}
                        onDelete={() => onDelete(scene.id)}
                        onMove={() => onMove(scene.id)}
                        onConvertToChapter={() =>
                          onConvertToChapter(scene.id)
                        }
                        onStatusChange={(status) =>
                          onStatusChange(scene.id, status)
                        }
                        onOpen={() => onOpenScene(scene.id)}
                        onInspect={() => onInspectScene(scene.id)}
                      />
                    </div>
                  ))}
                </AnimatePresence>
                <button
                  type="button"
                  onClick={onAddScene}
                  className={cn(
                    "flex shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[rgba(45,42,38,0.12)] bg-[rgba(247,243,234,0.35)] text-[var(--ink-faint)] transition-colors hover:border-[var(--accent)] hover:text-[var(--ink-muted)]",
                    cardWidth,
                    zoom === "tiny" ? "min-h-[7rem]" : "min-h-[11rem]",
                  )}
                >
                  <Plus className="h-4 w-4" strokeWidth={1.5} />
                  <span className="font-[family-name:var(--font-ui)] text-xs">
                    Scene
                  </span>
                </button>
              </div>
            </SortableContext>

            {scenes.length === 0 ? (
              <button
                type="button"
                onClick={onAddScene}
                className="mx-2 mb-2 flex w-[calc(100%-1rem)] items-center justify-center rounded-2xl border border-dashed border-[rgba(45,42,38,0.12)] bg-[rgba(247,243,234,0.4)] px-4 py-10 font-[family-name:var(--font-ui)] text-sm text-[var(--ink-faint)] transition-colors hover:border-[var(--accent)] hover:text-[var(--ink-muted)]"
              >
                Add the first scene
              </button>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.section>
  );
}
