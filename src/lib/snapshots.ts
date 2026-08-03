import type { Book } from "./types";
import { createId, countWords } from "./utils";
import { bookBackupStats } from "./backup";

const SNAPSHOTS_KEY = "folio:snapshots";
export const MAX_SNAPSHOTS_PER_BOOK = 12;

export interface BookSnapshot {
  id: string;
  bookId: string;
  /** Short label — "Manual", "Before restore", etc. */
  label: string;
  createdAt: number;
  wordCount: number;
  chapterCount: number;
  book: Book;
}

interface SnapshotStore {
  version: 1;
  items: BookSnapshot[];
}

function emptyStore(): SnapshotStore {
  return { version: 1, items: [] };
}

function loadStore(): SnapshotStore {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = window.localStorage.getItem(SNAPSHOTS_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as SnapshotStore;
    if (!parsed || !Array.isArray(parsed.items)) return emptyStore();
    return { version: 1, items: parsed.items };
  } catch {
    return emptyStore();
  }
}

function saveStore(store: SnapshotStore) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(store));
}

export function listSnapshots(bookId: string): BookSnapshot[] {
  return loadStore()
    .items.filter((s) => s.bookId === bookId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getSnapshot(snapshotId: string): BookSnapshot | null {
  return loadStore().items.find((s) => s.id === snapshotId) ?? null;
}

function pruneBook(
  items: BookSnapshot[],
  bookId: string,
  keep = MAX_SNAPSHOTS_PER_BOOK,
): BookSnapshot[] {
  const forBook = items
    .filter((s) => s.bookId === bookId)
    .sort((a, b) => b.createdAt - a.createdAt);
  const drop = new Set(forBook.slice(keep).map((s) => s.id));
  return items.filter((s) => !drop.has(s.id));
}

export function createSnapshot(
  book: Book,
  label = "Manual",
): BookSnapshot {
  const stats = bookBackupStats(book);
  const snap: BookSnapshot = {
    id: createId(),
    bookId: book.id,
    label: label.trim() || "Manual",
    createdAt: Date.now(),
    wordCount: stats.words,
    chapterCount: stats.chapters,
    book: structuredClone(book),
  };

  const store = loadStore();
  store.items = pruneBook([snap, ...store.items], book.id);
  saveStore(store);
  return snap;
}

export function deleteSnapshot(snapshotId: string): void {
  const store = loadStore();
  store.items = store.items.filter((s) => s.id !== snapshotId);
  saveStore(store);
}

export function deleteSnapshotsForBook(bookId: string): void {
  const store = loadStore();
  store.items = store.items.filter((s) => s.bookId !== bookId);
  saveStore(store);
}

/** Approximate storage use of all snapshots (UTF-16-ish). */
export function snapshotsStorageEstimate(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(SNAPSHOTS_KEY);
  return raw ? raw.length * 2 : 0;
}

export function snapshotWordDelta(
  snapshot: BookSnapshot,
  current: Book,
): number {
  const now = current.chapters.reduce(
    (n, c) => n + countWords(c.content),
    0,
  );
  return now - snapshot.wordCount;
}
