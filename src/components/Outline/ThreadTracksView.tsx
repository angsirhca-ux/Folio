"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import type { Chapter, PlotThread } from "@/lib/types";
import {
  flattenScenesForTracks,
  quietRunsForThread,
  sceneHasThread,
  type FlatSceneColumn,
} from "@/lib/plotThreads";
import { cn } from "@/lib/utils";

const COL_W = 56;
const LABEL_W = 156;

export function ThreadTracksView({
  chapters,
  threads,
  highlightThreadId,
  highlightPov = null,
  highlightCharacter = null,
  onToggleCell,
  onOpenScene,
  onManageThreads,
  onDeleteThread,
}: {
  chapters: Chapter[];
  threads: PlotThread[];
  highlightThreadId: string | null;
  highlightPov?: string | null;
  highlightCharacter?: string | null;
  onToggleCell: (sceneId: string, threadId: string) => void;
  onOpenScene: (chapterId: string, sceneIndex: number) => void;
  onManageThreads: () => void;
  onDeleteThread: (threadId: string) => void;
}) {
  const columns = useMemo(
    () => flattenScenesForTracks(chapters),
    [chapters],
  );

  const castHighlight =
    Boolean(highlightPov) || Boolean(highlightCharacter);

  function columnMatches(col: FlatSceneColumn): boolean {
    if (highlightPov && col.scene.pov !== highlightPov) return false;
    if (
      highlightCharacter &&
      !(col.scene.characters ?? []).includes(highlightCharacter)
    ) {
      return false;
    }
    return true;
  }

  const chapterSpans = useMemo(() => {
    const spans: { chapterId: string; title: string; start: number; count: number }[] =
      [];
    for (const col of columns) {
      const last = spans[spans.length - 1];
      if (last && last.chapterId === col.chapterId) {
        last.count += 1;
      } else {
        spans.push({
          chapterId: col.chapterId,
          title: col.chapterTitle,
          start: col.globalIndex,
          count: 1,
        });
      }
    }
    return spans;
  }, [columns]);

  const actSpans = useMemo(() => {
    const spans: { act: string; start: number; count: number }[] = [];
    for (const col of columns) {
      const act = col.scene.act?.trim() || "—";
      const last = spans[spans.length - 1];
      if (last && last.act === act) {
        last.count += 1;
      } else {
        spans.push({ act, start: col.globalIndex, count: 1 });
      }
    }
    return spans;
  }, [columns]);

  if (columns.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-8 py-24">
        <p className="max-w-sm text-center font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
          Add scenes in the manuscript or storyboard, then track plot threads
          across them here.
        </p>
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 py-24">
        <p className="max-w-md text-center font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
          Pick a genre pack to preload the tracks writers usually follow — then
          mark scenes on the grid (or Populate with Clarence).
        </p>
        <button
          type="button"
          onClick={onManageThreads}
          className="rounded-full border border-[var(--border)] bg-[var(--paper)] px-4 py-2 font-[family-name:var(--font-ui)] text-sm text-[var(--ink)] transition-colors hover:border-[var(--accent)]"
        >
          Choose a thread pack
        </button>
      </div>
    );
  }

  const gridWidth = columns.length * COL_W;

  return (
    <div className="relative min-h-0 flex-1 overflow-auto px-4 pb-16 pt-2 sm:px-6 lg:px-10">
      <div className="inline-block min-w-full">
        <div className="flex" style={{ minWidth: LABEL_W + gridWidth }}>
          <div
            className="sticky left-0 z-20 shrink-0 bg-[var(--paper)]"
            style={{ width: LABEL_W }}
          />
          <div className="flex" style={{ width: gridWidth }}>
            {chapterSpans.map((span) => (
              <div
                key={span.chapterId}
                className="border-b border-[rgba(45,42,38,0.08)] px-1 pb-1"
                style={{ width: span.count * COL_W }}
              >
                <p className="truncate font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                  {span.title || "Chapter"}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex" style={{ minWidth: LABEL_W + gridWidth }}>
          <div
            className="sticky left-0 z-20 shrink-0 bg-[var(--paper)]"
            style={{ width: LABEL_W }}
          />
          <div className="flex" style={{ width: gridWidth }}>
            {actSpans.map((span, i) => (
              <div
                key={`${span.act}-${span.start}-${i}`}
                className="border-b border-[rgba(45,42,38,0.06)] px-1 pb-2"
                style={{ width: span.count * COL_W }}
              >
                <p className="truncate font-[family-name:var(--font-ui)] text-[0.6rem] tracking-wide text-[var(--accent)]">
                  {span.act === "—" ? "" : `Act ${span.act}`}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex" style={{ minWidth: LABEL_W + gridWidth }}>
          <div
            className="sticky left-0 z-20 shrink-0 bg-[var(--paper)]"
            style={{ width: LABEL_W }}
          />
          <div className="flex" style={{ width: gridWidth }}>
            {columns.map((col) => {
              const match = columnMatches(col);
              const dim = castHighlight && !match;
              return (
                <button
                  key={col.scene.id}
                  type="button"
                  title={`${col.scene.title || "Untitled"}${col.scene.pov ? ` · POV ${col.scene.pov}` : ""}\nOpen in manuscript`}
                  onClick={() => onOpenScene(col.chapterId, col.sceneIndex)}
                  className={cn(
                    "truncate px-0.5 pb-3 text-center font-[family-name:var(--font-ui)] text-[0.65rem] leading-tight transition-opacity hover:text-[var(--accent)]",
                    dim
                      ? "opacity-25 text-[var(--ink-faint)]"
                      : castHighlight && match
                        ? "font-medium text-[var(--ink)]"
                        : "text-[var(--ink-muted)]",
                  )}
                  style={{ width: COL_W }}
                >
                  {(col.scene.title || "·").slice(0, 8)}
                </button>
              );
            })}
          </div>
        </div>

        {threads.map((thread) => (
          <ThreadTrackRow
            key={thread.id}
            thread={thread}
            columns={columns}
            dimmed={
              Boolean(highlightThreadId) && highlightThreadId !== thread.id
            }
            onToggleCell={onToggleCell}
            onDelete={() => onDeleteThread(thread.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ThreadTrackRow({
  thread,
  columns,
  dimmed,
  onToggleCell,
  onDelete,
}: {
  thread: PlotThread;
  columns: FlatSceneColumn[];
  dimmed: boolean;
  onToggleCell: (sceneId: string, threadId: string) => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const quiet = useMemo(
    () => quietRunsForThread(thread.id, columns),
    [thread.id, columns],
  );

  return (
    <div
      className={cn(
        "group/row flex items-stretch border-t border-[rgba(45,42,38,0.04)] transition-opacity",
        dimmed && "opacity-35",
      )}
      style={{ minWidth: LABEL_W + columns.length * COL_W }}
    >
      <div
        className="sticky left-0 z-20 flex shrink-0 items-center gap-1.5 bg-[var(--paper)] py-2 pr-2"
        style={{ width: LABEL_W }}
      >
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: thread.color }}
        />
        <span className="min-w-0 flex-1 truncate font-[family-name:var(--font-ui)] text-sm text-[var(--ink)]">
          {thread.name}
        </span>
        {confirmDelete ? (
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={onDelete}
              className="rounded px-1.5 py-0.5 font-[family-name:var(--font-ui)] text-[0.65rem] text-[#6B3A2A] hover:bg-[rgba(107,58,42,0.08)]"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="rounded px-1.5 py-0.5 font-[family-name:var(--font-ui)] text-[0.65rem] text-[var(--ink-faint)] hover:bg-[rgba(45,42,38,0.06)]"
            >
              No
            </button>
          </div>
        ) : (
          <button
            type="button"
            aria-label={`Delete ${thread.name}`}
            title="Delete thread"
            onClick={() => setConfirmDelete(true)}
            className="rounded p-1 text-[var(--ink-faint)] opacity-0 transition-opacity hover:bg-[rgba(107,58,42,0.08)] hover:text-[#6B3A2A] group-hover/row:opacity-100 focus-visible:opacity-100"
          >
            <Trash2 className="h-3 w-3" strokeWidth={1.5} />
          </button>
        )}
      </div>

      <div className="relative flex py-1.5" style={{ width: columns.length * COL_W }}>
        {quiet.map((run) => (
          <div
            key={`${run.start}-${run.end}`}
            title="Quiet stretch — thread absent for several scenes"
            className="pointer-events-none absolute top-1 bottom-1 rounded-md bg-[rgba(45,42,38,0.04)]"
            style={{
              left: run.start * COL_W + 4,
              width: (run.end - run.start + 1) * COL_W - 8,
            }}
          />
        ))}

        {columns.map((col) => {
          const on = sceneHasThread(col.scene, thread.id);
          return (
            <button
              key={col.scene.id}
              type="button"
              aria-pressed={on}
              aria-label={`${thread.name} on ${col.scene.title || "scene"}`}
              title={
                on
                  ? `${thread.name} · click to remove`
                  : `Add ${thread.name}`
              }
              onClick={() => onToggleCell(col.scene.id, thread.id)}
              className="relative z-[1] flex h-10 items-center justify-center transition-transform hover:scale-110"
              style={{ width: COL_W }}
            >
              <span
                className={cn(
                  "rounded-full transition-all",
                  on ? "h-3 w-3 shadow-sm" : "h-2 w-2 opacity-25",
                )}
                style={{
                  backgroundColor: on ? thread.color : "var(--ink-faint)",
                }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
