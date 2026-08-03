"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Plus, Search, X } from "lucide-react";
import { ClaudeDeepenButton } from "@/components/Characters/ClaudeDeepenButton";
import { DepthMeter } from "@/components/Characters/DepthMeter";
import { SeriesBibleStrip } from "@/components/Series/SeriesBibleStrip";
import { Button } from "@/components/ui/button";
import { useBook } from "@/providers/BookProvider";
import {
  characterAppearances,
  characterCompleteness,
  characterDepth,
  createCharacter,
  findCharacterByName,
} from "@/lib/characters";
import {
  discoverCastWithClaude,
  enrichCharacterWithClaude,
  mergeEnrichmentIntoCharacter,
  useClaudeStatus,
} from "@/hooks/useClaudeEnrichment";
import {
  CHARACTER_ROLE_META,
  povColor,
  type Character,
  type CharacterRole,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type SortMode = "story" | "name" | "depth" | "role";

const DEPTH_RANK = { stub: 0, sketch: 1, portrait: 2, living: 3 } as const;

export function CharactersPage() {
  const router = useRouter();
  const { book, hydrated, addCharacter, upsertCharacters, replaceCharacter } =
    useBook();
  const claude = useClaudeStatus();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("story");
  const [roleFilter, setRoleFilter] = useState<CharacterRole | "all">("all");
  const [castBusy, setCastBusy] = useState(false);
  const [castMessage, setCastMessage] = useState<string | null>(null);
  const [castError, setCastError] = useState<string | null>(null);

  const characters = book.characters ?? [];

  const roster = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = characters.map((c) => {
      const appearances = characterAppearances(book.chapters, c);
      const completeness = characterCompleteness(c);
      const depth = characterDepth(c, appearances.length);
      const firstIndex =
        appearances[0] != null
          ? appearances[0].chapterIndex * 1000 + appearances[0].sceneIndex
          : Number.MAX_SAFE_INTEGER;
      return { character: c, appearances, completeness, depth, firstIndex };
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

  const runDeepenCast = useCallback(async () => {
    setCastBusy(true);
    setCastError(null);
    setCastMessage("Scanning manuscript for cast…");

    try {
      const discovered = await discoverCastWithClaude(book);
      let rosterSnapshot = [...(book.characters ?? [])];
      const created: Character[] = [];

      for (const d of discovered) {
        if (findCharacterByName(rosterSnapshot, d.name)) continue;
        const next = createCharacter({
          name: d.name,
          role: d.role ?? "unspecified",
          shortBio: d.shortBio ?? "",
          tags: ["from-story", "claude"],
        });
        created.push(next);
        rosterSnapshot.push(next);
      }

      if (created.length) {
        upsertCharacters(created);
        setCastMessage(
          `Added ${created.length}. Deepening ${rosterSnapshot.length}…`,
        );
      } else {
        setCastMessage(`Deepening ${rosterSnapshot.length}…`);
      }

      let enriched = 0;
      for (let i = 0; i < rosterSnapshot.length; i++) {
        const target = rosterSnapshot[i];
        setCastMessage(`Deepening ${i + 1} of ${rosterSnapshot.length}…`);
        try {
          const enrichment = await enrichCharacterWithClaude(
            { ...book, characters: rosterSnapshot },
            target.id,
          );
          const merged = mergeEnrichmentIntoCharacter(
            target,
            enrichment,
            rosterSnapshot,
          );
          replaceCharacter(merged);
          rosterSnapshot = rosterSnapshot.map((c) =>
            c.id === merged.id ? merged : c,
          );
          enriched += 1;
        } catch {
          // keep going through the cast
        }
      }

      setCastMessage(
        `Done — ${enriched} deepened${created.length ? `, ${created.length} added` : ""}.`,
      );
    } catch (e) {
      setCastError(e instanceof Error ? e.message : "Cast deepen failed.");
      setCastMessage(null);
    } finally {
      setCastBusy(false);
    }
  }, [book, upsertCharacters, replaceCharacter]);

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
    <div className="mx-auto max-w-3xl px-5 pb-24 pt-10 sm:px-8 lg:px-10">
      <header className="mb-10">
        <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.28em] text-[var(--ink-faint)]">
          Dramatis personae
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-medium tracking-tight text-[var(--ink)] sm:text-5xl">
          Characters
        </h1>
        <p className="mt-4 max-w-xl font-[family-name:var(--font-ui)] text-base leading-relaxed text-[var(--ink-muted)]">
          Cast pages grow from the manuscript. Use Claude to read the prose and
          fill empty wiki fields — voice, wants, appearance — without overwriting
          what you&apos;ve written by hand.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <ClaudeDeepenButton
            configured={claude?.configured ?? null}
            busy={castBusy}
            label="Deepen cast with Claude"
            onClick={() => void runDeepenCast()}
          />
          {castMessage ? (
            <span className="font-[family-name:var(--font-ui)] text-xs text-[var(--ink-muted)]">
              {castMessage}
            </span>
          ) : null}
          {castError ? (
            <span className="font-[family-name:var(--font-ui)] text-xs text-[#6B3A2A]">
              {castError}
            </span>
          ) : null}
          {claude?.configured === false ? (
            <span className="font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)]">
              Set ANTHROPIC_API_KEY in .env.local (see env.example)
            </span>
          ) : null}
        </div>
      </header>

      <SeriesBibleStrip kind="characters" />

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
          {roster.map(({ character, appearances, completeness, depth }, i) => (
            <RosterRow
              key={character.id}
              character={character}
              appearanceCount={appearances.length}
              completeness={completeness}
              depth={depth}
              index={i}
            />
          ))}
        </ul>
      )}
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
  completeness,
  depth,
  index,
}: {
  character: Character;
  appearanceCount: number;
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
                ? "Not yet on the page"
                : appearanceCount === 1
                  ? "1 scene"
                  : `${appearanceCount} scenes`}
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
          : "Add someone the moment they walk onstage — or deepen the cast from the manuscript with Claude."}
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
