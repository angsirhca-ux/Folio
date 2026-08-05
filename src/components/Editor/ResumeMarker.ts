import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { clearResumePoint } from "@/lib/resumeMarkerStore";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    resumeMarker: {
      setResumeMarker: (pos: number | null) => ReturnType;
      clearResumeMarker: () => ReturnType;
    };
  }
}

type ResumeMarkerState = {
  pos: number | null;
};

const resumeMarkerKey = new PluginKey<ResumeMarkerState>("resumeMarker");

function clampPos(docSize: number, pos: number): number {
  return Math.min(Math.max(1, pos), Math.max(1, docSize));
}

function buildDecorations(
  doc: import("@tiptap/pm/model").Node,
  pos: number | null,
  view: EditorView | null,
  onDismiss: () => void,
): DecorationSet {
  if (pos == null || !view) return DecorationSet.empty;
  const safe = clampPos(doc.content.size, pos);
  return DecorationSet.create(doc, [
    Decoration.widget(
      safe,
      () => {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "resume-marker";
        el.setAttribute("aria-label", "You left off here — click to dismiss");
        el.title = "You left off here — click to dismiss";
        el.addEventListener("mousedown", (e) => {
          e.preventDefault();
          e.stopPropagation();
          onDismiss();
        });
        return el;
      },
      { side: -1, key: "folio-resume-marker" },
    ),
  ]);
}

/**
 * Muted red caret showing where the author left off after leaving the page,
 * switching tabs, or the machine sleeping. Clears on type or click.
 */
export const ResumeMarker = Extension.create({
  name: "resumeMarker",

  addStorage() {
    return {
      pos: null as number | null,
    };
  },

  addCommands() {
    return {
      setResumeMarker:
        (pos: number | null) =>
        ({ tr, dispatch, state }) => {
          const next =
            pos == null ? null : clampPos(state.doc.content.size, pos);
          this.storage.pos = next;
          if (dispatch) {
            dispatch(tr.setMeta(resumeMarkerKey, { type: "set", pos: next }));
          }
          return true;
        },
      clearResumeMarker:
        () =>
        ({ tr, dispatch }) => {
          clearResumePoint();
          if (this.storage.pos == null) return true;
          this.storage.pos = null;
          if (dispatch) {
            dispatch(tr.setMeta(resumeMarkerKey, { type: "clear" }));
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const extension = this;
    let editorView: EditorView | null = null;

    const dismiss = () => {
      clearResumePoint();
      if (!editorView || editorView.isDestroyed) {
        extension.storage.pos = null;
        return;
      }
      extension.storage.pos = null;
      editorView.dispatch(
        editorView.state.tr.setMeta(resumeMarkerKey, { type: "clear" }),
      );
    };

    return [
      new Plugin<ResumeMarkerState>({
        key: resumeMarkerKey,
        state: {
          init: () => ({ pos: extension.storage.pos }),
          apply(tr, value) {
            const meta = tr.getMeta(resumeMarkerKey) as
              | { type: string; pos?: number | null }
              | undefined;
            if (meta?.type === "clear") {
              extension.storage.pos = null;
              return { pos: null };
            }
            if (meta?.type === "set") {
              const next =
                meta.pos == null
                  ? null
                  : clampPos(tr.doc.content.size, meta.pos);
              extension.storage.pos = next;
              return { pos: next };
            }
            // Any prose change clears the leave-off marker (typing, paste, etc.).
            if (tr.docChanged && value.pos != null) {
              extension.storage.pos = null;
              clearResumePoint();
              return { pos: null };
            }
            return value;
          },
        },
        props: {
          decorations(state) {
            const pluginState = resumeMarkerKey.getState(state);
            return buildDecorations(
              state.doc,
              pluginState?.pos ?? null,
              editorView,
              dismiss,
            );
          },
        },
        view(view) {
          editorView = view;
          return {
            destroy() {
              editorView = null;
            },
          };
        },
      }),
    ];
  },
});
