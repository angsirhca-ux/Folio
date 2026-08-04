import type { Book, Chapter } from "./types";
import { createId, countWords } from "./utils";
import { bookBackupStats } from "./backup";

const SNAPSHOTS_KEY = "folio:snapshots";
export const MAX_SNAPSHOTS_PER_BOOK = 16;
/** Auto / safety snaps are pruned first; checkpoints are kept longer. */
export const MAX_AUTO_SNAPSHOTS = 8;

export type SnapshotKind = "checkpoint" | "auto";

export interface BookSnapshot {
  id: string;
  bookId: string;
  /** Short label — “Before the ending”, “Manual”, etc. */
  label: string;
  /** Named checkpoints resist pruning; auto safety snaps drop first. */
  kind: SnapshotKind;
  createdAt: number;
  wordCount: number;
  chapterCount: number;
  book: Book;
}

export type SnapshotDiffSummary = {
  wordDelta: number;
  chaptersAdded: string[];
  chaptersRemoved: string[];
  chaptersChanged: Array<{ title: string; wordDelta: number }>;
  /** One-line human summary. */
  headline: string;
};

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
    return {
      version: 1,
      items: parsed.items.map(normalizeSnapshot),
    };
  } catch {
    return emptyStore();
  }
}

function normalizeSnapshot(s: BookSnapshot): BookSnapshot {
  const kind: SnapshotKind =
    s.kind === "checkpoint" || s.kind === "auto"
      ? s.kind
      : isAutoLabel(s.label)
        ? "auto"
        : "checkpoint";
  return { ...s, kind };
}

function isAutoLabel(label: string): boolean {
  const l = label.trim().toLowerCase();
  return (
    l.startsWith("before ") ||
    l === "manual" ||
    l.includes("dropbox") ||
    l.includes("restore")
  );
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

/**
 * Prefer dropping oldest auto snaps; only then drop oldest checkpoints.
 * Soft caps: MAX_AUTO_SNAPSHOTS autos, MAX_SNAPSHOTS_PER_BOOK total.
 */
function pruneBook(items: BookSnapshot[], bookId: string): BookSnapshot[] {
  const forBook = items
    .filter((s) => s.bookId === bookId)
    .sort((a, b) => b.createdAt - a.createdAt);

  const autos = forBook.filter((s) => s.kind === "auto");
  const checks = forBook.filter((s) => s.kind === "checkpoint");

  const keepAutos = autos.slice(0, MAX_AUTO_SNAPSHOTS);
  let keepChecks = checks;
  const room = Math.max(0, MAX_SNAPSHOTS_PER_BOOK - keepAutos.length);
  if (keepChecks.length > room) {
    keepChecks = keepChecks.slice(0, Math.max(room, 4));
  }

  const keepIds = new Set(
    [...keepAutos, ...keepChecks].map((s) => s.id),
  );
  return items.filter((s) => s.bookId !== bookId || keepIds.has(s.id));
}

export function createSnapshot(
  book: Book,
  label = "Checkpoint",
  kind?: SnapshotKind,
): BookSnapshot {
  const stats = bookBackupStats(book);
  const resolvedKind: SnapshotKind =
    kind ?? (isAutoLabel(label) ? "auto" : "checkpoint");
  const snap: BookSnapshot = {
    id: createId(),
    bookId: book.id,
    label: label.trim() || (resolvedKind === "checkpoint" ? "Checkpoint" : "Auto"),
    kind: resolvedKind,
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

export function renameSnapshot(snapshotId: string, label: string): boolean {
  const store = loadStore();
  const idx = store.items.findIndex((s) => s.id === snapshotId);
  if (idx < 0) return false;
  const nextLabel = label.trim() || store.items[idx].label;
  store.items[idx] = {
    ...store.items[idx],
    label: nextLabel,
    kind: "checkpoint",
  };
  saveStore(store);
  return true;
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

function chapterFingerprint(ch: Chapter): string {
  return `${ch.id}\0${ch.title}\0${ch.content ?? ""}`;
}

/** Compare a snapshot to the live book — what would change on restore. */
export function diffSnapshotSummary(
  snapshot: BookSnapshot,
  current: Book,
): SnapshotDiffSummary {
  const snapBook = snapshot.book;
  const wordDelta = snapshot.wordCount - current.chapters.reduce(
    (n, c) => n + countWords(c.content),
    0,
  );

  const currentById = new Map(current.chapters.map((c) => [c.id, c]));
  const snapById = new Map(snapBook.chapters.map((c) => [c.id, c]));

  const chaptersAdded: string[] = [];
  const chaptersRemoved: string[] = [];
  const chaptersChanged: Array<{ title: string; wordDelta: number }> = [];

  for (const ch of snapBook.chapters) {
    if (!currentById.has(ch.id)) {
      chaptersAdded.push(ch.title || "Untitled");
    }
  }
  for (const ch of current.chapters) {
    if (!snapById.has(ch.id)) {
      chaptersRemoved.push(ch.title || "Untitled");
    }
  }
  for (const [id, snapCh] of snapById) {
    const cur = currentById.get(id);
    if (!cur) continue;
    if (chapterFingerprint(snapCh) === chapterFingerprint(cur)) continue;
    chaptersChanged.push({
      title: snapCh.title || cur.title || "Untitled",
      wordDelta: countWords(snapCh.content) - countWords(cur.content),
    });
  }

  const parts: string[] = [];
  if (wordDelta !== 0) {
    parts.push(
      `${wordDelta > 0 ? "+" : ""}${wordDelta.toLocaleString("en-US")} words vs now`,
    );
  }
  if (chaptersChanged.length) {
    parts.push(
      `${chaptersChanged.length} chapter${chaptersChanged.length === 1 ? "" : "s"} differ`,
    );
  }
  if (chaptersAdded.length) {
    parts.push(
      `${chaptersAdded.length} chapter${chaptersAdded.length === 1 ? "" : "s"} only in snapshot`,
    );
  }
  if (chaptersRemoved.length) {
    parts.push(
      `${chaptersRemoved.length} chapter${chaptersRemoved.length === 1 ? "" : "s"} only in current`,
    );
  }

  const headline =
    parts.length > 0
      ? parts.join(" · ")
      : "Looks identical to the current manuscript.";

  return {
    wordDelta,
    chaptersAdded,
    chaptersRemoved,
    chaptersChanged,
    headline,
  };
}

export function formatSnapshotDiffLines(
  summary: SnapshotDiffSummary,
): string[] {
  const lines: string[] = [summary.headline];
  for (const ch of summary.chaptersChanged.slice(0, 6)) {
    const d =
      ch.wordDelta === 0
        ? "edited"
        : `${ch.wordDelta > 0 ? "+" : ""}${ch.wordDelta} words`;
    lines.push(`“${ch.title}” — ${d}`);
  }
  if (summary.chaptersChanged.length > 6) {
    lines.push(`…and ${summary.chaptersChanged.length - 6} more`);
  }
  for (const t of summary.chaptersAdded.slice(0, 3)) {
    lines.push(`In snapshot only: “${t}”`);
  }
  for (const t of summary.chaptersRemoved.slice(0, 3)) {
    lines.push(`In current only: “${t}”`);
  }
  return lines;
}
