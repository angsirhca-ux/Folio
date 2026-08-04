/**
 * Compose a novel soundtrack from the stored manuscript reading (index),
 * not a second full prose pass.
 */

import type { Book, Chapter, ManuscriptIndexData, SoundtrackSong } from "./types";
import {
  createSoundtrackSong,
  nextSoundtrackOrder,
  songKey,
  sortSoundtrackSongs,
} from "./soundtrack";

export type DiscoveredSoundtrackSong = {
  title: string;
  artist: string;
  note?: string;
  placement?: string;
  order?: number;
};

export type SoundtrackComposePayload = {
  songs: DiscoveredSoundtrackSong[];
};

export const SOUNDTRACK_COMPOSE_TOOL_NAME = "save_soundtrack";

export const composeSoundtrackTool = {
  name: SOUNDTRACK_COMPOSE_TOOL_NAME,
  description:
    "Propose a 15-song soundtrack that matches the novel’s mood, characters, and arc — real or well-known songs that fit the vibe.",
  input_schema: {
    type: "object" as const,
    properties: {
      songs: {
        type: "array",
        description: "Exactly 15 tracks in listening order (opening → close).",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            artist: { type: "string" },
            note: {
              type: "string",
              description:
                "One or two sentences — why this track belongs to this book.",
            },
            placement: {
              type: "string",
              description:
                "Where it sits — Opening, Rising action, Midpoint, Climax, Aftermath, Credits…",
            },
            order: {
              type: "number",
              description: "1–15 listening order.",
            },
          },
          required: ["title", "artist", "note"],
        },
      },
    },
    required: ["songs"],
  },
};

function chapterLedger(chapters: Chapter[]): string {
  return chapters
    .map((ch, i) => {
      const summary = (ch.summary ?? "").trim();
      const sceneBits = (ch.scenes ?? [])
        .slice(0, 6)
        .map((s) => {
          const syn = s.synopsis?.trim();
          return syn
            ? `  · ${s.title || `Scene`}: ${syn.slice(0, 120)}`
            : `  · ${s.title || `Scene`}`;
        })
        .join("\n");
      return [
        `Ch ${i + 1}: ${ch.title}`,
        summary ? `  Summary: ${summary.slice(0, 280)}` : "",
        sceneBits,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

function indexDigest(index: ManuscriptIndexData): string {
  return [
    index.characters.length
      ? `Cast: ${index.characters
          .slice(0, 24)
          .map((c) => `${c.name}${c.shortBio ? ` (${c.shortBio.slice(0, 60)})` : ""}`)
          .join("; ")}`
      : "",
    index.locations.length
      ? `Places: ${index.locations
          .slice(0, 20)
          .map((l) => l.name)
          .join(", ")}`
      : "",
    index.plotThreads.length
      ? `Plot threads: ${index.plotThreads
          .map((t) => `${t.name}${t.summary ? ` — ${t.summary}` : ""}`)
          .join("; ")}`
      : "",
    index.chronicle.length
      ? `World lore: ${index.chronicle
          .slice(0, 12)
          .map((e) => `${e.title}${e.summary ? `: ${e.summary.slice(0, 100)}` : ""}`)
          .join("; ")}`
      : "",
    index.encyclopedia.length
      ? `Canon seeds: ${index.encyclopedia
          .slice(0, 16)
          .map((e) => e.title)
          .join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildSoundtrackComposeContext(
  book: Pick<Book, "title" | "author" | "chapters" | "soundtrack">,
  index: ManuscriptIndexData,
): string {
  const existing =
    (book.soundtrack ?? [])
      .map(
        (s) =>
          `- ${s.title}${s.artist ? ` — ${s.artist}` : ""}${s.placement ? ` [${s.placement}]` : ""}`,
      )
      .join("\n") || "(none yet)";

  return [
    `Novel: ${book.title || "Untitled"}`,
    book.author ? `Author: ${book.author}` : "",
    "",
    "TASK: Compose a 15-song soundtrack for this novel.",
    "Use the manuscript READING below (cast, places, threads, lore) plus the chapter ledger.",
    "Prefer real, recognizable songs that match tone — not generic “epic orchestra” filler.",
    "Vary era/genre where it serves the book. Order as a listening journey: open → deepen → turn → climax → after.",
    "Do not invent manuscript prose. Songs are playlists, not canon.",
    "",
    "MANUSCRIPT READING (from full Claude pass):",
    indexDigest(index) || "(thin reading — lean on chapter ledger)",
    "",
    "CHAPTER LEDGER:",
    chapterLedger(book.chapters ?? []) || "(no chapters)",
    "",
    `Existing soundtrack (do not duplicate title+artist):\n${existing}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function applySoundtrackCompose(
  existing: SoundtrackSong[],
  payload: SoundtrackComposePayload,
): SoundtrackSong[] {
  const incoming = (payload.songs ?? [])
    .filter((s) => s?.title?.trim() && s?.artist?.trim())
    .slice(0, 15);

  if (incoming.length === 0) return existing;

  const byKey = new Map(
    existing.map((s) => [songKey(s.title, s.artist), s] as const),
  );
  let next = [...existing];
  let orderBase = nextSoundtrackOrder(next);

  const sorted = [...incoming].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );

  sorted.forEach((d, i) => {
    const title = d.title.trim();
    const artist = d.artist.trim();
    const key = songKey(title, artist);
    const prev = byKey.get(key);
    const order =
      typeof d.order === "number" && d.order > 0 ? d.order - 1 : orderBase + i;

    if (prev) {
      next = next.map((s) => {
        if (s.id !== prev.id) return s;
        return {
          ...s,
          note:
            d.note?.trim() && d.note.trim().length > s.note.trim().length
              ? d.note.trim().slice(0, 800)
              : s.note || (d.note ?? "").trim().slice(0, 800),
          placement: d.placement?.trim() || s.placement,
          order,
          updatedAt: Date.now(),
        };
      });
      return;
    }

    const song = createSoundtrackSong({
      title,
      artist,
      note: (d.note ?? "").trim().slice(0, 800),
      placement: (d.placement ?? "").trim(),
      order,
    });
    byKey.set(key, song);
    next.push(song);
  });

  return sortSoundtrackSongs(next);
}
