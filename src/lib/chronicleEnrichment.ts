/**
 * Pull world-history chronicle events from the manuscript (lore, not plot beats).
 */

import type { Book, Chapter, Character, ChronicleEvent, EncyclopediaEntry, Location } from "./types";
import { createChronicleEvent, nextChronicleOrder, sortChronicleEvents } from "./chronicle";
import { chapterToPlainText } from "./developmentalEditor";
import {
  MANUSCRIPT_CONTEXT_BUDGET,
  packBalancedExcerpts,
} from "./manuscriptContext";
import { namesMatch } from "./research";

export type DiscoveredChronicleEvent = {
  title: string;
  whenLabel?: string;
  summary?: string;
  /** Relative order — lower = earlier in world history. */
  order?: number;
  linkedCharacterNames?: string[];
  linkedLocationNames?: string[];
  linkedEntryTitles?: string[];
};

export type ChronicleDiscoverPayload = {
  events: DiscoveredChronicleEvent[];
};

export const CHRONICLE_DISCOVER_TOOL_NAME = "save_chronicle_events";

export const discoverChronicleTool = {
  name: CHRONICLE_DISCOVER_TOOL_NAME,
  description:
    "Propose world-history chronicle events grounded in the manuscript and bible — lore ages, wars, founding moments — not plot beats from the novel’s present.",
  input_schema: {
    type: "object" as const,
    properties: {
      events: {
        type: "array",
        description:
          "4–14 distinct world-history events in roughly chronological order. Prefer fewer sharp events over vague filler.",
        items: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Short event name — e.g. The Sundering, Founding of Veyra.",
            },
            whenLabel: {
              type: "string",
              description:
                "Freeform when — e.g. Age of Embers, 40 years before the novel, Third Century.",
            },
            summary: {
              type: "string",
              description: "2–4 sentences of what happened and why it still matters.",
            },
            order: {
              type: "number",
              description: "Chronological sort key (lower = earlier).",
            },
            linkedCharacterNames: {
              type: "array",
              items: { type: "string" },
              description: "Exact cast names from the bible when relevant.",
            },
            linkedLocationNames: {
              type: "array",
              items: { type: "string" },
              description: "Exact place names from the bible when relevant.",
            },
            linkedEntryTitles: {
              type: "array",
              items: { type: "string" },
              description: "Exact encyclopedia titles when relevant.",
            },
          },
          required: ["title", "summary"],
        },
      },
    },
    required: ["events"],
  },
};

function resolveCharacterIds(
  names: string[] | undefined,
  cast: Character[],
): string[] {
  if (!names?.length) return [];
  const ids: string[] = [];
  for (const name of names) {
    const hit = cast.find(
      (c) =>
        namesMatch(c.name, name) ||
        (c.aliases ?? []).some((a) => namesMatch(a, name)),
    );
    if (hit && !ids.includes(hit.id)) ids.push(hit.id);
  }
  return ids;
}

function resolveLocationIds(
  names: string[] | undefined,
  places: Location[],
): string[] {
  if (!names?.length) return [];
  const ids: string[] = [];
  for (const name of names) {
    const hit = places.find(
      (l) =>
        namesMatch(l.name, name) ||
        (l.aliases ?? []).some((a) => namesMatch(a, name)),
    );
    if (hit && !ids.includes(hit.id)) ids.push(hit.id);
  }
  return ids;
}

function resolveEntryIds(
  titles: string[] | undefined,
  entries: EncyclopediaEntry[],
): string[] {
  if (!titles?.length) return [];
  const ids: string[] = [];
  for (const title of titles) {
    const hit = entries.find(
      (e) =>
        namesMatch(e.title, title) ||
        (e.aliases ?? []).some((a) => namesMatch(a, title)),
    );
    if (hit && !ids.includes(hit.id)) ids.push(hit.id);
  }
  return ids;
}

export function chaptersHaveChronicleProse(chapters: Chapter[]): boolean {
  let budget = 0;
  for (const ch of chapters) {
    const plain = chapterToPlainText(ch.content ?? "");
    budget += plain.length;
    budget += (ch.summary ?? "").length;
    if (budget > 400) return true;
  }
  return false;
}

