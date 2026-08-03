import type { Editor } from "@tiptap/react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import { scrollEditorPosIntoView } from "@/lib/editorNavigate";

function isSceneBreakNode(node: ProseMirrorNode): boolean {
  if (node.type.name === "sceneBreak") return true;
  if (node.type.name !== "paragraph") return false;
  const text = node.textContent.replace(/\s+/g, " ").trim();
  return (
    text === "* * *" ||
    text === "***" ||
    text === "*  *  *" ||
    text === "• • •"
  );
}

function findScenePosition(editor: Editor, sceneIndex: number): number | null {
  const { doc } = editor.state;

  if (sceneIndex <= 0) {
    let pos = 1;
    const first = doc.firstChild;
    if (first?.type.name === "heading" && first.attrs.level === 1) {
      pos = 1 + first.nodeSize;
    }
    return Math.min(pos, doc.content.size);
  }

  let breaks = 0;
  let found: number | null = null;

  doc.forEach((node, offset) => {
    if (found != null) return;
    if (isSceneBreakNode(node)) {
      breaks += 1;
      if (breaks === sceneIndex) {
        // Land at the start of the next block after the break
        found = offset + node.nodeSize;
      }
    }
  });

  return found;
}

/** Move caret to the start of a ***–separated scene and scroll it into view. */
export function focusEditorScene(editor: Editor, sceneIndex: number) {
  if (!editor || editor.isDestroyed) return false;

  const pos = findScenePosition(editor, sceneIndex);
  if (pos == null) return false;

  const max = editor.state.doc.content.size;
  const safe = Math.min(Math.max(1, pos), max);

  try {
    const selection = TextSelection.near(editor.state.doc.resolve(safe), 1);
    const tr = editor.state.tr.setSelection(selection).scrollIntoView();
    editor.view.dispatch(tr);
    editor.view.focus();
  } catch {
    editor.chain().focus().setTextSelection(safe).scrollIntoView().run();
  }

  requestAnimationFrame(() => scrollEditorPosIntoView(editor, safe));
  return true;
}
