"use client";

import { useCallback, useMemo, useState } from "react";
import { Cat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClarenceButton } from "@/components/Characters/ClaudeDeepenButton";
import {
  indexManuscriptWithClaude,
  useClaudeStatus,
} from "@/hooks/useClaudeEnrichment";
import { useBook } from "@/providers/BookProvider";
import { CLARENCE } from "@/lib/clarence";
import {
  formatIndexAge,
  isManuscriptIndexFresh,
} from "@/lib/manuscriptIndex";
import type { ManuscriptIndexData } from "@/lib/types";
import { cn } from "@/lib/utils";

export type ManuscriptIndexApi = ReturnType<typeof useManuscriptIndex>;

export function useManuscriptIndex() {
  const { book, setManuscriptIndex } = useBook();
  const claude = useClaudeStatus();
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"idle" | "reading" | "applying">("idle");
  const [error, setError] = useState<string | null>(null);

  const fresh = useMemo(
    () => isManuscriptIndexFresh(book),
    [book.chapters, book.manuscriptIndex],
  );

  const statusLabel = useMemo(() => {
    const idx = book.manuscriptIndex;
    if (!idx?.generatedAt) return "Clarence hasn’t read yet";
    if (!fresh)
      return `Manuscript changed · Clarence read ${formatIndexAge(idx.generatedAt)}`;
    return `Clarence read · ${formatIndexAge(idx.generatedAt)}`;
  }, [book.manuscriptIndex, fresh]);

  const ensureIndex = useCallback(
    async (opts?: { force?: boolean }): Promise<ManuscriptIndexData> => {
      if (!opts?.force && isManuscriptIndexFresh(book) && book.manuscriptIndex) {
        return book.manuscriptIndex;
      }
      setBusy(true);
      setPhase("reading");
      setError(null);
      try {
        const { index } = await indexManuscriptWithClaude(book);
        setManuscriptIndex(index);
        return index;
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Clarence couldn’t finish reading.";
        setError(message);
        throw e;
      } finally {
        setBusy(false);
        setPhase("idle");
      }
    },
    [book, setManuscriptIndex],
  );

  const reread = useCallback(async () => {
    await ensureIndex({ force: true });
  }, [ensureIndex]);

  return {
    claude,
    busy,
    phase,
    setPhase,
    error,
    setError,
    fresh,
    statusLabel,
    ensureIndex,
    reread,
    index: book.manuscriptIndex,
  };
}

export function ManuscriptIndexControls({
  api,
  onPopulate,
  populateLabel = CLARENCE.populateLabel,
  populateTitle = CLARENCE.populateTitle,
  className,
}: {
  api: ManuscriptIndexApi;
  onPopulate: () => void | Promise<void>;
  populateLabel?: string;
  populateTitle?: string;
  className?: string;
}) {
  const {
    claude,
    busy,
    phase,
    error,
    statusLabel,
    fresh,
    reread,
    index,
  } = api;
  const [localBusy, setLocalBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const running = busy || localBusy;

  async function handlePopulate() {
    setLocalBusy(true);
    setLocalError(null);
    setMessage(null);
    try {
      await onPopulate();
    } catch (e) {
      setLocalError(
        e instanceof Error ? e.message : "Clarence couldn’t populate that.",
      );
    } finally {
      setLocalBusy(false);
    }
  }

  async function handleReread() {
    setLocalError(null);
    setMessage(null);
    try {
      await reread();
      setMessage("Clarence finished rereading. Populate to apply.");
      window.setTimeout(() => setMessage(null), 4200);
    } catch {
      // error set on api
    }
  }

  const label =
    running && phase === "reading"
      ? CLARENCE.readingFull.replace(/…$/, "")
      : running && (phase === "applying" || localBusy)
        ? CLARENCE.applying.replace(/…$/, "")
        : populateLabel;

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <ClarenceButton
        configured={claude?.configured ?? null}
        busy={running}
        onClick={() => void handlePopulate()}
        label={label}
        title={populateTitle}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="gap-1.5 rounded-full"
        disabled={running || claude?.configured === false}
        title={
          index ? CLARENCE.rereadTitle : "Clarence will read before populating"
        }
        onClick={() => void handleReread()}
      >
        <Cat
          className={cn(
            "h-3.5 w-3.5",
            busy && phase === "reading" && "animate-pulse",
          )}
          strokeWidth={1.5}
        />
        {busy && phase === "reading"
          ? CLARENCE.reading
          : CLARENCE.rereadLabel}
      </Button>
      <span
        className={cn(
          "font-[family-name:var(--font-ui)] text-xs",
          fresh ? "text-[var(--ink-muted)]" : "text-[#6B3A2A]",
        )}
      >
        {statusLabel}
      </span>
      {message ? (
        <span className="font-[family-name:var(--font-ui)] text-xs text-[var(--ink-muted)]">
          {message}
        </span>
      ) : null}
      {localError || error ? (
        <span className="font-[family-name:var(--font-ui)] text-xs text-[#6B3A2A]">
          {localError || error}
        </span>
      ) : null}
    </div>
  );
}
