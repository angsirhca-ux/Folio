import type {
  AppSettings,
  Book,
  Chapter,
  FolioLibrary,
  Scene,
  Series,
  TrashedBook,
} from "./types";
import { DEFAULT_SETTINGS } from "./types";
import { createId } from "./utils";
import { createScene, ensureChapterScenes } from "./scenes";
import {
  createCharacter,
  createRelationship,
  ensureBookCharacters,
} from "./characters";
import {
  ensureBookFamilyTrees,
} from "./familyTrees";
import {
  createLocation,
  createLocationConnection,
  ensureBookLocations,
} from "./locations";
import {
  createResearchEntry,
  createResearchSource,
  ensureBookResearch,
} from "./research";
import {
  ensureBookEncyclopedia,
  syncEncyclopediaFromManuscript,
  createEncyclopediaEntry,
  createEncyclopediaStack,
} from "./encyclopedia";
import { ensureBookChronicle } from "./chronicle";
import { ensureBookSoundtrack } from "./soundtrack";
import { ensureBookManuscriptIndex } from "./manuscriptIndex";
import {
  bookSceneCount,
  bookWordCount,
  createTrashedBook,
  ensureBookTrash,
} from "./trash";
import {
  emptyDevelopmentalEditor,
  ensureDevelopmentalEditor,
} from "./developmentalEditor";
import { emptyBetaReaders, ensureBetaReaders } from "./betaReaders";
import { emptyCritique, ensureCritique } from "./critique";
import { emptyDump, ensureBookDump } from "./dump";
import { emptyStoryMap, ensureBookMap, sampleMapForLocations } from "./map";
import { emptyGoals, ensureBookGoals } from "./goals";
import { ensureBookPlotThreads } from "./plotThreads";
import { ensureLibrarySeries, hydrateSeries } from "./series";
import { syncChapterTitleField } from "./chapterHeading";

const BOOK_KEY = "folio:book";
const LIBRARY_KEY = "folio:library";
const SETTINGS_KEY = "folio:settings";

export { createId, bookWordCount, bookSceneCount };

function withScenes(chapter: Omit<Chapter, "scenes"> & { scenes?: Scene[] }): Chapter {
  return ensureChapterScenes({
    ...chapter,
    scenes: chapter.scenes ?? [],
  });
}

export function createEmptyBook(): Book {
  const chapterId = createId();
  const now = Date.now();
  const scene = createScene({ title: "Untitled Scene", status: "outline" });
  const map = emptyStoryMap("Map");

  return {
    id: createId(),
    title: "Untitled Manuscript",
    author: "",
    activeChapterId: chapterId,
    createdAt: now,
    updatedAt: now,
    characters: [],
    familyTrees: [],
    locations: [],
    research: [],
    encyclopedia: [],
    encyclopediaStacks: [],
    chronicle: [],
    soundtrack: [],
    soundtrackArc: "",
    soundtrackTaste: [],
    trash: [],
    map,
    maps: [map],
    activeMapId: map.id,
    developmentalEditor: emptyDevelopmentalEditor(),
    betaReaders: emptyBetaReaders(),
    critique: emptyCritique(),
    dump: emptyDump(),
    seriesId: null,
    plotThreads: [],
    goals: emptyGoals(0, now),
    chapters: [
      {
        id: chapterId,
        title: "Chapter One",
        summary: "",
        notes: "",
        createdAt: now,
        updatedAt: now,
        content: `<h1>Chapter One</h1><p></p>`,
        scenes: [scene],
      },
    ],
  };
}

