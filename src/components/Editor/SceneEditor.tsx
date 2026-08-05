"use client";

import { useEffect, useRef } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import CharacterCount from "@tiptap/extension-character-count";
import { cn } from "@/lib/utils";

const CONTENT_DEBOUNCE_MS = 280;

/**
 * TipTap editor for a single storyboard scene (no scene breaks —
 * those would split this fragment into extra manuscript scenes).
 */
export function SceneEditor({
  content,
  onChange,
  placeholder = "Write this scene…",
  className,
  autoFocus = true,
}: {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const latestHtmlRef = useRef(content);
  const debounceRef = useRef<number | null>(null);
  const applyingExternalRef = useRef(false);
  const editorRef = useRef<Editor | null>(null);
  const dirtyRef = useRef(false);

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false,
        code: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: "is-empty",
      }),
      Typography,
      CharacterCount,
    ],
    content,
    editable: true,
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: {
        class: "outline-none min-h-[14rem]",
        spellcheck: "true",
        lang: "en",
      },
      handleDOMEvents: {
        blur: () => {
          if (debounceRef.current != null) {
            window.clearTimeout(debounceRef.current);
            debounceRef.current = null;
          }
          const ed = editorRef.current;
          if (ed && !ed.isDestroyed) {
            latestHtmlRef.current = ed.getHTML();
            dirtyRef.current = false;
          }
          onChangeRef.current(latestHtmlRef.current);
          return false;
        },
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (applyingExternalRef.current) return;
      dirtyRef.current = true;
      if (debounceRef.current != null) {
        window.clearTimeout(debounceRef.current);
      }
      debounceRef.current = window.setTimeout(() => {
        debounceRef.current = null;
        if (!ed.isDestroyed) {
          latestHtmlRef.current = ed.getHTML();
          dirtyRef.current = false;
        }
        onChangeRef.current(latestHtmlRef.current);
      }, CONTENT_DEBOUNCE_MS);
    },
  });

  editorRef.current = editor;

  useEffect(() => {
    return () => {
      if (debounceRef.current != null) {
        window.clearTimeout(debounceRef.current);
      }
      const ed = editorRef.current;
      if (dirtyRef.current && ed && !ed.isDestroyed) {
        latestHtmlRef.current = ed.getHTML();
      }
      onChangeRef.current(latestHtmlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!editor) return;
    if (debounceRef.current != null || dirtyRef.current) return;
    if (content === latestHtmlRef.current) return;
    applyingExternalRef.current = true;
    editor.commands.setContent(content, { emitUpdate: false });
    latestHtmlRef.current = content;
    applyingExternalRef.current = false;
  }, [content, editor]);

  return (
    <div className={cn("manuscript-editor scene-write-editor", className)}>
      <EditorContent editor={editor} />
    </div>
  );
}
