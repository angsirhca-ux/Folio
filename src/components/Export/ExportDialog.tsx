"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlignLeft,
  BookOpen,
  FileText,
  FileType,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useBook } from "@/providers/BookProvider";
import {
  COMPILE_PRESETS,
  SCENE_BREAK_OPTIONS,
  applyCompilePreset,
  allChapterIds,
  compileWordCount,
  defaultCompileOptions,
  type CompileOptions,
  type CompilePreset,
  type SceneBreakStyle,
} from "@/lib/export/compile";
import { exportDocx } from "@/lib/export/docx";
import { exportEpub } from "@/lib/export/epub";
import { exportPdf } from "@/lib/export/pdf";
import { exportTxt } from "@/lib/export/txt";
import { formatWordCount, cn } from "@/lib/utils";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ExportFormat = "epub" | "pdf" | "docx" | "txt";
type ExportState = "idle" | "working" | "done" | "error";

const FORMATS: {
  id: ExportFormat;
  title: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "epub",
    title: "EPUB",
    description: "For Apple Books, Kindle, Kobo, and other readers",
    icon: <BookOpen className="h-4 w-4" strokeWidth={1.5} />,
  },
  {
    id: "pdf",
    title: "PDF",
    description: "Trade-paperback page, ready to print or share",
    icon: <FileText className="h-4 w-4" strokeWidth={1.5} />,
  },
  {
    id: "docx",
    title: "Word",
    description: "Editable .docx — submission preset uses standard manuscript style",
    icon: <FileType className="h-4 w-4" strokeWidth={1.5} />,
  },
  {
    id: "txt",
    title: "Plain text",
    description: "Clean .txt — universal, distraction-free",
    icon: <AlignLeft className="h-4 w-4" strokeWidth={1.5} />,
  },
];

