"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Minus,
  Quote,
} from "lucide-react";
import type { Editor } from "@tiptap/react";
import { cn } from "@/lib/utils";

interface ToolbarProps {
  editor: Editor | null;
  visible: boolean;
}

function ToolButton({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-250",
        active
          ? "bg-[var(--accent-soft)] text-[var(--accent)]"
          : "text-[var(--ink-muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--ink)]",
      )}
    >
      {children}
    </button>
  );
}

export function Toolbar({ editor, visible }: ToolbarProps) {
  if (!editor) return null;

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          className="folio-toolbar folio-chrome pointer-events-auto fixed bottom-8 left-1/2 z-40 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--paper)_88%,transparent)] px-2 py-1.5 shadow-[0_8px_32px_var(--shadow)]"
        >
          <ToolButton
            label="Bold"
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold className="h-3.5 w-3.5" strokeWidth={1.75} />
          </ToolButton>
          <ToolButton
            label="Italic"
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic className="h-3.5 w-3.5" strokeWidth={1.75} />
          </ToolButton>
          <div className="mx-1 h-4 w-px bg-[var(--border)]" />
          <ToolButton
            label="Chapter heading"
            active={editor.isActive("heading", { level: 1 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 1 }).run()
            }
          >
            <Heading1 className="h-3.5 w-3.5" strokeWidth={1.75} />
          </ToolButton>
          <ToolButton
            label="Section heading"
            active={editor.isActive("heading", { level: 2 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
          >
            <Heading2 className="h-3.5 w-3.5" strokeWidth={1.75} />
          </ToolButton>
          <ToolButton
            label="Quote"
            active={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            <Quote className="h-3.5 w-3.5" strokeWidth={1.75} />
          </ToolButton>
          <div className="mx-1 h-4 w-px bg-[var(--border)]" />
          <ToolButton
            label="Scene break"
            onClick={() => editor.chain().focus().setSceneBreak().run()}
          >
            <Minus className="h-3.5 w-3.5" strokeWidth={1.75} />
          </ToolButton>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
