"use client";

import { useEffect } from "react";

interface ShortcutHandlers {
  onToggleFocus?: () => void;
  onToggleSidebar?: () => void;
  onToggleFullscreen?: () => void;
  onOpenSettings?: () => void;
  onToggleToolbar?: () => void;
  onToggleNotes?: () => void;
  onToggleInspector?: () => void;
  onToggleGoals?: () => void;
  onToggleCritique?: () => void;
  onToggleResearch?: () => void;
  onToggleEncyclopedia?: () => void;
  onOpenExport?: () => void;
  onOpenPreview?: () => void;
  onOpenImport?: () => void;
  onSave?: () => void;
  onChapterUp?: () => void;
  onChapterDown?: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest(".ProseMirror, [contenteditable='true']"));
}

function isInChapterNav(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("[data-chapter-nav]"));
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      // Chapter navigation — ⌥↑ / ⌥↓ anywhere, or plain ↑/↓ in the Contents list
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        const inNav = isInChapterNav(e.target);
        const withAlt = e.altKey && !mod;
        if (inNav || withAlt) {
          // Allow plain arrows in nav even while a chapter title input isn't focused
          if (inNav && isTypingTarget(e.target) && (e.target as HTMLElement).tagName === "INPUT") {
            return;
          }
          e.preventDefault();
          if (e.key === "ArrowUp") handlers.onChapterUp?.();
          else handlers.onChapterDown?.();
          return;
        }
      }

      // ⌘S — save now
      if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handlers.onSave?.();
        return;
      }

      // ⌘⌥F — focus mode (works even while typing)
      if (mod && e.altKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        handlers.onToggleFocus?.();
        return;
      }

      // ⌘⌥R — research rail beside manuscript
      if (mod && e.altKey && e.key.toLowerCase() === "r") {
        e.preventDefault();
        handlers.onToggleResearch?.();
        return;
      }

      // ⌘⌥E — encyclopedia rail beside manuscript
      if (mod && e.altKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        handlers.onToggleEncyclopedia?.();
        return;
      }

      // ⌘\ — sidebar
      if (mod && e.key === "\\") {
        e.preventDefault();
        handlers.onToggleSidebar?.();
        return;
      }

      // ⌘. — fullscreen
      if (mod && e.key === ".") {
        e.preventDefault();
        handlers.onToggleFullscreen?.();
        return;
      }

      // ⌘, — settings
      if (mod && e.key === ",") {
        e.preventDefault();
        handlers.onOpenSettings?.();
        return;
      }

      // ⌘O — upload / open manuscript
      if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        handlers.onOpenImport?.();
        return;
      }

      // ⌘E — export
      if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        handlers.onOpenExport?.();
        return;
      }

      // ⌘⇧E — book preview
      if (mod && e.shiftKey && !e.altKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        handlers.onOpenPreview?.();
      }

      // ⌘/ — toggle formatting toolbar
      if (mod && e.key === "/") {
        e.preventDefault();
        handlers.onToggleToolbar?.();
        return;
      }

      // ⌘⇧N — notes
      if (mod && e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        handlers.onToggleNotes?.();
        return;
      }

      // ⌘⇧M — scene metadata inspector
      if (mod && e.shiftKey && e.key.toLowerCase() === "m") {
        e.preventDefault();
        handlers.onToggleInspector?.();
        return;
      }

      // ⌘⇧G — writing goals
      if (mod && e.shiftKey && e.key.toLowerCase() === "g") {
        e.preventDefault();
        handlers.onToggleGoals?.();
        return;
      }

      // ⌘⇧C — critique panel
      if (mod && e.shiftKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        handlers.onToggleCritique?.();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handlers]);
}
