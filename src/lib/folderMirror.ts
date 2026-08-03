/**
 * Optional write-only local folder mirror (File System Access API).
 * Chrome/Edge: continuous folio-library.json dump beside Dropbox sync.
 * Never auto-reads as authority — localStorage remains the working copy.
 */

import type { AppSettings, FolioLibrary } from "./types";
import { buildLibraryBackup } from "./backup";

const IDB_NAME = "folio-folder-mirror";
const IDB_STORE = "handles";
const HANDLE_KEY = "directory";
const META_KEY = "folio:folderMirror:meta";
const LIBRARY_FILENAME = "folio-library.json";
const BACKUPS_DIR = "backups";
const MAX_BACKUPS = 8;

export type FolderMirrorStatus = {
  supported: boolean;
  linked: boolean;
  folderName: string | null;
  lastWrittenAt: number | null;
  lastError: string | null;
};

type FolderMirrorMeta = {
  folderName: string | null;
  lastWrittenAt: number | null;
  lastError: string | null;
  linked: boolean;
};

type DirHandle = FileSystemDirectoryHandle;

declare global {
  interface Window {
    showDirectoryPicker?: (options?: {
      id?: string;
      mode?: "read" | "readwrite";
      startIn?:
        | "desktop"
        | "documents"
        | "downloads"
        | "music"
        | "pictures"
        | "videos";
    }) => Promise<FileSystemDirectoryHandle>;
  }

  interface FileSystemHandle {
    queryPermission?: (descriptor?: {
      mode?: "read" | "readwrite";
    }) => Promise<PermissionState>;
    requestPermission?: (descriptor?: {
      mode?: "read" | "readwrite";
    }) => Promise<PermissionState>;
  }
}

export function isFolderMirrorSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.showDirectoryPicker === "function"
  );
}

function emptyStatus(supported: boolean): FolderMirrorStatus {
  return {
    supported,
    linked: false,
    folderName: null,
    lastWrittenAt: null,
    lastError: null,
  };
}

function loadMeta(): FolderMirrorMeta {
  if (typeof window === "undefined") {
    return {
      folderName: null,
      lastWrittenAt: null,
      lastError: null,
      linked: false,
    };
  }
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) {
      return {
        folderName: null,
        lastWrittenAt: null,
        lastError: null,
        linked: false,
      };
    }
    const parsed = JSON.parse(raw) as FolderMirrorMeta;
    return {
      folderName: parsed.folderName ?? null,
      lastWrittenAt: parsed.lastWrittenAt ?? null,
      lastError: parsed.lastError ?? null,
      linked: Boolean(parsed.linked),
    };
  } catch {
    return {
      folderName: null,
      lastWrittenAt: null,
      lastError: null,
      linked: false,
    };
  }
}

function saveMeta(partial: Partial<FolderMirrorMeta>) {
  if (typeof window === "undefined") return;
  const next = { ...loadMeta(), ...partial };
  localStorage.setItem(META_KEY, JSON.stringify(next));
}

export function getFolderMirrorStatus(): FolderMirrorStatus {
  if (!isFolderMirrorSupported()) {
    return emptyStatus(false);
  }
  const meta = loadMeta();
  return {
    supported: true,
    linked: meta.linked,
    folderName: meta.folderName,
    lastWrittenAt: meta.lastWrittenAt,
    lastError: meta.lastError,
  };
}

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

async function idbGetHandle(): Promise<DirHandle | null> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const store = tx.objectStore(IDB_STORE);
    const req = store.get(HANDLE_KEY);
    req.onsuccess = () => {
      db.close();
      resolve((req.result as DirHandle | undefined) ?? null);
    };
    req.onerror = () => {
      db.close();
      reject(req.error ?? new Error("IndexedDB read failed"));
    };
  });
}

async function idbPutHandle(handle: DirHandle): Promise<void> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    const req = store.put(handle, HANDLE_KEY);
    req.onsuccess = () => {
      db.close();
      resolve();
    };
    req.onerror = () => {
      db.close();
      reject(req.error ?? new Error("IndexedDB write failed"));
    };
  });
}

async function idbClearHandle(): Promise<void> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    const req = store.delete(HANDLE_KEY);
    req.onsuccess = () => {
      db.close();
      resolve();
    };
    req.onerror = () => {
      db.close();
      reject(req.error ?? new Error("IndexedDB delete failed"));
    };
  });
}

