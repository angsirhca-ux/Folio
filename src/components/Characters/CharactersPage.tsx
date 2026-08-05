"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Plus, Search, X } from "lucide-react";
import {
  ManuscriptIndexControls,
  useManuscriptIndex,
} from "@/components/Manuscript/ManuscriptIndexControls";
import { ClarencePopulateAskDialog } from "@/components/Characters/ClarencePopulateAskDialog";
import { DepthMeter } from "@/components/Characters/DepthMeter";
import { FamilyTreesView } from "@/components/Characters/FamilyTreesView";
import { SeriesBibleStrip } from "@/components/Series/SeriesBibleStrip";
import { Button } from "@/components/ui/button";
import { useBook } from "@/providers/BookProvider";
import {
  characterAppearances,
  characterCompleteness,
  characterDepth,
  collapseDuplicateCharacters,
  createCharacter,
  findCharacterByName,
} from "@/lib/characters";
import {
  preferCanonicalName,
  suggestNameAliases,
} from "@/lib/nameContinuity";
import {
  applyCharacterEnrichment,
  type CharacterEnrichmentPayload,
} from "@/lib/characterEnrichment";
import { enrichCharacterWithClaude } from "@/hooks/useClaudeEnrichment";
import {
  probeFirstPersonNarrator,
  type ClarenceAskAnswers,
  type FirstPersonProbe,
} from "@/lib/clarenceAsk";
import {
  CHARACTER_ROLE_META,
  povColor,
  type Character,
  type CharacterRole,
} from "@/lib/types";
import { CLARENCE } from "@/lib/clarence";
import { cn } from "@/lib/utils";

type SortMode = "story" | "name" | "depth" | "role";
type CastView = "roster" | "tree";

const DEPTH_RANK = { stub: 0, sketch: 1, portrait: 2, living: 3 } as const;
/** Soft cap so a huge cast doesn’t run enrich for an hour in one click. */
const MAX_SHEETS_PER_POPULATE = 20;

function isThinCharacterSheet(c: Character): boolean {
  const hasWiki = Boolean(c.wiki?.trim());
  const hasPsych = Boolean(
    c.psychology?.wants?.trim() ||
      c.psychology?.needs?.trim() ||
      c.psychology?.fears?.trim(),
  );
  const hasIdentity = Boolean(
    c.identity?.appearance?.trim() || c.identity?.occupation?.trim(),
  );
  const hasVoice = Boolean(c.voice?.speechNotes?.trim());
  return !hasWiki && !hasPsych && !hasIdentity && !hasVoice;
}

