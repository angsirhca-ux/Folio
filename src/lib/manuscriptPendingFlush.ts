/**
 * Sync pending TipTap prose into the book before Save / unload.
 * ManuscriptEditor registers a flush; BookProvider calls it from saveNow.
 */

export type ManuscriptPendingFlush = {
  /** Chapter or dump page id currently open in the editor. */
  documentId: string;
  html: string;
};

type FlushFn = () => ManuscriptPendingFlush | null;

let flushFn: FlushFn | null = null;

export function registerManuscriptPendingFlush(fn: FlushFn | null): void {
  flushFn = fn;
}

/** Capture live editor HTML (incl. scene breaks / last keystrokes). */
export function flushManuscriptPending(): ManuscriptPendingFlush | null {
  return flushFn?.() ?? null;
}
