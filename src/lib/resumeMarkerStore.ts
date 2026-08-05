/** Persist where the author left off in a manuscript document. */

const STORAGE_KEY = "folio:resume-marker";

export type ResumePoint = {
  documentId: string;
  pos: number;
};

let memory: ResumePoint | null = null;

export function stashResumePoint(documentId: string, pos: number) {
  if (!documentId || pos < 0) return;
  memory = { documentId, pos };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    /* private mode / quota */
  }
}

/** Peek without clearing — used when remounting the same chapter. */
export function peekResumePoint(documentId: string): number | null {
  const point = memory ?? readStorage();
  if (!point || point.documentId !== documentId) return null;
  if (!Number.isFinite(point.pos) || point.pos < 0) return null;
  return Math.floor(point.pos);
}

export function clearResumePoint(documentId?: string) {
  if (
    documentId &&
    memory &&
    memory.documentId !== documentId &&
    readStorage()?.documentId !== documentId
  ) {
    return;
  }
  memory = null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function readStorage(): ResumePoint | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ResumePoint;
    if (
      !parsed ||
      typeof parsed.documentId !== "string" ||
      typeof parsed.pos !== "number"
    ) {
      return null;
    }
    memory = parsed;
    return parsed;
  } catch {
    return null;
  }
}