export function CharactersPage() {
  const router = useRouter();
  const {
    book,
    hydrated,
    addCharacter,
    upsertCharacters,
    deleteCharacter,
    applyClarenceAsk,
  } = useBook();
  const indexApi = useManuscriptIndex();
  const [view, setView] = useState<CastView>("roster");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("story");
  const [roleFilter, setRoleFilter] = useState<CharacterRole | "all">("all");
  const [castMessage, setCastMessage] = useState<string | null>(null);
  const [askOpen, setAskOpen] = useState(false);
  const [askProbe, setAskProbe] = useState<FirstPersonProbe | null>(null);
  const askResolver = useRef<((answers: ClarenceAskAnswers | null) => void) | null>(
    null,
  );

  const characters = book.characters ?? [];

  function requestClarenceAsk(
    probe: FirstPersonProbe,
  ): Promise<ClarenceAskAnswers | null> {
    setAskProbe(probe);
    setAskOpen(true);
    return new Promise((resolve) => {
      askResolver.current = resolve;
    });
  }

  const roster = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = characters.map((c) => {
      const appearances = characterAppearances(book.chapters, c);
      const presentCount = appearances.filter((a) => a.presence === "present")
        .length;
      const completeness = characterCompleteness(c);
      const depth = characterDepth(c, presentCount);
      const firstPresent = appearances.find((a) => a.presence === "present");
      const firstIndex =
        firstPresent != null
          ? firstPresent.chapterIndex * 1000 + firstPresent.sceneIndex
          : Number.MAX_SAFE_INTEGER;
      return {
        character: c,
        appearances,
        presentCount,
        completeness,
        depth,
        firstIndex,
      };
    });

    if (roleFilter !== "all") {
      list = list.filter((r) => r.character.role === roleFilter);
    }
    if (q) {
      list = list.filter(({ character: c }) => {
        const hay = [
          c.name,
          c.shortBio,
          c.wiki,
          ...c.aliases,
          ...c.tags,
          CHARACTER_ROLE_META[c.role].label,
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }

    list.sort((a, b) => {
      if (sort === "name") {
        return a.character.name.localeCompare(b.character.name);
      }
      if (sort === "depth") {
        return DEPTH_RANK[b.depth] - DEPTH_RANK[a.depth];
      }
      if (sort === "role") {
        return (
          ROLE_ORDER[a.character.role] - ROLE_ORDER[b.character.role] ||
          a.character.name.localeCompare(b.character.name)
        );
      }
      return (
        a.firstIndex - b.firstIndex ||
        a.character.name.localeCompare(b.character.name)
      );
    });

    return list;
  }, [characters, book.chapters, search, sort, roleFilter]);

  function createAndOpen(name?: string) {
    const id = addCharacter(name ? { name } : undefined);
    router.push(`/characters/${id}`);
  }

  async function runPopulateCast() {
    indexApi.setError(null);
    setCastMessage(null);

    const probe = probeFirstPersonNarrator(book);
    let workingBook = book;
    if (probe.needsNarratorAsk) {
      const answers = await requestClarenceAsk(probe);
      if (!answers) {
        setCastMessage(
          "Populate cancelled — tell Clarence who “I” is when ready.",
        );
        window.setTimeout(() => setCastMessage(null), 5000);
        return;
      }
      const applied = applyClarenceAsk(answers);
      workingBook = {
        ...book,
        chapters: applied.chapters,
        characters: applied.characters,
        clarenceContext: applied.clarenceContext,
      };
      setCastMessage(
        applied.povTagged
          ? `Noted — tagged ${applied.povTagged} scene${applied.povTagged === 1 ? "" : "s"} as ${answers.narratorName}. Reading…`
          : `Noted — ${answers.narratorName} is the narrator. Reading…`,
      );
    }

    const index = await indexApi.ensureIndex({
      force: probe.needsNarratorAsk,
      bookOverride: workingBook,
    });
    indexApi.setPhase("applying");
    try {
      let rosterSnapshot = [...(workingBook.characters ?? [])];
      const created: Character[] = [];
      for (const d of index.characters ?? []) {
        // Only seed people Clarence marked on-stage (or legacy entries without flag).
        if (d.presence === "mentioned") continue;
        const existing = findCharacterByName(rosterSnapshot, d.name);
        if (existing) {
          const canonical = preferCanonicalName(existing.name, d.name);
          const aliasSet = new Set(
            [
              ...(existing.aliases ?? []),
              ...(d.aliases ?? []),
              ...suggestNameAliases(canonical),
              existing.name,
              d.name,
            ]
              .map((a) => a.trim())
              .filter(
                (a) => a && a.toLowerCase() !== canonical.toLowerCase(),
              ),
          );
          const upgraded = {
            ...existing,
            name: canonical,
            aliases: [...aliasSet],
            role:
              existing.role === "unspecified" && d.role
                ? d.role
                : existing.role,
            shortBio:
              !existing.shortBio?.trim() && d.shortBio?.trim()
                ? d.shortBio.trim()
                : existing.shortBio,
            updatedAt: Date.now(),
          };
          rosterSnapshot = rosterSnapshot.map((c) =>
            c.id === existing.id ? upgraded : c,
          );
          upsertCharacters([upgraded]);
          continue;
        }
        const next = createCharacter({
          name: d.name,
          role: d.role ?? "unspecified",
          shortBio: d.shortBio ?? "",
          aliases: [
            ...new Set([
              ...(d.aliases ?? []),
              ...suggestNameAliases(d.name),
            ]),
          ],
          tags: ["from-story", "clarence"],
        });
        created.push(next);
        rosterSnapshot.push(next);
      }
      if (created.length) upsertCharacters(created);

      // Collapse Lily / Lily Chen style duplicates left from earlier reads.
      const { kept, removedIds } = collapseDuplicateCharacters(rosterSnapshot);
      if (removedIds.length) {
        const removed = new Set(removedIds);
        const mergedSurvivors = kept.filter((k) => {
          const prev = rosterSnapshot.find((r) => r.id === k.id);
          if (!prev) return true;
          return (
            prev.name !== k.name ||
            (prev.aliases?.length ?? 0) !== (k.aliases?.length ?? 0) ||
            prev.shortBio !== k.shortBio ||
            prev.wiki !== k.wiki ||
            prev.role !== k.role
          );
        });
        if (mergedSurvivors.length) upsertCharacters(mergedSurvivors);
        for (const id of removed) deleteCharacter(id);
        rosterSnapshot = kept;
      }

      // Fill full wiki sheets (not just the cast-list tagline).
      const indexedNames = new Set(
        (index.characters ?? []).map((d) => d.name.trim().toLowerCase()),
      );
      const toFill = rosterSnapshot.filter((c) => {
        if (!isThinCharacterSheet(c)) return false;
        if (created.some((n) => n.id === c.id)) return true;
        return indexedNames.has(c.name.trim().toLowerCase());
      });

      // Backfill given/family-name aliases on thin cards so appearances expand.
      rosterSnapshot = rosterSnapshot.map((c) => {
        const suggested = suggestNameAliases(c.name);
        if (!suggested.length) return c;
        const have = new Set(
          (c.aliases ?? []).map((a) => a.trim().toLowerCase()),
        );
        const add = suggested.filter((s) => !have.has(s.toLowerCase()));
        if (!add.length) return c;
        return { ...c, aliases: [...(c.aliases ?? []), ...add] };
      });
      const aliasTouched = rosterSnapshot.filter((c, i) => {
        const prev = (book.characters ?? []).find((x) => x.id === c.id);
        if (!prev) return created.some((n) => n.id === c.id);
        return (c.aliases?.length ?? 0) !== (prev.aliases?.length ?? 0);
      });
      if (aliasTouched.length) upsertCharacters(aliasTouched);

      const batch = toFill.slice(0, MAX_SHEETS_PER_POPULATE);
      let filled = 0;
      let failed = 0;

      for (let i = 0; i < batch.length; i++) {
        const target = batch[i]!;
        setCastMessage(
          `Filling ${target.name} · sheet ${i + 1} of ${batch.length}…`,
        );
        try {
          const bookForEnrich = {
            ...workingBook,
            characters: rosterSnapshot,
          };
          const enrichment = await enrichCharacterWithClaude(
            bookForEnrich,
            target.id,
          );
          const latest =
            rosterSnapshot.find((c) => c.id === target.id) ?? target;
          const merged = applyCharacterEnrichment(
            latest,
            enrichment as CharacterEnrichmentPayload,
            rosterSnapshot,
            "fill-empty",
          );
          rosterSnapshot = rosterSnapshot.map((c) =>
            c.id === merged.id ? merged : c,
          );
          upsertCharacters([merged]);
          filled += 1;
        } catch {
          failed += 1;
        }
      }

      const leftover = toFill.length - batch.length;
      const parts: string[] = [];
      if (created.length) parts.push(`Added ${created.length}`);
      if (filled) parts.push(`filled ${filled} sheet${filled === 1 ? "" : "s"}`);
      if (failed) parts.push(`${failed} couldn’t be filled`);
      if (leftover > 0) {
        parts.push(
          `${leftover} stub${leftover === 1 ? "" : "s"} left — open a card and Ask Clarence`,
        );
      }
      setCastMessage(
        parts.length
          ? `${parts.join(" · ")}.`
          : "Cast is up to date — nothing thin left to fill.",
      );
      window.setTimeout(() => setCastMessage(null), 7000);
    } finally {
      indexApi.setPhase("idle");
    }
  }

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-1 w-16 overflow-hidden rounded-full bg-[rgba(176,141,87,0.2)]">
          <div className="folio-loading-bar h-full w-1/2 rounded-full bg-[var(--accent)]" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mx-auto px-5 pb-24 pt-10 sm:px-8 lg:px-10",
        view === "tree" ? "max-w-5xl" : "max-w-3xl",
      )}
    >
      <header className="mb-8">
        <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.28em] text-[var(--ink-faint)]">
          Dramatis personae
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-medium tracking-tight text-[var(--ink)] sm:text-5xl">
          Characters
        </h1>
        <p className="mt-4 max-w-xl font-[family-name:var(--font-ui)] text-base leading-relaxed text-[var(--ink-muted)]">
          {view === "roster"
            ? "Cast pages grow from the manuscript. Populate adds people and fills empty wiki fields from the prose — voice, wants, appearance — without overwriting what you’ve written by hand."
            : "Chart family lines and partnerships. Make as many trees as you need — houses, clans, or bloodlines."}
        </p>

        <div
          className="mt-6 inline-flex rounded-full border border-[rgba(45,42,38,0.1)] bg-[rgba(247,243,234,0.65)] p-1"
          role="group"
          aria-label="Cast view"
        >
          {(
            [
              { id: "roster", label: "Roster" },
              { id: "tree", label: "Tree" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setView(opt.id)}
              aria-pressed={view === opt.id}
              className={cn(
                "rounded-full px-4 py-1.5 font-[family-name:var(--font-ui)] text-sm transition-colors",
                view === opt.id
                  ? "bg-[rgba(45,42,38,0.1)] text-[var(--ink)]"
                  : "text-[var(--ink-muted)] hover:text-[var(--ink)]",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {view === "roster" ? (
          <div className="mt-6 flex flex-col gap-2">
            <ManuscriptIndexControls
              api={indexApi}
              onPopulate={runPopulateCast}
              populateLabel={CLARENCE.populateLabel}
              populateTitle="Add cast from the manuscript reading and fill empty wiki sheets"
            />
            {castMessage ? (
              <span className="font-[family-name:var(--font-ui)] text-xs text-[var(--ink-muted)]">
                {castMessage}
              </span>
            ) : null}
          </div>
        ) : null}
      </header>

      {view === "roster" ? <SeriesBibleStrip kind="characters" /> : null}

      {view === "tree" ? (
        <FamilyTreesView />
      ) : (
        <>
      <div className="sticky top-0 z-20 -mx-1 mb-8 bg-[linear-gradient(180deg,#EDE8E0_70%,transparent)] pb-4 pt-1">
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[rgba(45,42,38,0.06)] bg-[rgba(247,243,234,0.72)] px-3 py-2.5 shadow-[0_8px_32px_rgba(45,42,38,0.06)] backdrop-blur-2xl sm:gap-3 sm:px-4">
          <label className="relative flex min-w-[10rem] max-w-xs flex-1 items-center">
            <Search
              className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-[var(--ink-faint)]"
              strokeWidth={1.5}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cast…"
              className="h-9 w-full rounded-full border border-transparent bg-[rgba(45,42,38,0.04)] pl-9 pr-9 font-[family-name:var(--font-ui)] text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] transition-colors focus:border-[var(--border)] focus:bg-[rgba(247,243,234,0.9)] focus:outline-none"
            />
            {search ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearch("")}
                className="absolute right-2 rounded-full p-1 text-[var(--ink-faint)] hover:text-[var(--ink)]"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            ) : null}
          </label>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            aria-label="Sort cast"
            className="h-9 rounded-full border border-transparent bg-[rgba(45,42,38,0.04)] px-3 font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)] focus:outline-none"
          >
            <option value="story">Story order</option>
            <option value="name">Name</option>
            <option value="depth">Depth</option>
            <option value="role">Role</option>
          </select>

          <select
            value={roleFilter}
            onChange={(e) =>
              setRoleFilter(e.target.value as CharacterRole | "all")
            }
            aria-label="Filter by role"
            className="h-9 rounded-full border border-transparent bg-[rgba(45,42,38,0.04)] px-3 font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)] focus:outline-none"
          >
            <option value="all">All roles</option>
            {(Object.keys(CHARACTER_ROLE_META) as CharacterRole[]).map(
              (role) => (
                <option key={role} value={role}>
                  {CHARACTER_ROLE_META[role].label}
                </option>
              ),
            )}
          </select>

          <Button
            size="sm"
            className="ml-auto gap-1.5 rounded-full"
            onClick={() => createAndOpen()}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            New
          </Button>
        </div>
      </div>

      {roster.length === 0 ? (
        <EmptyCast onCreate={() => createAndOpen()} hasSearch={Boolean(search)} />
      ) : (
        <ul className="divide-y divide-[rgba(45,42,38,0.08)] border-t border-[rgba(45,42,38,0.08)]">
          {roster.map(
            ({ character, appearances, presentCount, completeness, depth }, i) => (
            <RosterRow
              key={character.id}
              character={character}
              appearanceCount={presentCount}
              mentionCount={
                appearances.filter((a) => a.presence === "mentioned").length
              }
              completeness={completeness}
              depth={depth}
              index={i}
            />
          ),
          )}
        </ul>
      )}
        </>
      )}

      <ClarencePopulateAskDialog
        open={askOpen}
        probe={askProbe}
        onOpenChange={(open) => {
          setAskOpen(open);
          if (!open) {
            // Cancel / dismiss only — confirm clears the resolver first.
            const resolve = askResolver.current;
            askResolver.current = null;
            resolve?.(null);
          }
        }}
        onConfirm={(answers) => {
          const resolve = askResolver.current;
          askResolver.current = null;
          setAskOpen(false);
          resolve?.(answers);
        }}
      />
    </div>
  );
}

const ROLE_ORDER: Record<CharacterRole, number> = {
  protagonist: 0,
  deuteragonist: 1,
  antagonist: 2,
  supporting: 3,
  minor: 4,
  unspecified: 5,
};

function RosterRow({
  character,
  appearanceCount,
  mentionCount = 0,
  completeness,
  depth,
  index,
}: {
  character: Character;
  appearanceCount: number;
  mentionCount?: number;
  completeness: number;
  depth: ReturnType<typeof characterDepth>;
  index: number;
}) {
  const color = povColor(character.name);

  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: Math.min(index * 0.04, 0.35),
        ease: [0.25, 0.1, 0.25, 1],
      }}
    >
      <Link
        href={`/characters/${character.id}`}
        className="group flex gap-4 py-6 transition-colors sm:gap-6"
      >
        <span
          className="mt-2 h-10 w-[3px] shrink-0 rounded-full"
          style={{ background: color }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)] transition-colors group-hover:text-[color-mix(in_srgb,var(--accent)_65%,var(--ink))]">
              {character.name}
            </h2>
            {character.role !== "unspecified" ? (
              <span className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
                {CHARACTER_ROLE_META[character.role].label}
              </span>
            ) : null}
          </div>
          <p
            className={cn(
              "mt-1.5 font-[family-name:var(--font-ui)] text-sm leading-relaxed",
              character.shortBio
                ? "text-[var(--ink-muted)]"
                : "italic text-[var(--ink-faint)]",
            )}
          >
            {character.shortBio || "No blurb yet — open the wiki to begin."}
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-6">
            <DepthMeter
              depth={depth}
              completeness={completeness}
              compact
              className="w-40"
            />
            <span className="font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)]">
              {appearanceCount === 0
                ? mentionCount > 0
                  ? `Mentioned only · ${mentionCount}`
                  : "Not yet on the page"
                : appearanceCount === 1
                  ? "Present in 1 scene"
                  : `Present in ${appearanceCount} scenes`}
            </span>
          </div>
        </div>
      </Link>
    </motion.li>
  );
}

function EmptyCast({
  onCreate,
  hasSearch,
}: {
  onCreate: () => void;
  hasSearch: boolean;
}) {
  return (
    <div className="border-t border-[rgba(45,42,38,0.08)] py-16 text-center">
      <p className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
        {hasSearch ? "No one matches" : "An empty cast"}
      </p>
      <p className="mx-auto mt-3 max-w-sm font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
        {hasSearch
          ? "Try another search, or add a new character."
          : "Add someone the moment they walk onstage — or deepen the cast from the manuscript with Clarence."}
      </p>
      {!hasSearch ? (
        <Button className="mt-8 gap-1.5 rounded-full" onClick={onCreate}>
          <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
          First character
        </Button>
      ) : null}
    </div>
  );
}
