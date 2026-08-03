"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { RotateCcw, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useBook } from "@/providers/BookProvider";
import { bookSceneCount, bookWordCount } from "@/lib/trash";
import { formatRelativeDate } from "@/lib/scenes";
import { formatWordCount } from "@/lib/utils";
import {
  TRASH_KIND_META,
  type TrashItem,
  type TrashKind,
  type TrashedBook,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type FilterMode = "all" | TrashKind | "book";

type UnifiedRow =
  | { type: "item"; item: TrashItem }
  | { type: "book"; item: TrashedBook };

export function TrashPage() {
  const router = useRouter();
  const {
    book,
    hydrated,
    libraryTrash,
    restoreFromTrash,
    purgeFromTrash,
    emptyTrash,
    restoreLibraryBook,
    purgeLibraryBook,
    emptyAllLibraryTrash,
  } = useBook();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [pendingPurge, setPendingPurge] = useState<UnifiedRow | null>(null);

  const bookTrash = book.trash ?? [];

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list: UnifiedRow[] = [
      ...bookTrash.map((item) => ({ type: "item" as const, item })),
      ...libraryTrash.map((item) => ({ type: "book" as const, item })),
    ];

    return list
      .filter((row) => {
        if (filter === "all") return true;
        if (filter === "book") return row.type === "book";
        return row.type === "item" && row.item.kind === filter;
      })
      .filter((row) => {
        if (!q) return true;
        if (row.type === "book") {
          const b = row.item.book;
          return [b.title, b.author].join(" ").toLowerCase().includes(q);
        }
        const hay = [row.item.title, row.item.subtitle, row.item.kind]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        const da = a.type === "book" ? a.item.deletedAt : a.item.deletedAt;
        const db = b.type === "book" ? b.item.deletedAt : b.item.deletedAt;
        return db - da;
      });
  }, [bookTrash, libraryTrash, search, filter]);

  const totalCount = bookTrash.length + libraryTrash.length;

  function restore(row: UnifiedRow) {
    if (row.type === "book") {
      restoreLibraryBook(row.item.id);
      router.push("/books");
      return;
    }
    restoreFromTrash(row.item.id);
  }

  function purge(row: UnifiedRow) {
    if (row.type === "book") {
      purgeLibraryBook(row.item.id);
    } else {
      purgeFromTrash(row.item.id);
    }
  }

  function emptyEverything() {
    emptyTrash();
    emptyAllLibraryTrash();
  }

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-1 w-16 overflow-hidden rounded-full bg-[rgba(176,141,87,0.2)]">
          <div className="folio-loading-bar h-full w-1/2 rounded-full bg-[var(--accent)]" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-5 pb-24 pt-10 sm:px-8 lg:px-10">
      <header className="mb-10">
        <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.28em] text-[var(--ink-faint)]">
          Holding place
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-medium tracking-tight text-[var(--ink)] sm:text-5xl">
          Trash
        </h1>
        <p className="mt-4 max-w-xl font-[family-name:var(--font-ui)] text-base leading-relaxed text-[var(--ink-muted)]">
          Discarded scenes, chapters, wiki pages, and manuscripts rest here.
          Restore what you still need — or empty the bin when you&apos;re sure.
        </p>
        {totalCount > 0 ? (
          <div className="mt-6">
            <Button
              size="sm"
              variant="outline"
              className="rounded-full text-[#6B3A2A]"
              onClick={() => setConfirmEmpty(true)}
            >
              Empty trash
            </Button>
          </div>
        ) : null}
      </header>

      <div className="sticky top-0 z-20 -mx-1 mb-8 bg-[linear-gradient(180deg,#EDE8E0_70%,transparent)] pb-4 pt-1">
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[rgba(45,42,38,0.06)] bg-[rgba(247,243,234,0.72)] px-3 py-2.5 shadow-[0_8px_32px_rgba(45,42,38,0.06)] backdrop-blur-2xl sm:gap-3 sm:px-4">
          <label className="relative flex min-w-[10rem] max-w-xs flex-1 items-center">
            <Search
              className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-[var(--ink-faint)]"
              strokeWidth={1.5}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search trash…"
              className="h-9 w-full rounded-full border border-transparent bg-[rgba(45,42,38,0.04)] pl-9 pr-9 font-[family-name:var(--font-ui)] text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] transition-colors focus:border-[var(--border)] focus:bg-[rgba(247,243,234,0.9)] focus:outline-none"
            />
            {search ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearch("")}
                className="absolute right-2 rounded-full p-1 text-[var(--ink-faint)] hover:text-[var(--ink)]"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            ) : null}
          </label>

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterMode)}
            aria-label="Filter trash"
            className="h-9 rounded-full border border-transparent bg-[rgba(45,42,38,0.04)] px-3 font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)] focus:outline-none"
          >
            <option value="all">Everything</option>
            <option value="scene">Scenes</option>
            <option value="chapter">Chapters</option>
            <option value="character">Characters</option>
            <option value="location">Locations</option>
            <option value="research">Research</option>
            <option value="book">Books</option>
          </select>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="border-t border-[rgba(45,42,38,0.08)] py-16 text-center">
          <p className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
            {search || filter !== "all" ? "Nothing matches" : "Trash is empty"}
          </p>
          <p className="mx-auto mt-3 max-w-sm font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
            {search || filter !== "all"
              ? "Try another filter or clear the search."
              : "Deleted scenes, chapters, and books will gather here until you restore or purge them."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[rgba(45,42,38,0.08)] border-t border-[rgba(45,42,38,0.08)]">
          {rows.map((row, i) => (
            <TrashRow
              key={row.type === "book" ? `book-${row.item.id}` : row.item.id}
              row={row}
              index={i}
              onRestore={() => restore(row)}
              onPurge={() => setPendingPurge(row)}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={confirmEmpty}
        onOpenChange={setConfirmEmpty}
        title="Empty trash?"
        description="Everything here — scenes, chapters, wiki pages, and discarded books — will be permanently removed from this browser."
        confirmLabel="Empty trash"
        onConfirm={() => {
          emptyEverything();
          setConfirmEmpty(false);
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingPurge)}
        onOpenChange={(open) => {
          if (!open) setPendingPurge(null);
        }}
        title="Delete forever?"
        description={
          pendingPurge?.type === "book"
            ? `“${pendingPurge.item.book.title || "Untitled"}” will be permanently removed.`
            : `“${pendingPurge?.type === "item" ? pendingPurge.item.title : ""}” will be permanently removed.`
        }
        confirmLabel="Delete forever"
        onConfirm={() => {
          if (pendingPurge) purge(pendingPurge);
          setPendingPurge(null);
        }}
      />
    </div>
  );
}

function TrashRow({
  row,
  index,
  onRestore,
  onPurge,
}: {
  row: UnifiedRow;
  index: number;
  onRestore: () => void;
  onPurge: () => void;
}) {
  const kindLabel =
    row.type === "book" ? "Book" : TRASH_KIND_META[row.item.kind].label;
  const title =
    row.type === "book"
      ? row.item.book.title || "Untitled Manuscript"
      : row.item.title;
  const subtitle =
    row.type === "book"
      ? (() => {
          const b = row.item.book;
          const words = bookWordCount(b);
          return `${b.author || "No author"} · ${formatWordCount(words)} words · ${b.chapters.length} chapters · ${bookSceneCount(b)} scenes`;
        })()
      : row.item.subtitle;
  const deletedAt =
    row.type === "book" ? row.item.deletedAt : row.item.deletedAt;

  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: Math.min(index * 0.04, 0.35),
        ease: [0.25, 0.1, 0.25, 1],
      }}
      className="group flex flex-wrap items-start justify-between gap-4 py-6"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)] sm:text-2xl">
            {title}
          </h2>
          <span className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
            {kindLabel}
          </span>
        </div>
        {subtitle ? (
          <p
            className={cn(
              "mt-1.5 font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]",
            )}
          >
            {subtitle}
          </p>
        ) : null}
        <p className="mt-3 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)]">
          Discarded {formatRelativeDate(deletedAt)}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 rounded-full"
          onClick={onRestore}
        >
          <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
          Restore
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="gap-1.5 rounded-full text-[var(--ink-faint)] hover:text-[#6B3A2A]"
          onClick={onPurge}
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
          Delete
        </Button>
      </div>
    </motion.li>
  );
}
