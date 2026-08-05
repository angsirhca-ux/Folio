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
import { ResumeMarker } from "@/components/Editor/ResumeMarker";
import {
  MentionHint,
  type MentionActivate,
} from "@/components/Editor/MentionHint";
import type { MentionTerm } from "@/lib/mentionHints";
import { focusEditorScene } from "@/lib/focusEditorScene";
import { scrollEditorPosIntoView } from "@/lib/editorNavigate";
import { registerManuscriptPendingFlush } from "@/lib/manuscriptPendingFlush";
import {
  clearResumePoint,
  peekResumePoint,
  stashResumePoint,
} from "@/lib/resumeMarkerStore";
import { cn } from "@/lib/utils";

const CONTENT_DEBOUNCE_MS = 450;
const MENTION_REFRESH_MS = 520;

interface ManuscriptEditorProps {
  content: string;
  /** Active chapter or dump page — so Save can flush pending prose. */
  documentId: string;
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
  /** Bible titles to soft-underline in prose. */
  mentionTerms?: MentionTerm[];
  onMentionActivate?: (hit: MentionActivate) => void;
}

export function ManuscriptEditor({
  content,
  documentId,
  onChange,
  focusMode = false,
  editable = true,
  className,
  onEditorReady,
  sceneFocus,
  reviewHighlights = [],
  activeReviewFlagId = null,
  mentionTerms = [],
  onMentionActivate,
}: ManuscriptEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const chapterIdRef = useRef(documentId);
  chapterIdRef.current = documentId;
  const onMentionRef = useRef(onMentionActivate);
  onMentionRef.current = onMentionActivate;

  const latestHtmlRef = useRef(content);
  const debounceRef = useRef<number | null>(null);
  const mentionRefreshRef = useRef<number | null>(null);
  const focusedRef = useRef(false);
  const applyingExternalRef = useRef(false);
  const editorRef = useRef<Editor | null>(null);
  const dirtyRef = useRef(false);
  const lastCaretRef = useRef({ documentId, pos: 1 });

  function captureHtml(ed: Editor | null | undefined): string {
    if (ed && !ed.isDestroyed) {
      latestHtmlRef.current = ed.getHTML();
      dirtyRef.current = false;
    }
    return latestHtmlRef.current;
  }

  function flushToParent() {
    if (debounceRef.current != null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    onChangeRef.current(captureHtml(editorRef.current));
  }

  function scheduleToParent(ed: Editor) {
    dirtyRef.current = true;
    if (debounceRef.current != null) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      onChangeRef.current(captureHtml(ed));
    }, CONTENT_DEBOUNCE_MS);
  }

  // Let Save / unload pull live TipTap HTML (scene breaks, last keystrokes).
  useEffect(() => {
    registerManuscriptPendingFlush(() => {
      const ed = editorRef.current;
      if (!ed || ed.isDestroyed) return null;
      if (debounceRef.current != null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      const html = captureHtml(ed);
      onChangeRef.current(html);
      return { documentId: chapterIdRef.current, html };
    });
    return () => registerManuscriptPendingFlush(null);
  }, []);

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
      ResumeMarker,
      MentionHint.configure({
        onActivate: (hit) => onMentionRef.current?.(hit),
      }),
    ],
    content,
    editable,
    editorProps: {
      attributes: {
        class: "outline-none",
        spellcheck: "true",
        lang: "en",
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
    onUpdate: ({ editor: ed, transaction }) => {
      if (applyingExternalRef.current) return;
      // Scene breaks are structural — flush immediately so Save / storyboard
      // don't miss them while the prose debounce is still pending.
      if (transaction.docChanged) {
        let beforeBreaks = 0;
        let afterBreaks = 0;
        transaction.before.descendants((node) => {
          if (node.type.name === "sceneBreak") beforeBreaks += 1;
        });
        ed.state.doc.descendants((node) => {
          if (node.type.name === "sceneBreak") afterBreaks += 1;
        });
        if (beforeBreaks !== afterBreaks) {
          if (debounceRef.current != null) {
            window.clearTimeout(debounceRef.current);
            debounceRef.current = null;
          }
          onChangeRef.current(captureHtml(ed));
          if (mentionRefreshRef.current != null) {
            window.clearTimeout(mentionRefreshRef.current);
          }
          mentionRefreshRef.current = window.setTimeout(() => {
            mentionRefreshRef.current = null;
            if (!ed.isDestroyed) ed.commands.refreshMentionHints();
          }, MENTION_REFRESH_MS);
          return;
        }
      }
      scheduleToParent(ed);
      if (mentionRefreshRef.current != null) {
        window.clearTimeout(mentionRefreshRef.current);
      }
      mentionRefreshRef.current = window.setTimeout(() => {
        mentionRefreshRef.current = null;
        if (!ed.isDestroyed) ed.commands.refreshMentionHints();
      }, MENTION_REFRESH_MS);
    },
  });

  editorRef.current = editor;

  useEffect(() => {
    if (editor && onEditorReady) onEditorReady(editor);
    return () => {
      onEditorReady?.(null);
    };
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
      if (mentionRefreshRef.current != null) {
        window.clearTimeout(mentionRefreshRef.current);
        mentionRefreshRef.current = null;
      }
      if (dirtyRef.current) {
        captureHtml(editorRef.current);
      }
      flush(latestHtmlRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount/unmount only; flush must bind the opening onChange
  }, []);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    // While typing, TipTap is source of truth — don't reset the doc from React.
    if (focusedRef.current || debounceRef.current != null || dirtyRef.current)
      return;
    if (content === latestHtmlRef.current) return;
    applyingExternalRef.current = true;
    editor.commands.setContent(content, { emitUpdate: false });
    latestHtmlRef.current = content;
    applyingExternalRef.current = false;
    editor.commands.refreshMentionHints();
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
    if (!editor || editor.isDestroyed) return;
    editor.commands.setMentionTerms(mentionTerms);
  }, [editor, mentionTerms]);

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

  // Remember caret when leaving (tab hide, sleep, navigate away).
  useEffect(() => {
    if (!editor) return;

    const trackCaret = () => {
      if (editor.isDestroyed) return;
      lastCaretRef.current = {
        documentId: chapterIdRef.current,
        pos: editor.state.selection.from,
      };
    };
    trackCaret();
    editor.on("selectionUpdate", trackCaret);

    const stashFromEditor = () => {
      const { documentId: id, pos } = lastCaretRef.current;
      stashResumePoint(id, pos);
    };

    const showStashed = () => {
      if (editor.isDestroyed) return;
      const pos = peekResumePoint(documentId);
      if (pos == null) return;
      editor.commands.setResumeMarker(pos);
      requestAnimationFrame(() => {
        if (!editor.isDestroyed) scrollEditorPosIntoView(editor, pos);
      });
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        stashFromEditor();
      } else {
        showStashed();
      }
    };

    const onPageHide = () => stashFromEditor();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);

    const restoreTimer = window.setTimeout(showStashed, 80);

    return () => {
      window.clearTimeout(restoreTimer);
      editor.off("selectionUpdate", trackCaret);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      stashFromEditor();
    };
  }, [editor, documentId]);

  // Typing clears persisted point as well as the decoration
  useEffect(() => {
    if (!editor) return;
    const onTransaction = ({
      transaction,
    }: {
      transaction: { docChanged: boolean };
    }) => {
      if (!transaction.docChanged) return;
      clearResumePoint(chapterIdRef.current);
    };
    editor.on("transaction", onTransaction);
    return () => {
      editor.off("transaction", onTransaction);
    };
  }, [editor]);

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
