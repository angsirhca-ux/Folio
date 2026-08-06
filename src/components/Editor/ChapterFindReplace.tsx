"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { useRouter } from "next/navigation";
import {
  CaseSensitive,
  ChevronDown,
  ChevronUp,
  Replace,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  findDraftMatches,
  findMatchesInDoc,
  replaceAllInHtml,
  replaceAllMatches,
  replaceMatch,
  replaceOccurrenceInHtml,
  selectMatch,
  type DraftFindMatch,
} from "@/lib/manuscriptFind";
import { useBook } from "@/providers/BookProvider";
import { cn } from "@/lib/utils";

type Scope = "draft" | "chapter";

/** Whole-draft (or this-chapter) find & replace — embeds in the search dialog. */
export function ChapterFindReplace({
  editor,
  active,
}: {
  editor: Editor | null;
  active: boolean;
}) {
  const router = useRouter();
  const {
    book,
    activeChapter,
    selectChapter,
    updateChapterContent,
  } = useBook();
  const findRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [scope, setScope] = useState<Scope>("draft");
  const [index, setIndex] = useState(0);
  const [tick, setTick] = useState(0);
  const pendingSelect = useRef<DraftFindMatch | null>(null);

  const matches = useMemo(() => {
    void tick;
    if (!query) return [] as DraftFindMatch[];
    return findDraftMatches(book, query, {
      matchCase,
      chapterId: scope === "chapter" ? activeChapter.id : undefined,
      activeEditor: editor,
      activeChapterId: activeChapter.id,
    });
  }, [
    book,
    query,
    matchCase,
    scope,
    activeChapter.id,
    editor,
    tick,
  ]);

  const current = matches[index] ?? null;

  useEffect(() => {
    if (!active) return;
    const t = window.setTimeout(() => findRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [active]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const onUpdate = () => setTick((n) => n + 1);
    editor.on("update", onUpdate);
    return () => {
      editor.off("update", onUpdate);
    };
  }, [editor]);

  useEffect(() => {
    if (matches.length === 0) {
      setIndex(0);
      return;
    }
    setIndex((i) => Math.min(i, matches.length - 1));
  }, [matches.length]);

  // Paint find marks in the open chapter (visible while the search input is focused).
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (!active || !query.trim()) {
      editor.commands.clearFindHighlights();
      return;
    }
    const locals = findMatchesInDoc(editor.state.doc, query, { matchCase });
    // Active index among matches that belong to this chapter
    let activeLocal = 0;
    if (current && current.chapterId === activeChapter.id) {
      activeLocal = current.localIndex;
    }
    editor.commands.setFindHighlights(locals, activeLocal);
    return () => {
      if (!editor.isDestroyed) editor.commands.clearFindHighlights();
    };
  }, [
    editor,
    active,
    query,
    matchCase,
    matches,
    current,
    activeChapter.id,
    tick,
  ]);

  function revealMatch(match: DraftFindMatch) {
    const goSelect = () => {
      if (!editor || editor.isDestroyed) return;
      if (activeChapter.id !== match.chapterId) return;
      const locals = findMatchesInDoc(editor.state.doc, query, { matchCase });
      const local = locals[match.localIndex];
      if (local) {
        selectMatch(editor, local);
        editor.commands.setFindHighlights(locals, match.localIndex);
      }
    };

    if (match.chapterId !== activeChapter.id) {
      pendingSelect.current = match;
      selectChapter(match.chapterId);
      router.push("/");
      return;
    }
    pendingSelect.current = null;
    goSelect();
  }

  // After a chapter switch, select the pending hit once the editor is ready.
  useEffect(() => {
    if (!active || !query) return;
    const pending = pendingSelect.current;
    if (!pending) {
      if (!current || !editor || editor.isDestroyed) return;
      if (current.chapterId !== activeChapter.id) return;
      const locals = findMatchesInDoc(editor.state.doc, query, { matchCase });
      const local = locals[current.localIndex];
      if (local) selectMatch(editor, local);
      return;
    }
    if (pending.chapterId !== activeChapter.id) return;
    if (!editor || editor.isDestroyed) return;
    const locals = findMatchesInDoc(editor.state.doc, query, { matchCase });
    const local = locals[pending.localIndex];
    if (local) selectMatch(editor, local);
    pendingSelect.current = null;
  }, [
    active,
    activeChapter.id,
    editor,
    query,
    matchCase,
    current,
    tick,
  ]);

  function go(delta: number) {
    if (matches.length === 0) return;
    const next = (index + delta + matches.length) % matches.length;
    setIndex(next);
    const match = matches[next];
    if (match) revealMatch(match);
  }

  function doReplaceOne() {
    if (!current || !query) return;

    if (
      current.chapterId === activeChapter.id &&
      editor &&
      !editor.isDestroyed
    ) {
      const locals = findMatchesInDoc(editor.state.doc, query, { matchCase });
      const local = locals[current.localIndex];
      if (!local) return;
      replaceMatch(editor, local, replacement);
      setTick((n) => n + 1);
      return;
    }

    const chapter = book.chapters.find((c) => c.id === current.chapterId);
    if (!chapter) return;
    const nextHtml = replaceOccurrenceInHtml(
      chapter.content ?? "",
      query,
      replacement,
      current.localIndex,
      { matchCase },
    );
    if (nextHtml == null) return;
    updateChapterContent(nextHtml, current.chapterId);
    setTick((n) => n + 1);
  }

  function doReplaceAll() {
    if (!query || matches.length === 0) return;

    const chapterIds = new Set(matches.map((m) => m.chapterId));
    for (const chapterId of chapterIds) {
      if (
        chapterId === activeChapter.id &&
        editor &&
        !editor.isDestroyed
      ) {
        replaceAllMatches(editor, query, replacement, { matchCase });
        continue;
      }
      const chapter = book.chapters.find((c) => c.id === chapterId);
      if (!chapter) continue;
      const { html, count } = replaceAllInHtml(
        chapter.content ?? "",
        query,
        replacement,
        { matchCase },
      );
      if (count > 0) updateChapterContent(html, chapterId);
    }
    setTick((n) => n + 1);
    setIndex(0);
  }

  const hasBook = book.chapters.length > 0;

  if (!hasBook) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)]">
          No manuscript chapters yet.
        </p>
      </div>
    );
  }

  return (
    <div
      className="space-y-3 px-4 py-3"
      role="search"
      aria-label="Find and replace in manuscript"
    >
      <div
        className="flex rounded-full bg-[rgba(45,42,38,0.05)] p-0.5"
        role="group"
        aria-label="Find scope"
      >
        <button
          type="button"
          onClick={() => {
            setScope("draft");
            setIndex(0);
          }}
          className={cn(
            "flex-1 rounded-full px-2.5 py-1 font-[family-name:var(--font-ui)] text-[0.7rem] transition-colors",
            scope === "draft"
              ? "bg-[rgba(252,249,243,0.95)] text-[var(--ink)] shadow-sm"
              : "text-[var(--ink-faint)] hover:text-[var(--ink-muted)]",
          )}
        >
          Whole draft
        </button>
        <button
          type="button"
          onClick={() => {
            setScope("chapter");
            setIndex(0);
          }}
          className={cn(
            "flex-1 rounded-full px-2.5 py-1 font-[family-name:var(--font-ui)] text-[0.7rem] transition-colors",
            scope === "chapter"
              ? "bg-[rgba(252,249,243,0.95)] text-[var(--ink)] shadow-sm"
              : "text-[var(--ink-faint)] hover:text-[var(--ink-muted)]",
          )}
        >
          This chapter
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <input
          ref={findRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              go(e.shiftKey ? -1 : 1);
            }
          }}
          placeholder={
            scope === "draft"
              ? "Find in manuscript…"
              : "Find in this chapter…"
          }
          className="h-9 min-w-0 flex-1 rounded-full border border-[rgba(45,42,38,0.1)] bg-[rgba(45,42,38,0.04)] px-3 font-[family-name:var(--font-ui)] text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:border-[var(--border)] focus:outline-none"
        />
        <span className="shrink-0 tabular-nums font-[family-name:var(--font-ui)] text-[0.65rem] text-[var(--ink-faint)]">
          {query
            ? matches.length === 0
              ? "0"
              : `${index + 1}/${matches.length}`
            : "—"}
        </span>
        <button
          type="button"
          title="Previous"
          aria-label="Previous match"
          disabled={matches.length === 0}
          onClick={() => go(-1)}
          className="rounded-full p-1.5 text-[var(--ink-faint)] disabled:opacity-30 hover:bg-[rgba(45,42,38,0.06)] hover:text-[var(--ink)]"
        >
          <ChevronUp className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          title="Next"
          aria-label="Next match"
          disabled={matches.length === 0}
          onClick={() => go(1)}
          className="rounded-full p-1.5 text-[var(--ink-faint)] disabled:opacity-30 hover:bg-[rgba(45,42,38,0.06)] hover:text-[var(--ink)]"
        >
          <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          title={matchCase ? "Match case on" : "Match case off"}
          aria-pressed={matchCase}
          onClick={() => setMatchCase((v) => !v)}
          className={cn(
            "rounded-full p-1.5 transition-colors",
            matchCase
              ? "bg-[rgba(45,42,38,0.1)] text-[var(--ink)]"
              : "text-[var(--ink-faint)] hover:bg-[rgba(45,42,38,0.06)] hover:text-[var(--ink)]",
          )}
        >
          <CaseSensitive className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      </div>

      {current ? (
        <p className="truncate px-1 font-[family-name:var(--font-ui)] text-[0.7rem] text-[var(--ink-muted)]">
          {current.chapterTitle}
        </p>
      ) : null}

      <div className="flex items-center gap-1.5">
        <input
          value={replacement}
          onChange={(e) => setReplacement(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              e.stopPropagation();
              doReplaceOne();
            }
          }}
          placeholder="Replace with…"
          className="h-9 min-w-0 flex-1 rounded-full border border-[rgba(45,42,38,0.1)] bg-[rgba(45,42,38,0.04)] px-3 font-[family-name:var(--font-ui)] text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:border-[var(--border)] focus:outline-none"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9 gap-1 rounded-full px-2.5 text-xs"
          disabled={matches.length === 0}
          onClick={doReplaceOne}
        >
          <Replace className="h-3 w-3" strokeWidth={1.5} />
          Replace
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9 rounded-full px-2.5 text-xs"
          disabled={!query || matches.length === 0}
          onClick={doReplaceAll}
          title={
            matches.length
              ? `Replace all ${matches.length} matches`
              : undefined
          }
        >
          All{matches.length ? ` · ${matches.length}` : ""}
        </Button>
      </div>

      <p className="px-1 font-[family-name:var(--font-ui)] text-[0.65rem] text-[var(--ink-faint)]">
        {scope === "draft" ? "Entire manuscript" : "This chapter only"} · Enter
        next · ⇧Enter previous · ⌘Enter replace
      </p>
    </div>
  );
}
