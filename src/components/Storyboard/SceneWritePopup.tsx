"use client";

import { useEffect, useMemo, useState } from "react";
import { SceneEditor } from "@/components/Editor/SceneEditor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getSceneHtmlParts } from "@/lib/manuscriptScenes";
import { findScene } from "@/lib/scenes";
import { countWords, formatWordCount } from "@/lib/utils";
import type { Book } from "@/lib/types";

function splitLeadingH1(html: string): { h1: string; body: string } {
  const match = /^(<h1[^>]*>[\s\S]*?<\/h1>)\s*/i.exec(html.trim());
  if (!match) return { h1: "", body: html.trim() || "<p></p>" };
  const rest = html.trim().slice(match[0].length).trim();
  return { h1: match[1], body: rest || "<p></p>" };
}

export function SceneWritePopup({
  open,
  sceneId,
  book,
  onClose,
  onSave,
}: {
  open: boolean;
  sceneId: string | null;
  book: Book;
  onClose: () => void;
  onSave: (sceneId: string, html: string) => void;
}) {
  const found = useMemo(
    () => (sceneId ? findScene(book.chapters, sceneId) : null),
    [book.chapters, sceneId],
  );

  const [draft, setDraft] = useState("<p></p>");
  const [leadingH1, setLeadingH1] = useState("");
  const [baseline, setBaseline] = useState("<p></p>");
  const [editorKey, setEditorKey] = useState(0);

  useEffect(() => {
    if (!open || !found) return;
    const parts = getSceneHtmlParts(found.chapter.content);
    const part = parts[found.sceneIndex] ?? "<p></p>";
    // Keep chapter <h1> out of the writing surface for scene 0; reattach on save.
    const { h1, body } =
      found.sceneIndex === 0 ? splitLeadingH1(part) : { h1: "", body: part };
    setLeadingH1(h1);
    setDraft(body);
    setBaseline(body);
    setEditorKey((k) => k + 1);
  }, [open, found?.scene.id, found?.sceneIndex, found?.chapter.id]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!found || !sceneId) return;
        if (draft === baseline) return;
        const html = leadingH1 ? `${leadingH1}${draft}` : draft;
        onSave(sceneId, html);
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    open,
    found,
    sceneId,
    draft,
    baseline,
    leadingH1,
    onSave,
    onClose,
  ]);

  const dirty = draft !== baseline;
  const words = countWords(draft);

  function handleSave() {
    if (!found || !sceneId) return;
    const html = leadingH1 ? `${leadingH1}${draft}` : draft;
    onSave(sceneId, html);
    onClose();
  }

  function handleOpenChange(next: boolean) {
    if (!next) onClose();
  }

  return (
    <Dialog open={open && Boolean(found)} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex w-[min(96vw,40rem)] max-h-[min(92vh,44rem)] flex-col gap-0 overflow-hidden p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {found ? (
          <>
            <DialogHeader className="shrink-0 border-b border-[var(--border)] px-7 pb-4 pt-7 pr-14">
              <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                {found.chapter.title}
                <span className="mx-2 text-[rgba(45,42,38,0.2)]">·</span>
                Scene {found.sceneIndex + 1}
              </p>
              <DialogTitle className="mt-1 text-xl sm:text-2xl">
                {found.scene.title || "Untitled Scene"}
              </DialogTitle>
              <DialogDescription>
                Write just this scene. Save updates the manuscript — the rest of
                the chapter stays put.
              </DialogDescription>
            </DialogHeader>

            <div className="folio-scroll min-h-0 flex-1 overflow-y-auto px-7 py-5">
              <SceneEditor
                key={`${found.scene.id}-${editorKey}`}
                content={draft}
                onChange={setDraft}
                placeholder="Write this scene…"
              />
            </div>

            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--border)] px-7 py-4">
              <p className="font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)]">
                {formatWordCount(words)} words
                {dirty ? (
                  <span className="ml-2 text-[var(--ink-muted)]">· unsaved</span>
                ) : null}
              </p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleSave} disabled={!dirty}>
                  Save to manuscript
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