export function buildChronicleDiscoveryContext(
  book: Pick<
    Book,
    | "title"
    | "chapters"
    | "chronicle"
    | "characters"
    | "locations"
    | "encyclopedia"
  >,
): string {
  const existing =
    (book.chronicle ?? [])
      .map((e) => `- ${e.title}${e.whenLabel ? ` (${e.whenLabel})` : ""}`)
      .join("\n") || "(none yet)";

  const cast = (book.characters ?? [])
    .slice(0, 40)
    .map((c) => c.name)
    .join(", ");
  const places = (book.locations ?? [])
    .slice(0, 40)
    .map((l) => l.name)
    .join(", ");
  const encyclopedia = (book.encyclopedia ?? [])
    .slice(0, 40)
    .map((e) => e.title)
    .join(", ");

  const byChapter: string[][] = (book.chapters ?? []).map((ch, i) => {
    const plain = chapterToPlainText(ch.content ?? "");
    const summary = (ch.summary ?? "").trim();
    const chunks: string[] = [
      `### Ch ${i + 1} “${ch.title}”`,
    ];
    if (summary) chunks.push(`Summary: ${summary}`);
    if (plain.trim()) chunks.push(plain.trim());
    return chunks;
  });

  const preamble = [
    `Manuscript: ${book.title || "Untitled"}`,
    "",
    "TASK: Extract WORLD HISTORY / LORE chronicle events implied or stated in the text and bible.",
    "This is NOT the novel’s plot timeline — avoid scene-by-scene plot beats unless they are framed as past lore.",
    "Prefer founding wars, ages, cataclysms, dynasties, myths that characters treat as history.",
    "Do not invent events with no textual or bible support. Do not rewrite manuscript prose.",
    "",
    `Existing chronicle (do not duplicate titles):\n${existing}`,
    cast ? `Cast names (link when relevant): ${cast}` : "",
    places ? `Place names: ${places}` : "",
    encyclopedia ? `Encyclopedia titles: ${encyclopedia}` : "",
    "",
    "MANUSCRIPT:",
    "",
  ]
    .filter(Boolean)
    .join("\n");

  return packBalancedExcerpts(
    byChapter,
    MANUSCRIPT_CONTEXT_BUDGET,
    preamble,
  );
}

export function applyChronicleDiscovery(
  existing: ChronicleEvent[],
  payload: ChronicleDiscoverPayload,
  book: Pick<Book, "characters" | "locations" | "encyclopedia">,
): ChronicleEvent[] {
  const raw = (payload.events ?? [])
    .filter((e) => e?.title?.trim())
    .slice(0, 16);

  if (raw.length === 0) return existing;

  const byTitle = new Map(
    existing.map((e) => [e.title.trim().toLowerCase(), e] as const),
  );

  let next = [...existing];
  let orderBase = nextChronicleOrder(next);

  const sortedIncoming = [...raw].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );

  for (const d of sortedIncoming) {
    const title = d.title.trim();
    const key = title.toLowerCase();
    const linkedCharacterIds = resolveCharacterIds(
      d.linkedCharacterNames,
      book.characters ?? [],
    );
    const linkedLocationIds = resolveLocationIds(
      d.linkedLocationNames,
      book.locations ?? [],
    );
    const linkedEntryIds = resolveEntryIds(
      d.linkedEntryTitles,
      book.encyclopedia ?? [],
    );

    const prev = byTitle.get(key);
    if (prev) {
      next = next.map((e) => {
        if (e.id !== prev.id) return e;
        return {
          ...e,
          whenLabel: d.whenLabel?.trim() || e.whenLabel,
          summary:
            d.summary?.trim() && d.summary.trim().length > e.summary.trim().length
              ? d.summary.trim().slice(0, 2000)
              : e.summary || (d.summary ?? "").trim().slice(0, 2000),
          linkedCharacterIds:
            linkedCharacterIds.length > 0
              ? linkedCharacterIds
              : e.linkedCharacterIds,
          linkedLocationIds:
            linkedLocationIds.length > 0
              ? linkedLocationIds
              : e.linkedLocationIds,
          linkedEntryIds:
            linkedEntryIds.length > 0 ? linkedEntryIds : e.linkedEntryIds,
          updatedAt: Date.now(),
        };
      });
      continue;
    }

    const event = createChronicleEvent({
      title,
      whenLabel: (d.whenLabel ?? "").trim(),
      summary: (d.summary ?? "").trim().slice(0, 2000),
      order: typeof d.order === "number" ? d.order : orderBase++,
      linkedCharacterIds,
      linkedLocationIds,
      linkedEntryIds,
    });
    byTitle.set(key, event);
    next.push(event);
  }

  return sortChronicleEvents(next);
}
