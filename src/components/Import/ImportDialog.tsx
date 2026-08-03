"use client";

import { useCallback, useRef, useState } from "react";
import { FileUp, Loader2, Upload } from "lucide-react";
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
  countImportWords,
  isSupportedManuscript,
  parseManuscriptFile,
} from "@/lib/import/parse";
import type { ParsedManuscript } from "@/lib/import/types";
import { formatWordCount, cn } from "@/lib/utils";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Phase = "pick" | "preview" | "working" | "done" | "error";

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const { book, replaceManuscript } = useBook();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("pick");
  const [parsed, setParsed] = useState<ParsedManuscript | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const reset = useCallback(() => {
    setPhase("pick");
    setParsed(null);
    setError(null);
    setDragOver(false);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  function handleOpenChange(next: boolean) {
    if (phase === "working") return;
    onOpenChange(next);
    if (!next) reset();
  }

  async function ingestFile(file: File) {
    if (!isSupportedManuscript(file)) {
      setError("Supported formats: .docx, .odt, .txt, .md, .html, .epub");
      setPhase("error");
      return;
    }
    setPhase("working");
    setError(null);
    try {
      const result = await parseManuscriptFile(file);
      setParsed(result);
      setPhase("preview");
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Could not read that manuscript.",
      );
      setPhase("error");
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void ingestFile(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void ingestFile(file);
  }

  function confirmImport() {
    if (!parsed) return;
    setPhase("working");
    try {
      replaceManuscript(parsed);
      setPhase("done");
      window.setTimeout(() => {
        handleOpenChange(false);
      }, 1200);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Could not import that manuscript.",
      );
      setPhase("error");
    }
  }

  const words = parsed ? countImportWords(parsed) : 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[26rem]">
        <DialogHeader>
          <DialogTitle>Upload manuscript</DialogTitle>
          <DialogDescription>
            Drop in a draft. Folio cleans spacing, applies its typography, and
            splits chapters from your headings.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={inputRef}
          type="file"
          accept=".txt,.md,.markdown,.docx,.odt,.otd,.html,.htm,.epub,text/plain,text/markdown,text/html,application/epub+zip,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text"
          className="hidden"
          onChange={onInputChange}
        />

        {phase === "pick" || (phase === "working" && !parsed) ? (
          <button
            type="button"
            disabled={phase === "working"}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={cn(
              "flex w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center transition-all duration-300",
              dragOver
                ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                : "border-[var(--border)] hover:border-[color-mix(in_srgb,var(--accent)_45%,var(--border))] hover:bg-[var(--accent-soft)]",
              phase === "working" && "opacity-70",
            )}
          >
            {phase === "working" ? (
              <Loader2
                className="h-6 w-6 animate-spin text-[var(--accent)]"
                strokeWidth={1.5}
              />
            ) : (
              <Upload
                className="h-6 w-6 text-[var(--accent)]"
                strokeWidth={1.5}
              />
            )}
            <div>
              <p className="font-[family-name:var(--font-display)] text-base tracking-wide text-[var(--ink)]">
                {phase === "working" ? "Reading…" : "Choose a file"}
              </p>
              <p className="mt-1.5 font-[family-name:var(--font-ui)] text-xs leading-relaxed text-[var(--ink-muted)]">
                .docx · .odt · .txt · .md · .html · .epub
              </p>
            </div>
          </button>
        ) : null}

        {phase === "preview" && parsed ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--accent-soft)] px-4 py-3">
              <p className="font-[family-name:var(--font-display)] text-base tracking-wide text-[var(--ink)]">
                {parsed.title}
              </p>
              <p className="mt-1 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-muted)]">
                {parsed.sourceName}
                <span className="mx-1.5 opacity-40">·</span>
                {parsed.chapters.length}{" "}
                {parsed.chapters.length === 1 ? "chapter" : "chapters"}
                <span className="mx-1.5 opacity-40">·</span>
                {formatWordCount(words)} words
              </p>
            </div>

            <div className="folio-scroll max-h-40 space-y-1 overflow-y-auto rounded-lg border border-[var(--border)] px-3 py-2">
              {parsed.chapters.map((ch, i) => (
                <div
                  key={`${ch.title}-${i}`}
                  className="flex items-baseline gap-3 py-1.5"
                >
                  <span className="w-6 shrink-0 font-[family-name:var(--font-ui)] text-[0.65rem] tabular-nums text-[var(--ink-faint)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="truncate font-[family-name:var(--font-ui)] text-sm text-[var(--ink)]">
                    {ch.title}
                  </span>
                </div>
              ))}
            </div>

            <p className="font-[family-name:var(--font-ui)] text-xs leading-relaxed text-[var(--ink-muted)]">
              This will replace your current manuscript
              {book.title ? ` (“${book.title}”)` : ""}. Notes are not imported.
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  reset();
                  inputRef.current?.click();
                }}
              >
                Choose another
              </Button>
              <Button size="sm" onClick={confirmImport}>
                Import
              </Button>
            </div>
          </div>
        ) : null}

        {phase === "working" && parsed ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2
              className="h-6 w-6 animate-spin text-[var(--accent)]"
              strokeWidth={1.5}
            />
            <p className="font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)]">
              Opening the book…
            </p>
          </div>
        ) : null}

        {phase === "done" ? (
          <p className="py-8 text-center font-[family-name:var(--font-ui)] text-sm tracking-wide text-[var(--accent)]">
            Manuscript ready
          </p>
        ) : null}

        {phase === "error" ? (
          <div className="space-y-4">
            <p className="font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
              {error}
            </p>
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={reset}>
                Try again
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function ImportSettingsRow({ onImport }: { onImport: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="font-[family-name:var(--font-ui)] text-sm tracking-wide text-[var(--ink)]">
          Upload manuscript
        </p>
        <p className="mt-0.5 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-muted)]">
          Split chapters from headings
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onImport}>
        <FileUp className="h-3.5 w-3.5" strokeWidth={1.5} />
        Upload
      </Button>
    </div>
  );
}
