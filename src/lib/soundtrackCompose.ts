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

/** Fixed score slots — forces arc shape instead of 15 interchangeable vibes. */
export const SOUNDTRACK_SLOTS = [
  {
    id: "opening-titles",
    label: "Opening titles",
    brief: "Cold open / first page energy — the door into the book.",
  },
  {
    id: "world-theme",
    label: "World theme",
    brief: "Place, era, or atmosphere as sound — where we are.",
  },
  {
    id: "protagonist-theme",
    label: "Protagonist theme",
    brief: "Lead’s private frequency — want, wound, or voice.",
  },
  {
    id: "rival-or-shadow",
    label: "Rival / shadow",
    brief: "Antagonist, foil, or the force pressing the lead.",
  },
  {
    id: "ally-or-bond",
    label: "Ally / bond",
    brief: "Friendship, found family, or the relationship that steadies.",
  },
  {
    id: "desire-line",
    label: "Desire line",
    brief: "Romance, longing, or the thing they reach for.",
  },
  {
    id: "rising-heat",
    label: "Rising heat",
    brief: "Early escalation — stakes climb, tempo lifts.",
  },
  {
    id: "midpoint-turn",
    label: "Midpoint turn",
    brief: "The hinge — revelation, betrayal, or irreversible choice.",
  },
  {
    id: "false-calm",
    label: "False calm",
    brief: "Breath before the storm — lull, denial, or fragile peace.",
  },
  {
    id: "spiral",
    label: "Spiral",
    brief: "Things fray — obsession, dread, or runaway consequence.",
  },
  {
    id: "point-of-no-return",
    label: "Point of no return",
    brief: "Commitment to the endgame — they can’t go back.",
  },
  {
    id: "climax",
    label: "Climax",
    brief: "Peak confrontation — physical, emotional, or both.",
  },
  {
    id: "aftermath",
    label: "Aftermath",
    brief: "Cost and quiet — what the win/loss leaves behind.",
  },
  {
    id: "coda",
    label: "Coda",
    brief: "Last image / emotional residue — not credits yet.",
  },
  {
    id: "credits",
    label: "End credits",
    brief: "Walk-away track — the feeling you leave the theater with.",
  },
] as const;

export type SoundtrackSlotId = (typeof SOUNDTRACK_SLOTS)[number]["id"];

export type DiscoveredSoundtrackSong = {
  title: string;
  artist: string;
  note?: string;
  placement?: string;
  /** Prefer slot id when composing. */
  slot?: string;
  order?: number;
};

export type SoundtrackComposePayload = {
  /** One-line listening journey for the whole playlist. */
  arcBlurb?: string;
  songs: DiscoveredSoundtrackSong[];
};

export const SOUNDTRACK_COMPOSE_TOOL_NAME = "save_soundtrack";

const SLOT_IDS = SOUNDTRACK_SLOTS.map((s) => s.id);

export const composeSoundtrackTool = {
  name: SOUNDTRACK_COMPOSE_TOOL_NAME,
  description:
    "Propose a 15-track score for this novel — one song per fixed arc slot, real songs with specific why-it-fits notes.",
  input_schema: {
    type: "object" as const,
    properties: {
      arcBlurb: {
        type: "string",
        description:
          "One sentence describing the listening journey (e.g. cold rain → heat → ash).",
      },
      songs: {
        type: "array",
        description:
          "Exactly 15 tracks — one per slot id, in slot order (opening-titles → credits).",
        items: {
          type: "object",
          properties: {
            slot: {
              type: "string",
              enum: [...SLOT_IDS],
              description: "Which score slot this track fills.",
            },
            title: { type: "string" },
            artist: { type: "string" },
            note: {
              type: "string",
              description:
                "2–3 sentences: why THIS song for THIS book — name a character, place, or chapter beat. No generic mood adjectives alone.",
            },
            placement: {
              type: "string",
              description:
                "Human label matching the slot (e.g. Opening titles, Midpoint turn).",
            },
            order: {
              type: "number",
              description: "1–15 listening order (match slot order).",
            },
          },
          required: ["slot", "title", "artist", "note"],
        },
      },
    },
    required: ["arcBlurb", "songs"],
  },
};

