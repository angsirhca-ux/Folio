"use client";

import { useEffect, useRef } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import Focus from "@tiptap/extension-focus";
import CharacterCount from "@tiptap/extension-character-count";
import { SceneBreak } from "@/components/Editor/SceneBreak";
import { ReviewHighlight } from "@/components/Editor/ReviewHighlight";
import type { ReviewHighlightItem } from "@/components/Editor/ReviewHighlight";
import { focusEditorScene } from "@/lib/focusEditorScene";
import { cn } from "@/lib/utils";

const CONTENT_DEBOUNCE_MS = 320;

interface ManuscriptEditorProps {
  content: string;
  onChange: (html: string) => void;
  focusMode?: boolean;
  editable?: boolean;
  className?: string;
  onEditorReady?: (editor: Editor | null) => void;
  /** When token changes, jump to this scene index (*** breaks). */
  sceneFocus?: { sceneIndex: number; token: number } | null;
  /** Developmental-editor excerpts to gently highlight. */
  reviewHighlights?: ReviewHighlightItem[];
  activeReviewFlagId?: string | null;
}

export function ManuscriptEditor({
  content,
  onChange,
  focusMode = false,
  editable = true,
  className,
  onEditorReady,
  sceneFocus,
  reviewHighlights = [],
  activeReviewFlagId = null,
}: ManuscriptEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const latestHtmlRef = useRef(content);
  const debounceRef = useRef<number | null>(null);
  const focusedRef = useRef(false);
  const applyingExternalRef = useRef(false);

  function flushToParent() {
    if (debounceRef.current != null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    onChangeRef.current(latestHtmlRef.current);
  }

  function scheduleToParent(html: string) {
    latestHtmlRef.current = html;
    if (debounceRef.current != null) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      onChangeRef.current(latestHtmlRef.current);
    }, CONTENT_DEBOUNCE_MS);
  }

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
        code: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
      }),
      Placeholder.configure({
        placeholder: "Begin writing…",
        emptyEditorClass: "is-empty",
      }),
      Typography,
      Focus.configure({
        className: "has-focus",
        mode: "deepest",
      }),
      CharacterCount,
      SceneBreak,
      ReviewHighlight,
    ],
    content,
    editable,
    editorProps: {
      attributes: {
        class: "outline-none",
        spellcheck: "true",
      },
      handleDOMEvents: {
        focus: () => {
          focusedRef.current = true;
          return false;
        },
        blur: () => {
          focusedRef.current = false;
          flushToParent();
          return false;
        },
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (applyingExternalRef.current) return;
      scheduleToParent(ed.getHTML());
    },
  });

  useEffect(() => {
    if (editor && onEditorReady) onEditorReady(editor);
  }, [editor, onEditorReady]);

  // Flush pending prose to the document this instance was editing.
  // Capture onChange at effect setup time so a chapter switch can't
  // attribute this HTML to the newly active chapter.
  useEffect(() => {
    const flush = onChange;
    return () => {
      if (debounceRef.current != null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      flush(latestHtmlRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount/unmount only; flush must bind the opening onChange
  }, []);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    // While typing, TipTap is source of truth — don't reset the doc from React.
    if (focusedRef.current || debounceRef.current != null) return;
    if (content === latestHtmlRef.current) return;
    applyingExternalRef.current = true;
    editor.commands.setContent(content, { emitUpdate: false });
    latestHtmlRef.current = content;
    applyingExternalRef.current = false;
  }, [content, editor]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editable, editor]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.commands.setReviewHighlights(reviewHighlights);
  }, [editor, reviewHighlights]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.commands.setActiveReviewHighlight(activeReviewFlagId);
  }, [editor, activeReviewFlagId]);

  useEffect(() => {
    if (!editor || !sceneFocus) return;

    let cancelled = false;
    const delays = [30, 120, 320, 560];
    const timers: number[] = [];

    delays.forEach((ms) => {
      timers.push(
        window.setTimeout(() => {
          if (cancelled || editor.isDestroyed) return;
          focusEditorScene(editor, sceneFocus.sceneIndex);
        }, ms),
      );
    });

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [editor, sceneFocus]);

  return (
    <div
      className={cn(
        "manuscript-editor",
        focusMode && "focus-mode",
        className,
      )}
    >
      <EditorContent editor={editor} />
    </div>
  );
}
