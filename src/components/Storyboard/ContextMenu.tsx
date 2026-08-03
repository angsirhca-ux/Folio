"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import type { SceneStatus } from "@/lib/types";
import { SCENE_STATUS_META } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface SceneCardMenuActions {
  onDuplicate: () => void;
  onRename: () => void;
  onDelete: () => void;
  onMove: () => void;
  onConvertToChapter: () => void;
  onStatusChange: (status: SceneStatus) => void;
  onInspect?: () => void;
}

export function SceneCardMenu({
  open,
  onOpenChange,
  actions,
  className,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  actions: SceneCardMenuActions;
  className?: string;
}) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Scene actions"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "rounded-lg p-1.5 text-[var(--ink-faint)] opacity-0 transition-all duration-300",
            "hover:bg-[rgba(45,42,38,0.06)] hover:text-[var(--ink)]",
            "group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100",
            className,
          )}
        >
          <MoreHorizontal className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DropdownMenuItem onSelect={actions.onRename}>Rename</DropdownMenuItem>
        {actions.onInspect ? (
          <DropdownMenuItem onSelect={actions.onInspect}>
            Scene details…
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={actions.onDuplicate}>
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={actions.onMove}>Move…</DropdownMenuItem>
        <DropdownMenuItem onSelect={actions.onConvertToChapter}>
          Convert to Chapter
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Status</DropdownMenuLabel>
        {(Object.keys(SCENE_STATUS_META) as SceneStatus[]).map((status) => (
          <DropdownMenuItem
            key={status}
            onSelect={() => actions.onStatusChange(status)}
          >
            {SCENE_STATUS_META[status].label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={actions.onDelete}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
