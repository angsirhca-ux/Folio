import type { AppSettings, Book, FolioLibrary } from "./types";
import { createId, countWords } from "./utils";
import {
  loadLibrary,
  loadSettings,
  saveLibrary,
  saveSettings,
} from "./storage";

export const FOLIO_BACKUP_FORMAT = "folio-backup" as const;
export const FOLIO_BOOK_BACKUP_FORMAT = "folio-book-backup" as const;
export const FOLIO_BACKUP_VERSION = 1 as const;

/** Full library + settings — the durable recovery file. */
export interface FolioBackupFile {
  format: typeof FOLIO_BACKUP_FORMAT;
  version: typeof FOLIO_BACKUP_VERSION;
  exportedAt: number;
  library: FolioLibrary;
  settings: AppSettings;
}

/** Single manuscript file — lighter, for one book. */
export interface FolioBookBackupFile {
  format: typeof FOLIO_BOOK_BACKUP_FORMAT;
  version: typeof FOLIO_BACKUP_VERSION;
  exportedAt: number;
  book: Book;
}

export type FolioBackupPayload = FolioBackupFile | FolioBookBackupFile;

function slugify(title: string): string {
  const s = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return s || "folio";
}

function dateStamp(ms = Date.now()): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function buildLibraryBackup(
  library?: FolioLibrary,
  settings?: AppSettings,
): FolioBackupFile {
  return {
    format: FOLIO_BACKUP_FORMAT,
    version: FOLIO_BACKUP_VERSION,
    exportedAt: Date.now(),
    library: library ?? loadLibrary(),
    settings: settings ?? loadSettings(),
  };
}

export function buildBookBackup(book: Book): FolioBookBackupFile {
  return {
    format: FOLIO_BOOK_BACKUP_FORMAT,
    version: FOLIO_BACKUP_VERSION,
    exportedAt: Date.now(),
    book: structuredClone(book),
  };
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadLibraryBackup(
  library?: FolioLibrary,
  settings?: AppSettings,
) {
  const payload = buildLibraryBackup(library, settings);
  downloadJson(`folio-library-${dateStamp()}.json`, payload);
  return payload;
}

export function downloadBookBackup(book: Book) {
  const payload = buildBookBackup(book);
  const name = slugify(book.title || "manuscript");
  downloadJson(`${name}-${dateStamp()}.folio.json`, payload);
  return payload;
}

export function parseBackupJson(raw: string): FolioBackupPayload {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  if (!data || typeof data !== "object") {
    throw new Error("That file does not look like a Folio backup.");
  }
  const obj = data as Record<string, unknown>;

  if (obj.format === FOLIO_BACKUP_FORMAT) {
    if (!obj.library || typeof obj.library !== "object") {
      throw new Error("Library backup is missing its shelf of books.");
    }
    const library = obj.library as FolioLibrary;
    if (!Array.isArray(library.books) || library.books.length === 0) {
      throw new Error("Library backup has no books to restore.");
    }
    return {
      format: FOLIO_BACKUP_FORMAT,
      version: FOLIO_BACKUP_VERSION,
      exportedAt:
        typeof obj.exportedAt === "number" ? obj.exportedAt : Date.now(),
      library,
      settings: (obj.settings as AppSettings) ?? loadSettings(),
    };
  }

  if (obj.format === FOLIO_BOOK_BACKUP_FORMAT) {
    if (!obj.book || typeof obj.book !== "object") {
      throw new Error("Book backup is missing the manuscript.");
    }
    return {
      format: FOLIO_BOOK_BACKUP_FORMAT,
      version: FOLIO_BACKUP_VERSION,
      exportedAt:
        typeof obj.exportedAt === "number" ? obj.exportedAt : Date.now(),
      book: obj.book as Book,
    };
  }

  // Legacy: bare FolioLibrary or bare Book
  const maybeLib = obj as unknown as FolioLibrary;
  if (Array.isArray(maybeLib.books) && maybeLib.activeBookId) {
    return {
      format: FOLIO_BACKUP_FORMAT,
      version: FOLIO_BACKUP_VERSION,
      exportedAt: Date.now(),
      library: maybeLib,
      settings: loadSettings(),
    };
  }
  const maybeBook = obj as unknown as Book;
  if (
    Array.isArray(maybeBook.chapters) &&
    typeof maybeBook.id === "string" &&
    typeof maybeBook.title === "string"
  ) {
    return {
      format: FOLIO_BOOK_BACKUP_FORMAT,
      version: FOLIO_BACKUP_VERSION,
      exportedAt: Date.now(),
      book: maybeBook,
    };
  }

  throw new Error(
    "Unrecognized backup. Expect a Folio library or book .json export.",
  );
}

export async function readBackupFile(file: File): Promise<FolioBackupPayload> {
  const text = await file.text();
  return parseBackupJson(text);
}

/** Apply a full library backup to localStorage. Returns the active book. */
export function applyLibraryBackup(backup: FolioBackupFile): {
  library: FolioLibrary;
  settings: AppSettings;
  active: Book;
} {
  const library: FolioLibrary = {
    version: 1,
    activeBookId: backup.library.activeBookId,
    books: backup.library.books,
    series: backup.library.series ?? [],
    trash: backup.library.trash ?? [],
  };
  if (!library.books.some((b) => b.id === library.activeBookId)) {
    library.activeBookId = library.books[0].id;
  }
  saveLibrary(library);
  const settings = backup.settings ?? loadSettings();
  saveSettings(settings);
  const active =
    library.books.find((b) => b.id === library.activeBookId) ??
    library.books[0];
  return { library, settings, active };
}

/**
 * Merge/replace one book into the current library.
 * If the id exists, replace it; otherwise add and switch to it.
 */
export function applyBookBackup(book: Book): {
  library: FolioLibrary;
  active: Book;
} {
  const incoming = {
    ...structuredClone(book),
    id: book.id || createId(),
    updatedAt: Date.now(),
  };
  const library = loadLibrary();
  const idx = library.books.findIndex((b) => b.id === incoming.id);
  if (idx >= 0) {
    library.books[idx] = incoming;
  } else {
    library.books.unshift(incoming);
  }
  library.activeBookId = incoming.id;
  saveLibrary(library);
  return { library, active: incoming };
}

export function bookBackupStats(book: Book): {
  words: number;
  chapters: number;
} {
  return {
    words: book.chapters.reduce((n, c) => n + countWords(c.content), 0),
    chapters: book.chapters.length,
  };
}
