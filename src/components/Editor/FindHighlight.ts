import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export type FindHighlightRange = { from: number; to: number };

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    findHighlight: {
      setFindHighlights: (
        ranges: FindHighlightRange[],
        activeIndex?: number | null,
      ) => ReturnType;
      clearFindHighlights: () => ReturnType;
    };
  }
}

type FindHighlightState = {
  ranges: FindHighlightRange[];
  activeIndex: number | null;
};

const findHighlightKey = new PluginKey<FindHighlightState>("findHighlight");

/**
 * Persistent find marks so matches stay visible while the search field is focused
 * (native selection disappears when the editor blurs).
 */
export const FindHighlight = Extension.create({
  name: "findHighlight",

  addStorage() {
    return {
      ranges: [] as FindHighlightRange[],
      activeIndex: null as number | null,
    };
  },

  addCommands() {
    return {
      setFindHighlights:
        (ranges, activeIndex = 0) =>
        ({ tr, dispatch }) => {
          this.storage.ranges = ranges;
          this.storage.activeIndex =
            ranges.length === 0
              ? null
              : Math.min(
                  Math.max(0, activeIndex ?? 0),
                  Math.max(0, ranges.length - 1),
                );
          if (dispatch) {
            dispatch(tr.setMeta(findHighlightKey, { type: "set" }));
          }
          return true;
        },
      clearFindHighlights:
        () =>
        ({ tr, dispatch }) => {
          this.storage.ranges = [];
          this.storage.activeIndex = null;
          if (dispatch) {
            dispatch(tr.setMeta(findHighlightKey, { type: "clear" }));
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const extension = this;
    return [
      new Plugin<FindHighlightState>({
        key: findHighlightKey,
        state: {
          init: () => ({
            ranges: extension.storage.ranges,
            activeIndex: extension.storage.activeIndex,
          }),
          apply(tr, value) {
            const meta = tr.getMeta(findHighlightKey) as
              | { type: string }
              | undefined;
            if (meta?.type === "clear") {
              return { ranges: [], activeIndex: null };
            }
            if (meta?.type === "set") {
              return {
                ranges: extension.storage.ranges,
                activeIndex: extension.storage.activeIndex,
              };
            }
            if (tr.docChanged && value.ranges.length) {
              const mapped = value.ranges.map((r) => ({
                from: tr.mapping.map(r.from, -1),
                to: tr.mapping.map(r.to, 1),
              }));
              extension.storage.ranges = mapped;
              return { ...value, ranges: mapped };
            }
            return value;
          },
        },
        props: {
          decorations(state) {
            const pluginState = findHighlightKey.getState(state);
            const ranges = pluginState?.ranges ?? [];
            if (!ranges.length) return DecorationSet.empty;
            const decos: Decoration[] = [];
            const activeIndex = pluginState?.activeIndex ?? null;
            ranges.forEach((range, i) => {
              const from = Math.min(
                Math.max(0, range.from),
                state.doc.content.size,
              );
              const to = Math.min(
                Math.max(from, range.to),
                state.doc.content.size,
              );
              if (from >= to) return;
              const isActive = activeIndex != null && activeIndex === i;
              decos.push(
                Decoration.inline(from, to, {
                  class: isActive
                    ? "find-highlight find-highlight-active"
                    : "find-highlight",
                }),
              );
            });
            return DecorationSet.create(state.doc, decos);
          },
        },
      }),
    ];
  },
});