export function createSampleBook(): Book {
  const chapterId = createId();
  const chapterTwoId = createId();
  const now = Date.now();

  const opening = createScene({
    title: "Arrival",
    synopsis:
      "Morning light across a blank page. She listens to the house settle before the first sentence arrives.",
    status: "final",
    pov: "Elena",
    labels: ["opening", "atmosphere"],
    characters: ["Elena"],
    location: "Study",
    notes: "Establish the quiet before the story turns.",
    act: "I",
    wordCount: 1840,
  });

  const garden = createScene({
    title: "Meeting",
    synopsis:
      "Mist softens the garden. A thrush repeats the same patient phrase while she weighs the cost of beginning.",
    status: "revising",
    pov: "Elena",
    labels: ["motif"],
    characters: ["Elena", "Marcus"],
    location: "Garden",
    act: "I",
    wordCount: 1260,
  });

  const discovery = createScene({
    title: "Discovery",
    synopsis:
      "A drawer yields letters she never meant to keep. The ink has faded; the intention has not.",
    status: "writing",
    pov: "Elena",
    labels: ["reveal"],
    characters: ["Elena"],
    location: "Study",
    act: "I",
    wordCount: 920,
  });

  const conflict = createScene({
    title: "Conflict",
    synopsis:
      "Marcus arrives with a question that cannot be answered kindly. The room tightens.",
    status: "draft",
    pov: "Marcus",
    labels: ["tension"],
    characters: ["Elena", "Marcus"],
    location: "Study",
    act: "I",
    wordCount: 1100,
  });

  const escape = createScene({
    title: "Departure",
    synopsis: "She leaves before dusk. The house holds its breath behind her.",
    status: "outline",
    pov: "Elena",
    labels: ["closing"],
    characters: ["Elena"],
    location: "Street",
    act: "I",
    wordCount: 0,
  });

  const journey = createScene({
    title: "Journey",
    synopsis:
      "Walking through familiar streets that feel newly strange. The story tightens its hold.",
    status: "draft",
    pov: "Elena",
    characters: ["Elena"],
    location: "Town",
    act: "II",
    wordCount: 800,
  });

  const campfire = createScene({
    title: "Campfire",
    synopsis:
      "Strangers share warmth and half-truths. She listens more than she speaks.",
    status: "outline",
    pov: "Elena",
    characters: ["Elena", "Marcus"],
    location: "Riverbank",
    act: "II",
    wordCount: 0,
  });

  const attack = createScene({
    title: "What waits",
    synopsis: "What was waiting in the dark arrives without ceremony.",
    status: "outline",
    pov: "Marcus",
    characters: ["Marcus", "Elena"],
    location: "Riverbank",
    act: "II",
    wordCount: 0,
  });

  const elena = createCharacter({
    name: "Elena",
    role: "protagonist",
    shortBio: "A woman who listens to houses before she writes.",
    identity: {
      age: "",
      occupation: "Writer",
      appearance: "",
      distinguishing: "",
    },
    relationships: [
      createRelationship({
        toName: "Marcus",
        label: "Complicated history",
        notes: "A question that cannot be answered kindly.",
      }),
    ],
    tags: ["pov"],
  });

  const marcus = createCharacter({
    name: "Marcus",
    role: "deuteragonist",
    shortBio: "Arrives with questions; stays longer than welcome.",
    tags: [],
  });

  const studyLoc = createLocation({
    name: "Study",
    kind: "interior",
    shortBio: "Where the blank page waits.",
    inhabitants: ["Elena"],
    tags: ["opening"],
  });

  const gardenLoc = createLocation({
    name: "Garden",
    kind: "exterior",
    shortBio: "Mist and a patient thrush.",
    connections: [
      createLocationConnection({
        toName: "Study",
        label: "opens from",
      }),
    ],
    tags: [],
  });

  const streetLoc = createLocation({
    name: "Street",
    kind: "exterior",
    shortBio: "Where she leaves before dusk.",
    tags: [],
  });

  const townLoc = createLocation({
    name: "Town",
    kind: "settlement",
    shortBio: "Familiar streets that feel newly strange.",
    tags: [],
  });

  const riverbankLoc = createLocation({
    name: "Riverbank",
    kind: "exterior",
    shortBio: "Warmth, half-truths, and what waits in the dark.",
    inhabitants: ["Marcus", "Elena"],
    tags: [],
  });

  const lettersTopic = createResearchEntry({
    title: "The unread letters",
    kind: "motif",
    shortBio: "Paper that outlives intention — kept, faded, unanswered.",
    wiki: "A drawer yields what she swore she would not keep. The letters are older than her resolve; the ink has faded, the intention has not.",
    summary: "Physical proof of a past she cannot kindly answer.",
    questions: "Who wrote them? Why keep them unburned?",
    sources: [
      createResearchSource({
        title: "Manuscript — Discovery",
        quote:
          "A drawer yields letters she never meant to keep. The ink has faded; the intention has not.",
        notes: "From the page",
      }),
    ],
    linkedCharacters: ["Elena"],
    linkedLocations: ["Study"],
    tags: ["opening", "object"],
  });

  const houseTopic = createResearchEntry({
    title: "The house as witness",
    kind: "theme",
    shortBio: "Walls that settle before anyone speaks.",
    wiki: "The house listens. It holds its breath for the first sentence and again when she leaves before dusk.",
    summary: "Setting as moral pressure — silence mistaken for safety.",
    questions: "Is the house protector or accomplice?",
    linkedCharacters: ["Elena", "Marcus"],
    linkedLocations: ["Study", "Garden", "Street"],
    tags: ["atmosphere"],
  });

  const duskTopic = createResearchEntry({
    title: "Leaving before dusk",
    kind: "motif",
    shortBio: "Departure timed to avoid the question that cannot be answered kindly.",
    wiki: "Still thin — the gesture repeats: exit before night asks her to stay.",
    linkedCharacters: ["Elena"],
    linkedLocations: ["Street"],
    tags: [],
  });

  const customsStack = createEncyclopediaStack({
    name: "Customs",
    order: 0,
  });

  const duskCustom = createEncyclopediaEntry({
    title: "Leaving before dusk",
    stackId: customsStack.id,
    shortBio: "In this town, serious conversations end before the light fails.",
    wiki: "A local custom more felt than spoken: if you stay past dusk, you owe an answer. Elena keeps leaving.",
    summary: "Social rule that shapes exits and unfinished talk.",
    linkedCharacters: ["Elena"],
    linkedLocations: ["Street"],
    tags: ["sample"],
  });

  return {
    id: createId(),
    title: "Untitled Manuscript",
    author: "",
    activeChapterId: chapterId,
    createdAt: now,
    updatedAt: now,
    characters: [elena, marcus],
    familyTrees: [],
    locations: [studyLoc, gardenLoc, streetLoc, townLoc, riverbankLoc],
    research: [lettersTopic, houseTopic, duskTopic],
    encyclopedia: [duskCustom],
    encyclopediaStacks: [customsStack],
    chronicle: [],
    soundtrack: [],
    soundtrackArc: "",
    soundtrackTaste: [],
    trash: [],
    map: sampleMapForLocations([
      studyLoc,
      gardenLoc,
      streetLoc,
      townLoc,
      riverbankLoc,
    ]),
    maps: [],
    activeMapId: "",
    developmentalEditor: emptyDevelopmentalEditor(),
    betaReaders: emptyBetaReaders(),
    critique: emptyCritique(),
    dump: emptyDump(),
    seriesId: null,
    plotThreads: [],
    goals: emptyGoals(0, now),
    chapters: [
      {
        id: chapterId,
        title: "Chapter One",
        summary: "Elena wakes to a quiet morning and meets Marcus again.",
        notes: "",
        createdAt: now,
        updatedAt: now,
        content: `<h1>Chapter One</h1><p>The morning light fell across the desk in a quiet ribbon, and for a moment the blank page seemed less empty than waiting. She sat with her hands still, listening to the house settle, as if the walls themselves were holding their breath for the first sentence.</p><p class="scene-break" data-type="scene-break">* * *</p><p>Mist softens the garden. A thrush repeats the same patient phrase while she weighs the cost of beginning—and of meeting him again.</p><p class="scene-break" data-type="scene-break">* * *</p><p>A drawer yields letters she never meant to keep. The ink has faded; the intention has not.</p><p class="scene-break" data-type="scene-break">* * *</p><p>Marcus arrives with a question that cannot be answered kindly. The room tightens around them both.</p><p class="scene-break" data-type="scene-break">* * *</p><p>She leaves before dusk. The house holds its breath behind her.</p>`,
        scenes: [opening, garden, discovery, conflict, escape],
      },
      {
        id: chapterTwoId,
        title: "Chapter Two",
        summary: "She walks familiar streets that feel newly strange.",
        notes: "",
        createdAt: now,
        updatedAt: now,
        content: `<h1>Chapter Two</h1><p>Walking through familiar streets that feel newly strange. The story tightens its hold.</p><p class="scene-break" data-type="scene-break">* * *</p><p>Strangers share warmth and half-truths. She listens more than she speaks.</p><p class="scene-break" data-type="scene-break">* * *</p><p>What was waiting in the dark arrives without ceremony.</p>`,
        scenes: [journey, campfire, attack],
      },
    ],
  };
}

