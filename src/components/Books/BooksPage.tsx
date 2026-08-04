"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  CircleHelp,
  Copy,
  Download,
  HardDriveDownload,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { BackupDialog } from "@/components/Backup/BackupDialog";
import { ExportDialog } from "@/components/Export/ExportDialog";
import { ImportDialog } from "@/components/Import/ImportDialog";
import { FolioHowToDialog } from "@/components/Help/FolioHowToDialog";
import { useBook } from "@/providers/BookProvider";
import { bookSceneCount, bookWordCount } from "@/lib/trash";
import { formatRelativeDate } from "@/lib/scenes";
import { findSeries } from "@/lib/series";
import { formatWordCount } from "@/lib/utils";
import { povColor, type Book } from "@/lib/types";
import { cn } from "@/lib/utils";

type SortMode = "updated" | "title" | "words";

export function BooksPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    book,
    hydrated,
    libraryBooks,
    librarySeries,
    createBook,
    switchBook,
    duplicateBook,
    deleteBook,
    createSeries,
    assignBookToSeries,
  } = useBook();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("updated");
  const [pendingDelete, setPendingDelete] = useState<Book | null>(null);
  const [backupOpen, setBackupOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [howToOpen, setHowToOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("dropbox") === "connected") {
      setBackupOpen(true);
      window.history.replaceState({}, "", "/books");
    }
  }, [searchParams]);

  const roster = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = [...libraryBooks];
    if (q) {
      list = list.filter((b) => {
        const seriesTitle = findSeries(librarySeries, b.seriesId)?.title ?? "";
        const hay = [b.title, b.author, seriesTitle].join(" ").toLowerCase();
        return hay.includes(q);
      });
    }
    list.sort((a, b) => {
      if (sort === "title") {
        return (a.title || "Untitled").localeCompare(b.title || "Untitled");
      }
      if (sort === "words") {
        return bookWordCount(b) - bookWordCount(a);
      }
      return b.updatedAt - a.updatedAt;
    });
    return list;
  }, [libraryBooks, librarySeries, search, sort]);

  function openBook(id: string) {
    switchBook(id);
    router.push("/");
  }

  function createAndOpen() {
    createBook({ title: "Untitled Manuscript" });
    router.push("/");
  }

  function createSeriesAndOpen() {
    const id = createSeries("Untitled series");
    router.push(`/series/${id}`);
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
          Library
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-medium tracking-tight text-[var(--ink)] sm:text-5xl">
          Books
        </h1>
        <p className="mt-4 max-w-xl font-[family-name:var(--font-ui)] text-base leading-relaxed text-[var(--ink-muted)]">
          Your manuscripts live on this shelf. Connect Dropbox once — the whole
          shelf syncs between desk and phone. Open a book here to write.
        </p>
        <div className="mt-6">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5 rounded-full"
            onClick={() => setHowToOpen(true)}
          >
            <CircleHelp className="h-3.5 w-3.5" strokeWidth={1.5} />
            How to use Folio
          </Button>
        </div>
      </header>

      <section className="mb-10">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
            Series
          </h2>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 rounded-full"
            onClick={() => createSeriesAndOpen()}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            New series
          </Button>
        </div>
        {librarySeries.length === 0 ? (
          <p className="mt-3 font-[family-name:var(--font-ui)] text-sm italic text-[var(--ink-faint)]">
            No series yet — create one when a second book shares a world.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[rgba(45,42,38,0.08)] border-t border-[rgba(45,42,38,0.08)]">
            {librarySeries.map((s) => {
              const count = libraryBooks.filter((b) => b.seriesId === s.id)
                .length;
              return (
                <li key={s.id} className="py-4">
                  <Link
                    href={`/series/${s.id}`}
                    className="group block text-left"
                  >
                    <h3 className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)] transition-colors group-hover:text-[color-mix(in_srgb,var(--accent)_65%,var(--ink))]">
                      {s.title || "Untitled series"}
                    </h3>
                    <p className="mt-1 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)]">
                      {count} book{count === 1 ? "" : "s"} ·{" "}
                      {s.characters.length} cast · {s.locations.length} places
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

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
              placeholder="Search books…"
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
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            aria-label="Sort books"
            className="h-9 rounded-full border border-transparent bg-[rgba(45,42,38,0.04)] px-3 font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)] focus:outline-none"
          >
            <option value="updated">Recently opened</option>
            <option value="title">Title</option>
            <option value="words">Word count</option>
          </select>

          <Button
            size="sm"
            variant="outline"
            className="ml-auto gap-1.5 rounded-full"
            onClick={() => setImportOpen(true)}
            title={`Upload into “${book.title || "Untitled"}”`}
          >
            <Upload className="h-3.5 w-3.5" strokeWidth={1.5} />
            Upload
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 rounded-full"
            onClick={() => setExportOpen(true)}
            title={`Export “${book.title || "Untitled"}”`}
          >
            <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
            Export
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 rounded-full"
            onClick={() => setBackupOpen(true)}
          >
            <HardDriveDownload className="h-3.5 w-3.5" strokeWidth={1.5} />
            Backup
          </Button>
          <Button
            size="sm"
            className="gap-1.5 rounded-full"
            onClick={() => createAndOpen()}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            New
          </Button>
        </div>
      </div>

      {roster.length === 0 ? (
        <div className="border-t border-[rgba(45,42,38,0.08)] py-16 text-center">
          <p className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
            {search ? "No book matches" : "An empty shelf"}
          </p>
          <p className="mx-auto mt-3 max-w-sm font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
            {search
              ? "Try another search, or begin a new manuscript."
              : "Start a manuscript — the first spine on the shelf."}
          </p>
          {!search ? (
            <Button
              className="mt-8 gap-1.5 rounded-full"
              onClick={() => createAndOpen()}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
              First book
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="divide-y divide-[rgba(45,42,38,0.08)] border-t border-[rgba(45,42,38,0.08)]">
          {roster.map((item, i) => (
            <BookRow
              key={item.id}
              item={item}
              seriesTitle={
                findSeries(librarySeries, item.seriesId)?.title ?? null
              }
              seriesOptions={librarySeries.map((s) => ({
                id: s.id,
                title: s.title,
              }))}
              active={item.id === book.id}
              index={i}
              onOpen={() => openBook(item.id)}
              onUpload={() => {
                switchBook(item.id);
                setImportOpen(true);
              }}
              onExport={() => {
                switchBook(item.id);
                setExportOpen(true);
              }}
              onDuplicate={() => {
                duplicateBook(item.id);
                router.push("/");
              }}
              onDelete={() => setPendingDelete(item)}
              onAssignSeries={(seriesId) =>
                assignBookToSeries(item.id, seriesId)
              }
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={`Move “${pendingDelete?.title || "Untitled"}” to trash?`}
        description="The manuscript will leave the shelf and wait in Trash. You can restore it from there."
        confirmLabel="Move to trash"
        onConfirm={() => {
          if (pendingDelete) deleteBook(pendingDelete.id);
          setPendingDelete(null);
        }}
      />

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
      <BackupDialog open={backupOpen} onOpenChange={setBackupOpen} />
      <FolioHowToDialog open={howToOpen} onOpenChange={setHowToOpen} />
    </div>
  );
}

function BookRow({
  item,
  seriesTitle,
  seriesOptions,
  active,
  index,
  onOpen,
  onUpload,
  onExport,
  onDuplicate,
  onDelete,
  onAssignSeries,
}: {
  item: Book;
  seriesTitle: string | null;
  seriesOptions: Array<{ id: string; title: string }>;
  active: boolean;
  index: number;
  onOpen: () => void;
  onUpload: () => void;
  onExport: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onAssignSeries: (seriesId: string | null) => void;
}) {
  const color = povColor(item.title || item.id);
  const words = bookWordCount(item);
  const scenes = bookSceneCount(item);
  const chapters = item.chapters.length;

  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: Math.min(index * 0.04, 0.35),
        ease: [0.25, 0.1, 0.25, 1],
      }}
      className="group flex gap-4 py-6 sm:gap-6"
    >
      <span
        className="mt-2 h-14 w-[3px] shrink-0 rounded-full"
        style={{ background: color }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <button type="button" onClick={onOpen} className="w-full text-left">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)] transition-colors group-hover:text-[color-mix(in_srgb,var(--accent)_65%,var(--ink))]">
              {item.title || "Untitled Manuscript"}
            </h2>
            {active ? (
              <span className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.16em] text-[var(--accent)]">
                Open
              </span>
            ) : null}
          </div>
          <p
            className={cn(
              "mt-1.5 font-[family-name:var(--font-ui)] text-sm",
              item.author
                ? "text-[var(--ink-muted)]"
                : "italic text-[var(--ink-faint)]",
            )}
          >
            {item.author || "No author yet"}
            {seriesTitle ? ` · ${seriesTitle}` : ""}
          </p>
          <p className="mt-3 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)]">
            {formatWordCount(words)} words · {chapters} chapter
            {chapters === 1 ? "" : "s"} · {scenes} scene
            {scenes === 1 ? "" : "s"} · {formatRelativeDate(item.updatedAt)}
          </p>
        </button>
        <div className="mt-4 flex flex-wrap gap-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={onOpen}
          >
            Open
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 rounded-full"
            onClick={onUpload}
          >
            <Upload className="h-3.5 w-3.5" strokeWidth={1.5} />
            Upload
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 rounded-full"
            onClick={onExport}
          >
            <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
            Export
          </Button>
          {seriesOptions.length > 0 ? (
            <select
              aria-label="Assign series"
              value={item.seriesId ?? ""}
              onChange={(e) =>
                onAssignSeries(e.target.value ? e.target.value : null)
              }
              className="h-8 rounded-full border border-[rgba(45,42,38,0.08)] bg-transparent px-3 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-muted)] focus:outline-none"
            >
              <option value="">No series</option>
              {seriesOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title || "Untitled series"}
                </option>
              ))}
            </select>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 rounded-full"
            onClick={onDuplicate}
          >
            <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />
            Duplicate
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 rounded-full text-[var(--ink-faint)] hover:text-[#6B3A2A]"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
            Trash
          </Button>
        </div>
      </div>
    </motion.li>
  );
}
