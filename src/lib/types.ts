export type ThemeId = "classic" | "midnight" | "parchment";

export type SceneStatus =
  | "outline"
  | "draft"
  | "writing"
  | "revising"
  | "final";

export type StoryboardZoom = "tiny" | "small" | "medium" | "large";

export type StoryboardSort = "manual" | "title" | "status" | "updated";

export type OutlineScale = "compact" | "balanced" | "detailed";

/** How fleshed-out a character wiki is — grows as you write. */
export type CharacterDepth = "stub" | "sketch" | "portrait" | "living";

export type CharacterRole =
  | "protagonist"
  | "antagonist"
  | "deuteragonist"
  | "supporting"
  | "minor"
  | "unspecified";

export interface CharacterRelationship {
  id: string;
  /** Target character id, or empty if freeform. */
  toCharacterId: string;
  /** Freeform name when not linking to a wiki entry. */
  toName: string;
  label: string;
  notes: string;
}

export interface Character {
  id: string;
  name: string;
  aliases: string[];
  role: CharacterRole;
  /** One-line cast blurb — shows on the roster. */
  shortBio: string;
  /** Freeform wiki body (plain text / light markdown-ish). */
  wiki: string;
  identity: {
    age: string;
    occupation: string;
    appearance: string;
    distinguishing: string;
  };
  psychology: {
    wants: string;
    needs: string;
    fears: string;
    flaws: string;
    strengths: string;
  };
  voice: {
    speechNotes: string;
    mannerisms: string;
    sample: string;
  };
  arc: {
    startingPoint: string;
    turningPoints: string;
    endingPoint: string;
  };
  relationships: CharacterRelationship[];
  secrets: string;
  tags: string[];
  /**
   * Auto-refreshed digest compiled from scenes & prose.
   * Safe to overwrite on sync — separate from freeform `wiki`.
   */
  storyDigest: string;
  createdAt: number;
  updatedAt: number;
}

/** How fleshed-out a location wiki is — grows as you write. */
export type LocationDepth = "stub" | "sketch" | "portrait" | "living";

export type LocationKind =
  | "interior"
  | "exterior"
  | "settlement"
  | "landmark"
  | "threshold"
  | "region"
  | "unspecified";

export interface LocationConnection {
  id: string;
  toLocationId: string;
  toName: string;
  label: string;
  notes: string;
}

export interface Location {
  id: string;
  name: string;
  aliases: string[];
  kind: LocationKind;
  /** One-line atlas blurb — shows on the roster. */
  shortBio: string;
  /** Freeform wiki body. */
  wiki: string;
  sensory: {
    sight: string;
    sound: string;
    smell: string;
    atmosphere: string;
  };
  place: {
    region: string;
    access: string;
    landmarks: string;
    scale: string;
  };
  story: {
    function: string;
    firstImpression: string;
    changes: string;
  };
  connections: LocationConnection[];
  /** Character names who inhabit or frequent this place. */
  inhabitants: string[];
  secrets: string;
  tags: string[];
  /**
   * Auto-refreshed digest from scenes & prose.
   * Safe to overwrite on sync — separate from freeform `wiki`.
   */
  storyDigest: string;
  createdAt: number;
  updatedAt: number;
}

/** How fleshed-out a research entry is — grows as you gather. */
export type ResearchDepth = "stub" | "sketch" | "portrait" | "living";

export type ResearchKind =
  | "theme"
  | "motif"
  | "period"
  | "craft"
  | "source"
  | "lore"
  | "question"
  | "unspecified";

export interface ResearchSource {
  id: string;
  title: string;
  citation: string;
  quote: string;
  notes: string;
}

export interface ResearchLink {
  id: string;
  toEntryId: string;
  toTitle: string;
  label: string;
  notes: string;
}

