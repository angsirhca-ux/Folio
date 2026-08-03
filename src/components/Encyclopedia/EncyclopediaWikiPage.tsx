"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import {
  EncyclopediaAppearancesRail,
  EncyclopediaBackLink,
} from "@/components/Encyclopedia/EncyclopediaAppearancesRail";
import { ClaudeDeepenButton } from "@/components/Characters/ClaudeDeepenButton";
import { DepthMeter } from "@/components/Characters/DepthMeter";
import { WikiField } from "@/components/Characters/WikiField";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useBook } from "@/providers/BookProvider";
import {
  encyclopediaAppearances,
  encyclopediaCompleteness,
  encyclopediaDepth,
  sortEncyclopediaStacks,
} from "@/lib/encyclopedia";
import { useEncyclopediaDeepen } from "@/hooks/useClaudeEnrichment";
import { povColor, type EncyclopediaEntry } from "@/lib/types";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "findings", label: "Findings" },
  { id: "connections", label: "Links" },
  { id: "appearances", label: "On the page" },
] as const;

export function EncyclopediaWikiPage({ entryId }: { entryId: string }) {
  const router = useRouter();
  const {
    book,
    hydrated,
    updateEncyclopedia,
    replaceEncyclopedia,
    deleteEncyclopedia,
    addEncyclopediaLink,
    updateEncyclopediaLink,
    removeEncyclopediaLink,
    addEncyclopediaStack,
    ensureEncyclopediaStack,
    focusScene,
  } = useBook();
  const [pendingDelete, setPendingDelete] = useState(false);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkTarget, setLinkTarget] = useState("");

  const entry = useMemo(
    () => (book.encyclopedia ?? []).find((e) => e.id === entryId),
    [book.encyclopedia, entryId],
  );

  const stacks = useMemo(
    () => sortEncyclopediaStacks(book.encyclopediaStacks ?? []),
    [book.encyclopediaStacks],
  );

  const others = useMemo(
    () => (book.encyclopedia ?? []).filter((e) => e.id !== entryId),
    [book.encyclopedia, entryId],
  );

  const appearances = useMemo(
    () => (entry ? encyclopediaAppearances(book.chapters, entry) : []),
    [book.chapters, entry],
  );

  const onApplyEnrichment = useCallback(
    (next: EncyclopediaEntry) => {
      replaceEncyclopedia(next);
    },
    [replaceEncyclopedia],
  );

  const {
    status: claudeStatus,
    busy: deepenBusy,
    error: deepenError,
    doneAt: deepenDoneAt,
    deepen,
  } = useEncyclopediaDeepen(
    book,
    entry,
    onApplyEnrichment,
    ensureEncyclopediaStack,
  );

  const completeness = entry ? encyclopediaCompleteness(entry) : 0;
  const depth = entry ? encyclopediaDepth(entry, appearances.length) : "stub";
  const accent = entry ? povColor(entry.title) : "var(--accent)";

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-1 w-16 overflow-hidden rounded-full bg-[rgba(176,141,87,0.2)]">
          <div className="folio-loading-bar h-full w-1/2 rounded-full bg-[var(--accent)]" />
        </div>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <p className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
          Entry not found
        </p>
        <Link
          href="/encyclopedia"
          className="mt-6 inline-block font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)] underline underline-offset-4"
        >
          Back to encyclopedia
        </Link>
      </div>
    );
  }

  function patch(partial: Parameters<typeof updateEncyclopedia>[1]) {
    updateEncyclopedia(entryId, partial);
  }

  return (
    <div className="relative min-h-screen">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-56 opacity-40"
        style={{
          background: `linear-gradient(180deg, color-mix(in srgb, ${accent} 18%, transparent), transparent)`,
        }}
        aria-hidden
      />

      <div className="relative mx-auto grid max-w-5xl gap-10 px-5 pb-28 pt-8 sm:px-8 lg:grid-cols-[11rem_minmax(0,1fr)] lg:px-10 lg:pt-10">
        <aside className="hidden lg:block">
          <div className="sticky top-8 space-y-8">
            <EncyclopediaBackLink />
            <nav aria-label="Wiki sections" className="space-y-2">
              {SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="block font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
                >
                  {s.label}
                </a>
              ))}
            </nav>
            <DepthMeter
              depth={depth}
              completeness={completeness}
              variant="encyclopedia"
            />
            <p className="font-[family-name:var(--font-ui)] text-xs leading-relaxed text-[var(--ink-faint)]">
              {appearances.length === 0
                ? "Waiting for a first scene."
                : `${appearances.length} appearance${appearances.length === 1 ? "" : "s"} in the manuscript.`}
            </p>
          </div>
        </aside>

        <article className="min-w-0">
          <div className="mb-6 flex items-center justify-between gap-4 lg:hidden">
            <EncyclopediaBackLink />
            <button
              type="button"
              aria-label="Delete entry"
              onClick={() => setPendingDelete(true)}
              className="rounded-full p-2 text-[var(--ink-faint)] transition-colors hover:text-[#6B3A2A]"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>

          <motion.header
            id="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
            className="scroll-mt-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <input
                  value={entry.title}
                  onChange={(e) => patch({ title: e.target.value })}
                  aria-label="Entry title"
                  className="w-full bg-transparent font-[family-name:var(--font-display)] text-4xl font-medium tracking-tight text-[var(--ink)] focus:outline-none sm:text-5xl"
                />
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          stacks.find((s) => s.id === entry.stackId)?.color ??
                          "#8A847A",
                      }}
                      aria-hidden
                    />
                    <span className="sr-only">Stack</span>
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
                      className="rounded-full border border-[rgba(45,42,38,0.1)] bg-[rgba(247,243,234,0.6)] px-3 py-1.5 font-[family-name:var(--font-ui)] text-xs uppercase tracking-[0.14em] text-[var(--ink-muted)] focus:outline-none"
                    >
                      {stacks.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                      <option value="__new__">+ New stack…</option>
                    </select>
                  </label>
                  <ClaudeDeepenButton
                    configured={claudeStatus?.configured ?? null}
                    busy={deepenBusy}
                    onClick={() => void deepen()}
                  />
                  {deepenDoneAt ? (
                    <span className="font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)]">
                      Updated
                    </span>
                  ) : null}
                </div>
                {deepenError ? (
                  <p className="mt-3 font-[family-name:var(--font-ui)] text-xs text-[#6B3A2A]">
                    {deepenError}
                  </p>
                ) : null}
                {claudeStatus?.configured === false ? (
                  <p className="mt-3 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)]">
                    Add ANTHROPIC_API_KEY to .env.local (see env.example), then
                    restart the server.
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Delete entry"
                onClick={() => setPendingDelete(true)}
                className="hidden rounded-full p-2 text-[var(--ink-faint)] transition-colors hover:text-[#6B3A2A] lg:inline-flex"
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>

            <WikiField
              className="mt-8"
              label="Index blurb"
              hint="One line for the roster — what this thread is at a glance."
              value={entry.shortBio}
              onChange={(shortBio) => patch({ shortBio })}
              placeholder="Letters that wait longer than the people who write them."
              rows={2}
            />

            <WikiField
              className="mt-8"
              label="Notes"
              hint="Your canon notes — sync never overwrites this once you’ve written something."
              value={entry.wiki}
              onChange={(wiki) => patch({ wiki })}
              placeholder="What you know so far — clippings, hunches, craft notes."
              rows={5}
              inputClassName="text-[1.05rem] leading-[1.75]"
            />

            {entry.storyDigest ? (
              <div className="mt-10 rounded-sm border-l-2 border-[var(--accent)] pl-5">
                <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                  From the manuscript
                </p>
                <p className="mt-1 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)]">
                  Auto-updated from scene labels and prose mentions.
                </p>
                <pre className="mt-4 whitespace-pre-wrap font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
                  {entry.storyDigest}
                </pre>
              </div>
            ) : null}

            <WikiField
              className="mt-8"
              label="Also known as"
              value={entry.aliases.join(", ")}
              onChange={(raw) =>
                patch({
                  aliases: raw
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="Other titles, shorthand…"
              multiline={false}
            />

            <WikiField
              className="mt-6"
              label="Tags"
              value={entry.tags.join(", ")}
              onChange={(raw) =>
                patch({
                  tags: raw
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="opening, echo, unanswered…"
              multiline={false}
            />
          </motion.header>

          <WikiSection id="findings" title="Findings" index={1}>
            <WikiField
              label="Summary"
              hint="Distilled canon — what this means for the world."
              value={entry.summary}
              onChange={(summary) => patch({ summary })}
              rows={4}
              placeholder="In a few sentences, what does this establish in the story world?"
            />
          </WikiSection>

          <WikiSection id="connections" title="Links" index={2}>
            <WikiField
              label="Linked characters"
              hint="Names from the cast this thread touches."
              value={entry.linkedCharacters.join(", ")}
              onChange={(raw) =>
                patch({
                  linkedCharacters: raw
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="Elena, Marcus…"
              multiline={false}
            />
            <WikiField
              className="mt-8"
              label="Linked locations"
              hint="Places where this thread lives on the page."
              value={entry.linkedLocations.join(", ")}
              onChange={(raw) =>
                patch({
                  linkedLocations: raw
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="The kitchen, the shoreline…"
              multiline={false}
            />

            <div className="mt-10">
              <p className="mb-4 font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                Related entries
              </p>
              {entry.links.length === 0 ? (
                <p className="font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)]">
                  No links yet. Connect themes that echo, contradict, or deepen
                  each other.
                </p>
              ) : (
                <ul className="space-y-6">
                  {entry.links.map((r) => {
                    const linked = others.find((o) => o.id === r.toEntryId);
                    return (
                      <li
                        key={r.id}
                        className="border-b border-[rgba(45,42,38,0.08)] pb-6"
                      >
                        <div className="flex flex-wrap items-baseline gap-3">
                          <input
                            value={r.label}
                            onChange={(e) =>
                              updateEncyclopediaLink(entryId, r.id, {
                                label: e.target.value,
                              })
                            }
                            placeholder="Label"
                            className="min-w-[8rem] flex-1 bg-transparent font-[family-name:var(--font-ui)] text-xs uppercase tracking-[0.16em] text-[var(--ink-faint)] focus:outline-none"
                          />
                          {linked ? (
                            <Link
                              href={`/research/${linked.id}`}
                              className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)] underline decoration-[rgba(176,141,87,0.3)] underline-offset-4"
                            >
                              {linked.title}
                            </Link>
                          ) : (
                            <input
                              value={r.toTitle}
                              onChange={(e) =>
                                updateEncyclopediaLink(entryId, r.id, {
                                  toTitle: e.target.value,
                                })
                              }
                              placeholder="Entry"
                              className="bg-transparent font-[family-name:var(--font-display)] text-lg text-[var(--ink)] focus:outline-none"
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => removeEncyclopediaLink(entryId, r.id)}
                            className="ml-auto font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)] hover:text-[#6B3A2A]"
                          >
                            Remove
                          </button>
                        </div>
                        <textarea
                          value={r.notes}
                          onChange={(e) =>
                            updateEncyclopediaLink(entryId, r.id, {
                              notes: e.target.value,
                            })
                          }
                          placeholder="How they relate…"
                          rows={2}
                          className="mt-3 w-full resize-none bg-transparent font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)] placeholder:text-[var(--ink-faint)] focus:outline-none"
                        />
                      </li>
                    );
                  })}
                </ul>
              )}

              <form
                className="mt-8 flex flex-wrap items-end gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!linkLabel.trim()) return;
                  const target = others.find((o) => o.id === linkTarget);
                  addEncyclopediaLink(entryId, {
                    label: linkLabel.trim(),
                    toEntryId: target?.id ?? "",
                    toTitle: target?.title ?? "",
                  });
                  setLinkLabel("");
                  setLinkTarget("");
                }}
              >
                <label className="min-w-[8rem] flex-1">
                  <span className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                    New link
                  </span>
                  <input
                    value={linkLabel}
                    onChange={(e) => setLinkLabel(e.target.value)}
                    placeholder="echoes, contradicts…"
                    className="mt-2 w-full border-0 border-b border-[rgba(45,42,38,0.1)] bg-transparent pb-2 font-[family-name:var(--font-body)] text-sm focus:border-[var(--accent)] focus:outline-none"
                  />
                </label>
                <label className="min-w-[10rem] flex-1">
                  <span className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                    With
                  </span>
                  <select
                    value={linkTarget}
                    onChange={(e) => setLinkTarget(e.target.value)}
                    className="mt-2 w-full border-0 border-b border-[rgba(45,42,38,0.1)] bg-transparent pb-2 font-[family-name:var(--font-body)] text-sm text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none"
                  >
                    <option value="">Another entry…</option>
                    {others.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.title}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  disabled={!linkLabel.trim()}
                >
                  Add
                </Button>
              </form>
            </div>
          </WikiSection>

          <WikiSection id="appearances" title="On the page" index={4}>
            <EncyclopediaAppearancesRail
              appearances={appearances}
              onOpenScene={focusScene}
            />
          </WikiSection>
        </article>
      </div>

      <ConfirmDialog
        open={pendingDelete}
        onOpenChange={setPendingDelete}
        title={`Delete ${entry.title}?`}
        description="This research entry will move to Trash. Scene labels keep the name; you can restore the page from Trash."
        confirmLabel="Move to trash"
        onConfirm={() => {
          deleteEncyclopedia(entryId);
          router.push("/research");
        }}
      />
    </div>
  );
}

function WikiSection({
  id,
  title,
  index,
  children,
}: {
  id: string;
  title: string;
  index: number;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{
        duration: 0.45,
        delay: 0.04,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      className="mt-16 scroll-mt-8 border-t border-[rgba(45,42,38,0.1)] pt-10"
    >
      <h2 className="flex items-baseline gap-3 font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
        <span className="font-[family-name:var(--font-ui)] text-sm text-[var(--ink-faint)]">
          {String(index).padStart(2, "0")}
        </span>
        {title}
      </h2>
      <div className="mt-8">{children}</div>
    </motion.section>
  );
}
