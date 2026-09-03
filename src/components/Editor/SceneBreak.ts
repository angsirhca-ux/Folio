import { Node, mergeAttributes, type Editor } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    sceneBreak: {
      setSceneBreak: () => ReturnType;
    };
  }
}

/** Ornament text — regular spaces only (letter-spacing shifts glyphs left). */
export const SCENE_BREAK_TEXT = "* * *";

export function isSceneBreakParagraphText(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  return (
    t === "* * *" ||
    t === "***" ||
    t === "*  *  *" ||
    t === "• • •"
  );
}

function applySceneBreakDomStyles(dom: HTMLParagraphElement, mark: HTMLSpanElement) {
  // Flex centering beats justify / text-align-last on legacy paragraph rules.
  dom.style.setProperty("display", "flex", "important");
  dom.style.setProperty("justify-content", "center", "important");
  dom.style.setProperty("align-items", "center", "important");
  dom.style.setProperty("width", "100%", "important");
  dom.style.setProperty("max-width", "none", "important");
  dom.style.setProperty("box-sizing", "border-box", "important");
  dom.style.setProperty("margin", "1.6em 0", "important");
  dom.style.setProperty("margin-left", "0", "important");
  dom.style.setProperty("margin-right", "0", "important");
  dom.style.setProperty("padding", "0", "important");
  dom.style.setProperty("text-align", "center", "important");
  dom.style.setProperty("text-indent", "0", "important");
  dom.style.setProperty("text-justify", "auto", "important");
  dom.style.setProperty("letter-spacing", "normal", "important");
  dom.style.setProperty("hyphens", "none", "important");
  dom.style.color = "var(--ink-muted)";
  dom.style.fontFamily = "var(--font-display)";
  dom.style.userSelect = "none";
  dom.style.cursor = "default";
  dom.style.float = "none";
  dom.style.clear = "both";

  // Do NOT use left/transform here — parent text-align:center already centers.
  mark.style.display = "inline";
  mark.style.letterSpacing = "normal";
  mark.style.margin = "0";
  mark.style.padding = "0";
  mark.style.position = "static";
  mark.style.left = "auto";
  mark.style.transform = "none";
  mark.style.whiteSpace = "pre";
  mark.style.fontFamily = "var(--font-display)";
  mark.style.color = "var(--ink-muted)";
  mark.style.pointerEvents = "none";
  mark.style.float = "none";
}

/**
 * A centered “* * *” ornament between scenes.
 * Press Enter on an empty paragraph to insert one (double-Enter feel).
 */
export const SceneBreak = Node.create({
  name: "sceneBreak",

  group: "block",

  atom: true,

  selectable: true,

  draggable: false,

  parseHTML() {
    return [
      {
        tag: "p.scene-break",
        priority: 60,
      },
      {
        tag: 'p[data-type="scene-break"]',
        priority: 60,
      },
      {
        tag: "p",
        priority: 60,
        getAttrs: (node) => {
          if (typeof node === "string") return false;
          const el = node as HTMLElement;
          const text = (el.textContent || "").replace(/\s+/g, " ").trim();
          if (isSceneBreakParagraphText(text)) {
            return {};
          }
          return false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "p",
      mergeAttributes(HTMLAttributes, {
        class: "scene-break",
        "data-type": "scene-break",
        style:
          "display:flex;justify-content:center;width:100%;text-align:center;text-indent:0;letter-spacing:normal;margin:1.6em 0;padding:0",
      }),
      [
        "span",
        {
          class: "scene-break-mark",
          style: "display:inline;letter-spacing:normal;white-space:pre",
        },
        SCENE_BREAK_TEXT,
      ],
    ];
  },

  addNodeView() {
    return () => {
      const dom = document.createElement("p");
      dom.className = "scene-break";
      dom.setAttribute("data-type", "scene-break");
      dom.setAttribute("contenteditable", "false");
      const mark = document.createElement("span");
      mark.className = "scene-break-mark";
      mark.textContent = SCENE_BREAK_TEXT;
      applySceneBreakDomStyles(dom, mark);
      dom.appendChild(mark);
      return { dom };
    };
  },

  addCommands() {
    return {
      setSceneBreak:
        () =>
        ({ chain }) =>
          chain()
            .insertContent([
              { type: this.name },
              { type: "paragraph" },
            ])
            .run(),
    };
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => tryInsertSceneBreak(editor),
    };
  },

  addProseMirrorPlugins() {
    const sceneBreakType = this.type;
    return [
      new Plugin({
        appendTransaction: (_transactions, _oldState, newState) => {
          const paragraph = newState.schema.nodes.paragraph;
          if (!paragraph || !sceneBreakType) return null;

          const replacements: { from: number; to: number }[] = [];
          newState.doc.descendants((node, pos) => {
            if (
              node.type === paragraph &&
              isSceneBreakParagraphText(node.textContent)
            ) {
              replacements.push({ from: pos, to: pos + node.nodeSize });
            }
          });
          if (replacements.length === 0) return null;

          const tr = newState.tr;
          for (let i = replacements.length - 1; i >= 0; i -= 1) {
            const { from, to } = replacements[i];
            tr.replaceWith(from, to, sceneBreakType.create());
          }
          return tr;
        },
      }),
    ];
  },
});

function tryInsertSceneBreak(editor: Editor): boolean {
  const { state } = editor;
  const { $from, empty } = state.selection;
  if (!empty) return false;

  const parent = $from.parent;
  if (parent.type.name !== "paragraph") return false;
  if (parent.content.size > 0) return false;

  const index = $from.index($from.depth - 1);
  const parentDoc = $from.node($from.depth - 1);
  const prev = index > 0 ? parentDoc.child(index - 1) : null;
  if (prev?.type.name === "sceneBreak") return false;

  const from = $from.before();
  const to = $from.after();

  return editor
    .chain()
    .focus()
    .insertContentAt(
      { from, to },
      [
        { type: "sceneBreak" },
        { type: "paragraph" },
      ],
    )
    .run();
}
