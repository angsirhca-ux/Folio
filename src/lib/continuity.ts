import { createId } from "./utils";
import type { ContinuityNote } from "./types";

export function createContinuityNote(
  partial?: Partial<ContinuityNote> & { note?: string; asOf?: string },
): ContinuityNote {
  const now = Date.now();
  return {
    id: partial?.id ?? createId(),
    asOf: partial?.asOf?.trim() ?? "",
    note: partial?.note ?? "",
    createdAt: partial?.createdAt ?? now,
    updatedAt: partial?.updatedAt ?? now,
  };
}

export function sortContinuityNotes(notes: ContinuityNote[]): ContinuityNote[] {
  return [...notes].sort(
    (a, b) =>
      a.createdAt - b.createdAt ||
      a.asOf.localeCompare(b.asOf) ||
      a.note.localeCompare(b.note),
  );
}

export function normalizeContinuityNotes(
  raw: ContinuityNote[] | undefined | null,
): ContinuityNote[] {
  return sortContinuityNotes(
    (raw ?? []).map((n) =>
      createContinuityNote({
        ...n,
        asOf: n?.asOf ?? "",
        note: n?.note ?? "",
      }),
    ),
  );
}

/** Compact lines for AI / continuity context. */
export function continuityNotesForPrompt(
  notes: ContinuityNote[] | undefined,
  limit = 8,
): string {
  const list = sortContinuityNotes(notes ?? []).filter(
    (n) => n.note.trim() || n.asOf.trim(),
  );
  if (list.length === 0) return "";
  return list
    .slice(0, limit)
    .map((n) => {
      const when = n.asOf.trim() || "unspecified";
      const body = n.note.trim() || "(empty)";
      return `as of ${when}: ${body}`;
    })
    .join("\n");
}
