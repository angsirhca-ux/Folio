import type {
  Book,
  Character,
  EncyclopediaEntry,
  EncyclopediaStack,
  FolioLibrary,
  Location,
  Series,
} from "./types";
import { createId } from "./utils";
import { createCharacter, findCharacterByName } from "./characters";
import { createLocation, findLocationByName } from "./locations";
import {
  createEncyclopediaEntry,
  createEncyclopediaStack,
  ensureEncyclopediaStackNamed,
  findEncyclopediaByTitle,
  findStackByName,
  sortEncyclopediaStacks,
} from "./encyclopedia";

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
    encyclopedia: partial?.encyclopedia ?? [],
    encyclopediaStacks: partial?.encyclopediaStacks ?? [],
    createdAt: partial?.createdAt ?? now,
    updatedAt: partial?.updatedAt ?? now,
  };
}

export function hydrateSeries(raw: Partial<Series> | null | undefined): Series {
  const base = createSeries(raw ?? undefined);
  let stacks: EncyclopediaStack[] = [];
  for (const [i, s] of [...(raw?.encyclopediaStacks ?? [])].entries()) {
    stacks.push(
      createEncyclopediaStack(
        {
          ...s,
          name: s?.name || "Untitled stack",
          order: s?.order ?? i,
        },
        stacks,
      ),
    );
  }
  const encyclopedia = (raw?.encyclopedia ?? []).map((e) => {
    let stackId = e?.stackId ?? "";
    if (!stackId || !stacks.some((s) => s.id === stackId)) {
      const ensured = ensureEncyclopediaStackNamed(stacks, "General");
      stacks = ensured.stacks;
      stackId = ensured.stack.id;
    }
    return createEncyclopediaEntry({
      ...e,
      title: e?.title?.trim() || "Untitled",
      stackId,
    });
  });
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
    encyclopediaStacks: sortEncyclopediaStacks(stacks),
    encyclopedia,
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

/**
 * Clone a series encyclopedia article into the book.
 * Matches stacks by name; creates the stack on the book if needed.
 */
export function cloneSeriesEncyclopediaIntoBook(
  book: Book,
  entry: EncyclopediaEntry,
  seriesStacks: EncyclopediaStack[],
): { book: Book; entry: EncyclopediaEntry; alreadyHad: boolean } {
  const existing = findEncyclopediaByTitle(book.encyclopedia ?? [], entry.title);
  if (existing) {
    return { book, entry: existing, alreadyHad: true };
  }

  let stacks = [...(book.encyclopediaStacks ?? [])];
  const seriesStack = seriesStacks.find((s) => s.id === entry.stackId);
  const stackName = seriesStack?.name ?? "General";
  const hadStack = Boolean(findStackByName(stacks, stackName));
  const ensured = ensureEncyclopediaStackNamed(stacks, stackName);
  stacks = ensured.stacks;
  if (!hadStack && seriesStack?.color) {
    stacks = stacks.map((s) =>
      s.id === ensured.stack.id ? { ...s, color: seriesStack.color } : s,
    );
  }

  const clone = createEncyclopediaEntry({
    ...structuredClone(entry),
    id: createId(),
    stackId: ensured.stack.id,
    memberIds: [], // membership is book-local cast
    memberLocationIds: [],
    continuityNotes: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  return {
    book: {
      ...book,
      encyclopediaStacks: sortEncyclopediaStacks(stacks),
      encyclopedia: [...(book.encyclopedia ?? []), clone],
      updatedAt: Date.now(),
    },
    entry: clone,
    alreadyHad: false,
  };
}

export function promoteEncyclopediaToSeries(
  series: Series,
  entry: EncyclopediaEntry,
  bookStacks: EncyclopediaStack[],
): Series {
  let stacks = [...(series.encyclopediaStacks ?? [])];
  const bookStack = bookStacks.find((s) => s.id === entry.stackId);
  const stackName = bookStack?.name ?? "General";
  const hadStack = Boolean(findStackByName(stacks, stackName));
  const ensured = ensureEncyclopediaStackNamed(stacks, stackName);
  stacks = ensured.stacks;
  if (!hadStack && bookStack?.color) {
    stacks = stacks.map((s) =>
      s.id === ensured.stack.id ? { ...s, color: bookStack.color } : s,
    );
  }

  const existing = findEncyclopediaByTitle(series.encyclopedia ?? [], entry.title);
  const payload = createEncyclopediaEntry({
    ...structuredClone(entry),
    stackId: ensured.stack.id,
    memberIds: [],
    memberLocationIds: [],
    continuityNotes: entry.continuityNotes ?? [],
  });

  if (existing) {
    const existingLen =
      (existing.wiki?.length ?? 0) + (existing.shortBio?.length ?? 0);
    const incomingLen =
      (entry.wiki?.length ?? 0) + (entry.shortBio?.length ?? 0);
    if (incomingLen <= existingLen) {
      return {
        ...series,
        encyclopediaStacks: sortEncyclopediaStacks(stacks),
        updatedAt: Date.now(),
      };
    }
    return {
      ...series,
      encyclopediaStacks: sortEncyclopediaStacks(stacks),
      encyclopedia: (series.encyclopedia ?? []).map((e) =>
        e.id === existing.id
          ? createEncyclopediaEntry({
              ...payload,
              id: existing.id,
              createdAt: existing.createdAt,
              updatedAt: Date.now(),
            })
          : e,
      ),
      updatedAt: Date.now(),
    };
  }

  return {
    ...series,
    encyclopediaStacks: sortEncyclopediaStacks(stacks),
    encyclopedia: [
      ...(series.encyclopedia ?? []),
      createEncyclopediaEntry({
        ...payload,
        id: createId(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    ],
    updatedAt: Date.now(),
  };
}

export function seriesEncyclopediaMissingFromBook(
  series: Series | undefined,
  book: Book,
): EncyclopediaEntry[] {
  if (!series) return [];
  return (series.encyclopedia ?? []).filter(
    (e) => !findEncyclopediaByTitle(book.encyclopedia ?? [], e.title),
  );
}
