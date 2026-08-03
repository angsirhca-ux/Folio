"use client";

import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SceneStatus } from "@/lib/types";
import { SCENE_STATUS_META } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface OutlineFilters {
  pov: string | "all";
  status: SceneStatus | "all";
  character: string | "all";
  location: string | "all";
  tag: string | "all";
  act: string | "all";
}

export const EMPTY_FILTERS: OutlineFilters = {
  pov: "all",
  status: "all",
  character: "all",
  location: "all",
  tag: "all",
  act: "all",
};

export function FiltersPanel({
  filters,
  onChange,
  options,
  className,
}: {
  filters: OutlineFilters;
  onChange: (next: OutlineFilters) => void;
  options: {
    povs: string[];
    characters: string[];
    locations: string[];
    tags: string[];
    acts: string[];
  };
  className?: string;
}) {
  const activeCount = Object.values(filters).filter((v) => v !== "all").length;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1.5 rounded-full">
            <Filter className="h-3.5 w-3.5" strokeWidth={1.5} />
            Filters
            {activeCount > 0 ? (
              <span className="rounded-full bg-[var(--accent-soft)] px-1.5 text-[0.65rem] text-[var(--ink)]">
                {activeCount}
              </span>
            ) : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuLabel>Status</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => onChange({ ...filters, status: "all" })}>
            All statuses
          </DropdownMenuItem>
          {(Object.keys(SCENE_STATUS_META) as SceneStatus[]).map((s) => (
            <DropdownMenuItem
              key={s}
              onSelect={() => onChange({ ...filters, status: s })}
            >
              {SCENE_STATUS_META[s].label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
                  <DropdownMenuLabel>POV · highlight</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => onChange({ ...filters, pov: "all" })}>
            All POVs
          </DropdownMenuItem>
          {options.povs.map((p) => (
            <DropdownMenuItem
              key={p}
              onSelect={() => onChange({ ...filters, pov: p })}
            >
              {p}
            </DropdownMenuItem>
          ))}
          {options.characters.length > 0 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Character · highlight</DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={() => onChange({ ...filters, character: "all" })}
              >
                All characters
              </DropdownMenuItem>
              {options.characters.map((c) => (
                <DropdownMenuItem
                  key={c}
                  onSelect={() => onChange({ ...filters, character: c })}
                >
                  {c}
                </DropdownMenuItem>
              ))}
            </>
          ) : null}
          {options.locations.length > 0 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Location</DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={() => onChange({ ...filters, location: "all" })}
              >
                All locations
              </DropdownMenuItem>
              {options.locations.map((l) => (
                <DropdownMenuItem
                  key={l}
                  onSelect={() => onChange({ ...filters, location: l })}
                >
                  {l}
                </DropdownMenuItem>
              ))}
            </>
          ) : null}
          {options.tags.length > 0 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Tag</DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={() => onChange({ ...filters, tag: "all" })}
              >
                All tags
              </DropdownMenuItem>
              {options.tags.map((t) => (
                <DropdownMenuItem
                  key={t}
                  onSelect={() => onChange({ ...filters, tag: t })}
                >
                  {t}
                </DropdownMenuItem>
              ))}
            </>
          ) : null}
          {options.acts.length > 0 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Act · structure</DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={() => onChange({ ...filters, act: "all" })}
              >
                All acts
              </DropdownMenuItem>
              {options.acts.map((a) => (
                <DropdownMenuItem
                  key={a}
                  onSelect={() => onChange({ ...filters, act: a })}
                >
                  Act {a}
                </DropdownMenuItem>
              ))}
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {activeCount > 0 ? (
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-[family-name:var(--font-ui)] text-[0.7rem] text-[var(--ink-faint)] transition-colors hover:text-[var(--ink)]"
        >
          <X className="h-3 w-3" strokeWidth={1.5} />
          Clear
        </button>
      ) : null}
    </div>
  );
}
