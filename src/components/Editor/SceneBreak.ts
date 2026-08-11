import { Node, mergeAttributes, type Editor } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    sceneBreak: {
      setSceneBreak: () => ReturnType;
    };
  }
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
      },
      {
        tag: 'p[data-type="scene-break"]',
      },
      {
        tag: "p",
        getAttrs: (node) => {
          if (typeof node === "string") return false;
          const el = node as HTMLElement;
          const text = (el.textContent || "").replace(/\s+/g, " ").trim();
          if (text === "* * *" || text === "***" || text === "*  *  *") {
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
      }),
      ["span", { class: "scene-break-mark" }, "* * *"],
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
      mark.textContent = "* * *";
      dom.appendChild(mark);
      return {
        dom,
        // Atom — no editable content DOM
      };
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
});

function tryInsertSceneBreak(editor: Editor): boolean {
  const { state } = editor;
  const { $from, empty } = state.selection;
  if (!empty) return false;

  const parent = $from.parent;
  if (parent.type.name !== "paragraph") return false;
  if (parent.content.size > 0) return false;

  // Already between scene breaks / avoid stacking
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
