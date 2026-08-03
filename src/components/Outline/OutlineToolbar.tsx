"use client";

import { ChevronsDownUp, ChevronsUpDown, Plus, Search, X } from "lucide-react";
import {
  FiltersPanel,
  type OutlineFilters,
} from "@/components/Outline/FiltersPanel";
import { ZoomControl } from "@/components/Outline/ZoomControl";
import { Button } from "@/components/ui/button";
import type { OutlineScale, PlotThread } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type TimelineViewMode = "tracks" | "beats";

export function OutlineToolbar({
  viewMode,
  onViewModeChange,
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  filterOptions,
  scale,
  onScaleChange,
  onCollapseAll,
  onExpandAll,
  onAddChapter,
  onManageThreads,
  populateSlot,
  threads,
  highlightThreadId,
  onHighlightThreadId,
  className,
}: {
  viewMode: TimelineViewMode;
  onViewModeChange: (m: TimelineViewMode) => void;
  search: string;
  onSearchChange: (v: string) => void;
  filters: OutlineFilters;
  onFiltersChange: (f: OutlineFilters) => void;
  filterOptions: {
    povs: string[];
    characters: string[];
    locations: string[];
    tags: string[];
    acts: string[];
  };
  scale: OutlineScale;
  onScaleChange: (s: OutlineScale) => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  onAddChapter: () => void;
  onManageThreads: () => void;
  populateSlot?: ReactNode;
  threads: PlotThread[];
  highlightThreadId: string | null;
  onHighlightThreadId: (id: string | null) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky top-0 z-30 px-4 pb-3 pt-4 sm:px-6 lg:px-10",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[rgba(45,42,38,0.06)] bg-[rgba(247,243,234,0.72)] px-3 py-2.5 shadow-[0_8px_32px_rgba(45,42,38,0.06)] backdrop-blur-2xl sm:gap-3 sm:px-4">
        <div className="flex rounded-full border border-[rgba(45,42,38,0.08)] bg-[rgba(45,42,38,0.03)] p-0.5">
          {(
            [
              ["tracks", "Tracks"],
              ["beats", "Beats"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onViewModeChange(id)}
              className={cn(
                "rounded-full px-3 py-1.5 font-[family-name:var(--font-ui)] text-xs tracking-wide transition-colors",
                viewMode === id
                  ? "bg-[var(--paper)] text-[var(--ink)] shadow-sm"
                  : "text-[var(--ink-faint)] hover:text-[var(--ink-muted)]",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {viewMode === "beats" ? (
          <>
            <label className="relative flex min-w-[10rem] max-w-xs flex-1 items-center">
              <Search
                className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-[var(--ink-faint)]"
                strokeWidth={1.5}
              />
              <input
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search timeline…"
                className="h-9 w-full rounded-full border border-transparent bg-[rgba(45,42,38,0.04)] pl-9 pr-9 font-[family-name:var(--font-ui)] text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] transition-colors focus:border-[var(--border)] focus:bg-[rgba(247,243,234,0.9)] focus:outline-none"
              />
              {search ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => onSearchChange("")}
                  className="absolute right-2 rounded-full p-1 text-[var(--ink-faint)] hover:text-[var(--ink)]"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              ) : null}
            </label>

            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 rounded-full"
              onClick={onCollapseAll}
            >
              <ChevronsDownUp className="h-3.5 w-3.5" strokeWidth={1.5} />
              <span className="hidden lg:inline">Collapse</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 rounded-full"
              onClick={onExpandAll}
            >
              <ChevronsUpDown className="h-3.5 w-3.5" strokeWidth={1.5} />
              <span className="hidden lg:inline">Expand</span>
            </Button>

            <FiltersPanel
              filters={filters}
              onChange={onFiltersChange}
              options={filterOptions}
            />

            <div className="mx-1 hidden h-5 w-px bg-[var(--border)] md:block" />

            <ZoomControl value={scale} onChange={onScaleChange} />
          </>
        ) : (
          <>
            {threads.length > 0 ? (
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onHighlightThreadId(null)}
                  className={cn(
                    "rounded-full px-2.5 py-1 font-[family-name:var(--font-ui)] text-[0.7rem]",
                    !highlightThreadId
                      ? "bg-[rgba(45,42,38,0.08)] text-[var(--ink)]"
                      : "text-[var(--ink-faint)] hover:text-[var(--ink-muted)]",
                  )}
                >
                  All
                </button>
                {threads.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      onHighlightThreadId(
                        highlightThreadId === t.id ? null : t.id,
                      )
                    }
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-[family-name:var(--font-ui)] text-[0.7rem] transition-opacity",
                      highlightThreadId && highlightThreadId !== t.id
                        ? "opacity-40"
                        : "opacity-100",
                    )}
                    style={{
                      color: t.color,
                      backgroundColor: `${t.color}18`,
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: t.color }}
                    />
                    {t.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="min-w-0 flex-1 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)]">
                Assign threads across scenes
              </p>
            )}
            <FiltersPanel
              filters={filters}
              onChange={onFiltersChange}
              options={filterOptions}
            />
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          {viewMode === "tracks" ? populateSlot : null}
          <Button
            size="sm"
            variant="outline"
            onClick={onManageThreads}
            className="gap-1.5 rounded-full px-3.5"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            Thread
          </Button>
          {viewMode === "beats" ? (
            <Button
              size="sm"
              onClick={onAddChapter}
              className="gap-1.5 rounded-full px-3.5"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
              Chapter
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
