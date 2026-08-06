import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { findExcerptRange } from "@/lib/editorNavigate";

export type ReviewHighlightItem = {
  id: string;
  excerpt: string;
  category?: string;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    reviewHighlight: {
      setReviewHighlights: (items: ReviewHighlightItem[]) => ReturnType;
      setActiveReviewHighlight: (id: string | null) => ReturnType;
    };
  }
}

function buildDecorations(
  doc: import("@tiptap/pm/model").Node,
  items: ReviewHighlightItem[],
  activeId: string | null,
): DecorationSet {
  const decos: Decoration[] = [];
  const used = new Set<string>();

  for (const item of items) {
    const range = findExcerptRange(doc, item.excerpt);
    if (!range) continue;
    // Allow different flags on the same span; only skip exact dupes.
    const key = `${item.id}:${range.from}:${range.to}`;
    if (used.has(key)) continue;
    used.add(key);

    const isActive = activeId != null && activeId === item.id;
    decos.push(
      Decoration.inline(range.from, range.to, {
        class: isActive
          ? "review-highlight review-highlight-active"
          : "review-highlight",
        "data-review-flag": item.id,
      }),
    );
  }

  return DecorationSet.create(doc, decos);
}

const reviewHighlightKey = new PluginKey("reviewHighlight");

export const ReviewHighlight = Extension.create({
  name: "reviewHighlight",

  addStorage() {
    return {
      highlights: [] as ReviewHighlightItem[],
      activeId: null as string | null,
    };
  },

  addCommands() {
    return {
      setReviewHighlights:
        (items: ReviewHighlightItem[]) =>
        ({ tr, dispatch }) => {
          this.storage.highlights = items;
          if (dispatch) {
            dispatch(tr.setMeta(reviewHighlightKey, { type: "refresh" }));
          }
          return true;
        },
      setActiveReviewHighlight:
        (id: string | null) =>
        ({ tr, dispatch }) => {
          this.storage.activeId = id;
          if (dispatch) {
            dispatch(tr.setMeta(reviewHighlightKey, { type: "active" }));
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const extension = this;
    return [
      new Plugin({
        key: reviewHighlightKey,
        state: {
          init: (_, state) =>
            buildDecorations(
              state.doc,
              extension.storage.highlights,
              extension.storage.activeId,
            ),
          apply(tr, old, _oldState, newState) {
            const meta = tr.getMeta(reviewHighlightKey);
            // Full rebuild only when highlights/active change — not on every keystroke.
            if (meta) {
              if (!extension.storage.highlights.length) {
                return DecorationSet.empty;
              }
              return buildDecorations(
                newState.doc,
                extension.storage.highlights,
                extension.storage.activeId,
              );
            }
            if (tr.docChanged) {
              if (!extension.storage.highlights.length) {
                return DecorationSet.empty;
              }
              return old.map(tr.mapping, tr.doc);
            }
            return old;
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});
