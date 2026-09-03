"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Book } from "@/lib/types";
import { countWords, formatWordCount } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function MoveChapterDialog({
  open,
  chapterTitle,
  seriesTitle,
  targetBooks,
  onClose,
  onMove,
}: {
  open: boolean;
  chapterTitle: string;
  seriesTitle?: string;
  targetBooks: Book[];
  onClose: () => void;
  onMove: (targetBookId: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move chapter</DialogTitle>
          <DialogDescription>
            Move “{chapterTitle}” to another book
            {seriesTitle ? ` in ${seriesTitle}` : " in this series"}. The
            chapter text, scenes, and notes go with it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          {targetBooks.map((target) => {
            const words = target.chapters.reduce(
              (sum, ch) => sum + countWords(ch.content ?? ""),
              0,
            );
            return (
              <button
                key={target.id}
                type="button"
                onClick={() => onMove(target.id)}
                className={cn(
                  "flex w-full flex-col rounded-xl px-4 py-3 text-left font-[family-name:var(--font-ui)] text-sm transition-colors",
                  "text-[var(--ink)] hover:bg-[var(--accent-soft)]",
                )}
              >
                <span className="font-medium">
                  {target.title || "Untitled"}
                </span>
                <span className="mt-0.5 text-[0.75rem] text-[var(--ink-muted)]">
                  {target.chapters.length} chapter
                  {target.chapters.length === 1 ? "" : "s"} ·{" "}
                  {formatWordCount(words)} words
                </span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