export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const { book } = useBook();
  const [state, setState] = useState<ExportState>("idle");
  const [active, setActive] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<CompileOptions>(() =>
    defaultCompileOptions(book),
  );

  const chapterIdsKey = book.chapters.map((c) => c.id).join("|");

  // Reset compile selection when the dialog opens or the chapter list changes.
  useEffect(() => {
    if (!open) return;
    setOptions((prev) => {
      const ids = allChapterIds(book);
      const kept = prev.chapterIds.filter((id) => ids.includes(id));
      return {
        ...prev,
        chapterIds: kept.length ? kept : ids,
      };
    });
  }, [open, book, chapterIdsKey]);

  const selectedCount = options.chapterIds.length;
  const selectedWords = useMemo(
    () => compileWordCount(book, options),
    [book, options],
  );
  const title = book.title.trim() || "Untitled Manuscript";
  const canExport = selectedCount > 0 && state !== "working";

  function setPreset(preset: CompilePreset) {
    setOptions((prev) => applyCompilePreset(preset, prev));
  }

  function toggleChapter(id: string) {
    setOptions((prev) => {
      const has = prev.chapterIds.includes(id);
      const chapterIds = has
        ? prev.chapterIds.filter((x) => x !== id)
        : [
            ...book.chapters
              .map((c) => c.id)
              .filter((cid) => prev.chapterIds.includes(cid) || cid === id),
          ];
      return { ...prev, chapterIds };
    });
  }

  function selectAllChapters() {
    setOptions((prev) => ({ ...prev, chapterIds: allChapterIds(book) }));
  }

  function selectNoneChapters() {
    setOptions((prev) => ({ ...prev, chapterIds: [] }));
  }

  async function runExport(format: ExportFormat) {
    if (!canExport) return;
    setActive(format);
    setState("working");
    setError(null);
    try {
      if (format === "epub") await exportEpub(book, options);
      else if (format === "pdf") await exportPdf(book, options);
      else if (format === "docx") await exportDocx(book, options);
      else await exportTxt(book, options);
      setState("done");
      window.setTimeout(() => {
        setState("idle");
        setActive(null);
      }, 1800);
    } catch (err) {
      console.error(err);
      setState("error");
      setError(
        err instanceof Error ? err.message : "Something went wrong exporting.",
      );
      setActive(null);
    }
  }

  function handleOpenChange(next: boolean) {
    if (state === "working") return;
    onOpenChange(next);
    if (!next) {
      setState("idle");
      setActive(null);
      setError(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,40rem)] w-[min(94vw,32rem)] flex-col gap-0 overflow-hidden p-0">
        <div className="shrink-0 border-b border-[var(--border)] px-6 pb-4 pt-6">
          <DialogHeader className="mb-0">
            <DialogTitle>Compile &amp; export</DialogTitle>
            <DialogDescription className="mt-1.5">
              Choose what goes in the book — then save it as EPUB, PDF, Word, or
              text.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="folio-scroll min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-6 py-5">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--accent-soft)] px-4 py-3">
            <p className="font-[family-name:var(--font-display)] text-base tracking-wide text-[var(--ink)]">
              {title}
            </p>
            <p className="mt-1 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-muted)]">
              {selectedCount} of {book.chapters.length}{" "}
              {book.chapters.length === 1 ? "chapter" : "chapters"}
              <span className="mx-1.5 opacity-40">·</span>
              {formatWordCount(selectedWords)} words
              {book.author ? (
                <>
                  <span className="mx-1.5 opacity-40">·</span>
                  {book.author}
                </>
              ) : null}
            </p>
          </div>

          <section className="space-y-2">
            <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
              Intent
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {COMPILE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPreset(p.id)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-left transition-colors",
                    options.preset === p.id
                      ? "border-[color-mix(in_srgb,var(--accent)_50%,var(--border))] bg-[var(--accent-soft)]"
                      : "border-[var(--border)] hover:bg-[rgba(45,42,38,0.03)]",
                  )}
                >
                  <span className="block font-[family-name:var(--font-ui)] text-sm text-[var(--ink)]">
                    {p.label}
                  </span>
                  <span className="mt-0.5 block font-[family-name:var(--font-ui)] text-[0.7rem] leading-snug text-[var(--ink-faint)]">
                    {p.description}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
                Chapters
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAllChapters}
                  className="font-[family-name:var(--font-ui)] text-[0.65rem] text-[var(--ink-muted)] hover:text-[var(--ink)]"
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={selectNoneChapters}
                  className="font-[family-name:var(--font-ui)] text-[0.65rem] text-[var(--ink-muted)] hover:text-[var(--ink)]"
                >
                  None
                </button>
              </div>
            </div>
            <ul className="max-h-36 space-y-0.5 overflow-y-auto rounded-xl border border-[var(--border)] p-1.5 folio-scroll">
              {book.chapters.map((ch, i) => {
                const checked = options.chapterIds.includes(ch.id);
                return (
                  <li key={ch.id}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors",
                        checked
                          ? "bg-[rgba(45,42,38,0.04)]"
                          : "opacity-60 hover:opacity-100",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleChapter(ch.id)}
                        className="h-3.5 w-3.5 accent-[var(--accent)]"
                      />
                      <span className="min-w-0 flex-1 truncate font-[family-name:var(--font-ui)] text-sm text-[var(--ink)]">
                        {ch.title?.trim() || `Chapter ${i + 1}`}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="space-y-3">
            <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
              Front matter &amp; breaks
            </p>
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <span className="font-[family-name:var(--font-ui)] text-sm text-[var(--ink)]">
                Title page
              </span>
              <input
                type="checkbox"
                checked={options.includeTitlePage}
                onChange={(e) =>
                  setOptions((prev) => ({
                    ...prev,
                    includeTitlePage: e.target.checked,
                  }))
                }
                className="h-3.5 w-3.5 accent-[var(--accent)]"
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <span className="font-[family-name:var(--font-ui)] text-sm text-[var(--ink)]">
                Table of contents
                <span className="ml-1.5 text-[0.7rem] text-[var(--ink-faint)]">
                  (EPUB)
                </span>
              </span>
              <input
                type="checkbox"
                checked={options.includeToc}
                onChange={(e) =>
                  setOptions((prev) => ({
                    ...prev,
                    includeToc: e.target.checked,
                  }))
                }
                className="h-3.5 w-3.5 accent-[var(--accent)]"
              />
            </label>

            <div>
              <p className="mb-1.5 font-[family-name:var(--font-ui)] text-sm text-[var(--ink)]">
                Scene breaks
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SCENE_BREAK_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    title={opt.hint}
                    onClick={() =>
                      setOptions((prev) => ({
                        ...prev,
                        sceneBreak: opt.id as SceneBreakStyle,
                      }))
                    }
                    className={cn(
                      "rounded-full border px-2.5 py-1 font-[family-name:var(--font-ui)] text-xs transition-colors",
                      options.sceneBreak === opt.id
                        ? "border-[color-mix(in_srgb,var(--accent)_50%,var(--border))] bg-[var(--accent-soft)] text-[var(--ink)]"
                        : "border-[var(--border)] text-[var(--ink-muted)] hover:text-[var(--ink)]",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="space-y-2.5 pb-1">
            <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
              Format
            </p>
            {FORMATS.map((format) => (
              <ExportOption
                key={format.id}
                title={format.title}
                description={format.description}
                icon={format.icon}
                busy={state === "working" && active === format.id}
                done={state === "done" && active === format.id}
                disabled={!canExport}
                onClick={() => runExport(format.id)}
              />
            ))}
            {selectedCount === 0 ? (
              <p className="font-[family-name:var(--font-ui)] text-xs text-[var(--ink-muted)]">
                Select at least one chapter to export.
              </p>
            ) : null}
          </section>

          {error ? (
            <p className="font-[family-name:var(--font-ui)] text-xs text-[var(--ink-muted)]">
              {error}
            </p>
          ) : null}

          {state === "done" ? (
            <p className="text-center font-[family-name:var(--font-ui)] text-xs tracking-wide text-[var(--accent)]">
              Saved to your downloads
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExportOption({
  title,
  description,
  icon,
  busy,
  done,
  disabled,
  onClick,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  busy?: boolean;
  done?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-3 rounded-xl border border-[var(--border)] px-4 py-3.5 text-left transition-all duration-300",
        "hover:border-[color-mix(in_srgb,var(--accent)_45%,var(--border))] hover:bg-[var(--accent-soft)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        done && "border-[var(--accent)] bg-[var(--accent-soft)]",
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)] transition-colors",
          "group-hover:bg-[var(--paper)]",
        )}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
        ) : (
          icon
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-[family-name:var(--font-display)] text-base tracking-wide text-[var(--ink)]">
          {title}
        </span>
        <span className="mt-0.5 block font-[family-name:var(--font-ui)] text-xs leading-relaxed text-[var(--ink-muted)]">
          {description}
        </span>
      </span>
      <span className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.16em] text-[var(--ink-faint)] transition-colors group-hover:text-[var(--accent)]">
        {busy ? "…" : done ? "Done" : "Save"}
      </span>
    </button>
  );
}

/** Compact trigger used inside Settings */
export function ExportSettingsRow({ onExport }: { onExport: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="font-[family-name:var(--font-ui)] text-sm tracking-wide text-[var(--ink)]">
          Compile &amp; export
        </p>
        <p className="mt-0.5 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-muted)]">
          Chapters, front matter, EPUB · PDF · Word · text
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onExport}>
        Export
      </Button>
    </div>
  );
}
