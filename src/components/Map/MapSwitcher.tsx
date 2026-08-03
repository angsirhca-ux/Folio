"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBook } from "@/providers/BookProvider";

/**
 * Quiet multi-map control — one name, optional switcher, tiny menu.
 * Avoids a list of maps cluttering the geography rail.
 */
export function MapSwitcher() {
  const {
    book,
    addStoryMap,
    setActiveStoryMap,
    renameStoryMap,
    removeStoryMap,
    duplicateStoryMap,
  } = useBook();
  const maps = book.maps?.length ? book.maps : book.map ? [book.map] : [];
  const activeId = book.activeMapId || book.map?.id;
  const active = maps.find((m) => m.id === activeId) ?? maps[0];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(active?.name ?? "Map");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(active?.name ?? "Map");
    setEditing(false);
  }, [active?.id, active?.name]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (!active) return null;

  function commitName() {
    setEditing(false);
    const next = draft.trim() || "Map";
    setDraft(next);
    if (next !== active.name) renameStoryMap(active.id, next);
  }

  return (
    <div className="mt-3 flex items-center gap-1">
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitName();
            if (e.key === "Escape") {
              setDraft(active.name);
              setEditing(false);
            }
          }}
          className="min-w-0 flex-1 rounded-lg border border-[rgba(45,42,38,0.12)] bg-[var(--paper)] px-2.5 py-1.5 font-[family-name:var(--font-ui)] text-sm text-[var(--ink)] outline-none"
        />
      ) : maps.length > 1 ? (
        <select
          value={active.id}
          onChange={(e) => setActiveStoryMap(e.target.value)}
          aria-label="Active map"
          className="min-w-0 flex-1 truncate rounded-lg border border-transparent bg-[rgba(45,42,38,0.04)] px-2.5 py-1.5 font-[family-name:var(--font-ui)] text-sm text-[var(--ink)] outline-none hover:bg-[rgba(45,42,38,0.07)] focus:border-[rgba(45,42,38,0.12)]"
        >
          {maps.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          title="Rename map"
          className="min-w-0 flex-1 truncate rounded-lg px-2.5 py-1.5 text-left font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)] transition-colors hover:bg-[rgba(45,42,38,0.05)] hover:text-[var(--ink)]"
        >
          {active.name}
        </button>
      )}

      <button
        type="button"
        aria-label="New map"
        title="New map"
        onClick={() => addStoryMap()}
        className="rounded-lg p-1.5 text-[var(--ink-faint)] hover:bg-[rgba(45,42,38,0.06)] hover:text-[var(--ink)]"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Map options"
            className="rounded-lg p-1.5 text-[var(--ink-faint)] hover:bg-[rgba(45,42,38,0.06)] hover:text-[var(--ink)] data-[state=open]:bg-[rgba(45,42,38,0.06)]"
          >
            <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuItem
            onSelect={() => {
              setDraft(active.name);
              setEditing(true);
            }}
          >
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => duplicateStoryMap(active.id)}>
            <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />
            Duplicate
          </DropdownMenuItem>
          {maps.length > 1 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                destructive
                onSelect={() => removeStoryMap(active.id)}
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                Delete map
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
