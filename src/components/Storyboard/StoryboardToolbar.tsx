"use client";

import { Filter, Plus, ArrowUpDown } from "lucide-react";
import { SearchBar } from "@/components/Storyboard/SearchBar";
import { ZoomControls } from "@/components/Storyboard/ZoomControls";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SceneStatus, StoryboardSort, StoryboardZoom } from "@/lib/types";
import { SCENE_STATUS_META } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StoryboardToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sort,
  onSortChange,
  zoom,
  onZoomChange,
  onNewChapter,
  onNewScene,
  className,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: SceneStatus | "all";
  onStatusFilterChange: (v: SceneStatus | "all") => void;
  sort: StoryboardSort;
  onSortChange: (v: StoryboardSort) => void;
  zoom: StoryboardZoom;
  onZoomChange: (v: StoryboardZoom) => void;
  onNewChapter: () => void;
  onNewScene: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky top-0 z-30 px-4 pb-3 pt-4 sm:px-6 lg:px-8",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[rgba(45,42,38,0.06)] bg-[rgba(247,243,234,0.72)] px-3 py-2.5 shadow-[0_8px_32px_rgba(45,42,38,0.06)] backdrop-blur-2xl sm:gap-3 sm:px-4">
        <SearchBar
          value={search}
          onChange={onSearchChange}
          className="min-w-[10rem] max-w-xs basis-full sm:basis-auto"
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 rounded-full">
              <Filter className="h-3.5 w-3.5" strokeWidth={1.5} />
              <span className="hidden sm:inline">
                {statusFilter === "all"
                  ? "Filter"
                  : SCENE_STATUS_META[statusFilter].label}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Status</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => onStatusFilterChange("all")}>
              All scenes
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {(Object.keys(SCENE_STATUS_META) as SceneStatus[]).map((s) => (
              <DropdownMenuItem key={s} onSelect={() => onStatusFilterChange(s)}>
                {SCENE_STATUS_META[s].label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 rounded-full">
              <ArrowUpDown className="h-3.5 w-3.5" strokeWidth={1.5} />
              <span className="hidden sm:inline">Sort</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            {(
              [
                ["manual", "Manual order"],
                ["title", "Title"],
                ["status", "Status"],
                ["updated", "Last edited"],
              ] as const
            ).map(([value, label]) => (
              <DropdownMenuItem
                key={value}
                onSelect={() => onSortChange(value)}
                className={sort === value ? "bg-[var(--accent-soft)]" : ""}
              >
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="mx-1 hidden h-5 w-px bg-[var(--border)] sm:block" />

        <ZoomControls value={zoom} onChange={onZoomChange} />

        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={onNewChapter}
            className="gap-1.5 rounded-full"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span className="hidden lg:inline">Chapter</span>
          </Button>
          <Button
            size="sm"
            onClick={onNewScene}
            className="gap-1.5 rounded-full px-3.5"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            Scene
          </Button>
        </div>
      </div>
    </div>
  );
}