function chapterLedger(chapters: Chapter[]): string {
  return chapters
    .map((ch, i) => {
      const summary = (ch.summary ?? "").trim();
      const sceneBits = (ch.scenes ?? [])
        .slice(0, 8)
        .map((s) => {
          const syn = s.synopsis?.trim();
          const pov = s.pov?.trim();
          const status = s.status;
          const head = [s.title || "Scene", pov ? `POV ${pov}` : "", status]
            .filter(Boolean)
            .join(" · ");
          return syn
            ? `  · ${head}: ${syn.slice(0, 160)}`
            : `  · ${head}`;
        })
        .join("\n");
      return [
        `Ch ${i + 1}: ${ch.title}`,
        summary ? `  Summary: ${summary.slice(0, 320)}` : "",
        sceneBits,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

function indexDigest(index: ManuscriptIndexData): string {
  const leads = index.characters
    .filter(
      (c) =>
        c.role === "protagonist" ||
        c.role === "antagonist" ||
        c.role === "deuteragonist",
    )
    .slice(0, 8);
  const castLine =
    leads.length > 0
      ? leads
          .map(
            (c) =>
              `${c.name}${c.role ? ` [${c.role}]` : ""}${c.shortBio ? `: ${c.shortBio.slice(0, 90)}` : ""}`,
          )
          .join("\n  ")
      : index.characters
          .slice(0, 12)
          .map(
            (c) =>
              `${c.name}${c.shortBio ? `: ${c.shortBio.slice(0, 80)}` : ""}`,
          )
          .join("; ");

  return [
    castLine
      ? `Key cast:\n  ${castLine}`
      : "",
    index.locations.length
      ? `Places (texture for era/genre): ${index.locations
          .slice(0, 16)
          .map(
            (l) =>
              `${l.name}${l.kind && l.kind !== "unspecified" ? ` (${l.kind})` : ""}${l.shortBio ? ` — ${l.shortBio.slice(0, 70)}` : ""}`,
          )
          .join("; ")}`
      : "",
    index.plotThreads.length
      ? `Plot threads: ${index.plotThreads
          .map((t) => `${t.name}${t.summary ? ` — ${t.summary.slice(0, 100)}` : ""}`)
          .join("; ")}`
      : "",
    index.chronicle.length
      ? `World lore: ${index.chronicle
          .slice(0, 10)
          .map((e) => `${e.title}${e.summary ? `: ${e.summary.slice(0, 90)}` : ""}`)
          .join("; ")}`
      : "",
    index.encyclopedia.length
      ? `Canon texture: ${index.encyclopedia
          .slice(0, 14)
          .map((e) =>
            e.shortBio
              ? `${e.title} (${e.shortBio.slice(0, 60)})`
              : e.title,
          )
          .join("; ")}`
      : "",
    index.research.length
      ? `Research / period cues: ${index.research
          .slice(0, 10)
          .map((r) => r.title)
          .join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function slotBriefing(): string {
  return SOUNDTRACK_SLOTS.map(
    (s, i) => `${i + 1}. ${s.id} — ${s.label}: ${s.brief}`,
  ).join("\n");
}

export function buildSoundtrackComposeContext(
  book: Pick<
    Book,
    "title" | "author" | "chapters" | "soundtrack" | "soundtrackTaste"
  >,
  index: ManuscriptIndexData,
): string {
  const existing =
    (book.soundtrack ?? [])
      .map(
        (s) =>
          `- ${s.title}${s.artist ? ` — ${s.artist}` : ""}${s.placement ? ` [${s.placement}]` : ""}`,
      )
      .join("\n") || "(none yet)";

  const taste = (book.soundtrackTaste ?? [])
    .map((a) => a.trim())
    .filter(Boolean)
    .slice(0, 4);
  const tasteBlock =
    taste.length > 0
      ? [
          "AUTHOR TASTE SEEDS (favorite artists — up to 4):",
          taste.map((a) => `- ${a}`).join("\n"),
          "Lean on these as the palette: include at least one track from each named artist when a real song fits a slot, and let their adjacent era/genre/neighbors color nearby picks. Do not force a bad fit — if an artist clashes with a slot, pick a close cousin and say so in the note. Never ignore the seeds.",
        ].join("\n")
      : "AUTHOR TASTE SEEDS: (none set — choose freely from the manuscript’s world)";

  return [
    `Novel: ${book.title || "Untitled"}`,
    book.author ? `Author: ${book.author}` : "",
    "",
    "TASK: Compose a 15-track SCORE for this novel — one song per slot below.",
    "You are a novelist’s music supervisor with taste: specific, era-aware, emotionally precise.",
    "",
    tasteBlock,
    "",
    "HARD RULES:",
    "- Exactly one track per slot id. Use every slot.",
    "- Prefer real, findable songs (title + artist correct enough to search).",
    "- Match the book’s world: era, geography, class, and tone from places/lore/cast — not a generic indie-folk or epic-trailer palette unless the book earns it.",
    "- When AUTHOR TASTE SEEDS are present, treat them as the north star for sonic identity while still serving the arc slots.",
    "- Vary energy across the arc. Do not repeat the same mid-tempo mood fifteen times.",
    "- Avoid cliché “AI soundtrack” filler (generic Hans Zimmer–ish trailer cues, overused Spotify “writing playlist” staples, vague “cinematic” instrumentals) unless a track is unmistakably right.",
    "- Each note must cite a concrete story hook (character name, place, or chapter beat). Mood adjectives alone fail.",
    "- Songs are a playlist, not canon. Never invent manuscript prose.",
    "",
    "SCORE SLOTS (fill all, in order):",
    slotBriefing(),
    "",
    "MANUSCRIPT READING:",
    indexDigest(index) || "(thin reading — lean on chapter ledger and invent less)",
    "",
    "CHAPTER LEDGER (emotional map):",
    chapterLedger(book.chapters ?? []) || "(no chapters)",
    "",
    `Existing soundtrack (avoid dull duplicates of title+artist):\n${existing}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export const soundtrackComposeSystemPrompt = `You are a novelist’s music supervisor — playful, opinionated, and tasteful.
Build a 15-track score that feels commissioned for THIS book: era, cast, and arc matter.
When the author names favorite artists, treat those as the sonic north star — weave them and their neighbors through the slots without ignoring story fit.
Prefer surprising-but-right songs over safe playlist wallpaper.
Never rewrite manuscript prose. Output only via the save_soundtrack tool.`;

export function listenSearchUrls(
  title: string,
  artist: string,
): { spotify: string; youtube: string; apple: string } {
  const q = [title, artist].map((s) => s.trim()).filter(Boolean).join(" ");
  const enc = encodeURIComponent(q || title);
  return {
    spotify: `https://open.spotify.com/search/${enc}`,
    youtube: `https://www.youtube.com/results?search_query=${enc}`,
    apple: `https://music.apple.com/search?term=${enc}`,
  };
}

function slotLabel(slotId: string | undefined): string {
  const hit = SOUNDTRACK_SLOTS.find((s) => s.id === slotId);
  return hit?.label ?? "";
}

function slotOrder(slotId: string | undefined, fallback: number): number {
  const idx = SOUNDTRACK_SLOTS.findIndex((s) => s.id === slotId);
  return idx >= 0 ? idx : fallback;
}

export function applySoundtrackCompose(
  existing: SoundtrackSong[],
  payload: SoundtrackComposePayload,
  mode: "merge" | "replace" = "merge",
): SoundtrackSong[] {
  const incoming = (payload.songs ?? [])
    .filter((s) => s?.title?.trim() && s?.artist?.trim())
    .slice(0, 15);

  if (incoming.length === 0) {
    return mode === "replace" ? [] : existing;
  }

  const sorted = [...incoming].sort((a, b) => {
    const ao = slotOrder(a.slot, (a.order ?? 99) - 1);
    const bo = slotOrder(b.slot, (b.order ?? 99) - 1);
    return ao - bo;
  });

  if (mode === "replace") {
    return sortSoundtrackSongs(
      sorted.map((d, i) =>
        createSoundtrackSong({
          title: d.title.trim(),
          artist: d.artist.trim(),
          note: (d.note ?? "").trim().slice(0, 800),
          placement:
            d.placement?.trim() ||
            slotLabel(d.slot) ||
            SOUNDTRACK_SLOTS[i]?.label ||
            "",
          order: slotOrder(d.slot, i),
        }),
      ),
    );
  }

  const byKey = new Map(
    existing.map((s) => [songKey(s.title, s.artist), s] as const),
  );
  let next = [...existing];
  let orderBase = nextSoundtrackOrder(next);

  sorted.forEach((d, i) => {
    const title = d.title.trim();
    const artist = d.artist.trim();
    const key = songKey(title, artist);
    const prev = byKey.get(key);
    const order = slotOrder(d.slot, orderBase + i);
    const placement =
      d.placement?.trim() || slotLabel(d.slot) || "";

    if (prev) {
      next = next.map((s) => {
        if (s.id !== prev.id) return s;
        return {
          ...s,
          note:
            d.note?.trim() && d.note.trim().length > s.note.trim().length
              ? d.note.trim().slice(0, 800)
              : s.note || (d.note ?? "").trim().slice(0, 800),
          placement: placement || s.placement,
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
      placement,
      order,
    });
    byKey.set(key, song);
    next.push(song);
  });

  return sortSoundtrackSongs(next);
}
