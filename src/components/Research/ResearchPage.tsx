"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Plus, Search, X } from "lucide-react";
import {
  ManuscriptIndexControls,
  useManuscriptIndex,
} from "@/components/Manuscript/ManuscriptIndexControls";
import { DepthMeter } from "@/components/Characters/DepthMeter";
import { Button } from "@/components/ui/button";
import { useBook } from "@/providers/BookProvider";
import {
  createResearchEntry,
  findResearchByTitle,
  researchAppearances,
  researchCompleteness,
  researchDepth,
} from "@/lib/research";
import {
  RESEARCH_KIND_META,
  povColor,
  type ResearchEntry,
  type ResearchKind,
} from "@/lib/types";
import { CLARENCE } from "@/lib/clarence";
import { cn } from "@/lib/utils";

type SortMode = "story" | "title" | "depth" | "kind";

const DEPTH_RANK = { stub: 0, sketch: 1, portrait: 2, living: 3 } as const;

const KIND_ORDER: Record<ResearchKind, number> = {
  source: 0,
  period: 1,
  craft: 2,
  theme: 3,
  motif: 4,
  question: 5,
  unspecified: 6,
};

export function ResearchPage() {
  const router = useRouter();
  const { book, hydrated, addResearch, upsertResearch } = useBook();
  const indexApi = useManuscriptIndex();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("story");
  const [kindFilter, setKindFilter] = useState<ResearchKind | "all">("all");
  const [dossierMessage, setDossierMessage] = useState<string | null>(null);

  const entries = book.research ?? [];

  const roster = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = entries.map((e) => {
      const appearances = researchAppearances(book.chapters, e);
      const completeness = researchCompleteness(e);
      const depth = researchDepth(e, appearances.length);
      const firstIndex =
        appearances[0] != null
          ? appearances[0].chapterIndex * 1000 + appearances[0].sceneIndex
          : Number.MAX_SAFE_INTEGER;
      return { entry: e, appearances, completeness, depth, firstIndex };
    });

    if (kindFilter !== "all") {
      list = list.filter((r) => r.entry.kind === kindFilter);
    }
    if (q) {
      list = list.filter(({ entry: e }) => {
        const hay = [
          e.title,
          e.shortBio,
          e.wiki,
          e.summary,
          ...e.aliases,
          ...e.tags,
          RESEARCH_KIND_META[e.kind].label,
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }

    list.sort((a, b) => {
      if (sort === "title") {
        return a.entry.title.localeCompare(b.entry.title);
      }
      if (sort === "depth") {
        return DEPTH_RANK[b.depth] - DEPTH_RANK[a.depth];
      }
      if (sort === "kind") {
        return (
          KIND_ORDER[a.entry.kind] - KIND_ORDER[b.entry.kind] ||
          a.entry.title.localeCompare(b.entry.title)
        );
      }
      return (
        a.firstIndex - b.firstIndex ||
        a.entry.title.localeCompare(b.entry.title)
      );
    });

    return list;
  }, [entries, book.chapters, search, sort, kindFilter]);

  function createAndOpen(title?: string) {
    const id = addResearch(title ? { title } : undefined);
    router.push(`/research/${id}`);
  }

  async function runPopulateResearch() {
    indexApi.setError(null);
    setDossierMessage(null);
    const index = await indexApi.ensureIndex();
    indexApi.setPhase("applying");
    try {
      let rosterSnapshot = [...(book.research ?? [])];
      const created: ResearchEntry[] = [];
      for (const d of index.research ?? []) {
        if (findResearchByTitle(rosterSnapshot, d.title)) continue;
        const next = createResearchEntry({
          title: d.title,
          kind: d.kind ?? "unspecified",
          shortBio: d.shortBio ?? "",
          tags: ["from-story", "clarence"],
        });
        created.push(next);
        rosterSnapshot.push(next);
      }
      if (created.length) upsertResearch(created);
      setDossierMessage(
        created.length
          ? `Added ${created.length} from the manuscript reading. Open a card to deepen.`
          : "No new research entries — reading is up to date. Open a card to deepen.",
      );
      window.setTimeout(() => setDossierMessage(null), 5000);
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
    <div className="mx-auto max-w-3xl px-5 pb-24 pt-10 sm:px-8 lg:px-10">
      <header className="mb-10">
        <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.28em] text-[var(--ink-faint)]">
          Outside sources
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-medium tracking-tight text-[var(--ink)] sm:text-5xl">
          Research
        </h1>
        <p className="mt-4 max-w-xl font-[family-name:var(--font-ui)] text-base leading-relaxed text-[var(--ink-muted)]">
          Outside sources and reference — articles, period facts, craft notes,
          and open questions. Story-world canon lives in Encyclopedia. Clarence
          fills empty fields without overwriting what you&apos;ve written by
          hand.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <ManuscriptIndexControls
            api={indexApi}
            onPopulate={runPopulateResearch}
            populateLabel={CLARENCE.populateLabel}
            populateTitle="Add research entries from the manuscript reading"
          />
          {dossierMessage ? (
            <span className="font-[family-name:var(--font-ui)] text-xs text-[var(--ink-muted)]">
              {dossierMessage}
            </span>
          ) : null}
        </div>
      </header>

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
              placeholder="Search research…"
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
            aria-label="Sort research"
            className="h-9 rounded-full border border-transparent bg-[rgba(45,42,38,0.04)] px-3 font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)] focus:outline-none"
          >
            <option value="story">Story order</option>
            <option value="title">Title</option>
            <option value="depth">Depth</option>
            <option value="kind">Kind</option>
          </select>

          <select
            value={kindFilter}
            onChange={(e) =>
              setKindFilter(e.target.value as ResearchKind | "all")
            }
            aria-label="Filter by kind"
            className="h-9 rounded-full border border-transparent bg-[rgba(45,42,38,0.04)] px-3 font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)] focus:outline-none"
          >
            <option value="all">All kinds</option>
            {(Object.keys(RESEARCH_KIND_META) as ResearchKind[]).map((kind) => (
              <option key={kind} value={kind}>
                {RESEARCH_KIND_META[kind].label}
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
        <EmptyCommonplace
          onCreate={() => createAndOpen()}
          hasSearch={Boolean(search)}
        />
      ) : (
        <ul className="divide-y divide-[rgba(45,42,38,0.08)] border-t border-[rgba(45,42,38,0.08)]">
          {roster.map(({ entry, appearances, completeness, depth }, i) => (
            <RosterRow
              key={entry.id}
              entry={entry}
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
  entry,
  appearanceCount,
  completeness,
  depth,
  index,
}: {
  entry: ResearchEntry;
  appearanceCount: number;
  completeness: number;
  depth: ReturnType<typeof researchDepth>;
  index: number;
}) {
  const color = povColor(entry.title);

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
        href={`/research/${entry.id}`}
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
              {entry.title}
            </h2>
            {entry.kind !== "unspecified" ? (
              <span className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
                {RESEARCH_KIND_META[entry.kind].label}
              </span>
            ) : null}
          </div>
          <p
            className={cn(
              "mt-1.5 font-[family-name:var(--font-ui)] text-sm leading-relaxed",
              entry.shortBio
                ? "text-[var(--ink-muted)]"
                : "italic text-[var(--ink-faint)]",
            )}
          >
            {entry.shortBio || "No blurb yet — open the entry to begin."}
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-6">
            <DepthMeter
              depth={depth}
              completeness={completeness}
              compact
              variant="research"
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

function EmptyCommonplace({
  onCreate,
  hasSearch,
}: {
  onCreate: () => void;
  hasSearch: boolean;
}) {
  return (
    <div className="border-t border-[rgba(45,42,38,0.08)] py-16 text-center">
      <p className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
        {hasSearch ? "No entry matches" : "An empty commonplace"}
      </p>
      <p className="mx-auto mt-3 max-w-sm font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
        {hasSearch
          ? "Try another search, or add a new entry."
          : "Add a theme the moment it surfaces — or deepen the commonplace from the manuscript with Clarence."}
      </p>
      {!hasSearch ? (
        <Button className="mt-8 gap-1.5 rounded-full" onClick={onCreate}>
          <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
          First entry
        </Button>
      ) : null}
    </div>
  );
}