async function ensurePermission(handle: DirHandle): Promise<boolean> {
  const opts = { mode: "readwrite" as const };
  if (typeof handle.queryPermission === "function") {
    const current = await handle.queryPermission(opts);
    if (current === "granted") return true;
  }
  if (typeof handle.requestPermission === "function") {
    const next = await handle.requestPermission(opts);
    return next === "granted";
  }
  // Older Chromium: writable if we got the handle with readwrite mode.
  return true;
}

function stampFilename(ms = Date.now()): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `folio-library-${y}${m}${day}T${hh}${mm}.json`;
}

async function writeTextFile(
  dir: DirHandle,
  name: string,
  contents: string,
): Promise<void> {
  const file = await dir.getFileHandle(name, { create: true });
  const writable = await file.createWritable();
  try {
    await writable.write(contents);
  } finally {
    await writable.close();
  }
}

async function pruneBackups(backupsDir: DirHandle): Promise<void> {
  const entries: { name: string }[] = [];
  const iterable = backupsDir as DirHandle & {
    entries: () => AsyncIterableIterator<[string, FileSystemHandle]>;
  };
  for await (const [name, handle] of iterable.entries()) {
    if (handle.kind !== "file") continue;
    if (!name.startsWith("folio-library-") || !name.endsWith(".json")) continue;
    entries.push({ name });
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  while (entries.length > MAX_BACKUPS) {
    const oldest = entries.shift();
    if (!oldest) break;
    await backupsDir.removeEntry(oldest.name);
  }
}

/** Prompt for a Folio folder and persist the handle. */
export async function chooseFolderMirror(): Promise<FolderMirrorStatus> {
  if (!isFolderMirrorSupported() || !window.showDirectoryPicker) {
    throw new Error(
      "Local folder mirror needs Chrome or Edge (File System Access).",
    );
  }
  const handle = await window.showDirectoryPicker({
    id: "folio-library-mirror",
    mode: "readwrite",
    startIn: "documents",
  });
  const granted = await ensurePermission(handle);
  if (!granted) {
    throw new Error("Write permission was not granted for that folder.");
  }
  await idbPutHandle(handle);
  saveMeta({
    linked: true,
    folderName: handle.name,
    lastError: null,
  });
  return getFolderMirrorStatus();
}

export async function clearFolderMirror(): Promise<void> {
  try {
    await idbClearHandle();
  } catch {
    /* ignore */
  }
  saveMeta({
    linked: false,
    folderName: null,
    lastError: null,
  });
}

/**
 * Write folio-library.json + a timestamped copy under backups/ (capped).
 * Soft-fails: records lastError on meta, never throws to callers who catch.
 */
export async function writeFolderMirror(
  library: FolioLibrary,
  settings: AppSettings,
): Promise<FolderMirrorStatus> {
  if (!isFolderMirrorSupported()) {
    return emptyStatus(false);
  }
  const meta = loadMeta();
  if (!meta.linked) {
    return getFolderMirrorStatus();
  }

  try {
    const handle = await idbGetHandle();
    if (!handle) {
      saveMeta({
        linked: false,
        folderName: null,
        lastError: "Folder link was lost — choose the folder again.",
      });
      return getFolderMirrorStatus();
    }

    const granted = await ensurePermission(handle);
    if (!granted) {
      saveMeta({
        lastError: "Folder permission needed — click Write now to re-grant.",
      });
      return getFolderMirrorStatus();
    }

    const payload = buildLibraryBackup(library, settings);
    const json = JSON.stringify(payload, null, 2);
    await writeTextFile(handle, LIBRARY_FILENAME, json);

    const backups = await handle.getDirectoryHandle(BACKUPS_DIR, {
      create: true,
    });
    await writeTextFile(backups, stampFilename(), json);
    await pruneBackups(backups);

    saveMeta({
      linked: true,
      folderName: handle.name,
      lastWrittenAt: Date.now(),
      lastError: null,
    });
    return getFolderMirrorStatus();
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not write the Folio folder.";
    console.warn("[folio] Folder mirror:", e);
    saveMeta({ lastError: message });
    return getFolderMirrorStatus();
  }
}
