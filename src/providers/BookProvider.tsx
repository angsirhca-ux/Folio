"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AppSettings, Book, Chapter, Character, DevelopmentalMemoryNote, DevelopmentalPass, DumpPage, EncyclopediaEntry, EncyclopediaStack, FamilyTree, Location, ManuscriptIndexData, PlotThread, ResearchEntry, StoryMap, StoryMapLabel, StoryMapPath, StoryMapPin, StoryMapRegion, ThemeId, TrashedBook, BetaMemoryNote, BetaReview, CritiqueMemoryNote, CritiqueReview } from "@/lib/types";
import {
  createId,
  createBookInLibrary,
  deleteBookToTrash,
  deleteSeriesFromLibrary,
  duplicateBookInLibrary,
  emptyLibraryTrash,
  loadLibrary,
  loadSettings,
  purgeBookFromTrash,
  restoreBookFromTrash,
  saveBook,
  saveLibrary,
  saveSettings,
  switchActiveBook,
  upsertSeriesInLibrary,
} from "@/lib/storage";
import {
  applyBookBackup,
  applyLibraryBackup,
  downloadBookBackup as downloadBookBackupFile,
  downloadLibraryBackup as downloadLibraryBackupFile,
  FOLIO_BACKUP_FORMAT,
  type FolioBackupPayload,
} from "@/lib/backup";
import {
  applyClarenceAskAnswers,
  type ClarenceAskAnswers,
} from "@/lib/clarenceAsk";
import {
  acknowledgeRemote,
  beginDropboxAuth,
  buildDropboxPayload,
  compareWithRemote,
  disconnectDropbox,
  downloadDropboxLibrary,
  getDropboxStatus,
  uploadDropboxLibrary,
  type DropboxConnectionStatus,
  type FolioDropboxPayload,
} from "@/lib/dropboxSync";
import {
  chooseFolderMirror as pickFolderMirror,
  clearFolderMirror as unlinkFolderMirror,
  getFolderMirrorStatus,
  writeFolderMirror,
  type FolderMirrorStatus,
} from "@/lib/folderMirror";
import {
  createSnapshot,
  deleteSnapshot,
  getSnapshot,
  listSnapshots,
  renameSnapshot,
  diffSnapshotSummary,
  formatSnapshotDiffLines,
  type BookSnapshot,
  type SnapshotKind,
} from "@/lib/snapshots";
import { applyPlotThreadStarter, createPlotThread, toggleThreadId } from "@/lib/plotThreads";
import { applyPlotThreadDiscovery } from "@/lib/plotThreadEnrichment";
import {
  applyChronicleDiscovery,
  type ChronicleDiscoverPayload,
} from "@/lib/chronicleEnrichment";
import type { PlotThreadDiscoverPayload } from "@/lib/plotThreadEnrichment";
import { themes } from "@/lib/themes";
import { parsedToBook } from "@/lib/import/parse";
import type { ParsedManuscript } from "@/lib/import/types";
import {
  extractChapterHeading,
  renumberNumberedChapters,
  replaceChapterHeading,
  syncChapterTitleField,
} from "@/lib/chapterHeading";
import { countWords } from "@/lib/utils";
import { flushManuscriptPending } from "@/lib/manuscriptPendingFlush";
import {
  extractSceneHtmlAt,
  insertSceneHtmlAt,
} from "@/lib/manuscriptScenes";
import {
  appendSceneToChapter,
  createScene,
  findScene,
  moveSceneBetweenChapters,
  replaceSceneHtmlInChapter,
  syncScenesFromManuscript,
} from "@/lib/scenes";
import {
  createCharacter,
  createRelationship,
  findCharacterByName,
  renameCharacterInChapters,
  syncCharactersFromManuscript,
} from "@/lib/characters";
import {
  createLocation,
  createLocationConnection,
  findLocationByName,
  renameLocationInChapters,
  syncLocationsFromManuscript,
} from "@/lib/locations";
import {
  autoPlaceUnpinned,
  emptyStoryMap,
  ensureBookMap,
  replaceActiveMap,
  addStoryMap as addStoryMapToBook,
  setActiveStoryMap as setActiveStoryMapOnBook,
  renameStoryMap as renameStoryMapOnBook,
  removeStoryMap as removeStoryMapFromBook,
  duplicateStoryMap as duplicateStoryMapOnBook,
  removePinFromMap,
  removeRegionFromMap,
  removeLabelFromMap,
  removePathFromMap,
  upsertPinOnMap,
  upsertRegionOnMap,
  upsertLabelOnMap,
  upsertPathOnMap,
  applyMapStarter as applyMapStarterToMap,
} from "@/lib/map";
import {
  createResearchEntry,
  createResearchLink,
  createResearchSource,
  findResearchByTitle,
  syncResearchFromManuscript,
} from "@/lib/research";
import {
  createFamilyTree,
  sortFamilyTrees,
} from "@/lib/familyTrees";
import {
  createEncyclopediaEntry,
  createEncyclopediaLink,
  createEncyclopediaStack,
  applyEncyclopediaStackStarter,
  ensureEncyclopediaStackNamed,
  findEncyclopediaByTitle,
  sortEncyclopediaStacks,
  syncEncyclopediaFromManuscript,
} from "@/lib/encyclopedia";
import {
  createChronicleEvent,
  nextChronicleOrder,
  sortChronicleEvents,
} from "@/lib/chronicle";
import {
  createSoundtrackSong,
  nextSoundtrackOrder,
  sortSoundtrackSongs,
} from "@/lib/soundtrack";
import {
  applySoundtrackCompose,
  type SoundtrackComposePayload,
} from "@/lib/soundtrackCompose";
import type { SoundtrackSong } from "@/lib/types";
import {
  emptyBookTrash,
  purgeTrashItem,
  restoreTrashItem,
  trashChapterFromBook,
  trashCharacterFromBook,
  trashEncyclopediaFromBook,
  trashLocationFromBook,
  trashResearchFromBook,
  trashSceneFromBook,
} from "@/lib/trash";
import {
  applyDevelopmentalFlagPatch,
  mergeDevelopmentalPass,
} from "@/lib/developmentalEditor";
import { mergeBetaReview } from "@/lib/betaReaders";
import { mergeCritiqueReview } from "@/lib/critique";
import { createDumpPage, emptyDump } from "@/lib/dump";
import {
  clampGoalTarget,
  syncGoalsWithWordCount,
} from "@/lib/goals";
import {
  cloneSeriesCharacterIntoBook,
  cloneSeriesEncyclopediaIntoBook,
  cloneSeriesLocationIntoBook,
  cloneSeriesMapIntoBook,
  createSeries as createSeriesRecord,
  findSeries,
  promoteCharacterToSeries,
  promoteEncyclopediaToSeries,
  promoteLocationToSeries,
  promoteMapToSeries,
} from "@/lib/series";
import {
  setCharacterBelongsTo,
  setEncyclopediaCharacterMembers,
  setEncyclopediaLocationMembers,
  setLocationBelongsTo,
} from "@/lib/membership";
import type {
  BookGoals,
  ChronicleEvent,
  Scene,
  SceneStatus,
  Series,
  StoryboardZoom,
  OutlineScale,
} from "@/lib/types";

