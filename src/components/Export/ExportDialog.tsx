"use client";

import { useState } from "react";
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
    description: "Editable .docx for Microsoft Word and Google Docs",
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
  const { book, wordCount } = useBook();
  const [state, setState] = useState<ExportState>("idle");
  const [active, setActive] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chapterCount = book.chapters.length;
  const title = book.title.trim() || "Untitled Manuscript";

  async function runExport(format: ExportFormat) {
    setActive(format);
    setState("working");
    setError(null);
    try {
      if (format === "epub") await exportEpub(book);
      else if (format === "pdf") await exportPdf(book);
      else if (format === "docx") await exportDocx(book);
      else await exportTxt(book);
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
      <DialogContent className="max-w-[26rem]">
        <DialogHeader>
          <DialogTitle>Export</DialogTitle>
          <DialogDescription>
            Take your manuscript with you — as a book, a document, or plain
            words on a page.
          </DialogDescription>
        </DialogHeader>

        <div className="mb-5 rounded-lg border border-[var(--border)] bg-[var(--accent-soft)] px-4 py-3">
          <p className="font-[family-name:var(--font-display)] text-base tracking-wide text-[var(--ink)]">
            {title}
          </p>
          <p className="mt-1 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-muted)]">
            {chapterCount} {chapterCount === 1 ? "chapter" : "chapters"}
            <span className="mx-1.5 opacity-40">·</span>
            {formatWordCount(wordCount)} words
            {book.author ? (
              <>
                <span className="mx-1.5 opacity-40">·</span>
                {book.author}
              </>
            ) : null}
          </p>
        </div>

        <div className="flex max-h-[min(52vh,22rem)] flex-col gap-2.5 overflow-y-auto folio-scroll pr-0.5">
          {FORMATS.map((format) => (
            <ExportOption
              key={format.id}
              title={format.title}
              description={format.description}
              icon={format.icon}
              busy={state === "working" && active === format.id}
              done={state === "done" && active === format.id}
              disabled={state === "working"}
              onClick={() => runExport(format.id)}
            />
          ))}
        </div>

        {error ? (
          <p className="mt-4 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-muted)]">
            {error}
          </p>
        ) : null}

        {state === "done" ? (
          <p className="mt-4 text-center font-[family-name:var(--font-ui)] text-xs tracking-wide text-[var(--accent)]">
            Saved to your downloads
          </p>
        ) : null}
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
        "disabled:cursor-wait disabled:opacity-60",
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
          Export manuscript
        </p>
        <p className="mt-0.5 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-muted)]">
          EPUB, PDF, Word, or text
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onExport}>
        Export
      </Button>
    </div>
  );
}
