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

/**
 * A dated continuity crumb on a bible card —
 * “as of Ch. 12: believes X.” Not a full progression system.
 */
export interface ContinuityNote {
  id: string;
  /** Freeform anchor — “Ch. 12”, “After the fire”, “draft 3”. */
  asOf: string;
  note: string;
  createdAt: number;
  updatedAt: number;
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
  /** Encyclopedia cards this character belongs to (faction, species…). */
  belongsToIds: string[];
  /** Light progressions — what is true as of a chapter or moment. */
  continuityNotes: ContinuityNote[];
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

/** Parent → child edge inside a family tree. */
export interface FamilyTreeLink {
  id: string;
  parentId: string;
  childId: string;
}

/** Partner / spouse pair inside a family tree (undirected). */
export interface FamilyTreeUnion {
  id: string;
  aId: string;
  bId: string;
}

/** A named genealogy chart for this book — one cast can have several. */
export interface FamilyTree {
  id: string;
  name: string;
  order: number;
  /** Characters included on this chart. */
  memberIds: string[];
  links: FamilyTreeLink[];
  unions: FamilyTreeUnion[];
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
  /** Encyclopedia cards this place belongs to (region, institution…). */
  belongsToIds: string[];
  /** Light progressions — what is true as of a chapter or moment. */
  continuityNotes: ContinuityNote[];
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

/** Outside sources and reference — articles, period facts, craft, questions. */
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

/** How fleshed-out an encyclopedia entry is — grows as you gather. */
export type EncyclopediaDepth = "stub" | "sketch" | "portrait" | "living";

/**
 * @deprecated Fixed kinds — migrated into custom `EncyclopediaStack`s on hydrate.
 */
export type LegacyEncyclopediaKind =
  | "customs"
  | "magic"
  | "creature"
  | "faction"
  | "item"
  | "culture"
  | "event"
  | "concept"
  | "mythology"
  | "unspecified";

/** A user-named stack on the encyclopedia shelf (e.g. “Customs”, “Case files”). */
export interface EncyclopediaStack {
  id: string;
  name: string;
  /** Muted accent from the encyclopedia stack palette. */
  color: string;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface EncyclopediaLink {
  id: string;
  toEntryId: string;
  toTitle: string;
  label: string;
  notes: string;
}

/** A world-bible article inside the story — not outside research. */
export interface EncyclopediaEntry {
  id: string;
  title: string;
  aliases: string[];
  /** Which custom stack this card lives in. */
  stackId: string;
  /** One-line index blurb. */
  shortBio: string;
  /** Freeform canon notes. */
  wiki: string;
  /** Distilled canon summary. */
  summary: string;
  links: EncyclopediaLink[];
  linkedCharacters: string[];
  linkedLocations: string[];
  /** Cast members tied to this card (faction, species, institution…). */
  memberIds: string[];
  /** Places tied to this card (territory, HQ, sacred site…). */
  memberLocationIds: string[];
  /** Light progressions — what is true as of a chapter or moment. */
  continuityNotes: ContinuityNote[];
  /** Optional JPEG/PNG data URL for the card shelf. */
  coverImage?: string;
  coverName?: string;
  tags: string[];
  /**
   * Auto-refreshed digest from scenes, labels, and prose.
   * Safe to overwrite on sync — separate from freeform `wiki`.
   */
  storyDigest: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * A dated (or ordered) event in the world’s history — not a plot beat.
 * Links into encyclopedia / cast / places for the lore bible.
 */
export interface ChronicleEvent {
  id: string;
  title: string;
  summary: string;
  /** Sort key — lower is earlier. */
  order: number;
  /** Freeform when — “Age of Ash”, “1123”, “Before the war”. */
  whenLabel: string;
  linkedEntryIds: string[];
  linkedCharacterIds: string[];
  linkedLocationIds: string[];
  /**
   * Optional soft marker on a story map — lore geography, not a Location pin.
   * Cleared if the map is deleted.
   */
  mapMarker?: {
    mapId: string;
    x: number;
    y: number;
  };
  createdAt: number;
  updatedAt: number;
}

/** A track on the novel’s listening playlist — fun, not canon. */
export interface SoundtrackSong {
  id: string;
  title: string;
  artist: string;
  /** Why it fits the book — mood, character, or arc beat. */
  note: string;
  /** Freeform slot — Opening, Midpoint, Finale, Credits… */
  placement: string;
  order: number;
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
  /** Per-chapter compile overrides for export and preview. */
  compile?: ChapterCompileSettings;
  createdAt: number;
  updatedAt: number;
}

/** Export / preview formatting for one chapter. */
export interface ChapterCompileSettings {
  /** Leave out of compile, preview, and word count for export selection. */
  omitFromExport?: boolean;
  /** Do not inject or emphasize the chapter title heading. */
  suppressTitle?: boolean;
  /** Force a page break before this chapter (export + preview). */
  pageBreakBefore?: boolean;
  /** Optional part divider — e.g. "Part II". Shown when it changes from prior chapter. */
  partLabel?: string;
}

export type TrashKind =
  | "scene"
  | "chapter"
  | "character"
  | "location"
  | "research"
  | "encyclopedia";

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
  | { kind: "research"; entry: ResearchEntry }
  | { kind: "encyclopedia"; entry: EncyclopediaEntry };

/** A full manuscript moved out of the library shelf. */
export interface TrashedBook {
  id: string;
  deletedAt: number;
  book: Book;
}

/** Shared cast / places / lore across books in a series. */
export interface Series {
  id: string;
  title: string;
  synopsis: string;
  /** Freeform series lore — never appears in any manuscript. */
  notes: string;
  characters: Character[];
  locations: Location[];
  encyclopedia: EncyclopediaEntry[];
  encyclopediaStacks: EncyclopediaStack[];
  /** Shared geography corkboards for books in this series. */
  maps: StoryMap[];
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

/**
 * Structured findings from one full Claude manuscript read.
 * Populate buttons apply slices; Reread refreshes when the book moves on.
 */
export interface ManuscriptIndexData {
  generatedAt: number;
  sourceHash: string;
  characters: Array<{
    name: string;
    role?: CharacterRole;
    shortBio?: string;
    evidence?: string;
    aliases?: string[];
    /** present = on-stage; mentioned = talked about only */
    presence?: "present" | "mentioned";
  }>;
  locations: Array<{
    name: string;
    kind?: LocationKind;
    shortBio?: string;
    evidence?: string;
  }>;
  research: Array<{
    title: string;
    kind?: ResearchKind;
    shortBio?: string;
    evidence?: string;
  }>;
  encyclopedia: Array<{
    title: string;
    stackName?: string;
    shortBio?: string;
    evidence?: string;
  }>;
  chronicle: Array<{
    title: string;
    whenLabel?: string;
    summary?: string;
    order?: number;
    linkedCharacterNames?: string[];
    linkedLocationNames?: string[];
    linkedEntryTitles?: string[];
  }>;
  plotThreads: Array<{
    name: string;
    color?: string;
    summary?: string;
  }>;
  plotAssignments: Array<{
    sceneId: string;
    threadNames: string[];
  }>;
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
  /** Named family trees for the cast. */
  familyTrees: FamilyTree[];
  locations: Location[];
  research: ResearchEntry[];
  /** In-world canon articles, grouped by custom stacks. */
  encyclopedia: EncyclopediaEntry[];
  /** User-named stacks that group encyclopedia cards. */
  encyclopediaStacks: EncyclopediaStack[];
  /** World history events (lore chronicle — not plot Timeline). */
  chronicle: ChronicleEvent[];
  /** Listening playlist for the novel — Claude or author curated. */
  soundtrack: SoundtrackSong[];
  /** One-line listening journey for the soundtrack (from Clarence). */
  soundtrackArc: string;
  /**
   * Author taste seeds (up to 4 artists). Clarence leans on these when composing.
   */
  soundtrackTaste: string[];
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
   * Genre critique lenses (e.g. Fantasy worldbuilding).
   * Checklist verdicts only — never rewrites the manuscript.
   */
  critique: CritiqueState;
  /**
   * Working dump — free pages for scraps, spare scenes, name lists,
   * and anything not yet sorted into the manuscript or wiki.
   */
  dump: DumpState;
  /** Named plot threads for the Timeline tracks view. */
  plotThreads: PlotThread[];
  /**
   * Shared Claude reading of the manuscript — populate bible surfaces from
   * this instead of re-reading on every click. Stale when sourceHash diverges.
   */
  manuscriptIndex?: ManuscriptIndexData;
  /**
   * Author answers Clarence asked before populate (e.g. first-person narrator).
   * Injected into index/enrich prompts so “I” maps to a real person.
   */
  clarenceContext?: {
    narratorName?: string;
    authorNotes?: string;
    updatedAt: number;
  };
  /** Optional link to a library series bible. */
  seriesId?: string | null;
  /** Daily / manuscript goals and day log. */
  goals: BookGoals;
  /** Dedication, copyright, epigraph — rendered when compile toggles are on. */
  frontMatter?: BookFrontMatter;
  /** Last-used compile & export options for this book. */
  compileSettings?: BookCompileSettings;
  activeChapterId: string;
  createdAt: number;
  updatedAt: number;
}

/** Structured front matter — content lives here; include flags live in compile settings. */
export interface BookFrontMatter {
  dedication?: string;
  copyright?: string;
  epigraph?: string;
  epigraphAttribution?: string;
}

/** Persisted subset of compile options (chapter selection refreshed at export time). */
export interface BookCompileSettings {
  preset?: "reading" | "submission";
  includeTitlePage?: boolean;
  includeToc?: boolean;
  sceneBreak?: "asterisks" | "blank" | "hash" | "none";
  includeDedication?: boolean;
  includeCopyright?: boolean;
  includeEpigraph?: boolean;
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
  /** Simple polylines — roads, paths, rivers. */
  paths: StoryMapPath[];
  /**
   * Optional real-world basemap as a data URL (JPEG/PNG).
   * For contemporary / urban settings — with story pins laid on top.
   */
  backgroundImage?: string;
  /** Original filename of the uploaded basemap, for the author UI. */
  backgroundName?: string;
  /**
   * Packaged vector board (crisp at any zoom). Mutually exclusive with
   * backgroundImage in the UI — City starter uses this.
   */
  backgroundVector?: "city";
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

/**
 * A simple polyline on the corkboard — road, path, or river.
 * Not freehand cartography: ordered points in 0–1 space.
 */
export type StoryMapPathKind = "road" | "path" | "river";

export interface StoryMapPath {
  id: string;
  name: string;
  kind: StoryMapPathKind;
  /** Ordered points in 0–1 map space (at least 2). */
  points: Array<{ x: number; y: number }>;
  source?: "author" | "claude";
}

/** Soft named area on the author map — wash, or a placed feature icon. */
export type StoryMapRegionKind =
  | "territory"
  | "mountains"
  | "water"
  | "building";

/** Outline for a painted territory — change anytime after drawing. */
export type StoryMapRegionShape = "rect" | "ellipse" | "soft" | "polygon";

/** Optional edge treatment for territory washes (default none). */
export type StoryMapRegionStroke = "none" | "soft" | "ink";

/**
 * Territory: painted wash box in 0–1 space (may be rotated / reshaped).
 * Mountains / water / building: point icons (small fixed box around a center).
 * Polygon: absolute outline points in 0–1 map space (shape creator).
 */
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
  /** Box, oval, organic, or free polygon outline. */
  shape: StoryMapRegionShape;
  /** Key into MAP_TERRITORY_PALETTE (e.g. "sage", "mist"). */
  color: string;
  /** Territory edge — none by default (fill only). */
  stroke?: StoryMapRegionStroke;
  /**
   * Absolute outline in 0–1 map space when shape is polygon.
   * Bounding box x/y/w/h is derived from these points.
   */
  points?: Array<{ x: number; y: number }>;
  /** Author-drawn vs Claude story build — rebuild replaces claude regions only. */
  source?: "author" | "claude";
}

/** Editorial passes — chapter craft vs book-wide continuity. */
export type DevelopmentalPassKind = "style" | "story" | "action" | "continuity";

export type DevelopmentalFlagCategory =
  | "filter-words"
  | "weak-verbs"
  | "repetition"
  | "dialogue-tags"
  | "adverbs"
  | "flow-rhythm"
  | "redundancy"
  | "word-choice"
  | "dialogue-polish"
  | "wrong-tense"
  | "tense-shift"
  | "flashback-tense"
  | "sequence-of-tenses"
  | "head-hop"
  | "knowledge-slip"
  | "outside-access"
  | "person-shift"
  | "telling"
  | "pacing"
  | "plot-holes"
  | "character-voice"
  | "summarized-action"
  | "static-description"
  | "talking-heads"
  | "blurred-sequence"
  | "named-emotion-action"
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
   * Exactly two panel-only suggestions:
   * [0] direction (gentle craft steer), [1] short illustrative example.
   * Never inserted into the manuscript.
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
  | "follow-up"
  | "keep-reading"
  | "skimmed"
  | "believed"
  | "loved"
  | "disliked"
  | "carrying"
  | "opening-hold"
  | "middle-drag"
  | "ending-land"
  /** @deprecated Stored on older reviews — mapped on load. */
  | "goals-clear"
  | "voices-distinct"
  | "weakest-character"
  | "high-points-earned";

export type BetaWouldContinue = "yes" | "maybe" | "no";

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
  /**
   * Closing reader wish: what they'd emotionally want instead,
   * or an explicit "like it as-is / change nothing."
   */
  readerWish: string;
  /** Would this reader turn the page tonight? */
  wouldContinue?: BetaWouldContinue;
  /** True when this chapter was the last in the manuscript at read time. */
  terminalChapter?: boolean;
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

/** Pluggable genre / craft critique — packs replace brand lens UI. */
export type CritiqueLensId =
  | "fantasy-worldbuilding"
  | "romancing-the-beat"
  | "truby"
  | "story-genius"
  | "selling-writer";

export type CritiquePackId = "smart" | "pressure";

export type CritiqueSectionId =
  | "scene"
  | "fantasy"
  | "romance"
  | "arc"
  | "pressure";

export type CritiqueVerdict = "yes" | "partial" | "no" | "n/a";

export interface CritiqueQuestion {
  id: string;
  prompt: string;
  /** What readers feel when the answer is no. */
  redFlag: string;
}

export interface CritiqueLens {
  id: CritiqueLensId;
  name: string;
  blurb: string;
  /** Soft genre tags for future filtering. */
  genres: string[];
  questions: CritiqueQuestion[];
}

export interface CritiquePackQuestion extends CritiqueQuestion {
  sectionId: CritiqueSectionId;
}

export interface CritiquePack {
  id: CritiquePackId;
  name: string;
  blurb: string;
  questions: CritiquePackQuestion[];
}

export interface CritiqueItemResult {
  questionId: string;
  sectionId: CritiqueSectionId;
  verdict: CritiqueVerdict;
  note: string;
  /** Verbatim moment when no/partial is grounded in the chapter. */
  excerpt?: string;
  /** Gentle watch-for seed — never replacement prose. */
  suggestion?: string;
}

export interface CritiqueReview {
  id: string;
  packId: CritiquePackId;
  /** Legacy single-lens reviews (pre-pack). */
  lensId?: CritiqueLensId;
  chapterId: string;
  chapterTitle: string;
  createdAt: number;
  summary: string;
  items: CritiqueItemResult[];
}

export interface CritiqueMemoryNote {
  id: string;
  at: number;
  packId: CritiquePackId;
  /** Legacy single-lens memory. */
  lensId?: CritiqueLensId;
  kind: "pattern" | "strength" | "risk" | "general";
  text: string;
  chapterId?: string;
}

export interface CritiqueState {
  memory: CritiqueMemoryNote[];
  reviews: CritiqueReview[];
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

export const ENCYCLOPEDIA_DEPTH_META: Record<
  EncyclopediaDepth,
  { label: string; hint: string }
> = {
  stub: { label: "Stub", hint: "A title — waiting for notes" },
  sketch: { label: "Sketch", hint: "Blurb started" },
  portrait: { label: "Portrait", hint: "Canon taking shape" },
  living: { label: "Living", hint: "Links and story presence" },
};

/** Labels used when migrating old fixed kind values into custom stacks. */
export const LEGACY_ENCYCLOPEDIA_KIND_LABEL: Record<string, string> = {
  customs: "Customs",
  magic: "Magic",
  creature: "Creatures",
  faction: "Factions",
  item: "Items",
  culture: "Culture",
  event: "Events",
  concept: "Concepts",
  mythology: "Mythology",
  unspecified: "General",
};

export const TRASH_KIND_META: Record<TrashKind, { label: string }> = {
  scene: { label: "Scene" },
  chapter: { label: "Chapter" },
  character: { label: "Character" },
  location: { label: "Location" },
  research: { label: "Research" },
  encyclopedia: { label: "Encyclopedia" },
};

export const DEVELOPMENTAL_PASS_META: Record<
  DevelopmentalPassKind,
  { label: string; blurb: string }
> = {
  style: {
    label: "Style & Line",
    blurb:
      "One line pass — filters, diction, tense slips, and POV hops. Flags only.",
  },
  story: {
    label: "Story & Structure",
    blurb:
      "Telling vs showing, pacing, plot holes, and character voice — flags only.",
  },
  action: {
    label: "Action",
    blurb:
      "Moments that want dramatized action — summarized beats, static description, talking-heads, blurry sequences.",
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
  "flow-rhythm": { label: "Flow & rhythm", pass: "style" },
  redundancy: { label: "Redundancy", pass: "style" },
  "word-choice": { label: "Word choice", pass: "style" },
  "dialogue-polish": { label: "Dialogue", pass: "style" },
  "wrong-tense": { label: "Wrong tense", pass: "style" },
  "tense-shift": { label: "Tense shift", pass: "style" },
  "flashback-tense": { label: "Flashback tense", pass: "style" },
  "sequence-of-tenses": { label: "Sequence of tenses", pass: "style" },
  "head-hop": { label: "Head hop", pass: "style" },
  "knowledge-slip": { label: "Knowledge slip", pass: "style" },
  "outside-access": { label: "Outside access", pass: "style" },
  "person-shift": { label: "Person shift", pass: "style" },
  telling: { label: "Telling vs showing", pass: "story" },
  pacing: { label: "Pacing", pass: "story" },
  "plot-holes": { label: "Plot holes", pass: "story" },
  "character-voice": { label: "Character voice", pass: "story" },
  "summarized-action": { label: "Summarized action", pass: "action" },
  "static-description": { label: "Static description", pass: "action" },
  "talking-heads": { label: "Talking heads", pass: "action" },
  "blurred-sequence": { label: "Blurred sequence", pass: "action" },
  "named-emotion-action": { label: "Named emotion", pass: "action" },
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