interface BookContextValue {
  book: Book;
  settings: AppSettings;
  activeChapter: Chapter;
  activeDumpPage: DumpPage;
  wordCount: number;
  isSaving: boolean;
  isDirty: boolean;
  lastSavedAt: number | null;
  hydrated: boolean;
  setTitle: (title: string) => void;
  setAuthor: (author: string) => void;
  /** Pass chapterId when flushing from an editor instance so chapter switches don't mis-attribute prose. */
  updateChapterContent: (content: string, chapterId?: string) => void;
  updateChapterTitle: (chapterId: string, title: string) => void;
  updateChapterSummary: (chapterId: string, summary: string) => void;
  updateChapterNotes: (notes: string) => void;
  addChapter: (afterChapterId?: string) => void;
  /** Retitle “Chapter N” entries to match current order (custom names left alone). */
  renumberChapters: () => void;
  deleteChapter: (chapterId: string) => void;
  deleteManuscript: () => void;
  /** Library shelf — all manuscripts in this browser. */
  libraryBooks: Book[];
  libraryTrash: TrashedBook[];
  /** Library-level series bibles. */
  librarySeries: Series[];
  createBook: (partial?: { title?: string; author?: string }) => string;
  switchBook: (bookId: string) => void;
  duplicateBook: (bookId: string) => string | null;
  deleteBook: (bookId: string) => void;
  restoreLibraryBook: (trashId: string) => void;
  purgeLibraryBook: (trashId: string) => void;
  emptyAllLibraryTrash: () => void;
  createSeries: (title?: string) => string;
  updateSeries: (
    seriesId: string,
    partial: Partial<
      Pick<
        Series,
        | "title"
        | "synopsis"
        | "notes"
        | "characters"
        | "locations"
        | "encyclopedia"
        | "encyclopediaStacks"
        | "maps"
      >
    >,
  ) => void;
  deleteSeries: (seriesId: string) => void;
  assignBookToSeries: (bookId: string, seriesId: string | null) => void;
  bringSeriesCharacterIntoBook: (characterId: string) => string | null;
  bringSeriesLocationIntoBook: (locationId: string) => string | null;
  bringSeriesEncyclopediaIntoBook: (entryId: string) => string | null;
  bringSeriesMapIntoBook: (mapId: string) => string | null;
  promoteCharacterToSeriesBible: (characterId: string) => void;
  promoteLocationToSeriesBible: (locationId: string) => void;
  promoteEncyclopediaToSeriesBible: (entryId: string) => void;
  promoteMapToSeriesBible: (mapId?: string) => void;
  updateGoals: (partial: Partial<BookGoals>) => void;
  /** Words written since this browser session opened the book. */
  sessionWords: number;
  restoreFromTrash: (itemId: string) => void;
  purgeFromTrash: (itemId: string) => void;
  emptyTrash: () => void;
  selectChapter: (chapterId: string) => void;
  selectAdjacentChapter: (direction: "up" | "down") => void;
  moveChapter: (chapterId: string, direction: "up" | "down") => void;
  reorderChapters: (fromIndex: number, toIndex: number) => void;
  replaceManuscript: (parsed: ParsedManuscript) => void;
  addScene: (chapterId?: string) => string;
  updateScene: (
    sceneId: string,
    partial: Partial<
      Pick<
        Scene,
        | "title"
        | "synopsis"
        | "status"
        | "pov"
        | "labels"
        | "wordCount"
        | "characters"
        | "location"
        | "notes"
        | "act"
        | "threadIds"
      >
    >,
  ) => void;
  /** Replace one scene's prose in the chapter manuscript (***-split part). */
  updateSceneContent: (sceneId: string, html: string) => void;
  deleteScene: (sceneId: string) => void;
  duplicateScene: (sceneId: string) => void;
  moveScene: (
    sceneId: string,
    toChapterId: string,
    toIndex: number,
  ) => void;
  convertSceneToChapter: (sceneId: string) => void;
  setStoryboardZoom: (zoom: StoryboardZoom) => void;
  setOutlineScale: (scale: OutlineScale) => void;
  addCharacter: (partial?: Partial<Character> & { name?: string }) => string;
  /** Insert full character records (e.g. Claude discovery) in one write. */
  upsertCharacters: (incoming: Character[]) => void;
  updateCharacter: (
    characterId: string,
    partial: Partial<Omit<Character, "id" | "createdAt">>,
  ) => void;
  replaceCharacter: (character: Character) => void;
  deleteCharacter: (characterId: string) => void;
  addCharacterRelationship: (
    characterId: string,
    partial: { label: string; toCharacterId?: string; toName?: string; notes?: string },
  ) => void;
  updateCharacterRelationship: (
    characterId: string,
    relationshipId: string,
    partial: Partial<{
      label: string;
      toCharacterId: string;
      toName: string;
      notes: string;
    }>,
  ) => void;
  removeCharacterRelationship: (
    characterId: string,
    relationshipId: string,
  ) => void;
  /** Sync character ↔ encyclopedia membership both ways. */
  setCharacterBelongsToEntries: (
    characterId: string,
    entryIds: string[],
  ) => void;
  setEncyclopediaMemberCharacters: (
    entryId: string,
    characterIds: string[],
  ) => void;
  setLocationBelongsToEntries: (
    locationId: string,
    entryIds: string[],
  ) => void;
  setEncyclopediaMemberLocations: (
    entryId: string,
    locationIds: string[],
  ) => void;
  addFamilyTree: (name?: string) => string;
  updateFamilyTree: (
    treeId: string,
    partial: Partial<Omit<FamilyTree, "id" | "createdAt">>,
  ) => void;
  deleteFamilyTree: (treeId: string) => void;
  addLocation: (partial?: Partial<Location> & { name?: string }) => string;
  upsertLocations: (incoming: Location[]) => void;
  updateLocation: (
    locationId: string,
    partial: Partial<Omit<Location, "id" | "createdAt">>,
  ) => void;
  replaceLocation: (location: Location) => void;
  deleteLocation: (locationId: string) => void;
  addLocationConnection: (
    locationId: string,
    partial: {
      label: string;
      toLocationId?: string;
      toName?: string;
      notes?: string;
    },
  ) => void;
  updateLocationConnection: (
    locationId: string,
    connectionId: string,
    partial: Partial<{
      label: string;
      toLocationId: string;
      toName: string;
      notes: string;
    }>,
  ) => void;
  removeLocationConnection: (
    locationId: string,
    connectionId: string,
  ) => void;
  /** Replace the whole story map (pins / labels / regions). */
  updateStoryMap: (map: StoryMap) => void;
  upsertMapPin: (pin: StoryMapPin) => void;
  removeMapPin: (locationIdOrPinId: string) => void;
  upsertMapRegion: (region: StoryMapRegion) => void;
  removeMapRegion: (regionId: string) => void;
  upsertMapLabel: (label: StoryMapLabel) => void;
  removeMapLabel: (labelId: string) => void;
  upsertMapPath: (path: StoryMapPath) => void;
  removeMapPath: (pathId: string) => void;
  /** Place every unpinned atlas location on the corkboard. */
  autoPlaceMapPins: () => void;
  /** Seed the empty board from a map starter pack (city, new world…). */
  applyMapStarter: (starterId: string) => void;
  /** Add a blank map and switch to it. Returns the new map id. */
  addStoryMap: (name?: string) => string;
  setActiveStoryMap: (mapId: string) => void;
  renameStoryMap: (mapId: string, name: string) => void;
  removeStoryMap: (mapId: string) => void;
  duplicateStoryMap: (mapId: string) => void;
  addResearch: (partial?: Partial<ResearchEntry> & { title?: string }) => string;
  upsertResearch: (incoming: ResearchEntry[]) => void;
  updateResearch: (
    entryId: string,
    partial: Partial<Omit<ResearchEntry, "id" | "createdAt">>,
  ) => void;
  replaceResearch: (entry: ResearchEntry) => void;
  deleteResearch: (entryId: string) => void;
  addResearchSource: (
    entryId: string,
    partial: { title: string; citation?: string; quote?: string; notes?: string },
  ) => void;
  updateResearchSource: (
    entryId: string,
    sourceId: string,
    partial: Partial<{
      title: string;
      citation: string;
      quote: string;
      notes: string;
    }>,
  ) => void;
  removeResearchSource: (entryId: string, sourceId: string) => void;
  addResearchLink: (
    entryId: string,
    partial: {
      label: string;
      toEntryId?: string;
      toTitle?: string;
      notes?: string;
    },
  ) => void;
  updateResearchLink: (
    entryId: string,
    linkId: string,
    partial: Partial<{
      label: string;
      toEntryId: string;
      toTitle: string;
      notes: string;
    }>,
  ) => void;
  removeResearchLink: (entryId: string, linkId: string) => void;
  addEncyclopedia: (
    partial?: Partial<EncyclopediaEntry> & { title?: string; stackId?: string },
  ) => string;
  upsertEncyclopedia: (incoming: EncyclopediaEntry[]) => void;
  updateEncyclopedia: (
    entryId: string,
    partial: Partial<Omit<EncyclopediaEntry, "id" | "createdAt">>,
  ) => void;
  replaceEncyclopedia: (entry: EncyclopediaEntry) => void;
  deleteEncyclopedia: (entryId: string) => void;
  addEncyclopediaStack: (name: string, color?: string) => string;
  updateEncyclopediaStack: (
    stackId: string,
    partial: Partial<Pick<EncyclopediaStack, "name" | "color">>,
  ) => void;
  deleteEncyclopediaStack: (stackId: string) => void;
  ensureEncyclopediaStack: (name: string) => string;
  applyEncyclopediaStarter: (starterId: string) => void;
  addEncyclopediaLink: (
    entryId: string,
    partial: {
      label: string;
      toEntryId?: string;
      toTitle?: string;
      notes?: string;
    },
  ) => void;
  updateEncyclopediaLink: (
    entryId: string,
    linkId: string,
    partial: Partial<{
      label: string;
      toEntryId: string;
      toTitle: string;
      notes: string;
    }>,
  ) => void;
  removeEncyclopediaLink: (entryId: string, linkId: string) => void;
  addChronicleEvent: (
    partial?: Partial<ChronicleEvent> & { title?: string },
  ) => string;
  updateChronicleEvent: (
    eventId: string,
    partial: Partial<Omit<ChronicleEvent, "id" | "createdAt">>,
  ) => void;
  deleteChronicleEvent: (eventId: string) => void;
  moveChronicleEvent: (eventId: string, direction: "up" | "down") => void;
  addSoundtrackSong: (
    partial?: Partial<
      Pick<SoundtrackSong, "title" | "artist" | "note" | "placement" | "order">
    >,
  ) => string;
  updateSoundtrackSong: (
    songId: string,
    partial: Partial<
      Pick<SoundtrackSong, "title" | "artist" | "note" | "placement" | "order">
    >,
  ) => void;
  deleteSoundtrackSong: (songId: string) => void;
  moveSoundtrackSong: (songId: string, direction: "up" | "down") => void;
  applySoundtrackFromClaude: (payload: SoundtrackComposePayload) => void;
  /** Apply a developmental-editor pass (flags + memory). Never rewrites prose. */
  applyDevelopmentalReview: (
    pass: DevelopmentalPass,
    memoryUpdates: DevelopmentalMemoryNote[],
  ) => void;
  updateDevelopmentalFlag: (
    passId: string,
    flagId: string,
    partial: Partial<{
      verdict: "liked" | "disliked" | null;
      closed: boolean;
    }>,
  ) => void;
  clearDevelopmentalMemory: () => void;
  clearDevelopmentalPasses: () => void;
  /** Apply a beta-reader review (reactions + craft + memory). Never rewrites prose. */
  applyBetaReview: (
    review: BetaReview,
    memoryUpdates: BetaMemoryNote[],
  ) => void;
  /** Clear beta memory. Omit args to clear the whole book; pass chapter/reader to scope. */
  clearBetaMemory: (scope?: {
    chapterId?: string;
    readerId?: string;
  }) => void;
  /** Drop one reader’s review of a chapter (memory untouched). */
  clearBetaReviewForChapter: (readerId: string, chapterId: string) => void;
  clearBetaReviews: () => void;
  /** Apply a critique checklist review. Never rewrites prose. */
  applyCritiqueReview: (
    review: CritiqueReview,
    memoryUpdates: CritiqueMemoryNote[],
  ) => void;
  clearCritiqueMemory: () => void;
  clearCritiqueReviews: () => void;
  selectDumpPage: (pageId: string) => void;
  addDumpPage: (title?: string) => string;
  deleteDumpPage: (pageId: string) => void;
  updateDumpPageTitle: (pageId: string, title: string) => void;
  updateDumpPageContent: (content: string, pageId?: string) => void;
  reorderDumpPages: (fromIndex: number, toIndex: number) => void;
  addPlotThread: (partial?: Partial<Pick<PlotThread, "name" | "color">>) => string;
  updatePlotThread: (
    threadId: string,
    partial: Partial<Pick<PlotThread, "name" | "color">>,
  ) => void;
  deletePlotThread: (threadId: string) => void;
  /** Preload genre track names (idempotent). Does not assign scenes. */
  applyPlotThreadStarter: (starterId: string) => void;
  toggleSceneThread: (sceneId: string, threadId: string) => void;
  applyPlotThreadsFromClaude: (payload: PlotThreadDiscoverPayload) => void;
  applyChronicleFromClaude: (payload: ChronicleDiscoverPayload) => void;
  setManuscriptIndex: (index: ManuscriptIndexData | undefined) => void;
  /** Persist narrator / notes from Clarence’s pre-populate ask dialog. */
  applyClarenceAsk: (
    answers: ClarenceAskAnswers,
  ) => import("@/lib/clarenceAsk").ApplyNarratorResult;
  /** Jump manuscript editor to a ***–separated scene within a chapter. */
  focusScene: (chapterId: string, sceneIndex: number) => void;
  sceneFocus: { chapterId: string; sceneIndex: number; token: number } | null;
  /** Dropbox sync (App Folder + PKCE). */
  dropboxStatus: DropboxConnectionStatus;
  dropboxSyncing: boolean;
  dropboxConflict: FolioDropboxPayload | null;
  connectDropbox: () => Promise<void>;
  disconnectDropboxAccount: () => void;
  syncDropboxNow: () => Promise<void>;
  resolveDropboxConflict: (choice: "remote" | "local") => Promise<void>;
  refreshDropboxStatus: () => void;
  /** Write-only local folder mirror (Chrome/Edge File System Access). */
  folderMirrorStatus: FolderMirrorStatus;
  folderMirrorWriting: boolean;
  chooseFolderMirror: () => Promise<void>;
  clearFolderMirrorLink: () => Promise<void>;
  writeFolderMirrorNow: () => Promise<void>;
  refreshFolderMirrorStatus: () => void;
  /** Download full library + settings as a Folio backup file. */
  downloadLibraryBackup: () => void;
  /** Download the active book as a Folio book backup. */
  downloadBookBackup: () => void;
  /** Replace library (or merge one book) from a parsed backup file. */
  restoreFromBackup: (payload: FolioBackupPayload) => void;
  /** In-browser version history for the active book. */
  listBookSnapshots: () => BookSnapshot[];
  takeBookSnapshot: (
    label?: string,
    kind?: SnapshotKind,
  ) => BookSnapshot | null;
  renameBookSnapshot: (snapshotId: string, label: string) => boolean;
  restoreBookSnapshot: (snapshotId: string) => boolean;
  deleteBookSnapshot: (snapshotId: string) => void;
  /** What would change if this snapshot were restored. */
  summarizeSnapshotDiff: (snapshotId: string) => string[] | null;
  saveNow: () => void;
  setTheme: (theme: ThemeId) => void;
  toggleFocusMode: () => void;
  toggleFullscreen: () => void;
  toggleSidebar: () => void;
  toggleAppNav: () => void;
  updateSettings: (partial: Partial<AppSettings>) => void;
}

const BookContext = createContext<BookContextValue | null>(null);

