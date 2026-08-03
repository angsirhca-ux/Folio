"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, BookMarked, Plus, X } from "lucide-react";
import { WikiField } from "@/components/Characters/WikiField";
import { Button } from "@/components/ui/button";
import { useBook } from "@/providers/BookProvider";
import {
  encyclopediaAppearances,
  sortEncyclopediaStacks,
} from "@/lib/encyclopedia";
import { prepareCoverImage } from "@/lib/coverImage";
import type { EncyclopediaEntry, EncyclopediaStack } from "@/lib/types";
import { cn } from "@/lib/utils";

interface EncyclopediaPanelProps {
  open: boolean;
  onClose: () => void;
  entryId: string | null;
  onEntryIdChange: (id: string | null) => void;
}

export function EncyclopediaPanel({
  open,
  onClose,
  entryId,
  onEntryIdChange,
}: EncyclopediaPanelProps) {
  const router = useRouter();
  const {
    book,
    addEncyclopedia,
    updateEncyclopedia,
    addEncyclopediaStack,
    setEncyclopediaMemberCharacters,
    focusScene,
  } = useBook();
  const [query, setQuery] = useState("");
  const [coverBusy, setCoverBusy] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const entries = book.encyclopedia ?? [];
  const stacks = useMemo(
    () => sortEncyclopediaStacks(book.encyclopediaStacks ?? []),
    [book.encyclopediaStacks],
  );
  const stackOf = (stackId: string): EncyclopediaStack | undefined =>
    stacks.find((s) => s.id === stackId);
  const stackName = (stackId: string) =>
    stackOf(stackId)?.name ?? "Unsorted";
  const stackColor = (stackId: string) =>
    stackOf(stackId)?.color ?? "#8A847A";

  const entry = entryId
    ? (entries.find((e) => e.id === entryId) ?? null)
    : null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...entries];
    if (!q) return list;
    return list.filter((e) => {
      const hay = [
        e.title,
        e.shortBio,
        e.wiki,
        e.summary,
        stackName(e.stackId),
        ...(e.aliases ?? []),
        ...(e.tags ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [entries, query, stacks]);

  const grouped = useMemo(() => {
    const byStack = new Map<string, EncyclopediaEntry[]>();
    for (const e of filtered) {
      const key = stacks.some((s) => s.id === e.stackId) ? e.stackId : "__orphan__";
      const bucket = byStack.get(key) ?? [];
      bucket.push(e);
      byStack.set(key, bucket);
    }
    for (const bucket of byStack.values()) {
      bucket.sort((a, b) =>
        (a.title || "").localeCompare(b.title || ""),
      );
    }
    const groups: Array<{
      id: string;
      name: string;
      color: string;
      entries: EncyclopediaEntry[];
    }> = stacks
      .map((s) => ({
        id: s.id,
        name: s.name,
        color: s.color,
        entries: byStack.get(s.id) ?? [],
      }))
      .filter((g) => g.entries.length > 0);

    const orphans = byStack.get("__orphan__") ?? [];
    if (orphans.length) {
      groups.push({
        id: "__orphan__",
        name: "Unsorted",
        color: "#8A847A",
        entries: orphans,
      });
    }
    return groups;
  }, [filtered, stacks]);

  const appearances = useMemo(() => {
    if (!entry) return [];
    return encyclopediaAppearances(book.chapters, entry);
  }, [book.chapters, entry]);

  function createAndOpen() {
    const id = addEncyclopedia({ title: "New encyclopedia" });
    onEntryIdChange(id);
  }

  function patch(partial: Partial<Omit<EncyclopediaEntry, "id" | "createdAt">>) {
    if (!entry) return;
    updateEncyclopedia(entry.id, partial);
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.aside
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
          className="fixed bottom-0 right-0 top-0 z-50 flex w-[min(100vw,26rem)] flex-col border-l border-[var(--border)] bg-[var(--sidebar)] shadow-[-12px_0_40px_var(--shadow)]"
        >
          <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-6 py-5">
            <div className="min-w-0">
              <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.28em] text-[var(--ink-faint)]">
                Encyclopedia
              </p>
              <h2 className="mt-1 truncate font-[family-name:var(--font-display)] text-lg font-medium tracking-wide text-[var(--ink)]">
                {entry ? entry.title?.trim() || "Untitled" : "Commonplace"}
              </h2>
              {entry ? (
                <p className="mt-1.5 flex items-center gap-2 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-muted)]">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: stackColor(entry.stackId) }}
                    aria-hidden
                  />
                  {stackName(entry.stackId)}
                </p>
              ) : (
                <p className="mt-1 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-muted)]">
                  {entries.length}{" "}
                  {entries.length === 1 ? "entry" : "entries"}
                </p>
              )}
            </div>
            <button
              type="button"
              aria-label="Close encyclopedia"
              onClick={onClose}
              className="rounded-lg p-1.5 text-[var(--ink-faint)] hover:bg-[rgba(45,42,38,0.06)] hover:text-[var(--ink)]"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>

          {entry ? (
            <>
              <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-2">
                <button
                  type="button"
                  onClick={() => onEntryIdChange(null)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-muted)] transition-colors hover:bg-[rgba(45,42,38,0.06)] hover:text-[var(--ink)]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
                  All articles
                </button>
              </div>

              <div className="folio-scroll min-h-0 flex-1 space-y-5 px-6 py-5">
                <WikiField
                  label="Title"
                  value={entry.title}
                  onChange={(v) => patch({ title: v })}
                  multiline={false}
                  placeholder="Article title"
                />

                <WikiField
                  label="Notes"
                  hint="Freeform encyclopedia beside the draft"
                  value={entry.wiki}
                  onChange={(v) => patch({ wiki: v })}
                  rows={6}
                  placeholder="What you’re gathering…"
                />

                <WikiField
                  label="Blurb"
                  value={entry.shortBio}
                  onChange={(v) => patch({ shortBio: v })}
                  rows={2}
                  placeholder="One-line index line"
                />

                <WikiField
                  label="Findings"
                  value={entry.summary}
                  onChange={(v) => patch({ summary: v })}
                  rows={3}
                  placeholder="What you’ve distilled"
                />

                <div>
                  <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                    Cover
                  </p>
                  {entry.coverImage ? (
                    <div className="mt-2 overflow-hidden rounded-xl border border-[rgba(45,42,38,0.08)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={entry.coverImage}
                        alt=""
                        className="max-h-28 w-full object-cover"
                      />
                    </div>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <input
                      ref={coverInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        setCoverBusy(true);
                        void prepareCoverImage(file)
                          .then((prepared) => {
                            patch({
                              coverImage: prepared.dataUrl,
                              coverName: prepared.name,
                            });
                          })
                          .catch(() => {
                            /* ignore in panel */
                          })
                          .finally(() => setCoverBusy(false));
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-full text-xs"
                      disabled={coverBusy}
                      onClick={() => coverInputRef.current?.click()}
                    >
                      {entry.coverImage ? "Replace" : "Add cover"}
                    </Button>
                    {entry.coverImage ? (
                      <button
                        type="button"
                        className="font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)] hover:text-[#6B3A2A]"
                        onClick={() =>
                          patch({
                            coverImage: undefined,
                            coverName: undefined,
                          })
                        }
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>

                {(book.characters ?? []).length > 0 ? (
                  <div>
                    <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                      Members
                    </p>
                    <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto">
                      {(book.characters ?? []).map((c) => {
                        const on = (entry.memberIds ?? []).includes(c.id);
                        return (
                          <li key={c.id}>
                            <label className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1 hover:bg-[rgba(45,42,38,0.04)]">
                              <input
                                type="checkbox"
                                checked={on}
                                onChange={() => {
                                  const next = on
                                    ? entry.memberIds.filter((id) => id !== c.id)
                                    : [...(entry.memberIds ?? []), c.id];
                                  setEncyclopediaMemberCharacters(
                                    entry.id,
                                    next,
                                  );
                                }}
                              />
                              <span className="font-[family-name:var(--font-ui)] text-sm text-[var(--ink)]">
                                {c.name}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}

                {appearances.length > 0 ? (
                  <div>
                    <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                      In the manuscript
                    </p>
                    <ul className="mt-2 space-y-1">
                      {appearances.slice(0, 8).map((a) => (
                        <li key={`${a.chapterId}-${a.sceneIndex}`}>
                          <button
                            type="button"
                            onClick={() => {
                              focusScene(a.chapterId, a.sceneIndex);
                              router.push("/");
                            }}
                            className="w-full rounded-lg px-2 py-2 text-left transition-colors hover:bg-[rgba(45,42,38,0.05)]"
                          >
                            <span className="block truncate font-[family-name:var(--font-ui)] text-sm text-[var(--ink)]">
                              {a.scene.title?.trim() || "Untitled scene"}
                            </span>
                            <span className="block truncate font-[family-name:var(--font-ui)] text-[0.7rem] text-[var(--ink-faint)]">
                              {a.chapterTitle}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              <div className="space-y-3 border-t border-[var(--border)] px-6 py-4">
                <label className="block">
                  <span className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                    Move to stack
                  </span>
                  <select
                    value={entry.stackId}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "__new__") {
                        const name = window.prompt("New stack name");
                        if (!name?.trim()) return;
                        const id = addEncyclopediaStack(name.trim());
                        patch({ stackId: id });
                        return;
                      }
                      patch({ stackId: value });
                    }}
                    className="mt-2 w-full rounded-lg border border-[rgba(45,42,38,0.1)] bg-[var(--paper)] px-3 py-2 font-[family-name:var(--font-ui)] text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                  >
                    {stacks.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                    <option value="__new__">+ New stack…</option>
                  </select>
                </label>
                <Link
                  href={`/encyclopedia/${entry.id}`}
                  className="inline-flex items-center gap-2 font-[family-name:var(--font-ui)] text-sm text-[var(--accent)] transition-opacity hover:opacity-80"
                >
                  <BookMarked className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Open full wiki
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search encyclopedia…"
                  className="min-w-0 flex-1 rounded-lg border border-[rgba(45,42,38,0.1)] bg-[var(--paper)] px-3 py-2 font-[family-name:var(--font-ui)] text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)] focus:border-[var(--accent)]"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={createAndOpen}
                  title="New encyclopedia entry"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                  New
                </Button>
              </div>

              <div className="folio-scroll min-h-0 flex-1">
                {grouped.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 px-8 py-12 text-center">
                    <p className="font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
                      {entries.length === 0
                        ? "No encyclopedia yet. Keep an in-world article open beside the draft."
                        : "Nothing matches that search."}
                    </p>
                    {entries.length === 0 ? (
                      <Button type="button" size="sm" onClick={createAndOpen}>
                        <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                        New entry
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <div className="pb-4">
                    {grouped.map((group) => (
                      <section key={group.id} className="pt-3">
                        <div className="sticky top-0 z-10 flex items-center gap-2 bg-[var(--sidebar)] px-6 py-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: group.color }}
                            aria-hidden
                          />
                          <h3 className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                            {group.name}
                          </h3>
                        </div>
                        <ul>
                          {group.entries.map((e) => {
                            const count = encyclopediaAppearances(
                              book.chapters,
                              e,
                            ).length;
                            return (
                              <li key={e.id}>
                                <button
                                  type="button"
                                  onClick={() => onEntryIdChange(e.id)}
                                  className={cn(
                                    "flex w-full items-start gap-3 px-6 py-3 text-left transition-colors hover:bg-[rgba(45,42,38,0.04)]",
                                  )}
                                >
                                  <span
                                    className="mt-1.5 h-8 w-[3px] shrink-0 rounded-full opacity-80"
                                    style={{ backgroundColor: group.color }}
                                    aria-hidden
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate font-[family-name:var(--font-ui)] text-sm text-[var(--ink)]">
                                      {e.title?.trim() || "Untitled"}
                                    </p>
                                    {e.shortBio?.trim() ? (
                                      <p className="mt-0.5 truncate font-[family-name:var(--font-ui)] text-[0.7rem] text-[var(--ink-faint)]">
                                        {e.shortBio.trim()}
                                      </p>
                                    ) : null}
                                  </div>
                                  {count > 0 ? (
                                    <span className="shrink-0 font-[family-name:var(--font-ui)] text-[0.65rem] tabular-nums text-[var(--ink-faint)]">
                                      {count}
                                    </span>
                                  ) : null}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </section>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
