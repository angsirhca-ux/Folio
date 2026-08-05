"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Cat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClarenceButton } from "@/components/Characters/ClaudeDeepenButton";
import {
  indexManuscriptWithClaude,
  useClaudeStatus,
  type ManuscriptIndexProgress,
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

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function useManuscriptIndex() {
  const { book, setManuscriptIndex } = useBook();
  const claude = useClaudeStatus();
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"idle" | "reading" | "applying">("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ManuscriptIndexProgress | null>(
    null,
  );
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!busy || phase !== "reading" || startedAt == null) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [busy, phase, startedAt]);

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

  const readingLabel = useMemo(() => {
    if (!busy || phase !== "reading" || startedAt == null) return null;
    const elapsed = formatElapsed(now - startedAt);
    if (progress && progress.passCount > 0) {
      if (progress.pass === 0) {
        return `Starting · ${elapsed}`;
      }
      return `Pass ${progress.pass} of ${progress.passCount} · ${elapsed}`;
    }
    return `Reading · ${elapsed}`;
  }, [busy, phase, startedAt, now, progress]);

  const ensureIndex = useCallback(
    async (opts?: {
      force?: boolean;
      bookOverride?: typeof book;
    }): Promise<ManuscriptIndexData> => {
      const source = opts?.bookOverride ?? book;
      if (
        !opts?.force &&
        isManuscriptIndexFresh(source) &&
        source.manuscriptIndex
      ) {
        return source.manuscriptIndex;
      }
      setBusy(true);
      setPhase("reading");
      setError(null);
      setProgress(null);
      setStartedAt(Date.now());
      setNow(Date.now());
      try {
        const { index } = await indexManuscriptWithClaude(source, {
          onProgress: (p) => setProgress(p),
        });
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
        setProgress(null);
        setStartedAt(null);
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
    readingLabel,
    progress,
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
    readingLabel,
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
          index ? CLARENCE.rereadTitle : CLARENCE.firstReadTitle
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
          : index
            ? CLARENCE.rereadLabel
            : CLARENCE.firstReadLabel}
      </Button>
      <span
        className={cn(
          "font-[family-name:var(--font-ui)] text-xs",
          busy && phase === "reading"
            ? "text-[var(--ink)]"
            : fresh
              ? "text-[var(--ink-muted)]"
              : "text-[#6B3A2A]",
        )}
      >
        {readingLabel ?? statusLabel}
      </span>
      {busy && phase === "reading" ? (
        <span className="font-[family-name:var(--font-ui)] text-[0.7rem] text-[var(--ink-faint)]">
          Full novels often take a few minutes — keep Folio open.
        </span>
      ) : null}
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
