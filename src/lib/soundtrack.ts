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
  book: Omit<Book, "soundtrack"> & { soundtrack?: SoundtrackSong[] },
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
  };
}

export function songKey(title: string, artist: string): string {
  return `${title.trim().toLowerCase()}::${artist.trim().toLowerCase()}`;
}
