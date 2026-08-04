import type { Book, ChronicleEvent } from "./types";
import { createId } from "./utils";

export function createChronicleEvent(
  partial: Partial<ChronicleEvent> & { title: string },
): ChronicleEvent {
  const now = Date.now();
  return {
    id: partial.id ?? createId(),
    title: partial.title.trim() || "Untitled event",
    summary: partial.summary ?? "",
    order: partial.order ?? 0,
    whenLabel: partial.whenLabel ?? "",
    linkedEntryIds: partial.linkedEntryIds ?? [],
    linkedCharacterIds: partial.linkedCharacterIds ?? [],
    linkedLocationIds: partial.linkedLocationIds ?? [],
    mapMarker: partial.mapMarker
      ? {
          mapId: partial.mapMarker.mapId,
          x: Math.min(1, Math.max(0, partial.mapMarker.x)),
          y: Math.min(1, Math.max(0, partial.mapMarker.y)),
        }
      : undefined,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
  };
}

export function sortChronicleEvents(
  events: ChronicleEvent[],
): ChronicleEvent[] {
  return [...events].sort(
    (a, b) =>
      a.order - b.order ||
      a.whenLabel.localeCompare(b.whenLabel) ||
      a.title.localeCompare(b.title),
  );
}

export function ensureBookChronicle(
  book: Omit<Book, "chronicle"> & { chronicle?: ChronicleEvent[] },
): Book {
  const chronicle = sortChronicleEvents(
    (book.chronicle ?? []).map((e, i) =>
      createChronicleEvent({
        ...e,
        title: e.title || "Untitled event",
        order: e.order ?? i,
      }),
    ),
  );
  return {
    ...(book as Book),
    chronicle,
  };
}

export function nextChronicleOrder(events: ChronicleEvent[]): number {
  if (events.length === 0) return 0;
  return Math.max(...events.map((e) => e.order)) + 1;
}