/** A commonplace entry — theme, motif, source, or open question. */
export interface ResearchEntry {
  id: string;
  title: string;
  aliases: string[];
  kind: ResearchKind;
  /** One-line index blurb. */
  shortBio: string;
  /** Freeform research notes. */
  wiki: string;
  /** Distilled findings. */
  summary: string;
  /** Open questions still chasing. */
  questions: string;
  sources: ResearchSource[];
  links: ResearchLink[];
  linkedCharacters: string[];
  linkedLocations: string[];
  tags: string[];
  /**
   * Auto-refreshed digest from scenes, labels, and prose.
   * Safe to overwrite on sync — separate from freeform `wiki`.
   */
  storyDigest: string;
  createdAt: number;
  updatedAt: number;
}

export interface Scene {
  id: string;
  title: string;
  synopsis: string;
  status: SceneStatus;
  pov: string;
  labels: string[];
  characters: string[];
  location: string;
  notes: string;
  act: string;
  /** Plot thread ids from `Book.plotThreads`. */
  threadIds: string[];
  wordCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface Chapter {
  id: string;
  title: string;
  /** Author-written skim line for the timeline (not auto-filled). */
  summary: string;
  content: string;
  notes: string;
  scenes: Scene[];
  createdAt: number;
  updatedAt: number;
}

export type TrashKind =
  | "scene"
  | "chapter"
  | "character"
  | "location"
  | "research";

/** Soft-deleted manuscript piece — lives until restored or purged. */
export interface TrashItem {
  id: string;
  kind: TrashKind;
  title: string;
  /** Context line — e.g. chapter title for a scene. */
  subtitle: string;
  deletedAt: number;
  payload: TrashPayload;
}

export type TrashPayload =
  | {
      kind: "scene";
      scene: Scene;
      html: string;
      chapterId: string;
      chapterTitle: string;
      sceneIndex: number;
    }
  | { kind: "chapter"; chapter: Chapter }
  | { kind: "character"; character: Character }
  | { kind: "location"; location: Location }
  | { kind: "research"; entry: ResearchEntry };

/** A full manuscript moved out of the library shelf. */
export interface TrashedBook {
  id: string;
  deletedAt: number;
  book: Book;
}

/** Shared cast / places across books in a series. */
export interface Series {
  id: string;
  title: string;
  synopsis: string;
  /** Freeform series lore — never appears in any manuscript. */
  notes: string;
  characters: Character[];
  locations: Location[];
  createdAt: number;
  updatedAt: number;
}

/** One calendar day’s writing toward the daily target. */
export interface WritingDayLog {
  /** Local YYYY-MM-DD */
  date: string;
  wordsWritten: number;
}

/**
 * Per-book writing goals — literary pace, not streak-app pressure.
 * Daily / manuscript targets of 0 mean “off.”
 */
export interface BookGoals {
  dailyTarget: number;
  manuscriptTarget: number;
  /** Local YYYY-MM-DD deadline, or empty. */
  deadline: string;
  /** Soft session intention — e.g. “finish the confrontation.” */
  sessionIntention: string;
  dayLog: WritingDayLog[];
  /** Manuscript word count when the current local day began. */
  dayStartWordCount: number;
  /** Local YYYY-MM-DD for `dayStartWordCount`. */
  dayStartDate: string;
}

/** Named subplot / arc track on the Timeline. */
export interface PlotThread {
  id: string;
  name: string;
  /** CSS color from the Folio thread palette. */
  color: string;
  createdAt: number;
  updatedAt: number;
}

export interface FolioLibrary {
  version: 1;
  activeBookId: string;
  books: Book[];
  /** Series bibles shared across manuscripts on the shelf. */
  series: Series[];
  /** Discarded manuscripts (separate from in-book trash). */
  trash: TrashedBook[];
}

export interface Book {
  id: string;
  title: string;
  author: string;
  chapters: Chapter[];
  characters: Character[];
  locations: Location[];
  research: ResearchEntry[];
  /**
   * All story maps for this book (London streets, fantasy continent, …).
   * One is active at a time via `activeMapId`.
   */
  maps: StoryMap[];
  /** Which map is open on the Map page. */
  activeMapId: string;
  /**
   * Active map mirror — always kept in sync with `maps[activeMapId]`.
   * Prefer reading via the Map page / ensureBookMap.
   */
  map: StoryMap;
  /** Soft-deleted scenes, chapters, and wiki entries for this book. */
  trash: TrashItem[];
  /**
   * Developmental / copy-editor memory and review passes.
   * Flags only — never stores rewritten prose.
   */
  developmentalEditor: DevelopmentalEditorState;
  /**
   * AI beta readers — persona reviews with cross-chapter memory.
   * Reactions + craft answers only — never rewrites the manuscript.
   */
  betaReaders: BetaReadersState;
  /**
   * Working dump — free pages for scraps, spare scenes, name lists,
   * and anything not yet sorted into the manuscript or wiki.
   */
  dump: DumpState;
  /** Named plot threads for the Timeline tracks view. */
  plotThreads: PlotThread[];
  /** Optional link to a library series bible. */
  seriesId?: string | null;
  /** Daily / manuscript goals and day log. */
  goals: BookGoals;
  activeChapterId: string;
  createdAt: number;
  updatedAt: number;
}

/** Corkboard geography for the book — presentation layer over Locations. */
export interface StoryMap {
  id: string;
  /** Author-facing name — e.g. "London", "The Reach". */
  name: string;
  width: number;
  height: number;
  pins: StoryMapPin[];
  labels: StoryMapLabel[];
  regions: StoryMapRegion[];
  /**
   * Optional real-world basemap as a data URL (JPEG/PNG).
   * For contemporary / urban / romance settings — e.g. a London street map —
   * with story pins laid on top.
   */
  backgroundImage?: string;
  /** Original filename of the uploaded basemap, for the author UI. */
  backgroundName?: string;
}

export interface StoryMapPin {
  id: string;
  locationId: string;
  /** 0–1 across the map canvas. */
  x: number;
  y: number;
  /** Optional label override; defaults to Location.name. */
  label?: string;
  /** Why Claude placed this pin — story geography note. */
  rationale?: string;
}

export interface StoryMapLabel {
  id: string;
  text: string;
  x: number;
  y: number;
}

/** Soft named area on the author map — territory wash, range, or water. */
export type StoryMapRegionKind = "territory" | "mountains" | "water";

/** Outline for a painted feature — change anytime after drawing. */
export type StoryMapRegionShape = "rect" | "ellipse" | "soft";

/** Soft named area — box in 0–1 space; may be rotated / reshaped. */
export interface StoryMapRegion {
  id: string;
  name: string;
  kind: StoryMapRegionKind;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Degrees clockwise; 0 is upright. */
  rotation: number;
  /** Box, oval, or organic outline. */
  shape: StoryMapRegionShape;
  /** Key into MAP_TERRITORY_PALETTE (e.g. "sage", "mist"). */
  color: string;
  /** Author-drawn vs Claude story build — rebuild replaces claude regions only. */
  source?: "author" | "claude";
}

/** Editorial passes — chapter craft vs book-wide continuity. */
export type DevelopmentalPassKind = "style" | "story" | "line" | "continuity";

export type DevelopmentalFlagCategory =
  | "filter-words"
  | "weak-verbs"
  | "repetition"
  | "dialogue-tags"
  | "adverbs"
  | "telling"
  | "pacing"
  | "plot-holes"
  | "character-voice"
  | "flow-rhythm"
  | "redundancy"
  | "word-choice"
  | "dialogue-polish"
  | "show-dont-tell"
  | "name-variants"
  | "cast-mismatch"
  | "location-jump"
  | "timeline"
  | "forgotten-detail"
  | "orphan-tag";

export type DevelopmentalSeverity = "note" | "watch" | "issue";

/** A single observation — quote + note + two panel-only suggestions. */
export interface DevelopmentalFlag {
  id: string;
  category: DevelopmentalFlagCategory;
  severity: DevelopmentalSeverity;
  /** Short quote from the chapter (author's words). */
  excerpt: string;
  /** What to notice — diagnostic framing. */
  note: string;
  /**
   * Exactly two directional suggestions for the author to consider.
   * Shown only in the AI panel — never inserted into the manuscript.
   */
  suggestions: [string, string];
  /** Author reaction — kept on the card until closed. */
  verdict?: "liked" | "disliked" | null;
  /** Hidden from the panel and manuscript highlights when true. */
  closed?: boolean;
  /** Book-scoped continuity: chapter that holds the excerpt. */
  chapterId?: string;
  /** Optional scene index within that chapter for jump-to. */
  sceneIndex?: number;
}

export interface DevelopmentalPass {
  id: string;
  kind: DevelopmentalPassKind;
  chapterId: string;
  chapterTitle: string;
  createdAt: number;
  /** High-level editorial skim of the pass. */
  summary: string;
  flags: DevelopmentalFlag[];
}

/** Durable notes the editor keeps across chapters and sessions. */
export interface DevelopmentalMemoryNote {
  id: string;
  at: number;
  kind: DevelopmentalPassKind | "general" | "preference";
  text: string;
}

export interface DevelopmentalEditorState {
  memory: DevelopmentalMemoryNote[];
  passes: DevelopmentalPass[];
}

/** Emotional beat from an AI beta reader — never rewritten prose. */
export type BetaEmotion =
  | "surprised"
  | "bored"
  | "shocked"
  | "moved"
  | "confused"
  | "delighted"
  | "tense"
  | "detached"
  | "curious"
  | "skeptical"
  | "anxious"
  | "amused"
  | "heartbroken"
  | "hopeful";

export const BETA_EMOTION_META: Record<BetaEmotion, { label: string }> = {
  surprised: { label: "Surprised" },
  bored: { label: "Bored" },
  shocked: { label: "Shocked" },
  moved: { label: "Moved" },
  confused: { label: "Confused" },
  delighted: { label: "Delighted" },
  tense: { label: "Tense" },
  detached: { label: "Detached" },
  curious: { label: "Curious" },
  skeptical: { label: "Skeptical" },
  anxious: { label: "Anxious" },
  amused: { label: "Amused" },
  heartbroken: { label: "Heartbroken" },
  hopeful: { label: "Hopeful" },
};

export type BetaCraftQuestionId =
  | "goals-clear"
  | "voices-distinct"
  | "weakest-character"
  | "high-points-earned"
  | "loved"
  | "disliked";

export interface BetaReaderPersona {
  id: string;
  name: string;
  /** Short taste / reading posture for prompts. */
  blurb: string;
}

export interface BetaReaction {
  id: string;
  emotion: BetaEmotion;
  /** Optional findable moment from the chapter. */
  excerpt?: string;
  note: string;
}

export interface BetaCraftAnswer {
  questionId: BetaCraftQuestionId;
  answer: string;
}

export interface BetaReview {
  id: string;
  readerId: string;
  chapterId: string;
  chapterTitle: string;
  createdAt: number;
  summary: string;
  reactions: BetaReaction[];
  craftAnswers: BetaCraftAnswer[];
}

/** Cross-chapter impressions this persona carries forward. */
export interface BetaMemoryNote {
  id: string;
  at: number;
  readerId: string;
  kind: "impression" | "expectation" | "attachment" | "confusion" | "general";
  text: string;
  chapterId?: string;
}

export interface BetaReadersState {
  readers: BetaReaderPersona[];
  memory: BetaMemoryNote[];
  reviews: BetaReview[];
}

/** One free page in the book dump (scraps, names, spare scenes). */
export interface DumpPage {
  id: string;
  title: string;
  /** TipTap HTML — freeform, not part of the manuscript. */
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface DumpState {
  pages: DumpPage[];
  activePageId: string;
}

export const CHARACTER_ROLE_META: Record<
  CharacterRole,
  { label: string }
> = {
  protagonist: { label: "Protagonist" },
  antagonist: { label: "Antagonist" },
  deuteragonist: { label: "Deuteragonist" },
  supporting: { label: "Supporting" },
  minor: { label: "Minor" },
  unspecified: { label: "Unspecified" },
};

export const CHARACTER_DEPTH_META: Record<
  CharacterDepth,
  { label: string; hint: string }
> = {
  stub: { label: "Stub", hint: "A name — waiting for the page" },
  sketch: { label: "Sketch", hint: "Role or blurb started" },
  portrait: { label: "Portrait", hint: "Identity taking shape" },
  living: { label: "Living", hint: "Voice, arc, and story presence" },
};

export const LOCATION_KIND_META: Record<LocationKind, { label: string }> = {
  interior: { label: "Interior" },
  exterior: { label: "Exterior" },
  settlement: { label: "Settlement" },
  landmark: { label: "Landmark" },
  threshold: { label: "Threshold" },
  region: { label: "Region" },
  unspecified: { label: "Unspecified" },
};

export const LOCATION_DEPTH_META: Record<
  LocationDepth,
  { label: string; hint: string }
> = {
  stub: { label: "Stub", hint: "A name — waiting for the page" },
  sketch: { label: "Sketch", hint: "Kind or blurb started" },
  portrait: { label: "Portrait", hint: "Sensory detail taking shape" },
  living: { label: "Living", hint: "Atmosphere, story use, and presence" },
};

export const RESEARCH_KIND_META: Record<ResearchKind, { label: string }> = {
  theme: { label: "Theme" },
  motif: { label: "Motif" },
  period: { label: "Period" },
  craft: { label: "Craft" },
  source: { label: "Source" },
  lore: { label: "Lore" },
  question: { label: "Question" },
  unspecified: { label: "Unspecified" },
};

export const RESEARCH_DEPTH_META: Record<
  ResearchDepth,
  { label: string; hint: string }
> = {
  stub: { label: "Stub", hint: "A title — waiting for notes" },
  sketch: { label: "Sketch", hint: "Kind or blurb started" },
  portrait: { label: "Portrait", hint: "Findings taking shape" },
  living: { label: "Living", hint: "Sources, links, and story presence" },
};

export const TRASH_KIND_META: Record<TrashKind, { label: string }> = {
  scene: { label: "Scene" },
  chapter: { label: "Chapter" },
  character: { label: "Character" },
  location: { label: "Location" },
  research: { label: "Research" },
};

export const DEVELOPMENTAL_PASS_META: Record<
  DevelopmentalPassKind,
  { label: string; blurb: string }
> = {
  style: {
    label: "Style & Mechanics",
    blurb:
      "Filter words, weak verbs, repetition, dialogue tags, and -ly adverbs.",
  },
  story: {
    label: "Story & Structure",
    blurb:
      "Telling vs showing, pacing, plot holes, and character voice — flags only.",
  },
  line: {
    label: "Line Edit",
    blurb:
      "Flow & rhythm, cut redundancy, sharpen diction, polish dialogue, show don’t tell — this chapter only.",
  },
  continuity: {
    label: "Continuity",
    blurb:
      "Whole-book consistency — names, cast, places, timeline, and forgotten details.",
  },
};

export const DEVELOPMENTAL_CATEGORY_META: Record<
  DevelopmentalFlagCategory,
  { label: string; pass: DevelopmentalPassKind }
> = {
  "filter-words": { label: "Filter words", pass: "style" },
  "weak-verbs": { label: "Weak verbs", pass: "style" },
  repetition: { label: "Repetition", pass: "style" },
  "dialogue-tags": { label: "Dialogue tags", pass: "style" },
  adverbs: { label: "Adverbs", pass: "style" },
  telling: { label: "Telling vs showing", pass: "story" },
  pacing: { label: "Pacing", pass: "story" },
  "plot-holes": { label: "Plot holes", pass: "story" },
  "character-voice": { label: "Character voice", pass: "story" },
  "flow-rhythm": { label: "Flow & rhythm", pass: "line" },
  redundancy: { label: "Redundancy", pass: "line" },
  "word-choice": { label: "Word choice", pass: "line" },
  "dialogue-polish": { label: "Dialogue", pass: "line" },
  "show-dont-tell": { label: "Show, don’t tell", pass: "line" },
  "name-variants": { label: "Name variants", pass: "continuity" },
  "cast-mismatch": { label: "Cast mismatch", pass: "continuity" },
  "location-jump": { label: "Location jump", pass: "continuity" },
  timeline: { label: "Timeline", pass: "continuity" },
  "forgotten-detail": { label: "Forgotten detail", pass: "continuity" },
  "orphan-tag": { label: "Orphan tag", pass: "continuity" },
};

export interface AppSettings {
  theme: ThemeId;
  focusMode: boolean;
  fontSize: number;
  lineHeight: number;
  fullscreen: boolean;
  /** Manuscript Contents (chapter list) panel. */
  sidebarOpen: boolean;
  /** Main Folio tool nav (Books, Storyboard, …). */
  appNavOpen: boolean;
  storyboardZoom: StoryboardZoom;
  outlineScale: OutlineScale;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "classic",
  focusMode: false,
  fontSize: 20,
  lineHeight: 1.7,
  fullscreen: false,
  sidebarOpen: true,
  appNavOpen: true,
  storyboardZoom: "medium",
  outlineScale: "balanced",
};

export const SCENE_STATUS_META: Record<
  SceneStatus,
  { label: string; shortLabel: string; color: string; bg: string }
> = {
  // Planned / empty — warm gray
  outline: {
    label: "Not started",
    shortLabel: "Outline",
    color: "#9C9590",
    bg: "rgba(156, 149, 144, 0.14)",
  },
  // Has words but unfinished — muted gold
  draft: {
    label: "Come back to",
    shortLabel: "Partial",
    color: "#B89A5E",
    bg: "rgba(184, 154, 94, 0.16)",
  },
  // Actively mid-scene — soft amber (same family as partial)
  writing: {
    label: "In progress",
    shortLabel: "Writing",
    color: "#C4A574",
    bg: "rgba(196, 165, 116, 0.16)",
  },
  // Complete enough, needs a pass — muted clay
  revising: {
    label: "Needs revision",
    shortLabel: "Revise",
    color: "#B07D6A",
    bg: "rgba(176, 125, 106, 0.16)",
  },
  // Done — muted sage
  final: {
    label: "Finished",
    shortLabel: "Done",
    color: "#7A9588",
    bg: "rgba(122, 149, 136, 0.16)",
  },
};

/** Cycle used by the manuscript scene dots. */
export const SCENE_STATUS_CYCLE: SceneStatus[] = [
  "outline",
  "draft",
  "revising",
  "final",
];

export function nextSceneStatus(current: SceneStatus): SceneStatus {
  const i = SCENE_STATUS_CYCLE.indexOf(
    current === "writing" ? "draft" : current,
  );
  const from = i >= 0 ? i : 0;
  return SCENE_STATUS_CYCLE[(from + 1) % SCENE_STATUS_CYCLE.length];
}

/** Muted POV ring colors — deterministic by name. */
export const POV_PALETTE = [
  "#8B7355",
  "#6B7F94",
  "#7A8F6E",
  "#9A7B8A",
  "#7A8A8A",
  "#A07850",
  "#6E7A8F",
  "#8A847A",
] as const;

export function povColor(name: string): string {
  if (!name.trim()) return "transparent";
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return POV_PALETTE[Math.abs(hash) % POV_PALETTE.length];
}

export function readingMinutes(wordCount: number): number {
  return Math.max(0, Math.round(wordCount / 238));
}
