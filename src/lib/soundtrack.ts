import type { Book, SoundtrackSong } from "./types";
import { createId } from "./utils";

export function createSoundtrackSong(
  partial: Partial<SoundtrackSong> & { title: string },
): SoundtrackSong {
  const now = Date.now();
  return {
    id: partial.id ?? createId(),
    title: partial.title.trim() || "Untitled track",
    artist: (partial.artist ?? "").trim(),
    note: partial.note ?? "",
    placement: partial.placement ?? "",
    order: partial.order ?? 0,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
  };
}

/** Max favorite artists the author can seed into Clarence’s compose. */
export const MAX_SOUNDTRACK_TASTE = 4;

export function normalizeSoundtrackTaste(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const name = String(item ?? "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name.slice(0, 80));
    if (out.length >= MAX_SOUNDTRACK_TASTE) break;
  }
  return out;
}

export function sortSoundtrackSongs(songs: SoundtrackSong[]): SoundtrackSong[] {
  return [...songs].sort(
    (a, b) =>
      a.order - b.order ||
      a.title.localeCompare(b.title) ||
      a.artist.localeCompare(b.artist),
  );
}

export function nextSoundtrackOrder(songs: SoundtrackSong[]): number {
  if (songs.length === 0) return 0;
  return Math.max(...songs.map((s) => s.order)) + 1;
}

export function ensureBookSoundtrack(
  book: Omit<Book, "soundtrack" | "soundtrackArc" | "soundtrackTaste"> & {
    soundtrack?: SoundtrackSong[];
    soundtrackArc?: string;
    soundtrackTaste?: string[];
  },
): Book {
  const soundtrack = sortSoundtrackSongs(
    (book.soundtrack ?? []).map((s, i) =>
      createSoundtrackSong({
        ...s,
        title: s.title || "Untitled track",
        order: s.order ?? i,
      }),
    ),
  );
  return {
    ...(book as Book),
    soundtrack,
    soundtrackArc: (book.soundtrackArc ?? "").trim(),
    soundtrackTaste: normalizeSoundtrackTaste(book.soundtrackTaste),
  };
}

export function songKey(title: string, artist: string): string {
  return `${title.trim().toLowerCase()}::${artist.trim().toLowerCase()}`;
}