function hydrateBook(
  book: Omit<
    Book,
    | "characters"
    | "locations"
    | "research"
    | "encyclopedia"
    | "chronicle"
    | "soundtrack"
    | "trash"
    | "developmentalEditor"
    | "betaReaders"
    | "dump"
    | "map"
    | "maps"
    | "activeMapId"
    | "goals"
    | "plotThreads"
    | "manuscriptIndex"
  > & {
    characters?: Book["characters"];
    locations?: Book["locations"];
    research?: Book["research"];
    encyclopedia?: Book["encyclopedia"];
    chronicle?: Book["chronicle"];
    soundtrack?: Book["soundtrack"];
    trash?: Book["trash"];
    developmentalEditor?: Book["developmentalEditor"];
    betaReaders?: Book["betaReaders"];
    critique?: Book["critique"];
    dump?: Book["dump"];
    map?: Book["map"];
    maps?: Book["maps"];
    activeMapId?: Book["activeMapId"];
    seriesId?: Book["seriesId"];
    goals?: Book["goals"];
    plotThreads?: Book["plotThreads"];
    manuscriptIndex?: Book["manuscriptIndex"];
  },
): Book {
  return ensureBookDump(
    ensureCritique(
      ensureBetaReaders(
        ensureBookPlotThreads(
          ensureBookGoals(
            ensureBookMap(
              ensureDevelopmentalEditor(
                ensureBookTrash(
                  ensureBookManuscriptIndex(
                    ensureBookSoundtrack(
                      ensureBookChronicle(
                        syncEncyclopediaFromManuscript(
                          ensureBookResearch(
                            ensureBookEncyclopedia(
                              ensureBookFamilyTrees(
                                ensureBookLocations(
                                  ensureBookCharacters({
                                    ...book,
                                    seriesId: book.seriesId ?? null,
                                    plotThreads: book.plotThreads ?? [],
                                    manuscriptIndex: book.manuscriptIndex,
                                    map: book.map ?? emptyStoryMap(),
                                    maps: book.maps,
                                    activeMapId: book.activeMapId,
                                    encyclopedia: book.encyclopedia ?? [],
                                    encyclopediaStacks: book.encyclopediaStacks ?? [],
                                    chronicle: book.chronicle ?? [],
                                    soundtrack: book.soundtrack ?? [],
                                    soundtrackArc: book.soundtrackArc ?? "",
                                    soundtrackTaste: book.soundtrackTaste ?? [],
                                    familyTrees: book.familyTrees ?? [],
                                    research: book.research ?? [],
                                    chapters: book.chapters.map((c) =>
                                      withScenes(
                                        syncChapterTitleField({
                                          ...c,
                                          summary: c.summary ?? "",
                                          notes: c.notes ?? "",
                                          scenes: c.scenes ?? [],
                                        }),
                                      ),
                                    ),
                                  } as Book),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

function emptyLibrary(): FolioLibrary {
  const sample = hydrateBook(createSampleBook());
  return {
    version: 1,
    activeBookId: sample.id,
    books: [sample],
    series: [],
    trash: [],
  };
}

function hydrateLibrary(raw: Partial<FolioLibrary> & { books?: Book[] }): FolioLibrary {
  const books = (raw.books ?? []).map((b) => hydrateBook(b));
  if (books.length === 0) return emptyLibrary();
  const activeBookId =
    books.find((b) => b.id === raw.activeBookId)?.id ?? books[0].id;
  const trash: TrashedBook[] = (raw.trash ?? []).map((t) => ({
    id: t.id ?? createId(),
    deletedAt: t.deletedAt ?? Date.now(),
    book: hydrateBook(t.book),
  }));
  return ensureLibrarySeries({
    version: 1,
    activeBookId,
    books,
    series: (raw.series ?? []).map((s) => hydrateSeries(s)),
    trash,
  });
}

export function loadLibrary(): FolioLibrary {
  if (typeof window === "undefined") {
    return emptyLibrary();
  }
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    if (raw) {
      return hydrateLibrary(JSON.parse(raw) as FolioLibrary);
    }

    // Migrate legacy single-book storage.
    const legacy = localStorage.getItem(BOOK_KEY);
    if (legacy) {
      const book = hydrateBook(JSON.parse(legacy) as Book);
      const library: FolioLibrary = {
        version: 1,
        activeBookId: book.id,
        books: [book],
        series: [],
        trash: [],
      };
      saveLibrary(library);
      return library;
    }

    const library = emptyLibrary();
    saveLibrary(library);
    return library;
  } catch {
    return emptyLibrary();
  }
}

export function saveLibrary(library: FolioLibrary): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
  // Keep legacy key in sync for safety / older tooling.
  const active =
    library.books.find((b) => b.id === library.activeBookId) ??
    library.books[0];
  if (active) {
    localStorage.setItem(BOOK_KEY, JSON.stringify(active));
  }
}

export function loadBook(): Book {
  const library = loadLibrary();
  return (
    library.books.find((b) => b.id === library.activeBookId) ??
    library.books[0]
  );
}

/** Persist the active manuscript and keep the library shelf in sync. */
export function saveBook(book: Book): void {
  if (typeof window === "undefined") return;
  // Fast path: patch localStorage without re-hydrating every book in the library.
  // Full loadLibrary() was the autosave hitch on large shelves.
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    if (raw) {
      const library = JSON.parse(raw) as FolioLibrary;
      const prior = Array.isArray(library.books) ? library.books : [];
      const exists = prior.some((b) => b && b.id === book.id);
      const books = exists
        ? prior.map((b) => (b && b.id === book.id ? book : b))
        : [...prior, book];
      const next: FolioLibrary = {
        version: 1,
        activeBookId: book.id,
        books: books as Book[],
        series: library.series ?? [],
        trash: library.trash ?? [],
      };
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(next));
      localStorage.setItem(BOOK_KEY, JSON.stringify(book));
      return;
    }
  } catch {
    /* fall through to hydrate path */
  }

  const library = loadLibrary();
  const exists = library.books.some((b) => b.id === book.id);
  const books = exists
    ? library.books.map((b) => (b.id === book.id ? book : b))
    : [...library.books, book];
  saveLibrary({
    ...library,
    activeBookId: book.id,
    books,
  });
}

export function listLibraryBooks(): Book[] {
  return loadLibrary().books;
}

export function getLibraryTrash(): TrashedBook[] {
  return loadLibrary().trash;
}

export function createBookInLibrary(partial?: {
  title?: string;
  author?: string;
}): Book {
  const book = createEmptyBook();
  if (partial?.title?.trim()) book.title = partial.title.trim();
  if (partial?.author != null) book.author = partial.author;
  const library = loadLibrary();
  saveLibrary({
    ...library,
    activeBookId: book.id,
    books: [...library.books, book],
  });
  return book;
}

export function switchActiveBook(bookId: string): Book | null {
  const library = loadLibrary();
  const next = library.books.find((b) => b.id === bookId);
  if (!next) return null;
  saveLibrary({ ...library, activeBookId: bookId });
  return next;
}

export function duplicateBookInLibrary(bookId: string): Book | null {
  const library = loadLibrary();
  const source = library.books.find((b) => b.id === bookId);
  if (!source) return null;
  const copy = hydrateBook({
    ...structuredClone(source),
    id: createId(),
    title: `${source.title || "Untitled"} (copy)`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    trash: [],
  });
  // Fresh chapter ids to avoid collisions if both stay open in sync later
  const idMap = new Map<string, string>();
  copy.chapters = copy.chapters.map((ch) => {
    const newId = createId();
    idMap.set(ch.id, newId);
    return { ...ch, id: newId };
  });
  copy.activeChapterId =
    idMap.get(source.activeChapterId) ?? copy.chapters[0]?.id ?? copy.activeChapterId;
  saveLibrary({
    ...library,
    activeBookId: copy.id,
    books: [...library.books, copy],
  });
  return copy;
}

/** Move a manuscript to library trash. Always leaves at least one open book. */
export function deleteBookToTrash(bookId: string): {
  active: Book;
  library: FolioLibrary;
} {
  const library = loadLibrary();
  const target = library.books.find((b) => b.id === bookId);
  if (!target) {
    return {
      active:
        library.books.find((b) => b.id === library.activeBookId) ??
        library.books[0],
      library,
    };
  }

  const remaining = library.books.filter((b) => b.id !== bookId);
  const trashed = createTrashedBook(target);
  let books = remaining;
  let activeBookId = library.activeBookId;

  if (books.length === 0) {
    const fresh = createEmptyBook();
    books = [fresh];
    activeBookId = fresh.id;
  } else if (activeBookId === bookId) {
    activeBookId = books[0].id;
  }

  const next: FolioLibrary = {
    ...library,
    books,
    activeBookId,
    trash: [trashed, ...library.trash],
  };
  saveLibrary(next);
  return {
    active: books.find((b) => b.id === activeBookId) ?? books[0],
    library: next,
  };
}

export function restoreBookFromTrash(trashId: string): Book | null {
  const library = loadLibrary();
  const item = library.trash.find((t) => t.id === trashId);
  if (!item) return null;
  const book = hydrateBook({
    ...item.book,
    id: library.books.some((b) => b.id === item.book.id)
      ? createId()
      : item.book.id,
    updatedAt: Date.now(),
  });
  const next: FolioLibrary = {
    ...library,
    activeBookId: book.id,
    books: [...library.books, book],
    trash: library.trash.filter((t) => t.id !== trashId),
  };
  saveLibrary(next);
  return book;
}

export function purgeBookFromTrash(trashId: string): FolioLibrary {
  const library = loadLibrary();
  const next = {
    ...library,
    trash: library.trash.filter((t) => t.id !== trashId),
  };
  saveLibrary(next);
  return next;
}

export function emptyLibraryTrash(): FolioLibrary {
  const library = loadLibrary();
  const next = { ...library, trash: [] };
  saveLibrary(next);
  return next;
}

export function listLibrarySeries(): Series[] {
  return loadLibrary().series ?? [];
}

export function saveLibrarySeries(series: Series[]): FolioLibrary {
  const library = loadLibrary();
  const next = ensureLibrarySeries({
    ...library,
    series,
  });
  saveLibrary(next);
  return next;
}

export function upsertSeriesInLibrary(series: Series): FolioLibrary {
  const library = loadLibrary();
  const hydrated = hydrateSeries({ ...series, updatedAt: Date.now() });
  const exists = (library.series ?? []).some((s) => s.id === hydrated.id);
  const list = exists
    ? (library.series ?? []).map((s) => (s.id === hydrated.id ? hydrated : s))
    : [...(library.series ?? []), hydrated];
  return saveLibrarySeries(list);
}

export function deleteSeriesFromLibrary(seriesId: string): FolioLibrary {
  const library = loadLibrary();
  const books = library.books.map((b) =>
    b.seriesId === seriesId ? { ...b, seriesId: null, updatedAt: Date.now() } : b,
  );
  const next: FolioLibrary = {
    ...library,
    books,
    series: (library.series ?? []).filter((s) => s.id !== seriesId),
  };
  saveLibrary(next);
  // Keep active book in sync if it was unlinked
  const active =
    books.find((b) => b.id === library.activeBookId) ?? books[0];
  if (active) saveBook(active);
  return next;
}

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
