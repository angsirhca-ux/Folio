import type {
  Book,
  Character,
  FolioLibrary,
  Location,
  Series,
} from "./types";
import { createId } from "./utils";
import { createCharacter, findCharacterByName } from "./characters";
import { createLocation, findLocationByName } from "./locations";

export function createSeries(
  partial?: Partial<Series> & { title?: string },
): Series {
  const now = Date.now();
  return {
    id: partial?.id ?? createId(),
    title: partial?.title?.trim() || "Untitled series",
    synopsis: partial?.synopsis ?? "",
    notes: partial?.notes ?? "",
    characters: partial?.characters ?? [],
    locations: partial?.locations ?? [],
    createdAt: partial?.createdAt ?? now,
    updatedAt: partial?.updatedAt ?? now,
  };
}

export function hydrateSeries(raw: Partial<Series> | null | undefined): Series {
  const base = createSeries(raw ?? undefined);
  return {
    ...base,
    characters: (raw?.characters ?? []).map((c) =>
      createCharacter({
        ...c,
        name: c?.name?.trim() || "Unnamed",
      }),
    ),
    locations: (raw?.locations ?? []).map((l) =>
      createLocation({
        ...l,
        name: l?.name?.trim() || "Unnamed",
      }),
    ),
  };
}

export function ensureLibrarySeries(
  library: FolioLibrary,
): FolioLibrary {
  return {
    ...library,
    series: (library.series ?? []).map((s) => hydrateSeries(s)),
  };
}

export function findSeries(
  seriesList: Series[] | undefined,
  seriesId: string | null | undefined,
): Series | undefined {
  if (!seriesId) return undefined;
  return (seriesList ?? []).find((s) => s.id === seriesId);
}

export function booksInSeries(
  books: Book[],
  seriesId: string,
): Book[] {
  return books.filter((b) => b.seriesId === seriesId);
}

/** Clone a series character into the active book roster (new id). */
export function cloneSeriesCharacterIntoBook(
  book: Book,
  character: Character,
): { book: Book; character: Character; alreadyHad: boolean } {
  const existing = findCharacterByName(book.characters ?? [], character.name);
  if (existing) {
    return { book, character: existing, alreadyHad: true };
  }
  const clone = createCharacter({
    ...structuredClone(character),
    id: createId(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  return {
    book: {
      ...book,
      characters: [...(book.characters ?? []), clone],
      updatedAt: Date.now(),
    },
    character: clone,
    alreadyHad: false,
  };
}

/** Clone a series location into the active book atlas (new id). */
export function cloneSeriesLocationIntoBook(
  book: Book,
  location: Location,
): { book: Book; location: Location; alreadyHad: boolean } {
  const existing = findLocationByName(book.locations ?? [], location.name);
  if (existing) {
    return { book, location: existing, alreadyHad: true };
  }
  const clone = createLocation({
    ...structuredClone(location),
    id: createId(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  return {
    book: {
      ...book,
      locations: [...(book.locations ?? []), clone],
      updatedAt: Date.now(),
    },
    location: clone,
    alreadyHad: false,
  };
}

/** Promote a book character into the series bible (by name, no overwrite of richer entry). */
export function promoteCharacterToSeries(
  series: Series,
  character: Character,
): Series {
  const existing = findCharacterByName(series.characters, character.name);
  if (existing) {
    const existingLen =
      (existing.wiki?.length ?? 0) + (existing.shortBio?.length ?? 0);
    const incomingLen =
      (character.wiki?.length ?? 0) + (character.shortBio?.length ?? 0);
    if (incomingLen <= existingLen) return series;
    return {
      ...series,
      characters: series.characters.map((c) =>
        c.id === existing.id
          ? createCharacter({
              ...structuredClone(character),
              id: existing.id,
              createdAt: existing.createdAt,
              updatedAt: Date.now(),
            })
          : c,
      ),
      updatedAt: Date.now(),
    };
  }
  return {
    ...series,
    characters: [
      ...series.characters,
      createCharacter({
        ...structuredClone(character),
        id: createId(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    ],
    updatedAt: Date.now(),
  };
}

export function promoteLocationToSeries(
  series: Series,
  location: Location,
): Series {
  const existing = findLocationByName(series.locations, location.name);
  if (existing) {
    const existingLen =
      (existing.wiki?.length ?? 0) + (existing.shortBio?.length ?? 0);
    const incomingLen =
      (location.wiki?.length ?? 0) + (location.shortBio?.length ?? 0);
    if (incomingLen <= existingLen) return series;
    return {
      ...series,
      locations: series.locations.map((l) =>
        l.id === existing.id
          ? createLocation({
              ...structuredClone(location),
              id: existing.id,
              createdAt: existing.createdAt,
              updatedAt: Date.now(),
            })
          : l,
      ),
      updatedAt: Date.now(),
    };
  }
  return {
    ...series,
    locations: [
      ...series.locations,
      createLocation({
        ...structuredClone(location),
        id: createId(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    ],
    updatedAt: Date.now(),
  };
}

/** Series cast/places not yet on this book’s roster (by name). */
export function seriesCharactersMissingFromBook(
  series: Series | undefined,
  book: Book,
): Character[] {
  if (!series) return [];
  return series.characters.filter(
    (c) => !findCharacterByName(book.characters ?? [], c.name),
  );
}

export function seriesLocationsMissingFromBook(
  series: Series | undefined,
  book: Book,
): Location[] {
  if (!series) return [];
  return series.locations.filter(
    (l) => !findLocationByName(book.locations ?? [], l.name),
  );
}
