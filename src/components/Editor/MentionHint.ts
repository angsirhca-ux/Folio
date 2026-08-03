import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import {
  findMentionHits,
  type MentionKind,
  type MentionTerm,
} from "@/lib/mentionHints";

export type MentionActivate = {
  kind: MentionKind;
  id: string;
  label: string;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    mentionHint: {
      setMentionTerms: (terms: MentionTerm[]) => ReturnType;
      refreshMentionHints: () => ReturnType;
    };
  }
}

function buildDecorations(
  doc: import("@tiptap/pm/model").Node,
  terms: MentionTerm[],
): DecorationSet {
  if (!terms.length) return DecorationSet.empty;
  const hits = findMentionHits(doc, terms);
  const decos = hits.map((h) =>
    Decoration.inline(h.from, h.to, {
      class: `mention-hint mention-hint--${h.term.kind}`,
      "data-mention-kind": h.term.kind,
      "data-mention-id": h.term.id,
      "data-mention-label": h.term.label,
      title: `${h.term.label} — open bible`,
    }),
  );
  return DecorationSet.create(doc, decos);
}

const mentionHintKey = new PluginKey("mentionHint");

export const MentionHint = Extension.create<{
  onActivate: ((hit: MentionActivate) => void) | null;
}>({
  name: "mentionHint",

  addOptions() {
    return {
      onActivate: null,
    };
  },

  addStorage() {
    return {
      terms: [] as MentionTerm[],
    };
  },

  addCommands() {
    return {
      setMentionTerms:
        (terms: MentionTerm[]) =>
        ({ tr, dispatch }) => {
          this.storage.terms = terms;
          if (dispatch) {
            dispatch(tr.setMeta(mentionHintKey, { type: "refresh" }));
          }
          return true;
        },
      refreshMentionHints:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            dispatch(tr.setMeta(mentionHintKey, { type: "refresh" }));
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const extension = this;
    return [
      new Plugin({
        key: mentionHintKey,
        state: {
          init: (_, state) =>
            buildDecorations(state.doc, extension.storage.terms),
          apply(tr, old, _oldState, newState) {
            const meta = tr.getMeta(mentionHintKey);
            if (meta) {
              if (!extension.storage.terms.length) {
                return DecorationSet.empty;
              }
              return buildDecorations(newState.doc, extension.storage.terms);
            }
            if (tr.docChanged) {
              if (!extension.storage.terms.length) {
                return DecorationSet.empty;
              }
              // Map until idle refresh rescans for new mentions.
              return old.map(tr.mapping, tr.doc);
            }
            return old;
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
          handleClick(_view, _pos, event) {
            const el = (event.target as HTMLElement | null)?.closest?.(
              "[data-mention-id]",
            ) as HTMLElement | null;
            if (!el) return false;
            const id = el.getAttribute("data-mention-id");
            const kind = el.getAttribute("data-mention-kind") as MentionKind | null;
            const label = el.getAttribute("data-mention-label") ?? "";
            if (!id || !kind) return false;
            extension.options.onActivate?.({ kind, id, label });
            return true;
          },
        },
      }),
    ];
  },
});
