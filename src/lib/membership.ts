import type { Book } from "./types";

function uniq(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))];
}

/**
 * Set cast members on an encyclopedia card and mirror onto
 * each character’s `belongsToIds`.
 */
export function setEncyclopediaCharacterMembers(
  book: Book,
  entryId: string,
  characterIds: string[],
): Book {
  const wanted = new Set(uniq(characterIds));
  const encyclopedia = (book.encyclopedia ?? []).map((e) =>
    e.id === entryId
      ? { ...e, memberIds: [...wanted], updatedAt: Date.now() }
      : e,
  );
  const characters = (book.characters ?? []).map((c) => {
    const has = (c.belongsToIds ?? []).includes(entryId);
    const should = wanted.has(c.id);
    if (has === should) return c;
    const belongsToIds = should
      ? uniq([...(c.belongsToIds ?? []), entryId])
      : (c.belongsToIds ?? []).filter((id) => id !== entryId);
    return { ...c, belongsToIds, updatedAt: Date.now() };
  });
  return { ...book, encyclopedia, characters, updatedAt: Date.now() };
}

/**
 * Set encyclopedia cards a character belongs to; mirror onto
 * each card’s `memberIds`.
 */
export function setCharacterBelongsTo(
  book: Book,
  characterId: string,
  entryIds: string[],
): Book {
  const wanted = new Set(uniq(entryIds));
  const characters = (book.characters ?? []).map((c) =>
    c.id === characterId
      ? { ...c, belongsToIds: [...wanted], updatedAt: Date.now() }
      : c,
  );
  const encyclopedia = (book.encyclopedia ?? []).map((e) => {
    const has = (e.memberIds ?? []).includes(characterId);
    const should = wanted.has(e.id);
    if (has === should) return e;
    const memberIds = should
      ? uniq([...(e.memberIds ?? []), characterId])
      : (e.memberIds ?? []).filter((id) => id !== characterId);
    return { ...e, memberIds, updatedAt: Date.now() };
  });
  return { ...book, encyclopedia, characters, updatedAt: Date.now() };
}

/**
 * Set place members on an encyclopedia card; mirror onto
 * each location’s `belongsToIds`.
 */
export function setEncyclopediaLocationMembers(
  book: Book,
  entryId: string,
  locationIds: string[],
): Book {
  const wanted = new Set(uniq(locationIds));
  const encyclopedia = (book.encyclopedia ?? []).map((e) =>
    e.id === entryId
      ? { ...e, memberLocationIds: [...wanted], updatedAt: Date.now() }
      : e,
  );
  const locations = (book.locations ?? []).map((l) => {
    const has = (l.belongsToIds ?? []).includes(entryId);
    const should = wanted.has(l.id);
    if (has === should) return l;
    const belongsToIds = should
      ? uniq([...(l.belongsToIds ?? []), entryId])
      : (l.belongsToIds ?? []).filter((id) => id !== entryId);
    return { ...l, belongsToIds, updatedAt: Date.now() };
  });
  return { ...book, encyclopedia, locations, updatedAt: Date.now() };
}

/**
 * Set encyclopedia cards a place belongs to; mirror onto
 * each card’s `memberLocationIds`.
 */
export function setLocationBelongsTo(
  book: Book,
  locationId: string,
  entryIds: string[],
): Book {
  const wanted = new Set(uniq(entryIds));
  const locations = (book.locations ?? []).map((l) =>
    l.id === locationId
      ? { ...l, belongsToIds: [...wanted], updatedAt: Date.now() }
      : l,
  );
  const encyclopedia = (book.encyclopedia ?? []).map((e) => {
    const has = (e.memberLocationIds ?? []).includes(locationId);
    const should = wanted.has(e.id);
    if (has === should) return e;
    const memberLocationIds = should
      ? uniq([...(e.memberLocationIds ?? []), locationId])
      : (e.memberLocationIds ?? []).filter((id) => id !== locationId);
    return { ...e, memberLocationIds, updatedAt: Date.now() };
  });
  return { ...book, encyclopedia, locations, updatedAt: Date.now() };
}
