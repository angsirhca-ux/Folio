"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  MapPin,
  ScrollText,
  Search,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useBook } from "@/providers/BookProvider";
import {
  groupSearchHits,
  searchBook,
  type ProjectSearchHit,
  type ProjectSearchKind,
} from "@/lib/projectSearch";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<
  ProjectSearchKind,
  ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  chapter: BookOpen,
  scene: Sparkles,
  prose: BookOpen,
  character: Users,
  location: MapPin,
  research: ScrollText,
};

export function ProjectSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { book, focusScene, selectChapter, hydrated } = useBook();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const hits = useMemo(() => {
    if (!hydrated || !query.trim()) return [];
    return searchBook(book, query);
  }, [book, query, hydrated]);

  const groups = useMemo(() => groupSearchHits(hits), [hits]);
  const flat = hits;

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-search-index="${activeIndex}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const go = useCallback(
    (hit: ProjectSearchHit) => {
      onOpenChange(false);
      if (hit.kind === "character" || hit.kind === "location" || hit.kind === "research") {
        if (hit.href) router.push(hit.href);
        return;
      }
      if (hit.chapterId != null && hit.sceneIndex != null) {
        focusScene(hit.chapterId, hit.sceneIndex);
        router.push("/");
        return;
      }
      if (hit.chapterId) {
        selectChapter(hit.chapterId);
        router.push("/");
      }
    },
    [focusScene, onOpenChange, router, selectChapter],
  );

  function onKeyDown(e: ReactKeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onOpenChange(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(flat.length - 1, i + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const hit = flat[activeIndex];
      if (hit) go(hit);
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Close search"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] bg-[rgba(45,42,38,0.28)] backdrop-blur-[2px]"
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Search project"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
            className="fixed left-1/2 top-[min(12vh,5.5rem)] z-[70] w-[min(92vw,34rem)] -translate-x-1/2 overflow-hidden rounded-2xl border border-[rgba(45,42,38,0.08)] bg-[rgba(247,243,234,0.97)] shadow-[0_28px_80px_rgba(45,42,38,0.18)] backdrop-blur-xl"
            onKeyDown={onKeyDown}
          >
            <div className="flex items-center gap-3 border-b border-[rgba(45,42,38,0.08)] px-4 py-3">
              <Search
                className="h-4 w-4 shrink-0 text-[var(--ink-faint)]"
                strokeWidth={1.5}
              />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search manuscript, scenes, cast, places…"
                className="min-w-0 flex-1 bg-transparent font-[family-name:var(--font-ui)] text-base text-[var(--ink)] placeholder:text-[var(--ink-faint)] outline-none"
              />
              <kbd className="hidden shrink-0 rounded-md border border-[rgba(45,42,38,0.1)] px-1.5 py-0.5 font-[family-name:var(--font-ui)] text-[0.65rem] text-[var(--ink-faint)] sm:inline">
                esc
              </kbd>
              <button
                type="button"
                aria-label="Close"
                onClick={() => onOpenChange(false)}
                className="rounded-lg p-1 text-[var(--ink-faint)] hover:text-[var(--ink)] sm:hidden"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>

            <div
              ref={listRef}
              className="folio-scroll max-h-[min(62vh,28rem)] overflow-y-auto overscroll-contain px-2 py-2"
            >
              {!query.trim() ? (
                <p className="px-3 py-8 text-center font-[family-name:var(--font-ui)] text-sm text-[var(--ink-faint)]">
                  Find a line, a scene, a place, a name — across the whole book.
                </p>
              ) : flat.length === 0 ? (
                <p className="px-3 py-8 text-center font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)]">
                  Nothing matches “{query.trim()}”.
                </p>
              ) : (
                groups.map((group) => (
                  <div key={group.kind} className="mb-2">
                    <p className="px-3 pb-1 pt-2 font-[family-name:var(--font-ui)] text-[0.6rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                      {group.label}
                    </p>
                    <ul className="space-y-0.5">
                      {group.hits.map((hit) => {
                        const index = flat.indexOf(hit);
                        const Icon = KIND_ICON[hit.kind];
                        const active = index === activeIndex;
                        return (
                          <li key={hit.id}>
                            <button
                              type="button"
                              data-search-index={index}
                              onMouseEnter={() => setActiveIndex(index)}
                              onClick={() => go(hit)}
                              className={cn(
                                "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                                active
                                  ? "bg-[var(--accent-soft)]"
                                  : "hover:bg-[rgba(45,42,38,0.04)]",
                              )}
                            >
                              <Icon
                                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--ink-faint)]"
                                strokeWidth={1.5}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-[family-name:var(--font-ui)] text-sm text-[var(--ink)]">
                                  {hit.title}
                                </span>
                                {hit.subtitle ? (
                                  <span className="mt-0.5 block truncate font-[family-name:var(--font-ui)] text-[0.7rem] text-[var(--ink-faint)]">
                                    {hit.subtitle}
                                  </span>
                                ) : null}
                                {hit.excerpt ? (
                                  <span className="mt-1 block line-clamp-2 font-[family-name:var(--font-body)] text-[0.8rem] leading-snug text-[var(--ink-muted)]">
                                    {hit.excerpt}
                                  </span>
                                ) : null}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between border-t border-[rgba(45,42,38,0.06)] px-4 py-2 font-[family-name:var(--font-ui)] text-[0.65rem] text-[var(--ink-faint)]">
              <span>↑↓ move · ↵ open</span>
              <span>{flat.length ? `${flat.length} results` : "⌘K"}</span>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

/** Global ⌘K / Ctrl+K listener + optional trigger. */
export function useProjectSearchHotkey(onOpen: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.shiftKey || e.altKey) return;
      if (e.key.toLowerCase() !== "k") return;
      e.preventDefault();
      onOpen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpen]);
}