export function BookProvider({ children }: { children: ReactNode }) {
  const [book, setBook] = useState<Book | null>(null);
  const [libraryBooks, setLibraryBooks] = useState<Book[]>([]);
  const [libraryTrash, setLibraryTrash] = useState<TrashedBook[]>([]);
  const [librarySeries, setLibrarySeries] = useState<Series[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [sessionBaseline, setSessionBaseline] = useState(0);
  const [dropboxStatus, setDropboxStatus] = useState<DropboxConnectionStatus>(
    () =>
      typeof window === "undefined"
        ? {
            configured: false,
            connected: false,
            email: null,
            displayName: null,
            lastSyncedAt: null,
            lastAckRevision: 0,
            lastRemoteRev: null,
          }
        : getDropboxStatus(),
  );
  const [dropboxSyncing, setDropboxSyncing] = useState(false);
  const [dropboxConflict, setDropboxConflict] =
    useState<FolioDropboxPayload | null>(null);
  const [folderMirrorStatus, setFolderMirrorStatus] =
    useState<FolderMirrorStatus>(() =>
      typeof window === "undefined"
        ? {
            supported: false,
            linked: false,
            folderName: null,
            lastWrittenAt: null,
            lastError: null,
          }
        : getFolderMirrorStatus(),
    );
  const [folderMirrorWriting, setFolderMirrorWriting] = useState(false);
  const [sceneFocus, setSceneFocus] = useState<{
    chapterId: string;
    sceneIndex: number;
    token: number;
  } | null>(null);
  const [snapshotsTick, setSnapshotsTick] = useState(0);
  const skipDirtyRef = useRef(true);
  const dropboxPushTimerRef = useRef<number | null>(null);
  const dropboxBusyRef = useRef(false);
  const folderMirrorTimerRef = useRef<number | null>(null);
  const folderMirrorBusyRef = useRef(false);
  const isDirtyRef = useRef(false);
  const bookRef = useRef(book);
  bookRef.current = book;
  isDirtyRef.current = isDirty;

  const syncLibraryMeta = useCallback((active?: Book | null) => {
    const lib = loadLibrary();
    setLibraryBooks(
      active
        ? lib.books.map((b) => (b.id === active.id ? active : b))
        : lib.books,
    );
    setLibraryTrash(lib.trash);
    setLibrarySeries(lib.series ?? []);
  }, []);

  useEffect(() => {
    const lib = loadLibrary();
    const active =
      lib.books.find((b) => b.id === lib.activeBookId) ?? lib.books[0];
    setBook(active);
    setLibraryBooks(lib.books);
    setLibraryTrash(lib.trash);
    setLibrarySeries(lib.series ?? []);
    setSettings(loadSettings());
    setHydrated(true);
    setLastSavedAt(Date.now());
    setIsDirty(false);
    const wc = active.chapters.reduce(
      (sum, ch) => sum + countWords(ch.content ?? ""),
      0,
    );
    setSessionBaseline(wc);
    window.setTimeout(() => {
      skipDirtyRef.current = false;
    }, 0);
  }, []);

  // Keep cast + atlas wikis in sync when manuscript / scene tags change
  // (cheap key + long debounce so typing never blocks on character scans)
  const manuscriptCastKey = useMemo(() => {
    if (!book) return "";
    return book.chapters
      .map((c) => {
        const sceneKey = (c.scenes ?? [])
          .map(
            (s) =>
              `${s.id}:${s.pov}:${s.location}:${(s.characters ?? []).join(",")}`,
          )
          .join("|");
        return `${c.id}:${c.content.length}:${c.updatedAt}:${sceneKey}`;
      })
      .join(";");
  }, [book]);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      const current = bookRef.current;
      if (!current) return;
      const withChars = syncCharactersFromManuscript(current);
      const withLocs = syncLocationsFromManuscript(withChars);
      const withResearch = syncResearchFromManuscript(withLocs);
      const synced = syncEncyclopediaFromManuscript(withResearch);
      if (synced === current) return;
      skipDirtyRef.current = true;
      setBook(synced);
      saveBook(synced);
      setLibraryBooks((prev) =>
        prev.map((b) => (b.id === synced.id ? synced : b)),
      );
      window.setTimeout(() => {
        skipDirtyRef.current = false;
      }, 0);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [hydrated, manuscriptCastKey]);

  const activeSceneSyncKey = useMemo(() => {
    if (!book) return "";
    const chapter = book.chapters.find((c) => c.id === book.activeChapterId);
    if (!chapter) return "";
    return `${chapter.id}:${chapter.updatedAt}:${chapter.content.length}`;
  }, [book]);

  // Align storyboard scene cards with *** breaks after typing settles
  useEffect(() => {
    if (!hydrated || !activeSceneSyncKey) return;
    const timer = window.setTimeout(() => {
      setBook((current) => {
        if (!current) return current;
        const chapter = current.chapters.find(
          (c) => c.id === current.activeChapterId,
        );
        if (!chapter) return current;
        const synced = syncScenesFromManuscript(chapter);
        if (
          synced.content === chapter.content &&
          synced.scenes.length === chapter.scenes.length &&
          synced.scenes.every(
            (s, i) =>
              s.id === chapter.scenes[i]?.id &&
              s.wordCount === chapter.scenes[i]?.wordCount &&
              s.synopsis === chapter.scenes[i]?.synopsis &&
              s.title === chapter.scenes[i]?.title,
          )
        ) {
          return current;
        }
        skipDirtyRef.current = true;
        window.setTimeout(() => {
          skipDirtyRef.current = false;
        }, 0);
        return {
          ...current,
          chapters: current.chapters.map((c) =>
            c.id === chapter.id ? synced : c,
          ),
        };
      });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [hydrated, activeSceneSyncKey]);

  useEffect(() => {
    if (!hydrated || !book) return;
    if (skipDirtyRef.current) return;

    setIsDirty(true);
    setIsSaving(true);
    const timer = window.setTimeout(() => {
      saveBook(book);
      setLibraryBooks((prev) =>
        prev.map((b) => (b.id === book.id ? book : b)),
      );
      setIsSaving(false);
      setIsDirty(false);
      setLastSavedAt(Date.now());
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [book, hydrated]);

  // Warn if closing the tab with unsaved edits mid-debounce
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!hydrated || !settings) return;
    saveSettings(settings);

    const theme = themes[settings.theme];
    const root = document.documentElement;
    root.dataset.theme = settings.theme;
    root.style.setProperty("--paper", theme.paper);
    root.style.setProperty("--ink", theme.ink);
    root.style.setProperty("--ink-muted", theme.inkMuted);
    root.style.setProperty("--ink-faint", theme.inkFaint);
    root.style.setProperty("--accent", theme.accent);
    root.style.setProperty("--accent-soft", theme.accentSoft);
    root.style.setProperty("--border", theme.border);
    root.style.setProperty("--shadow", theme.shadow);
    root.style.setProperty("--sidebar", theme.sidebar);
    root.style.setProperty("--selection", theme.selection);
    root.style.setProperty("--cursor", theme.cursor);
    root.style.setProperty("--font-size", `${settings.fontSize}px`);
    root.style.setProperty("--line-height", String(settings.lineHeight));
  }, [settings, hydrated]);

  const saveNow = useCallback(() => {
    const current = bookRef.current;
    if (!current) return;

    // TipTap keeps scene breaks / last keystrokes until debounce — pull them in
    // before writing so Save never persists a stale chapter.
    const pending = flushManuscriptPending();
    let toSave = current;
    if (pending) {
      const chapterIdx = current.chapters.findIndex(
        (c) => c.id === pending.documentId,
      );
      if (chapterIdx >= 0) {
        const chapter = current.chapters[chapterIdx]!;
        const heading = extractChapterHeading(pending.html);
        const title =
          heading === null || heading === "" ? chapter.title : heading;
        toSave = {
          ...current,
          chapters: current.chapters.map((c, i) =>
            i === chapterIdx
              ? {
                  ...c,
                  content: pending.html,
                  title,
                  updatedAt: Date.now(),
                }
              : c,
          ),
          updatedAt: Date.now(),
        };
      } else {
        const dump = current.dump;
        const pageIdx = dump?.pages.findIndex(
          (p) => p.id === pending.documentId,
        );
        if (dump && pageIdx != null && pageIdx >= 0) {
          toSave = {
            ...current,
            dump: {
              ...dump,
              pages: dump.pages.map((p, i) =>
                i === pageIdx
                  ? { ...p, content: pending.html, updatedAt: Date.now() }
                  : p,
              ),
            },
            updatedAt: Date.now(),
          };
        }
      }
      if (toSave !== current) {
        skipDirtyRef.current = true;
        bookRef.current = toSave;
        setBook(toSave);
        window.setTimeout(() => {
          skipDirtyRef.current = false;
        }, 0);
      }
    }

    setIsSaving(true);
    saveBook(toSave);
    setLibraryBooks((prev) =>
      prev.map((b) => (b.id === toSave.id ? toSave : b)),
    );
    setIsSaving(false);
    setIsDirty(false);
    setLastSavedAt(Date.now());
  }, []);

  const refreshDropboxStatus = useCallback(() => {
    setDropboxStatus(getDropboxStatus());
  }, []);

  const refreshFolderMirrorStatus = useCallback(() => {
    setFolderMirrorStatus(getFolderMirrorStatus());
  }, []);

  const pushToFolderMirror = useCallback(async () => {
    if (!settings) return;
    if (!getFolderMirrorStatus().linked) return;
    if (folderMirrorBusyRef.current) return;
    folderMirrorBusyRef.current = true;
    setFolderMirrorWriting(true);
    try {
      const next = await writeFolderMirror(loadLibrary(), settings);
      setFolderMirrorStatus(next);
    } finally {
      folderMirrorBusyRef.current = false;
      setFolderMirrorWriting(false);
    }
  }, [settings]);

  const scheduleFolderMirrorWrite = useCallback(() => {
    if (!getFolderMirrorStatus().linked) return;
    if (folderMirrorTimerRef.current) {
      window.clearTimeout(folderMirrorTimerRef.current);
    }
    folderMirrorTimerRef.current = window.setTimeout(() => {
      void pushToFolderMirror();
    }, 1800);
  }, [pushToFolderMirror]);

  const applyDropboxPayload = useCallback(
    (payload: FolioDropboxPayload, remoteRev: string) => {
      skipDirtyRef.current = true;
      applyLibraryBackup({
        format: FOLIO_BACKUP_FORMAT,
        version: payload.version,
        exportedAt: payload.exportedAt,
        library: payload.library,
        settings: payload.settings,
      });
      const lib = loadLibrary();
      const nextSettings = payload.settings ?? loadSettings();
      setSettings(nextSettings);
      setLibraryBooks(lib.books);
      setLibraryTrash(lib.trash);
      setLibrarySeries(lib.series ?? []);
      setBook(
        lib.books.find((b) => b.id === lib.activeBookId) ?? lib.books[0],
      );
      acknowledgeRemote(payload.sync?.revision ?? 0, remoteRev || null);
      setDropboxStatus(getDropboxStatus());
      setDropboxConflict(null);
      setIsDirty(false);
      setLastSavedAt(Date.now());
      window.setTimeout(() => {
        skipDirtyRef.current = false;
      }, 0);
    },
    [],
  );

  const pushToDropbox = useCallback(async () => {
    if (!getDropboxStatus().connected || !settings) return;
    if (dropboxBusyRef.current || dropboxConflict) return;
    dropboxBusyRef.current = true;
    setDropboxSyncing(true);
    try {
      const status = getDropboxStatus();
      const library = loadLibrary();
      const payload = buildDropboxPayload(
        library,
        settings,
        status.lastAckRevision,
      );
      await uploadDropboxLibrary(payload);
      setDropboxStatus(getDropboxStatus());
    } finally {
      dropboxBusyRef.current = false;
      setDropboxSyncing(false);
    }
  }, [settings, dropboxConflict]);

  const pullDropboxIfNeeded = useCallback(async (): Promise<
    "none" | "pull" | "push" | "conflict" | "skipped"
  > => {
    if (!getDropboxStatus().connected) return "skipped";
    if (dropboxBusyRef.current || dropboxConflict) return "skipped";
    // Persist any dirty book before comparing so localDirty is honest.
    if (isDirtyRef.current && bookRef.current) {
      const pending = flushManuscriptPending();
      let local = bookRef.current;
      if (pending) {
        const chapterIdx = local.chapters.findIndex(
          (c) => c.id === pending.documentId,
        );
        if (chapterIdx >= 0) {
          const chapter = local.chapters[chapterIdx]!;
          const heading = extractChapterHeading(pending.html);
          const title =
            heading === null || heading === "" ? chapter.title : heading;
          local = {
            ...local,
            chapters: local.chapters.map((c, i) =>
              i === chapterIdx
                ? {
                    ...c,
                    content: pending.html,
                    title,
                    updatedAt: Date.now(),
                  }
                : c,
            ),
            updatedAt: Date.now(),
          };
          bookRef.current = local;
          skipDirtyRef.current = true;
          setBook(local);
          window.setTimeout(() => {
            skipDirtyRef.current = false;
          }, 0);
        }
      }
      saveBook(local);
      setIsDirty(false);
      setLastSavedAt(Date.now());
      isDirtyRef.current = false;
    }
    dropboxBusyRef.current = true;
    setDropboxSyncing(true);
    try {
      const status = getDropboxStatus();
      const remote = await downloadDropboxLibrary();
      const decision = compareWithRemote(remote, {
        localDirty: isDirtyRef.current,
        lastAckRevision: status.lastAckRevision,
        lastRemoteRev: status.lastRemoteRev,
      });
      if (decision.kind === "pull") {
        if (bookRef.current) {
          try {
            createSnapshot(bookRef.current, "Before Dropbox pull", "auto");
          } catch {
            /* quota */
          }
        }
        applyDropboxPayload(decision.remote.payload, decision.remote.remoteRev);
        return "pull";
      }
      if (decision.kind === "conflict") {
        setDropboxConflict(decision.remote.payload);
        return "conflict";
      }
      if (decision.kind === "push") {
        dropboxBusyRef.current = false;
        setDropboxSyncing(false);
        await pushToDropbox();
        return "push";
      }
      return "none";
    } catch (e) {
      console.warn("[folio] Dropbox sync:", e);
      return "skipped";
    } finally {
      dropboxBusyRef.current = false;
      setDropboxSyncing(false);
      setDropboxStatus(getDropboxStatus());
    }
  }, [applyDropboxPayload, dropboxConflict, pushToDropbox]);

  const scheduleDropboxPush = useCallback(() => {
    if (!getDropboxStatus().connected) return;
    if (dropboxPushTimerRef.current) {
      window.clearTimeout(dropboxPushTimerRef.current);
    }
    dropboxPushTimerRef.current = window.setTimeout(() => {
      void pushToDropbox();
    }, 1800);
  }, [pushToDropbox]);

  // Push to Dropbox shortly after a successful local save.
  useEffect(() => {
    if (!hydrated || !lastSavedAt) return;
    if (!dropboxStatus.connected) return;
    scheduleDropboxPush();
  }, [lastSavedAt, hydrated, dropboxStatus.connected, scheduleDropboxPush]);

  // Write-only local folder mirror on the same debounce.
  useEffect(() => {
    if (!hydrated || !lastSavedAt) return;
    if (!folderMirrorStatus.linked) return;
    scheduleFolderMirrorWrite();
  }, [
    lastSavedAt,
    hydrated,
    folderMirrorStatus.linked,
    scheduleFolderMirrorWrite,
  ]);

  // Pull / conflict-check when visible and on an interval.
  useEffect(() => {
    if (!hydrated || !dropboxStatus.connected) return;
    const tick = () => {
      void pullDropboxIfNeeded();
    };
    const t = window.setTimeout(tick, 1200);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    const interval = window.setInterval(tick, 20_000);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [hydrated, dropboxStatus.connected, pullDropboxIfNeeded]);

  const updateBook = useCallback((updater: (prev: Book) => Book) => {
    setBook((prev) => {
      if (!prev) return prev;
      return { ...updater(prev), updatedAt: Date.now() };
    });
  }, []);

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettings((prev) => (prev ? { ...prev, ...partial } : prev));
  }, []);

  const focusScene = useCallback((chapterId: string, sceneIndex: number) => {
    // Navigate without marking the manuscript dirty
    setBook((prev) => {
      if (!prev || prev.activeChapterId === chapterId) return prev;
      return { ...prev, activeChapterId: chapterId };
    });
    setSceneFocus({
      chapterId,
      sceneIndex,
      token: Date.now(),
    });
  }, []);

  const activeChapter = useMemo(() => {
    if (!book) return null;
    return (
      book.chapters.find((c) => c.id === book.activeChapterId) ??
      book.chapters[0]
    );
  }, [book]);

  const activeDumpPage = useMemo(() => {
    if (!book) return null;
    const dump = book.dump ?? emptyDump();
    return (
      dump.pages.find((p) => p.id === dump.activePageId) ?? dump.pages[0] ?? null
    );
  }, [book]);

  const wordCacheRef = useRef(
    new Map<string, { len: number; updatedAt: number; words: number }>(),
  );

  const wordCount = useMemo(() => {
    if (!book) return 0;
    const cache = wordCacheRef.current;
    const seen = new Set<string>();
    let sum = 0;
    for (const chapter of book.chapters) {
      seen.add(chapter.id);
      const prev = cache.get(chapter.id);
      if (
        prev &&
        prev.len === (chapter.content?.length ?? 0) &&
        prev.updatedAt === chapter.updatedAt
      ) {
        sum += prev.words;
        continue;
      }
      const words = countWords(chapter.content ?? "");
      cache.set(chapter.id, {
        len: chapter.content?.length ?? 0,
        updatedAt: chapter.updatedAt,
        words,
      });
      sum += words;
    }
    for (const id of [...cache.keys()]) {
      if (!seen.has(id)) cache.delete(id);
    }
    return sum;
  }, [book]);

  const sessionWords = Math.max(0, wordCount - sessionBaseline);

  // Keep daily goal progress in sync with live manuscript word count.
  useEffect(() => {
    if (!hydrated) return;
    setBook((prev) => {
      if (!prev?.goals) return prev;
      const wc = prev.chapters.reduce((sum, chapter) => {
        const cached = wordCacheRef.current.get(chapter.id);
        if (
          cached &&
          cached.len === (chapter.content?.length ?? 0) &&
          cached.updatedAt === chapter.updatedAt
        ) {
          return sum + cached.words;
        }
        return sum + countWords(chapter.content);
      }, 0);
      const synced = syncGoalsWithWordCount(prev.goals, wc);
      if (
        synced.dayStartDate === prev.goals.dayStartDate &&
        synced.dayStartWordCount === prev.goals.dayStartWordCount &&
        synced.dayLog.length === prev.goals.dayLog.length &&
        synced.dayLog.every(
          (d, i) =>
            d.date === prev.goals.dayLog[i]?.date &&
            d.wordsWritten === prev.goals.dayLog[i]?.wordsWritten,
        )
      ) {
        return prev;
      }
      skipDirtyRef.current = true;
      window.setTimeout(() => {
        skipDirtyRef.current = false;
      }, 0);
      return { ...prev, goals: synced };
    });
  }, [hydrated, wordCount]);

  const value = useMemo<BookContextValue | null>(() => {
    if (!book || !settings || !activeChapter || !activeDumpPage) return null;

    return {
      book,
      settings,
      activeChapter,
      activeDumpPage,
      wordCount,
      sessionWords,
      isSaving,
      isDirty,
      lastSavedAt,
      hydrated,
      setTitle: (title) => updateBook((b) => ({ ...b, title })),
      setAuthor: (author) => updateBook((b) => ({ ...b, author })),
      updateChapterContent: (content, chapterId) =>
        updateBook((b) => {
          const targetId = chapterId ?? b.activeChapterId;
          return {
            ...b,
            chapters: b.chapters.map((c) => {
              if (c.id !== targetId) return c;
              const heading = extractChapterHeading(content);
              const title =
                heading === null || heading === "" ? c.title : heading;
              if (c.content === content && c.title === title) return c;
              // Keep scene-card sync off the typing path — debounced separately.
              return {
                ...c,
                content,
                title,
                updatedAt: Date.now(),
              };
            }),
          };
        }),
      updateChapterTitle: (chapterId, title) =>
        updateBook((b) => ({
          ...b,
          chapters: b.chapters.map((c) => {
            if (c.id !== chapterId) return c;
            const trimmed = title.trim() || c.title;
            const content = replaceChapterHeading(c.content, trimmed);
            if (c.title === trimmed && c.content === content) return c;
            return { ...c, title: trimmed, content, updatedAt: Date.now() };
          }),
        })),
      updateChapterSummary: (chapterId, summary) =>
        updateBook((b) => ({
          ...b,
          chapters: b.chapters.map((c) =>
            c.id === chapterId
              ? { ...c, summary, updatedAt: Date.now() }
              : c,
          ),
        })),
      updateChapterNotes: (notes) =>
        updateBook((b) => ({
          ...b,
          chapters: b.chapters.map((c) =>
            c.id === b.activeChapterId
              ? { ...c, notes, updatedAt: Date.now() }
              : c,
          ),
        })),
      addChapter: (afterChapterId) => {
        const id = createId();
        const scene = createScene({
          title: "Untitled Scene",
          status: "outline",
        });
        updateBook((b) => {
          const anchorId = afterChapterId || b.activeChapterId;
          const after = b.chapters.findIndex((c) => c.id === anchorId);
          const insertAt = after >= 0 ? after + 1 : b.chapters.length;
          const n = insertAt + 1;
          const chapter = {
            id,
            title: `Chapter ${n}`,
            summary: "",
            content: `<h1>Chapter ${n}</h1><p></p>`,
            notes: "",
            scenes: [scene],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          const chapters = renumberNumberedChapters([
            ...b.chapters.slice(0, insertAt),
            chapter,
            ...b.chapters.slice(insertAt),
          ]);
          return { ...b, activeChapterId: id, chapters };
        });
      },
      renumberChapters: () => {
        const pending = flushManuscriptPending();
        updateBook((b) => {
          let chapters = b.chapters;
          if (pending?.documentId && pending.html != null) {
            chapters = chapters.map((c) =>
              c.id === pending.documentId
                ? {
                    ...c,
                    content: pending.html,
                    title:
                      extractChapterHeading(pending.html)?.trim() || c.title,
                    updatedAt: Date.now(),
                  }
                : c,
            );
          }
          const renumbered = renumberNumberedChapters(chapters);
          if (renumbered === chapters) return b;
          return { ...b, chapters: renumbered };
        });
      },
      deleteChapter: (chapterId) =>
        updateBook((b) => trashChapterFromBook(b, chapterId)),
      deleteManuscript: () => {
        if (!book) return;
        const { active, library } = deleteBookToTrash(book.id);
        skipDirtyRef.current = true;
        setBook(active);
        setLibraryBooks(library.books);
        setLibraryTrash(library.trash);
        setIsDirty(false);
        setLastSavedAt(Date.now());
        window.setTimeout(() => {
          skipDirtyRef.current = false;
        }, 0);
      },
      createBook: (partial) => {
        if (book) saveBook(book);
        const next = createBookInLibrary(partial);
        skipDirtyRef.current = true;
        setBook(next);
        syncLibraryMeta(next);
        setSessionBaseline(0);
        setIsDirty(false);
        setLastSavedAt(Date.now());
        window.setTimeout(() => {
          skipDirtyRef.current = false;
        }, 0);
        return next.id;
      },
      switchBook: (bookId) => {
        if (!book || book.id === bookId) return;
        saveBook(book);
        const next = switchActiveBook(bookId);
        if (!next) return;
        skipDirtyRef.current = true;
        setBook(next);
        syncLibraryMeta(next);
        const wc = next.chapters.reduce(
          (sum, ch) => sum + countWords(ch.content ?? ""),
          0,
        );
        setSessionBaseline(wc);
        setIsDirty(false);
        setLastSavedAt(Date.now());
        window.setTimeout(() => {
          skipDirtyRef.current = false;
        }, 0);
      },
      duplicateBook: (bookId) => {
        if (book) saveBook(book);
        const next = duplicateBookInLibrary(bookId);
        if (!next) return null;
        skipDirtyRef.current = true;
        setBook(next);
        syncLibraryMeta(next);
        const wc = next.chapters.reduce(
          (sum, ch) => sum + countWords(ch.content ?? ""),
          0,
        );
        setSessionBaseline(wc);
        setIsDirty(false);
        setLastSavedAt(Date.now());
        window.setTimeout(() => {
          skipDirtyRef.current = false;
        }, 0);
        return next.id;
      },
      deleteBook: (bookId) => {
        if (book && book.id !== bookId) saveBook(book);
        const { active, library } = deleteBookToTrash(bookId);
        skipDirtyRef.current = true;
        setBook(active);
        setLibraryBooks(library.books);
        setLibraryTrash(library.trash);
        setLibrarySeries(library.series ?? []);
        const wc = active.chapters.reduce(
          (sum, ch) => sum + countWords(ch.content ?? ""),
          0,
        );
        setSessionBaseline(wc);
        setIsDirty(false);
        setLastSavedAt(Date.now());
        window.setTimeout(() => {
          skipDirtyRef.current = false;
        }, 0);
      },
      restoreLibraryBook: (trashId) => {
        if (book) saveBook(book);
        const next = restoreBookFromTrash(trashId);
        if (!next) return;
        skipDirtyRef.current = true;
        setBook(next);
        syncLibraryMeta(next);
        const wc = next.chapters.reduce(
          (sum, ch) => sum + countWords(ch.content ?? ""),
          0,
        );
        setSessionBaseline(wc);
        setIsDirty(false);
        setLastSavedAt(Date.now());
        window.setTimeout(() => {
          skipDirtyRef.current = false;
        }, 0);
      },
      purgeLibraryBook: (trashId) => {
        const library = purgeBookFromTrash(trashId);
        setLibraryTrash(library.trash);
      },
      emptyAllLibraryTrash: () => {
        const library = emptyLibraryTrash();
        setLibraryTrash(library.trash);
      },
      createSeries: (title) => {
        if (book) saveBook(book);
        const series = createSeriesRecord({
          title: title?.trim() || "Untitled series",
        });
        const lib = upsertSeriesInLibrary(series);
        setLibrarySeries(lib.series ?? []);
        return series.id;
      },
      updateSeries: (seriesId, partial) => {
        const current = findSeries(librarySeries, seriesId);
        if (!current) return;
        const next = {
          ...current,
          ...partial,
          title:
            partial.title != null
              ? partial.title.trim() || current.title
              : current.title,
          updatedAt: Date.now(),
        };
        const lib = upsertSeriesInLibrary(next);
        setLibrarySeries(lib.series ?? []);
      },
      deleteSeries: (seriesId) => {
        if (book) saveBook(book);
        const lib = deleteSeriesFromLibrary(seriesId);
        setLibraryBooks(lib.books);
        setLibrarySeries(lib.series ?? []);
        const active =
          lib.books.find((b) => b.id === lib.activeBookId) ?? lib.books[0];
        if (active) setBook(active);
      },
      assignBookToSeries: (bookId, seriesId) => {
        if (book?.id === bookId) {
          updateBook((b) => ({
            ...b,
            seriesId,
            updatedAt: Date.now(),
          }));
          setLibraryBooks((prev) =>
            prev.map((b) =>
              b.id === bookId ? { ...b, seriesId, updatedAt: Date.now() } : b,
            ),
          );
          return;
        }
        const lib = loadLibrary();
        const books = lib.books.map((b) =>
          b.id === bookId ? { ...b, seriesId, updatedAt: Date.now() } : b,
        );
        saveLibrary({ ...lib, books });
        setLibraryBooks(books);
      },
      bringSeriesCharacterIntoBook: (characterId) => {
        const series = findSeries(librarySeries, book.seriesId);
        const character = series?.characters.find((c) => c.id === characterId);
        if (!character) return null;
        let createdId: string | null = null;
        updateBook((b) => {
          const result = cloneSeriesCharacterIntoBook(b, character);
          createdId = result.character.id;
          return result.book;
        });
        return createdId;
      },
      bringSeriesLocationIntoBook: (locationId) => {
        const series = findSeries(librarySeries, book.seriesId);
        const location = series?.locations.find((l) => l.id === locationId);
        if (!location) return null;
        let createdId: string | null = null;
        updateBook((b) => {
          const result = cloneSeriesLocationIntoBook(b, location);
          createdId = result.location.id;
          return result.book;
        });
        return createdId;
      },
      bringSeriesEncyclopediaIntoBook: (entryId) => {
        const series = findSeries(librarySeries, book.seriesId);
        const entry = series?.encyclopedia?.find((e) => e.id === entryId);
        if (!series || !entry) return null;
        let createdId: string | null = null;
        updateBook((b) => {
          const result = cloneSeriesEncyclopediaIntoBook(
            b,
            entry,
            series.encyclopediaStacks ?? [],
          );
          createdId = result.entry.id;
          return result.book;
        });
        return createdId;
      },
      bringSeriesMapIntoBook: (mapId) => {
        const series = findSeries(librarySeries, book.seriesId);
        const seriesMap = series?.maps?.find((m) => m.id === mapId);
        if (!series || !seriesMap) return null;
        let createdId: string | null = null;
        updateBook((b) => {
          const result = cloneSeriesMapIntoBook(b, series, seriesMap);
          createdId = result.map.id;
          return result.book;
        });
        return createdId;
      },
      promoteCharacterToSeriesBible: (characterId) => {
        const series = findSeries(librarySeries, book.seriesId);
        const character = book.characters.find((c) => c.id === characterId);
        if (!series || !character) return;
        const next = promoteCharacterToSeries(series, character);
        const lib = upsertSeriesInLibrary(next);
        setLibrarySeries(lib.series ?? []);
      },
      promoteLocationToSeriesBible: (locationId) => {
        const series = findSeries(librarySeries, book.seriesId);
        const location = book.locations.find((l) => l.id === locationId);
        if (!series || !location) return;
        const next = promoteLocationToSeries(series, location);
        const lib = upsertSeriesInLibrary(next);
        setLibrarySeries(lib.series ?? []);
      },
      promoteEncyclopediaToSeriesBible: (entryId) => {
        const series = findSeries(librarySeries, book.seriesId);
        const entry = (book.encyclopedia ?? []).find((e) => e.id === entryId);
        if (!series || !entry) return;
        const next = promoteEncyclopediaToSeries(
          series,
          entry,
          book.encyclopediaStacks ?? [],
        );
        const lib = upsertSeriesInLibrary(next);
        setLibrarySeries(lib.series ?? []);
      },
      promoteMapToSeriesBible: (mapId) => {
        const series = findSeries(librarySeries, book.seriesId);
        if (!series) return;
        const target =
          (mapId
            ? (book.maps ?? []).find((m) => m.id === mapId)
            : book.map) ?? book.map;
        if (!target) return;
        const next = promoteMapToSeries(series, book, target);
        const lib = upsertSeriesInLibrary(next);
        setLibrarySeries(lib.series ?? []);
      },
      updateGoals: (partial) =>
        updateBook((b) => ({
          ...b,
          goals: {
            ...b.goals,
            ...partial,
            dailyTarget:
              partial.dailyTarget != null
                ? clampGoalTarget(partial.dailyTarget)
                : b.goals.dailyTarget,
            manuscriptTarget:
              partial.manuscriptTarget != null
                ? clampGoalTarget(partial.manuscriptTarget)
                : b.goals.manuscriptTarget,
            deadline:
              partial.deadline != null ? partial.deadline : b.goals.deadline,
            sessionIntention:
              partial.sessionIntention != null
                ? partial.sessionIntention
                : b.goals.sessionIntention,
          },
        })),
      restoreFromTrash: (itemId) =>
        updateBook((b) => restoreTrashItem(b, itemId)),
      purgeFromTrash: (itemId) =>
        updateBook((b) => purgeTrashItem(b, itemId)),
      emptyTrash: () => updateBook((b) => emptyBookTrash(b)),
      selectChapter: (chapterId) =>
        updateBook((b) => ({ ...b, activeChapterId: chapterId })),
      selectAdjacentChapter: (direction) =>
        updateBook((b) => {
          const index = b.chapters.findIndex((c) => c.id === b.activeChapterId);
          if (index < 0) return b;
          const next = direction === "up" ? index - 1 : index + 1;
          if (next < 0 || next >= b.chapters.length) return b;
          return { ...b, activeChapterId: b.chapters[next].id };
        }),
      moveChapter: (chapterId, direction) =>
        updateBook((b) => {
          const fromIndex = b.chapters.findIndex((c) => c.id === chapterId);
          if (fromIndex < 0) return b;
          const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
          if (toIndex < 0 || toIndex >= b.chapters.length) return b;
          const chapters = [...b.chapters];
          const [moved] = chapters.splice(fromIndex, 1);
          chapters.splice(toIndex, 0, moved);
          return { ...b, chapters };
        }),
      reorderChapters: (fromIndex, toIndex) =>
        updateBook((b) => {
          if (
            fromIndex === toIndex ||
            fromIndex < 0 ||
            toIndex < 0 ||
            fromIndex >= b.chapters.length ||
            toIndex >= b.chapters.length
          ) {
            return b;
          }
          const chapters = [...b.chapters];
          const [moved] = chapters.splice(fromIndex, 1);
          chapters.splice(toIndex, 0, moved);
          return { ...b, chapters };
        }),
      replaceManuscript: (parsed) => {
        setBook((prev) => parsedToBook(parsed, prev));
      },
      addScene: (chapterId) => {
        const targetId = chapterId ?? book.activeChapterId;
        let newId = "";
        updateBook((b) => ({
          ...b,
          chapters: b.chapters.map((c) => {
            if (c.id !== targetId) return c;
            const next = appendSceneToChapter(c);
            newId = next.scenes[next.scenes.length - 1]?.id ?? "";
            return next;
          }),
        }));
        return newId;
      },
      updateScene: (sceneId, partial) =>
        updateBook((b) => ({
          ...b,
          chapters: b.chapters.map((c) => ({
            ...c,
            scenes: c.scenes.map((s) =>
              s.id === sceneId
                ? { ...s, ...partial, updatedAt: Date.now() }
                : s,
            ),
          })),
        })),
      updateSceneContent: (sceneId, html) =>
        updateBook((b) => {
          const found = findScene(b.chapters, sceneId);
          if (!found) return b;
          const nextChapter = replaceSceneHtmlInChapter(
            found.chapter,
            found.sceneIndex,
            html,
          );
          if (nextChapter === found.chapter) return b;
          const nextScene = nextChapter.scenes[found.sceneIndex];
          const shouldDraft =
            found.scene.status === "outline" &&
            (nextScene?.wordCount ?? 0) > 0;
          return {
            ...b,
            chapters: b.chapters.map((c, i) => {
              if (i !== found.chapterIndex) return c;
              const chapter = shouldDraft
                ? {
                    ...nextChapter,
                    scenes: nextChapter.scenes.map((s, si) =>
                      si === found.sceneIndex
                        ? {
                            ...s,
                            status: "draft" as const,
                            updatedAt: Date.now(),
                          }
                        : s,
                    ),
                  }
                : nextChapter;
              return syncChapterTitleField(chapter);
            }),
          };
        }),
      deleteScene: (sceneId) =>
        updateBook((b) => trashSceneFromBook(b, sceneId)),
      duplicateScene: (sceneId) =>
        updateBook((b) => {
          const found = findScene(b.chapters, sceneId);
          if (!found) return b;
          const extracted = extractSceneHtmlAt(
            found.chapter.content,
            found.sceneIndex,
          );
          if (!extracted) return b;
          const content = insertSceneHtmlAt(
            found.chapter.content,
            extracted.part,
            found.sceneIndex + 1,
          );
          const copy = createScene({
            title: `${found.scene.title} (copy)`,
            synopsis: found.scene.synopsis,
            status: found.scene.status as SceneStatus,
            pov: found.scene.pov,
            labels: [...found.scene.labels],
            characters: [...found.scene.characters],
            location: found.scene.location,
            notes: found.scene.notes,
            act: found.scene.act,
            wordCount: found.scene.wordCount,
          });
          return {
            ...b,
            chapters: b.chapters.map((c, i) => {
              if (i !== found.chapterIndex) return c;
              const scenes = [...c.scenes];
              scenes.splice(found.sceneIndex + 1, 0, copy);
              return syncScenesFromManuscript({
                ...c,
                content,
                scenes,
              });
            }),
          };
        }),
      moveScene: (sceneId, toChapterId, toIndex) =>
        updateBook((b) => ({
          ...b,
          chapters: moveSceneBetweenChapters(
            b.chapters,
            sceneId,
            toChapterId,
            toIndex,
          ),
        })),
      convertSceneToChapter: (sceneId) =>
        updateBook((b) => {
          const found = findScene(b.chapters, sceneId);
          if (!found) return b;
          const scene = found.scene;
          const newChapterId = createId();
          const title =
            scene.title && scene.title !== "Untitled Scene"
              ? scene.title
              : `Chapter ${b.chapters.length + 1}`;
          const newScene = createScene({
            title: "Untitled Scene",
            synopsis: scene.synopsis,
            status: scene.status,
            pov: scene.pov,
            labels: [...scene.labels],
            characters: [...scene.characters],
            location: scene.location,
            notes: scene.notes,
            act: scene.act,
            wordCount: scene.wordCount,
          });
          let chapters = b.chapters.map((c) => {
            if (c.id !== found.chapter.id) return c;
            const scenes = c.scenes.filter((s) => s.id !== sceneId);
            return {
              ...c,
              scenes:
                scenes.length > 0
                  ? scenes
                  : [createScene({ title: "Untitled Scene" })],
              updatedAt: Date.now(),
            };
          });
          const insertAt = found.chapterIndex + 1;
          chapters = [
            ...chapters.slice(0, insertAt),
            {
              id: newChapterId,
              title,
              summary: scene.synopsis?.trim() ?? "",
              content: `<h1>${title}</h1><p>${scene.synopsis ? "" : ""}</p>`,
              notes: scene.synopsis,
              scenes: [newScene],
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
            ...chapters.slice(insertAt),
          ];
          return {
            ...b,
            chapters,
            activeChapterId: newChapterId,
          };
        }),
      setStoryboardZoom: (zoom) => updateSettings({ storyboardZoom: zoom }),
      setOutlineScale: (scale) => updateSettings({ outlineScale: scale }),
      addCharacter: (partial) => {
        const character = createCharacter({
          ...partial,
          name: partial?.name?.trim() || "New character",
        });
        updateBook((b) => ({
          ...b,
          characters: [...(b.characters ?? []), character],
        }));
        return character.id;
      },
      upsertCharacters: (incoming) => {
        if (!incoming.length) return;
        updateBook((b) => {
          const characters = [...(b.characters ?? [])];
          for (const item of incoming) {
            const existing =
              characters.find((c) => c.id === item.id) ??
              findCharacterByName(characters, item.name);
            if (existing) {
              const idx = characters.findIndex((c) => c.id === existing.id);
              characters[idx] = {
                ...existing,
                ...item,
                id: existing.id,
                createdAt: existing.createdAt,
                updatedAt: Date.now(),
              };
            } else {
              characters.push(item);
            }
          }
          return { ...b, characters };
        });
      },
      updateCharacter: (characterId, partial) =>
        updateBook((b) => {
          const prev = (b.characters ?? []).find((c) => c.id === characterId);
          if (!prev) return b;
          const nextName =
            partial.name !== undefined ? partial.name.trim() || prev.name : prev.name;
          const renamed =
            partial.name !== undefined && nextName !== prev.name
              ? renameCharacterInChapters(b.chapters, prev.name, nextName)
              : b.chapters;
          return {
            ...b,
            chapters: renamed,
            characters: (b.characters ?? []).map((c) =>
              c.id === characterId
                ? {
                    ...c,
                    ...partial,
                    name: nextName,
                    identity: partial.identity
                      ? { ...c.identity, ...partial.identity }
                      : c.identity,
                    psychology: partial.psychology
                      ? { ...c.psychology, ...partial.psychology }
                      : c.psychology,
                    voice: partial.voice
                      ? { ...c.voice, ...partial.voice }
                      : c.voice,
                    arc: partial.arc ? { ...c.arc, ...partial.arc } : c.arc,
                    updatedAt: Date.now(),
                  }
                : c,
            ),
          };
        }),
      replaceCharacter: (character) =>
        updateBook((b) => {
          const list = b.characters ?? [];
          const idx = list.findIndex((c) => c.id === character.id);
          if (idx < 0) {
            return {
              ...b,
              characters: [...list, { ...character, updatedAt: Date.now() }],
            };
          }
          return {
            ...b,
            characters: list.map((c) =>
              c.id === character.id
                ? { ...character, updatedAt: Date.now() }
                : c,
            ),
          };
        }),
      deleteCharacter: (characterId) =>
        updateBook((b) => trashCharacterFromBook(b, characterId)),
      addCharacterRelationship: (characterId, partial) =>
        updateBook((b) => ({
          ...b,
          characters: (b.characters ?? []).map((c) => {
            if (c.id !== characterId) return c;
            return {
              ...c,
              relationships: [
                ...c.relationships,
                createRelationship({
                  label: partial.label,
                  toCharacterId: partial.toCharacterId,
                  toName: partial.toName,
                  notes: partial.notes,
                }),
              ],
              updatedAt: Date.now(),
            };
          }),
        })),
      updateCharacterRelationship: (characterId, relationshipId, partial) =>
        updateBook((b) => ({
          ...b,
          characters: (b.characters ?? []).map((c) => {
            if (c.id !== characterId) return c;
            return {
              ...c,
              relationships: c.relationships.map((r) =>
                r.id === relationshipId ? { ...r, ...partial } : r,
              ),
              updatedAt: Date.now(),
            };
          }),
        })),
      removeCharacterRelationship: (characterId, relationshipId) =>
        updateBook((b) => ({
          ...b,
          characters: (b.characters ?? []).map((c) => {
            if (c.id !== characterId) return c;
            return {
              ...c,
              relationships: c.relationships.filter(
                (r) => r.id !== relationshipId,
              ),
              updatedAt: Date.now(),
            };
          }),
        })),
      setCharacterBelongsToEntries: (characterId, entryIds) =>
        updateBook((b) => setCharacterBelongsTo(b, characterId, entryIds)),
      setEncyclopediaMemberCharacters: (entryId, characterIds) =>
        updateBook((b) =>
          setEncyclopediaCharacterMembers(b, entryId, characterIds),
        ),
      setLocationBelongsToEntries: (locationId, entryIds) =>
        updateBook((b) => setLocationBelongsTo(b, locationId, entryIds)),
      setEncyclopediaMemberLocations: (entryId, locationIds) =>
        updateBook((b) =>
          setEncyclopediaLocationMembers(b, entryId, locationIds),
        ),
      addFamilyTree: (name) => {
        let id = "";
        updateBook((b) => {
          const trees = b.familyTrees ?? [];
          const tree = createFamilyTree(
            { name: name?.trim() || "Family tree" },
            trees.length,
          );
          id = tree.id;
          return {
            ...b,
            familyTrees: sortFamilyTrees([...trees, tree]),
          };
        });
        return id;
      },
      updateFamilyTree: (treeId, partial) =>
        updateBook((b) => ({
          ...b,
          familyTrees: sortFamilyTrees(
            (b.familyTrees ?? []).map((t) =>
              t.id === treeId
                ? {
                    ...t,
                    ...partial,
                    id: t.id,
                    createdAt: t.createdAt,
                    updatedAt: Date.now(),
                  }
                : t,
            ),
          ),
        })),
      deleteFamilyTree: (treeId) =>
        updateBook((b) => ({
          ...b,
          familyTrees: (b.familyTrees ?? []).filter((t) => t.id !== treeId),
        })),
      addLocation: (partial) => {
        const location = createLocation({
          ...partial,
          name: partial?.name?.trim() || "New location",
        });
        updateBook((b) => ({
          ...b,
          locations: [...(b.locations ?? []), location],
        }));
        return location.id;
      },
      upsertLocations: (incoming) => {
        if (!incoming.length) return;
        updateBook((b) => {
          const locations = [...(b.locations ?? [])];
          for (const item of incoming) {
            const existing =
              locations.find((l) => l.id === item.id) ??
              findLocationByName(locations, item.name);
            if (existing) {
              const idx = locations.findIndex((l) => l.id === existing.id);
              locations[idx] = {
                ...existing,
                ...item,
                id: existing.id,
                createdAt: existing.createdAt,
                updatedAt: Date.now(),
              };
            } else {
              locations.push(item);
            }
          }
          return { ...b, locations };
        });
      },
      updateLocation: (locationId, partial) =>
        updateBook((b) => {
          const prev = (b.locations ?? []).find((l) => l.id === locationId);
          if (!prev) return b;
          const nextName =
            partial.name !== undefined
              ? partial.name.trim() || prev.name
              : prev.name;
          const renamed =
            partial.name !== undefined && nextName !== prev.name
              ? renameLocationInChapters(b.chapters, prev.name, nextName)
              : b.chapters;
          return {
            ...b,
            chapters: renamed,
            locations: (b.locations ?? []).map((l) =>
              l.id === locationId
                ? {
                    ...l,
                    ...partial,
                    name: nextName,
                    sensory: partial.sensory
                      ? { ...l.sensory, ...partial.sensory }
                      : l.sensory,
                    place: partial.place
                      ? { ...l.place, ...partial.place }
                      : l.place,
                    story: partial.story
                      ? { ...l.story, ...partial.story }
                      : l.story,
                    updatedAt: Date.now(),
                  }
                : l,
            ),
          };
        }),
      replaceLocation: (location) =>
        updateBook((b) => {
          const list = b.locations ?? [];
          const idx = list.findIndex((l) => l.id === location.id);
          if (idx < 0) {
            return {
              ...b,
              locations: [...list, { ...location, updatedAt: Date.now() }],
            };
          }
          return {
            ...b,
            locations: list.map((l) =>
              l.id === location.id
                ? { ...location, updatedAt: Date.now() }
                : l,
            ),
          };
        }),
      deleteLocation: (locationId) =>
        updateBook((b) => {
          const next = trashLocationFromBook(b, locationId);
          return ensureBookMap({
            ...next,
            map: removePinFromMap(next.map ?? emptyStoryMap(), locationId),
          });
        }),
      updateStoryMap: (map) =>
        updateBook((b) => replaceActiveMap(b, map)),
      upsertMapPin: (pin) =>
        updateBook((b) => {
          const ensured = ensureBookMap(b);
          return replaceActiveMap(
            ensured,
            upsertPinOnMap(ensured.map, pin),
          );
        }),
      removeMapPin: (locationIdOrPinId) =>
        updateBook((b) => {
          const ensured = ensureBookMap(b);
          return replaceActiveMap(
            ensured,
            removePinFromMap(ensured.map, locationIdOrPinId),
          );
        }),
      upsertMapRegion: (region) =>
        updateBook((b) => {
          const ensured = ensureBookMap(b);
          return replaceActiveMap(
            ensured,
            upsertRegionOnMap(ensured.map, region),
          );
        }),
      removeMapRegion: (regionId) =>
        updateBook((b) => {
          const ensured = ensureBookMap(b);
          return replaceActiveMap(
            ensured,
            removeRegionFromMap(ensured.map, regionId),
          );
        }),
      upsertMapLabel: (label) =>
        updateBook((b) => {
          const ensured = ensureBookMap(b);
          return replaceActiveMap(
            ensured,
            upsertLabelOnMap(ensured.map, label),
          );
        }),
      removeMapLabel: (labelId) =>
        updateBook((b) => {
          const ensured = ensureBookMap(b);
          return replaceActiveMap(
            ensured,
            removeLabelFromMap(ensured.map, labelId),
          );
        }),
      upsertMapPath: (path) =>
        updateBook((b) => {
          const ensured = ensureBookMap(b);
          return replaceActiveMap(
            ensured,
            upsertPathOnMap(ensured.map, path),
          );
        }),
      removeMapPath: (pathId) =>
        updateBook((b) => {
          const ensured = ensureBookMap(b);
          return replaceActiveMap(
            ensured,
            removePathFromMap(ensured.map, pathId),
          );
        }),
      autoPlaceMapPins: () =>
        updateBook((b) => {
          const ensured = ensureBookMap(b);
          return replaceActiveMap(
            ensured,
            autoPlaceUnpinned(ensured.map, ensured.locations ?? []),
          );
        }),
      applyMapStarter: (starterId) =>
        updateBook((b) => {
          const ensured = ensureBookMap(b);
          return replaceActiveMap(
            ensured,
            applyMapStarterToMap(ensured.map, starterId),
          );
        }),
      addStoryMap: (name) => {
        let newId = "";
        updateBook((b) => {
          const next = addStoryMapToBook(b, name);
          newId = next.activeMapId;
          return next;
        });
        return newId;
      },
      setActiveStoryMap: (mapId) =>
        updateBook((b) => setActiveStoryMapOnBook(b, mapId)),
      renameStoryMap: (mapId, name) =>
        updateBook((b) => renameStoryMapOnBook(b, mapId, name)),
      removeStoryMap: (mapId) =>
        updateBook((b) => removeStoryMapFromBook(b, mapId)),
      duplicateStoryMap: (mapId) =>
        updateBook((b) => duplicateStoryMapOnBook(b, mapId)),
      addLocationConnection: (locationId, partial) =>
        updateBook((b) => ({
          ...b,
          locations: (b.locations ?? []).map((l) => {
            if (l.id !== locationId) return l;
            return {
              ...l,
              connections: [
                ...l.connections,
                createLocationConnection({
                  label: partial.label,
                  toLocationId: partial.toLocationId,
                  toName: partial.toName,
                  notes: partial.notes,
                }),
              ],
              updatedAt: Date.now(),
            };
          }),
        })),
      updateLocationConnection: (locationId, connectionId, partial) =>
        updateBook((b) => ({
          ...b,
          locations: (b.locations ?? []).map((l) => {
            if (l.id !== locationId) return l;
            return {
              ...l,
              connections: l.connections.map((r) =>
                r.id === connectionId ? { ...r, ...partial } : r,
              ),
              updatedAt: Date.now(),
            };
          }),
        })),
      removeLocationConnection: (locationId, connectionId) =>
        updateBook((b) => ({
          ...b,
          locations: (b.locations ?? []).map((l) => {
            if (l.id !== locationId) return l;
            return {
              ...l,
              connections: l.connections.filter((r) => r.id !== connectionId),
              updatedAt: Date.now(),
            };
          }),
        })),
      addResearch: (partial) => {
        const entry = createResearchEntry({
          ...partial,
          title: partial?.title?.trim() || "New research",
        });
        updateBook((b) => ({
          ...b,
          research: [...(b.research ?? []), entry],
        }));
        return entry.id;
      },
      upsertResearch: (incoming) => {
        if (!incoming.length) return;
        updateBook((b) => {
          const research = [...(b.research ?? [])];
          for (const item of incoming) {
            const existing =
              research.find((e) => e.id === item.id) ??
              findResearchByTitle(research, item.title);
            if (existing) {
              const idx = research.findIndex((e) => e.id === existing.id);
              research[idx] = {
                ...existing,
                ...item,
                id: existing.id,
                createdAt: existing.createdAt,
                updatedAt: Date.now(),
              };
            } else {
              research.push(item);
            }
          }
          return { ...b, research };
        });
      },
      updateResearch: (entryId, partial) =>
        updateBook((b) => ({
          ...b,
          research: (b.research ?? []).map((e) =>
            e.id === entryId
              ? {
                  ...e,
                  ...partial,
                  title:
                    partial.title !== undefined
                      ? partial.title.trim() || e.title
                      : e.title,
                  updatedAt: Date.now(),
                }
              : e,
          ),
        })),
      replaceResearch: (entry) =>
        updateBook((b) => {
          const list = b.research ?? [];
          const idx = list.findIndex((e) => e.id === entry.id);
          if (idx < 0) {
            return {
              ...b,
              research: [...list, { ...entry, updatedAt: Date.now() }],
            };
          }
          return {
            ...b,
            research: list.map((e) =>
              e.id === entry.id ? { ...entry, updatedAt: Date.now() } : e,
            ),
          };
        }),
      deleteResearch: (entryId) =>
        updateBook((b) => trashResearchFromBook(b, entryId)),
      addResearchSource: (entryId, partial) =>
        updateBook((b) => ({
          ...b,
          research: (b.research ?? []).map((e) => {
            if (e.id !== entryId) return e;
            return {
              ...e,
              sources: [
                ...e.sources,
                createResearchSource({
                  title: partial.title,
                  citation: partial.citation,
                  quote: partial.quote,
                  notes: partial.notes,
                }),
              ],
              updatedAt: Date.now(),
            };
          }),
        })),
      updateResearchSource: (entryId, sourceId, partial) =>
        updateBook((b) => ({
          ...b,
          research: (b.research ?? []).map((e) => {
            if (e.id !== entryId) return e;
            return {
              ...e,
              sources: e.sources.map((s) =>
                s.id === sourceId ? { ...s, ...partial } : s,
              ),
              updatedAt: Date.now(),
            };
          }),
        })),
      removeResearchSource: (entryId, sourceId) =>
        updateBook((b) => ({
          ...b,
          research: (b.research ?? []).map((e) => {
            if (e.id !== entryId) return e;
            return {
              ...e,
              sources: e.sources.filter((s) => s.id !== sourceId),
              updatedAt: Date.now(),
            };
          }),
        })),
      addResearchLink: (entryId, partial) =>
        updateBook((b) => ({
          ...b,
          research: (b.research ?? []).map((e) => {
            if (e.id !== entryId) return e;
            return {
              ...e,
              links: [
                ...e.links,
                createResearchLink({
                  label: partial.label,
                  toEntryId: partial.toEntryId,
                  toTitle: partial.toTitle,
                  notes: partial.notes,
                }),
              ],
              updatedAt: Date.now(),
            };
          }),
        })),
      updateResearchLink: (entryId, linkId, partial) =>
        updateBook((b) => ({
          ...b,
          research: (b.research ?? []).map((e) => {
            if (e.id !== entryId) return e;
            return {
              ...e,
              links: e.links.map((l) =>
                l.id === linkId ? { ...l, ...partial } : l,
              ),
              updatedAt: Date.now(),
            };
          }),
        })),
      removeResearchLink: (entryId, linkId) =>
        updateBook((b) => ({
          ...b,
          research: (b.research ?? []).map((e) => {
            if (e.id !== entryId) return e;
            return {
              ...e,
              links: e.links.filter((l) => l.id !== linkId),
              updatedAt: Date.now(),
            };
          }),
        })),
      addEncyclopedia: (partial) => {
        let createdId = "";
        updateBook((b) => {
          let stacks = [...(b.encyclopediaStacks ?? [])];
          let stackId = partial?.stackId ?? "";
          if (!stackId || !stacks.some((s) => s.id === stackId)) {
            const ensured = ensureEncyclopediaStackNamed(
              stacks,
              stacks[0]?.name ?? "General",
            );
            stacks = ensured.stacks;
            stackId = ensured.stack.id;
          }
          const entry = createEncyclopediaEntry({
            ...partial,
            stackId,
            title: partial?.title?.trim() || "New article",
          });
          createdId = entry.id;
          return {
            ...b,
            encyclopediaStacks: sortEncyclopediaStacks(stacks),
            encyclopedia: [...(b.encyclopedia ?? []), entry],
          };
        });
        return createdId;
      },
      upsertEncyclopedia: (incoming) => {
        updateBook((b) => {
          const encyclopedia = [...(b.encyclopedia ?? [])];
          for (const item of incoming) {
            const existing =
              encyclopedia.find((e) => e.id === item.id) ??
              findEncyclopediaByTitle(encyclopedia, item.title);
            if (existing) {
              const idx = encyclopedia.findIndex((e) => e.id === existing.id);
              encyclopedia[idx] = {
                ...existing,
                ...item,
                id: existing.id,
                createdAt: existing.createdAt,
                updatedAt: Date.now(),
              };
            } else {
              encyclopedia.push(item);
            }
          }
          return { ...b, encyclopedia };
        });
      },
      updateEncyclopedia: (entryId, partial) =>
        updateBook((b) => ({
          ...b,
          encyclopedia: (b.encyclopedia ?? []).map((e) =>
            e.id === entryId
              ? { ...e, ...partial, id: e.id, createdAt: e.createdAt, updatedAt: Date.now() }
              : e,
          ),
        })),
      replaceEncyclopedia: (entry) =>
        updateBook((b) => {
          const list = b.encyclopedia ?? [];
          const exists = list.some((e) => e.id === entry.id);
          if (!exists) {
            return {
              ...b,
              encyclopedia: [...list, { ...entry, updatedAt: Date.now() }],
            };
          }
          return {
            ...b,
            encyclopedia: list.map((e) =>
              e.id === entry.id ? { ...entry, updatedAt: Date.now() } : e,
            ),
          };
        }),
      deleteEncyclopedia: (entryId) =>
        updateBook((b) => trashEncyclopediaFromBook(b, entryId)),
      addEncyclopediaStack: (name, color) => {
        let id = "";
        updateBook((b) => {
          const stacks = [...(b.encyclopediaStacks ?? [])];
          const existing = stacks.find(
            (s) => s.name.trim().toLowerCase() === name.trim().toLowerCase(),
          );
          if (existing) {
            id = existing.id;
            if (color && color !== existing.color) {
              return {
                ...b,
                encyclopediaStacks: sortEncyclopediaStacks(
                  stacks.map((s) =>
                    s.id === existing.id
                      ? { ...s, color, updatedAt: Date.now() }
                      : s,
                  ),
                ),
              };
            }
            return b;
          }
          const stack = createEncyclopediaStack(
            { name, color, order: stacks.length },
            stacks,
          );
          id = stack.id;
          return {
            ...b,
            encyclopediaStacks: sortEncyclopediaStacks([...stacks, stack]),
          };
        });
        return id;
      },
      updateEncyclopediaStack: (stackId, partial) =>
        updateBook((b) => ({
          ...b,
          encyclopediaStacks: sortEncyclopediaStacks(
            (b.encyclopediaStacks ?? []).map((s) =>
              s.id === stackId
                ? {
                    ...s,
                    ...(partial.name != null
                      ? { name: partial.name.trim() || s.name }
                      : {}),
                    ...(partial.color != null
                      ? { color: partial.color.trim() || s.color }
                      : {}),
                    updatedAt: Date.now(),
                  }
                : s,
            ),
          ),
        })),
      deleteEncyclopediaStack: (stackId) =>
        updateBook((b) => {
          const remaining = (b.encyclopediaStacks ?? []).filter(
            (s) => s.id !== stackId,
          );
          let stacks = remaining;
          let fallbackId = remaining[0]?.id;
          if (!fallbackId) {
            const ensured = ensureEncyclopediaStackNamed([], "General");
            stacks = ensured.stacks;
            fallbackId = ensured.stack.id;
          }
          return {
            ...b,
            encyclopediaStacks: sortEncyclopediaStacks(stacks),
            encyclopedia: (b.encyclopedia ?? []).map((e) =>
              e.stackId === stackId
                ? { ...e, stackId: fallbackId!, updatedAt: Date.now() }
                : e,
            ),
          };
        }),
      ensureEncyclopediaStack: (name) => {
        let id = "";
        updateBook((b) => {
          const ensured = ensureEncyclopediaStackNamed(
            b.encyclopediaStacks ?? [],
            name,
          );
          id = ensured.stack.id;
          if (ensured.stacks === (b.encyclopediaStacks ?? [])) {
            return b;
          }
          return {
            ...b,
            encyclopediaStacks: sortEncyclopediaStacks(ensured.stacks),
          };
        });
        return id;
      },
      applyEncyclopediaStarter: (starterId) => {
        updateBook((b) => {
          const stacks = applyEncyclopediaStackStarter(
            b.encyclopediaStacks ?? [],
            starterId,
          );
          if (stacks === (b.encyclopediaStacks ?? [])) return b;
          return {
            ...b,
            encyclopediaStacks: stacks,
            updatedAt: Date.now(),
          };
        });
      },
      addEncyclopediaLink: (entryId, partial) =>
        updateBook((b) => ({
          ...b,
          encyclopedia: (b.encyclopedia ?? []).map((e) => {
            if (e.id !== entryId) return e;
            return {
              ...e,
              links: [
                ...e.links,
                createEncyclopediaLink({
                  label: partial.label,
                  toEntryId: partial.toEntryId,
                  toTitle: partial.toTitle,
                  notes: partial.notes,
                }),
              ],
              updatedAt: Date.now(),
            };
          }),
        })),
      updateEncyclopediaLink: (entryId, linkId, partial) =>
        updateBook((b) => ({
          ...b,
          encyclopedia: (b.encyclopedia ?? []).map((e) => {
            if (e.id !== entryId) return e;
            return {
              ...e,
              links: e.links.map((l) =>
                l.id === linkId ? { ...l, ...partial } : l,
              ),
              updatedAt: Date.now(),
            };
          }),
        })),
      removeEncyclopediaLink: (entryId, linkId) =>
        updateBook((b) => ({
          ...b,
          encyclopedia: (b.encyclopedia ?? []).map((e) => {
            if (e.id !== entryId) return e;
            return {
              ...e,
              links: e.links.filter((l) => l.id !== linkId),
              updatedAt: Date.now(),
            };
          }),
        })),
      addChronicleEvent: (partial) => {
        let createdId = "";
        updateBook((b) => {
          const events = b.chronicle ?? [];
          const event = createChronicleEvent({
            ...partial,
            title: partial?.title?.trim() || "New event",
            order: partial?.order ?? nextChronicleOrder(events),
          });
          createdId = event.id;
          return {
            ...b,
            chronicle: sortChronicleEvents([...events, event]),
            updatedAt: Date.now(),
          };
        });
        return createdId;
      },
      updateChronicleEvent: (eventId, partial) =>
        updateBook((b) => ({
          ...b,
          chronicle: sortChronicleEvents(
            (b.chronicle ?? []).map((e) => {
              if (e.id !== eventId) return e;
              const next = {
                ...e,
                ...partial,
                id: e.id,
                createdAt: e.createdAt,
                updatedAt: Date.now(),
              };
              if ("mapMarker" in partial && partial.mapMarker == null) {
                delete next.mapMarker;
              }
              return next;
            }),
          ),
          updatedAt: Date.now(),
        })),
      deleteChronicleEvent: (eventId) =>
        updateBook((b) => ({
          ...b,
          chronicle: (b.chronicle ?? []).filter((e) => e.id !== eventId),
          updatedAt: Date.now(),
        })),
      moveChronicleEvent: (eventId, direction) =>
        updateBook((b) => {
          const sorted = sortChronicleEvents(b.chronicle ?? []);
          const index = sorted.findIndex((e) => e.id === eventId);
          if (index < 0) return b;
          const swapWith = direction === "up" ? index - 1 : index + 1;
          if (swapWith < 0 || swapWith >= sorted.length) return b;
          const a = sorted[index];
          const c = sorted[swapWith];
          const next = sorted.map((e) => {
            if (e.id === a.id) return { ...e, order: c.order, updatedAt: Date.now() };
            if (e.id === c.id) return { ...e, order: a.order, updatedAt: Date.now() };
            return e;
          });
          return {
            ...b,
            chronicle: sortChronicleEvents(next),
            updatedAt: Date.now(),
          };
        }),
      addSoundtrackSong: (partial) => {
        let createdId = "";
        updateBook((b) => {
          const songs = b.soundtrack ?? [];
          const song = createSoundtrackSong({
            ...partial,
            title: partial?.title?.trim() || "New track",
            order: partial?.order ?? nextSoundtrackOrder(songs),
          });
          createdId = song.id;
          return {
            ...b,
            soundtrack: sortSoundtrackSongs([...songs, song]),
            updatedAt: Date.now(),
          };
        });
        return createdId;
      },
      updateSoundtrackSong: (songId, partial) =>
        updateBook((b) => ({
          ...b,
          soundtrack: sortSoundtrackSongs(
            (b.soundtrack ?? []).map((s) => {
              if (s.id !== songId) return s;
              return {
                ...s,
                ...partial,
                updatedAt: Date.now(),
              };
            }),
          ),
          updatedAt: Date.now(),
        })),
      deleteSoundtrackSong: (songId) =>
        updateBook((b) => ({
          ...b,
          soundtrack: (b.soundtrack ?? []).filter((s) => s.id !== songId),
          updatedAt: Date.now(),
        })),
      moveSoundtrackSong: (songId, direction) =>
        updateBook((b) => {
          const sorted = sortSoundtrackSongs(b.soundtrack ?? []);
          const index = sorted.findIndex((s) => s.id === songId);
          if (index < 0) return b;
          const swapWith = direction === "up" ? index - 1 : index + 1;
          if (swapWith < 0 || swapWith >= sorted.length) return b;
          const a = sorted[index];
          const c = sorted[swapWith];
          const next = sorted.map((s) => {
            if (s.id === a.id)
              return { ...s, order: c.order, updatedAt: Date.now() };
            if (s.id === c.id)
              return { ...s, order: a.order, updatedAt: Date.now() };
            return s;
          });
          return {
            ...b,
            soundtrack: sortSoundtrackSongs(next),
            updatedAt: Date.now(),
          };
        }),
      applySoundtrackFromClaude: (payload) =>
        updateBook((b) => ({
          ...b,
          soundtrack: applySoundtrackCompose(b.soundtrack ?? [], payload),
          updatedAt: Date.now(),
        })),
      applyDevelopmentalReview: (pass, memoryUpdates) =>
        updateBook((b) => ({
          ...b,
          developmentalEditor: mergeDevelopmentalPass(
            b.developmentalEditor ?? { memory: [], passes: [] },
            pass,
            memoryUpdates,
          ),
        })),
      updateDevelopmentalFlag: (passId, flagId, partial) =>
        updateBook((b) => ({
          ...b,
          developmentalEditor: applyDevelopmentalFlagPatch(
            b.developmentalEditor ?? { memory: [], passes: [] },
            passId,
            flagId,
            partial,
          ),
        })),
      clearDevelopmentalMemory: () =>
        updateBook((b) => ({
          ...b,
          developmentalEditor: {
            ...(b.developmentalEditor ?? { memory: [], passes: [] }),
            memory: [],
          },
        })),
      clearDevelopmentalPasses: () =>
        updateBook((b) => ({
          ...b,
          developmentalEditor: {
            ...(b.developmentalEditor ?? { memory: [], passes: [] }),
            passes: [],
          },
        })),
      applyBetaReview: (review, memoryUpdates) =>
        updateBook((b) => ({
          ...b,
          betaReaders: mergeBetaReview(
            b.betaReaders ?? { readers: [], memory: [], reviews: [] },
            review,
            memoryUpdates,
          ),
        })),
      clearBetaMemory: (scope) =>
        updateBook((b) => {
          const beta = b.betaReaders ?? {
            readers: [],
            memory: [],
            reviews: [],
          };
          if (!scope?.chapterId && !scope?.readerId) {
            return { ...b, betaReaders: { ...beta, memory: [] } };
          }
          return {
            ...b,
            betaReaders: {
              ...beta,
              memory: (beta.memory ?? []).filter((m) => {
                const readerMatch =
                  !scope.readerId || m.readerId === scope.readerId;
                const chapterMatch =
                  !scope.chapterId || m.chapterId === scope.chapterId;
                return !(readerMatch && chapterMatch);
              }),
            },
          };
        }),
      clearBetaReviewForChapter: (readerId, chapterId) =>
        updateBook((b) => {
          const beta = b.betaReaders ?? {
            readers: [],
            memory: [],
            reviews: [],
          };
          return {
            ...b,
            betaReaders: {
              ...beta,
              reviews: (beta.reviews ?? []).filter(
                (r) =>
                  !(r.readerId === readerId && r.chapterId === chapterId),
              ),
            },
          };
        }),
      clearBetaReviews: () =>
        updateBook((b) => ({
          ...b,
          betaReaders: {
            ...(b.betaReaders ?? { readers: [], memory: [], reviews: [] }),
            reviews: [],
          },
        })),
      applyCritiqueReview: (review, memoryUpdates) =>
        updateBook((b) => ({
          ...b,
          critique: mergeCritiqueReview(
            b.critique ?? { memory: [], reviews: [] },
            review,
            memoryUpdates,
          ),
        })),
      clearCritiqueMemory: () =>
        updateBook((b) => ({
          ...b,
          critique: {
            ...(b.critique ?? { memory: [], reviews: [] }),
            memory: [],
          },
        })),
      clearCritiqueReviews: () =>
        updateBook((b) => ({
          ...b,
          critique: {
            ...(b.critique ?? { memory: [], reviews: [] }),
            reviews: [],
          },
        })),
      selectDumpPage: (pageId) =>
        updateBook((b) => {
          const dump = b.dump ?? emptyDump();
          if (!dump.pages.some((p) => p.id === pageId)) return b;
          return { ...b, dump: { ...dump, activePageId: pageId } };
        }),
      addDumpPage: (title) => {
        const page = createDumpPage({
          title: title?.trim() || `Page ${(book?.dump?.pages.length ?? 0) + 1}`,
        });
        updateBook((b) => {
          const dump = b.dump ?? emptyDump();
          return {
            ...b,
            dump: {
              pages: [...dump.pages, page],
              activePageId: page.id,
            },
          };
        });
        return page.id;
      },
      deleteDumpPage: (pageId) =>
        updateBook((b) => {
          const dump = b.dump ?? emptyDump();
          if (dump.pages.length <= 1) return b;
          const pages = dump.pages.filter((p) => p.id !== pageId);
          if (pages.length === dump.pages.length) return b;
          const activePageId =
            dump.activePageId === pageId
              ? pages[0].id
              : pages.find((p) => p.id === dump.activePageId)?.id ?? pages[0].id;
          return { ...b, dump: { pages, activePageId } };
        }),
      updateDumpPageTitle: (pageId, title) =>
        updateBook((b) => {
          const dump = b.dump ?? emptyDump();
          const nextTitle = title.trim() || "Untitled";
          return {
            ...b,
            dump: {
              ...dump,
              pages: dump.pages.map((p) =>
                p.id === pageId
                  ? { ...p, title: nextTitle, updatedAt: Date.now() }
                  : p,
              ),
            },
          };
        }),
      updateDumpPageContent: (content, pageId) =>
        updateBook((b) => {
          const dump = b.dump ?? emptyDump();
          const targetId = pageId ?? dump.activePageId;
          return {
            ...b,
            dump: {
              ...dump,
              pages: dump.pages.map((p) =>
                p.id === targetId
                  ? { ...p, content, updatedAt: Date.now() }
                  : p,
              ),
            },
          };
        }),
      reorderDumpPages: (fromIndex, toIndex) =>
        updateBook((b) => {
          const dump = b.dump ?? emptyDump();
          if (
            fromIndex === toIndex ||
            fromIndex < 0 ||
            toIndex < 0 ||
            fromIndex >= dump.pages.length ||
            toIndex >= dump.pages.length
          ) {
            return b;
          }
          const pages = [...dump.pages];
          const [moved] = pages.splice(fromIndex, 1);
          pages.splice(toIndex, 0, moved);
          return { ...b, dump: { ...dump, pages } };
        }),
      addPlotThread: (partial) => {
        const thread = createPlotThread(
          partial,
          (book?.plotThreads ?? []).length,
        );
        updateBook((b) => ({
          ...b,
          plotThreads: [...(b.plotThreads ?? []), thread],
        }));
        return thread.id;
      },
      updatePlotThread: (threadId, partial) =>
        updateBook((b) => ({
          ...b,
          plotThreads: (b.plotThreads ?? []).map((t) =>
            t.id === threadId
              ? {
                  ...t,
                  ...partial,
                  name:
                    partial.name !== undefined
                      ? partial.name.trim() || t.name
                      : t.name,
                  updatedAt: Date.now(),
                }
              : t,
          ),
        })),
      deletePlotThread: (threadId) =>
        updateBook((b) => ({
          ...b,
          plotThreads: (b.plotThreads ?? []).filter((t) => t.id !== threadId),
          chapters: b.chapters.map((c) => ({
            ...c,
            scenes: c.scenes.map((s) => ({
              ...s,
              threadIds: (s.threadIds ?? []).filter((id) => id !== threadId),
            })),
          })),
        })),
      applyPlotThreadStarter: (starterId) =>
        updateBook((b) => {
          const next = applyPlotThreadStarter(b.plotThreads ?? [], starterId);
          if (next === (b.plotThreads ?? [])) return b;
          return { ...b, plotThreads: next, updatedAt: Date.now() };
        }),
      toggleSceneThread: (sceneId, threadId) =>
        updateBook((b) => ({
          ...b,
          chapters: b.chapters.map((c) => ({
            ...c,
            scenes: c.scenes.map((s) =>
              s.id === sceneId
                ? {
                    ...s,
                    threadIds: toggleThreadId(s.threadIds, threadId),
                    updatedAt: Date.now(),
                  }
                : s,
            ),
          })),
        })),
      applyPlotThreadsFromClaude: (payload) =>
        updateBook((b) => applyPlotThreadDiscovery(b, payload)),
      applyChronicleFromClaude: (payload) =>
        updateBook((b) => ({
          ...b,
          chronicle: applyChronicleDiscovery(b.chronicle ?? [], payload, b),
          updatedAt: Date.now(),
        })),
      setManuscriptIndex: (index) =>
        updateBook((b) => ({
          ...b,
          manuscriptIndex: index,
          updatedAt: Date.now(),
        })),
      applyClarenceAsk: (answers) => {
        let result!: ReturnType<typeof applyClarenceAskAnswers>;
        updateBook((b) => {
          result = applyClarenceAskAnswers(b, answers);
          return {
            ...b,
            chapters: result.chapters,
            characters: result.characters,
            clarenceContext: result.clarenceContext,
            updatedAt: Date.now(),
          };
        });
        return result;
      },
      focusScene,
      sceneFocus,
      dropboxStatus,
      dropboxSyncing,
      dropboxConflict,
      connectDropbox: async () => {
        await beginDropboxAuth();
      },
      disconnectDropboxAccount: () => {
        disconnectDropbox();
        setDropboxConflict(null);
        setDropboxStatus(getDropboxStatus());
      },
      syncDropboxNow: async () => {
        // Flush pending library write so we don't false-conflict after a local edit.
        if (bookRef.current) {
          saveBook(bookRef.current);
          setIsDirty(false);
          setLastSavedAt(Date.now());
          isDirtyRef.current = false;
        }
        const result = await pullDropboxIfNeeded();
        // Avoid pushing over a conflict (setState is async) or double-pushing.
        if (
          result === "conflict" ||
          result === "push" ||
          result === "skipped"
        ) {
          return;
        }
        if (getDropboxStatus().connected) {
          await pushToDropbox();
        }
      },
      resolveDropboxConflict: async (choice) => {
        if (!dropboxConflict || !settings) return;
        if (book) {
          try {
            createSnapshot(
              book,
              choice === "remote"
                ? "Before keeping Dropbox copy"
                : "Before keeping this device",
              "auto",
            );
          } catch {
            /* quota */
          }
        }
        if (choice === "remote") {
          const remote = await downloadDropboxLibrary();
          if (remote.exists) {
            applyDropboxPayload(remote.payload, remote.remoteRev);
          } else {
            applyDropboxPayload(dropboxConflict, "");
          }
          return;
        }
        // Keep local — upload over Dropbox
        setDropboxConflict(null);
        const status = getDropboxStatus();
        const library = loadLibrary();
        const payload = buildDropboxPayload(
          library,
          settings,
          Math.max(status.lastAckRevision, dropboxConflict.sync?.revision ?? 0),
        );
        dropboxBusyRef.current = true;
        setDropboxSyncing(true);
        try {
          await uploadDropboxLibrary(payload);
          setDropboxStatus(getDropboxStatus());
        } finally {
          dropboxBusyRef.current = false;
          setDropboxSyncing(false);
        }
      },
      refreshDropboxStatus,
      folderMirrorStatus,
      folderMirrorWriting,
      chooseFolderMirror: async () => {
        const next = await pickFolderMirror();
        setFolderMirrorStatus(next);
        if (settings) {
          await pushToFolderMirror();
        }
      },
      clearFolderMirrorLink: async () => {
        await unlinkFolderMirror();
        setFolderMirrorStatus(getFolderMirrorStatus());
      },
      writeFolderMirrorNow: async () => {
        await pushToFolderMirror();
      },
      refreshFolderMirrorStatus,
      downloadLibraryBackup: () => {
        if (book) saveBook(book);
        downloadLibraryBackupFile(loadLibrary(), settings);
      },
      downloadBookBackup: () => {
        if (!book) return;
        saveBook(book);
        downloadBookBackupFile(book);
      },
      restoreFromBackup: (payload) => {
        if (book) {
          try {
            createSnapshot(book, "Before restore", "auto");
          } catch {
            /* quota — still allow restore */
          }
        }
        skipDirtyRef.current = true;
        if (payload.format === FOLIO_BACKUP_FORMAT) {
          applyLibraryBackup(payload);
          const lib = loadLibrary();
          const nextSettings = payload.settings ?? loadSettings();
          setSettings(nextSettings);
          setLibraryBooks(lib.books);
          setLibraryTrash(lib.trash);
          setLibrarySeries(lib.series ?? []);
          setBook(
            lib.books.find((b) => b.id === lib.activeBookId) ?? lib.books[0],
          );
        } else {
          applyBookBackup(payload.book);
          const lib = loadLibrary();
          setLibraryBooks(lib.books);
          setLibraryTrash(lib.trash);
          setLibrarySeries(lib.series ?? []);
          setBook(
            lib.books.find((b) => b.id === lib.activeBookId) ?? lib.books[0],
          );
        }
        setIsDirty(false);
        setLastSavedAt(Date.now());
        setSnapshotsTick((t) => t + 1);
        window.setTimeout(() => {
          skipDirtyRef.current = false;
        }, 0);
      },
      listBookSnapshots: () => {
        void snapshotsTick;
        if (!book) return [];
        return listSnapshots(book.id);
      },
      takeBookSnapshot: (label, kind) => {
        if (!book) return null;
        saveBook(book);
        const snap = createSnapshot(
          book,
          label ?? "Checkpoint",
          kind ?? "checkpoint",
        );
        setSnapshotsTick((t) => t + 1);
        return snap;
      },
      renameBookSnapshot: (snapshotId, label) => {
        const ok = renameSnapshot(snapshotId, label);
        if (ok) setSnapshotsTick((t) => t + 1);
        return ok;
      },
      restoreBookSnapshot: (snapshotId) => {
        const snap = getSnapshot(snapshotId);
        if (!snap || !book) return false;
        try {
          createSnapshot(book, "Before snapshot restore", "auto");
        } catch {
          /* quota */
        }
        const restored = {
          ...structuredClone(snap.book),
          id: book.id,
          updatedAt: Date.now(),
        };
        skipDirtyRef.current = true;
        saveBook(restored);
        setBook(restored);
        setLibraryBooks((prev) =>
          prev.map((b) => (b.id === restored.id ? restored : b)),
        );
        setIsDirty(false);
        setLastSavedAt(Date.now());
        setSnapshotsTick((t) => t + 1);
        window.setTimeout(() => {
          skipDirtyRef.current = false;
        }, 0);
        return true;
      },
      deleteBookSnapshot: (snapshotId) => {
        deleteSnapshot(snapshotId);
        setSnapshotsTick((t) => t + 1);
      },
      summarizeSnapshotDiff: (snapshotId) => {
        if (!book) return null;
        const snap = getSnapshot(snapshotId);
        if (!snap) return null;
        return formatSnapshotDiffLines(diffSnapshotSummary(snap, book));
      },
      libraryBooks,
      libraryTrash,
      librarySeries,
      saveNow,
      setTheme: (theme) => updateSettings({ theme }),
      toggleFocusMode: () =>
        updateSettings({ focusMode: !settings.focusMode }),
      toggleFullscreen: () =>
        updateSettings({ fullscreen: !settings.fullscreen }),
      toggleSidebar: () =>
        updateSettings({ sidebarOpen: !settings.sidebarOpen }),
      toggleAppNav: () =>
        updateSettings({ appNavOpen: !(settings.appNavOpen ?? true) }),
      updateSettings,
    };
  }, [
    book,
    settings,
    activeChapter,
    activeDumpPage,
    wordCount,
    sessionWords,
    isSaving,
    isDirty,
    lastSavedAt,
    hydrated,
    libraryBooks,
    libraryTrash,
    librarySeries,
    updateBook,
    updateSettings,
    focusScene,
    sceneFocus,
    dropboxStatus,
    dropboxSyncing,
    dropboxConflict,
    refreshDropboxStatus,
    pullDropboxIfNeeded,
    pushToDropbox,
    applyDropboxPayload,
    folderMirrorStatus,
    folderMirrorWriting,
    refreshFolderMirrorStatus,
    pushToFolderMirror,
    saveNow,
    syncLibraryMeta,
    snapshotsTick,
  ]);

  if (!value) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--paper,#F7F3EA)]">
        <div className="h-1 w-16 overflow-hidden rounded-full bg-[rgba(176,141,87,0.2)]">
          <div className="folio-loading-bar h-full w-1/2 rounded-full bg-[var(--accent,#B08D57)]" />
        </div>
      </div>
    );
  }

  return <BookContext.Provider value={value}>{children}</BookContext.Provider>;
}

export function useBook() {
  const ctx = useContext(BookContext);
  if (!ctx) throw new Error("useBook must be used within BookProvider");
  return ctx;
}
