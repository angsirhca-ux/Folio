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
  createLocation,
  findLocationByName,
  locationAppearances,
  locationCompleteness,
  locationDepth,
} from "@/lib/locations";
import {
  discoverLocationsWithClaude,
  enrichLocationWithClaude,
  mergeEnrichmentIntoLocation,
  useClaudeStatus,
} from "@/hooks/useClaudeEnrichment";
import {
  LOCATION_KIND_META,
  povColor,
  type Location,
  type LocationKind,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type SortMode = "story" | "name" | "depth" | "kind";

const DEPTH_RANK = { stub: 0, sketch: 1, portrait: 2, living: 3 } as const;

const KIND_ORDER: Record<LocationKind, number> = {
  interior: 0,
  exterior: 1,
  settlement: 2,
  landmark: 3,
  threshold: 4,
  region: 5,
  unspecified: 6,
};

export function LocationsPage() {
  const router = useRouter();
  const { book, hydrated, addLocation, upsertLocations, replaceLocation } =
    useBook();
  const claude = useClaudeStatus();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("story");
  const [kindFilter, setKindFilter] = useState<LocationKind | "all">("all");
  const [atlasBusy, setAtlasBusy] = useState(false);
  const [atlasMessage, setAtlasMessage] = useState<string | null>(null);
  const [atlasError, setAtlasError] = useState<string | null>(null);

  const locations = book.locations ?? [];

  const roster = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = locations.map((l) => {
      const appearances = locationAppearances(book.chapters, l);
      const completeness = locationCompleteness(l);
      const depth = locationDepth(l, appearances.length);
      const firstIndex =
        appearances[0] != null
          ? appearances[0].chapterIndex * 1000 + appearances[0].sceneIndex
          : Number.MAX_SAFE_INTEGER;
      return { location: l, appearances, completeness, depth, firstIndex };
    });

    if (kindFilter !== "all") {
      list = list.filter((r) => r.location.kind === kindFilter);
    }
    if (q) {
      list = list.filter(({ location: l }) => {
        const hay = [
          l.name,
          l.shortBio,
          l.wiki,
          ...l.aliases,
          ...l.tags,
          LOCATION_KIND_META[l.kind].label,
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }

    list.sort((a, b) => {
      if (sort === "name") {
        return a.location.name.localeCompare(b.location.name);
      }
      if (sort === "depth") {
        return DEPTH_RANK[b.depth] - DEPTH_RANK[a.depth];
      }
      if (sort === "kind") {
        return (
          KIND_ORDER[a.location.kind] - KIND_ORDER[b.location.kind] ||
          a.location.name.localeCompare(b.location.name)
        );
      }
      return (
        a.firstIndex - b.firstIndex ||
        a.location.name.localeCompare(b.location.name)
      );
    });

    return list;
  }, [locations, book.chapters, search, sort, kindFilter]);

  function createAndOpen(name?: string) {
    const id = addLocation(name ? { name } : undefined);
    router.push(`/locations/${id}`);
  }

  const runDeepenAtlas = useCallback(async () => {
    setAtlasBusy(true);
    setAtlasError(null);
    setAtlasMessage("Scanning manuscript for places…");

    try {
      const discovered = await discoverLocationsWithClaude(book);
      let rosterSnapshot = [...(book.locations ?? [])];
      const created: Location[] = [];

      for (const d of discovered) {
        if (findLocationByName(rosterSnapshot, d.name)) continue;
        const next = createLocation({
          name: d.name,
          kind: d.kind ?? "unspecified",
          shortBio: d.shortBio ?? "",
          tags: ["from-story", "claude"],
        });
        created.push(next);
        rosterSnapshot.push(next);
      }

      if (created.length) {
        upsertLocations(created);
        setAtlasMessage(
          `Added ${created.length}. Deepening ${rosterSnapshot.length}…`,
        );
      } else {
        setAtlasMessage(`Deepening ${rosterSnapshot.length}…`);
      }

      let enriched = 0;
      for (let i = 0; i < rosterSnapshot.length; i++) {
        const target = rosterSnapshot[i];
        setAtlasMessage(`Deepening ${i + 1} of ${rosterSnapshot.length}…`);
        try {
          const enrichment = await enrichLocationWithClaude(
            { ...book, locations: rosterSnapshot },
            target.id,
          );
          const merged = mergeEnrichmentIntoLocation(
            target,
            enrichment,
            rosterSnapshot,
          );
          replaceLocation(merged);
          rosterSnapshot = rosterSnapshot.map((l) =>
            l.id === merged.id ? merged : l,
          );
          enriched += 1;
        } catch {
          // continue
        }
      }

      setAtlasMessage(
        `Done — ${enriched} deepened${created.length ? `, ${created.length} added` : ""}.`,
      );
    } catch (e) {
      setAtlasError(e instanceof Error ? e.message : "Atlas deepen failed.");
      setAtlasMessage(null);
    } finally {
      setAtlasBusy(false);
    }
  }, [book, upsertLocations, replaceLocation]);

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
          Story atlas
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-medium tracking-tight text-[var(--ink)] sm:text-5xl">
          Locations
        </h1>
        <p className="mt-4 max-w-xl font-[family-name:var(--font-ui)] text-base leading-relaxed text-[var(--ink-muted)]">
          Place pages grow from the manuscript. Use Claude to read the prose and
          fill empty wiki fields — atmosphere, access, story function — without
          overwriting what you&apos;ve written by hand.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <ClaudeDeepenButton
            configured={claude?.configured ?? null}
            busy={atlasBusy}
            label="Deepen atlas with Claude"
            onClick={() => void runDeepenAtlas()}
          />
          {atlasMessage ? (
            <span className="font-[family-name:var(--font-ui)] text-xs text-[var(--ink-muted)]">
              {atlasMessage}
            </span>
          ) : null}
          {atlasError ? (
            <span className="font-[family-name:var(--font-ui)] text-xs text-[#6B3A2A]">
              {atlasError}
            </span>
          ) : null}
          {claude?.configured === false ? (
            <span className="font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)]">
              Set ANTHROPIC_API_KEY in .env.local (see env.example)
            </span>
          ) : null}
        </div>
      </header>

      <SeriesBibleStrip kind="locations" />

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
              placeholder="Search places…"
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
            aria-label="Sort places"
            className="h-9 rounded-full border border-transparent bg-[rgba(45,42,38,0.04)] px-3 font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)] focus:outline-none"
          >
            <option value="story">Story order</option>
            <option value="name">Name</option>
            <option value="depth">Depth</option>
            <option value="kind">Kind</option>
          </select>

          <select
            value={kindFilter}
            onChange={(e) =>
              setKindFilter(e.target.value as LocationKind | "all")
            }
            aria-label="Filter by kind"
            className="h-9 rounded-full border border-transparent bg-[rgba(45,42,38,0.04)] px-3 font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)] focus:outline-none"
          >
            <option value="all">All kinds</option>
            {(Object.keys(LOCATION_KIND_META) as LocationKind[]).map((kind) => (
              <option key={kind} value={kind}>
                {LOCATION_KIND_META[kind].label}
              </option>
            ))}
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
        <EmptyAtlas
          onCreate={() => createAndOpen()}
          hasSearch={Boolean(search)}
        />
      ) : (
        <ul className="divide-y divide-[rgba(45,42,38,0.08)] border-t border-[rgba(45,42,38,0.08)]">
          {roster.map(({ location, appearances, completeness, depth }, i) => (
            <RosterRow
              key={location.id}
              location={location}
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

function RosterRow({
  location,
  appearanceCount,
  completeness,
  depth,
  index,
}: {
  location: Location;
  appearanceCount: number;
  completeness: number;
  depth: ReturnType<typeof locationDepth>;
  index: number;
}) {
  const color = povColor(location.name);

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
        href={`/locations/${location.id}`}
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
              {location.name}
            </h2>
            {location.kind !== "unspecified" ? (
              <span className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
                {LOCATION_KIND_META[location.kind].label}
              </span>
            ) : null}
          </div>
          <p
            className={cn(
              "mt-1.5 font-[family-name:var(--font-ui)] text-sm leading-relaxed",
              location.shortBio
                ? "text-[var(--ink-muted)]"
                : "italic text-[var(--ink-faint)]",
            )}
          >
            {location.shortBio || "No blurb yet — open the wiki to begin."}
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-6">
            <DepthMeter
              depth={depth}
              completeness={completeness}
              compact
              variant="location"
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

function EmptyAtlas({
  onCreate,
  hasSearch,
}: {
  onCreate: () => void;
  hasSearch: boolean;
}) {
  return (
    <div className="border-t border-[rgba(45,42,38,0.08)] py-16 text-center">
      <p className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
        {hasSearch ? "No place matches" : "An empty atlas"}
      </p>
      <p className="mx-auto mt-3 max-w-sm font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
        {hasSearch
          ? "Try another search, or add a new location."
          : "Add a place the moment the story arrives there — or deepen the atlas from the manuscript with Claude."}
      </p>
      {!hasSearch ? (
        <Button className="mt-8 gap-1.5 rounded-full" onClick={onCreate}>
          <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
          First location
        </Button>
      ) : null}
    </div>
  );
}
