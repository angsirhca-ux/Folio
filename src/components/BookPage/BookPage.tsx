"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { Editor } from "@tiptap/react";
import { ManuscriptEditor } from "@/components/Editor/ManuscriptEditor";
import type { ReviewHighlightItem } from "@/components/Editor/ReviewHighlight";
import { useBook } from "@/providers/BookProvider";
import { latestPassForChapter } from "@/lib/developmentalEditor";
import type { DevelopmentalPassKind } from "@/lib/types";

interface BookPageProps {
  onEditorReady?: (editor: Editor | null) => void;
  activeReviewFlagId?: string | null;
  /** When false, hide developmental flag decorations on the page. */
  showReviewHighlights?: boolean;
  /** Only highlight flags from this pass tab (style / story / line / continuity). */
  reviewPassKind?: DevelopmentalPassKind | null;
}

export function BookPage({
  onEditorReady,
  activeReviewFlagId = null,
  showReviewHighlights = false,
  reviewPassKind = null,
}: BookPageProps) {
  const {
    book,
    activeChapter,
    settings,
    updateChapterContent,
    setTitle,
    sceneFocus,
  } = useBook();

  const editorSceneFocus = useMemo(() => {
    if (!sceneFocus) return null;
    if (sceneFocus.chapterId !== activeChapter.id) return null;
    return {
      sceneIndex: sceneFocus.sceneIndex,
      token: sceneFocus.token,
    };
  }, [sceneFocus, activeChapter.id]);

  const reviewHighlights = useMemo((): ReviewHighlightItem[] => {
    if (!showReviewHighlights || !reviewPassKind) return [];
    const state = book.developmentalEditor;
    if (!state) return [];
    const pass = latestPassForChapter(
      state,
      activeChapter.id,
      reviewPassKind,
    );
    if (!pass) return [];
    const items: ReviewHighlightItem[] = [];
    for (const flag of pass.flags) {
      if (flag.closed) continue;
      if (!flag.excerpt?.trim()) continue;
      if (
        pass.kind === "continuity" &&
        flag.chapterId &&
        flag.chapterId !== activeChapter.id
      ) {
        continue;
      }
      items.push({
        id: flag.id,
        excerpt: flag.excerpt,
        category: flag.category,
      });
    }
    return items;
  }, [
    showReviewHighlights,
    reviewPassKind,
    book.developmentalEditor,
    activeChapter.id,
  ]);

  return (
    <motion.article
      key={activeChapter.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
      className="relative mx-auto w-full max-w-[var(--page-width)] px-8 pb-36 pt-20 sm:px-10 md:px-12 lg:px-14"
    >
      <header className="mb-16 text-center">
        <input
          value={book.title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Manuscript title"
          placeholder="Untitled Manuscript"
          className="w-full bg-transparent text-center font-[family-name:var(--font-display)] text-[0.7rem] font-medium uppercase tracking-[0.35em] text-[var(--ink-faint)] placeholder:text-[var(--ink-faint)] transition-colors focus:text-[var(--ink-muted)]"
        />
        {book.author ? (
          <p className="mt-3 font-[family-name:var(--font-ui)] text-sm italic text-[var(--ink-muted)]">
            {book.author}
          </p>
        ) : null}
        <div
          className="mx-auto mt-9 h-px w-10 bg-[var(--accent)] opacity-45"
          aria-hidden
        />
      </header>

      <ManuscriptEditor
        key={activeChapter.id}
        content={activeChapter.content}
        onChange={updateChapterContent}
        focusMode={settings.focusMode}
        onEditorReady={onEditorReady}
        sceneFocus={editorSceneFocus}
        reviewHighlights={reviewHighlights}
        activeReviewFlagId={
          showReviewHighlights ? activeReviewFlagId : null
        }
      />
    </motion.article>
  );
}
