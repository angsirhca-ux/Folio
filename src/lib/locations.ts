import type {
  Book,
  Chapter,
  Location,
  LocationConnection,
  LocationDepth,
  LocationKind,
  Scene,
} from "./types";
import { createId } from "./utils";
import { getSceneHtmlParts } from "./manuscriptScenes";
import { normalizeContinuityNotes } from "./continuity";

export function emptySensory() {
  return { sight: "", sound: "", smell: "", atmosphere: "" };
}

export function emptyPlace() {
  return { region: "", access: "", landmarks: "", scale: "" };
}

export function emptyStory() {
  return { function: "", firstImpression: "", changes: "" };
}

export function createLocation(
  partial: Partial<Location> & { name: string },
): Location {
  const now = Date.now();
  return {
    id: partial.id ?? createId(),
    name: partial.name.trim() || "Unnamed",
    aliases: partial.aliases ?? [],
    kind: partial.kind ?? "unspecified",
    shortBio: partial.shortBio ?? "",
    wiki: partial.wiki ?? "",
    sensory: { ...emptySensory(), ...partial.sensory },
    place: { ...emptyPlace(), ...partial.place },
    story: { ...emptyStory(), ...partial.story },
    connections: partial.connections ?? [],
    inhabitants: partial.inhabitants ?? [],
    belongsToIds: partial.belongsToIds ?? [],
    continuityNotes: normalizeContinuityNotes(partial.continuityNotes),
    secrets: partial.secrets ?? "",
    tags: partial.tags ?? [],
    storyDigest: partial.storyDigest ?? "",
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
  };
}

export function createLocationConnection(
  partial: Partial<LocationConnection> & { label: string },
): LocationConnection {
  return {
    id: partial.id ?? createId(),
    toLocationId: partial.toLocationId ?? "",
    toName: partial.toName ?? "",
    label: partial.label,
    notes: partial.notes ?? "",
  };
}

function filled(value: string | undefined | null): boolean {
  return Boolean(value && value.trim());
}

function countFilled(values: (string | undefined | null)[]): number {
  return values.filter(filled).length;
}

export function locationCompleteness(loc: Location): number {
  const fields = [
    loc.shortBio,
    loc.wiki,
    loc.kind !== "unspecified" ? "x" : "",
    loc.sensory.sight,
    loc.sensory.sound,
    loc.sensory.smell,
    loc.sensory.atmosphere,
    loc.place.region,
    loc.place.access,
    loc.place.landmarks,
    loc.place.scale,
    loc.story.function,
    loc.story.firstImpression,
    loc.story.changes,
    loc.secrets,
    loc.connections.length > 0 ? "x" : "",
    loc.inhabitants.length > 0 ? "x" : "",
    loc.aliases.length > 0 ? "x" : "",
    loc.tags.length > 0 ? "x" : "",
  ];
  return countFilled(fields) / fields.length;
}

export function locationDepth(
  loc: Location,
  appearanceCount = 0,
): LocationDepth {
  const complete = locationCompleteness(loc);
  const hasSketch =
    filled(loc.shortBio) || loc.kind !== "unspecified" || filled(loc.wiki);
  const hasPortrait =
    countFilled([
      loc.sensory.sight,
      loc.sensory.atmosphere,
      loc.place.region,
      loc.story.function,
    ]) >= 2;
  const hasLiving =
    (countFilled([
      loc.sensory.sight,
      loc.sensory.sound,
      loc.sensory.smell,
      loc.sensory.atmosphere,
      loc.story.function,
      loc.story.changes,
    ]) >= 3 &&
      appearanceCount >= 2) ||
    complete >= 0.55;

  if (hasLiving) return "living";
  if (hasPortrait || complete >= 0.28) return "portrait";
  if (hasSketch || appearanceCount >= 1) return "sketch";
  return "stub";
}

export function namesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function locationMatchesName(loc: Location, name: string): boolean {
  if (!name.trim()) return false;
  if (namesMatch(loc.name, name)) return true;
  return loc.aliases.some((alias) => namesMatch(alias, name));
}

export function findLocationByName(
  locations: Location[],
  name: string,
): Location | undefined {
  return locations.find((l) => locationMatchesName(l, name));
}

export interface LocationAppearance {
  chapterId: string;
  chapterTitle: string;
  chapterIndex: number;
  scene: Scene;
  sceneIndex: number;
  tagged: boolean;
  viaProse: boolean;
  matchedAs?: string;
}

export function locationAppearances(
  chapters: Chapter[],
  location: Location,
): LocationAppearance[] {
  const out: LocationAppearance[] = [];
  const forms = [location.name, ...location.aliases]
    .map((n) => n.trim())
    .filter((n) => n.length >= 2)
    .sort((a, b) => b.length - a.length);

  chapters.forEach((chapter, chapterIndex) => {
    const parts = getSceneHtmlParts(chapter.content);
    (chapter.scenes ?? []).forEach((scene, sceneIndex) => {
      const tagged = locationMatchesName(location, scene.location);
      const prose = scenePlainText(parts[sceneIndex] ?? "");
      let viaProse = false;
      let matchedAs: string | undefined;
      if (!tagged) {
        for (const n of forms) {
          if (nameMentionedInText(prose, n)) {
            viaProse = true;
            matchedAs = n;
            break;
          }
        }
      }
      if (tagged || viaProse) {
        out.push({
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          chapterIndex,
          scene,
          sceneIndex,
          tagged,
          viaProse,
          matchedAs,
        });
      }
    });
  });
  return out;
}

function scenePlainText(html: string): string {
  return html
    .replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "…")
    .replace(/&lsquo;/g, "‘")
    .replace(/&rsquo;/g, "’")
    .replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”")
    .replace(/[ \t]+/g, " ")
    .replace(/\n+/g, "\n")
    .trim();
}

function nameMentionedInText(text: string, name: string): boolean {
  const n = name.trim();
  if (!n || n.length < 2) return false;
  const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?:^|[^\\p{L}])${escaped}(?:[^\\p{L}]|$)`, "iu");
  return re.test(text);
}

function collectTaggedLocations(chapters: Chapter[]): string[] {
  const names = new Set<string>();
  for (const ch of chapters) {
    for (const s of ch.scenes ?? []) {
      if (s.location.trim()) names.add(s.location.trim());
    }
  }
  return [...names];
}

function canonicalizeNames(names: string[]): Map<string, string> {
  const byKey = new Map<string, string>();
  for (const name of names) {
    const key = name.trim().toLowerCase();
    if (!key) continue;
    const prev = byKey.get(key);
    if (!prev || name.length > prev.length) byKey.set(key, name.trim());
  }
  return byKey;
}

/** If scene.location is empty and a known place is named in prose, tag it. */
function tagScenesWithKnownLocations(
  chapters: Chapter[],
  knownNames: string[],
): Chapter[] {
  if (knownNames.length === 0) return chapters;
  let changed = false;

  const next = chapters.map((ch) => {
    const parts = getSceneHtmlParts(ch.content);
    let chapterChanged = false;
    const scenes = (ch.scenes ?? []).map((scene, i) => {
      if (scene.location.trim()) return scene;
      const text = scenePlainText(parts[i] ?? "");
      if (!text) return scene;
      for (const name of knownNames) {
        if (!nameMentionedInText(text, name)) continue;
        chapterChanged = true;
        return { ...scene, location: name, updatedAt: Date.now() };
      }
      return scene;
    });
    if (!chapterChanged) return ch;
    changed = true;
    return { ...ch, scenes, updatedAt: Date.now() };
  });

  return changed ? next : chapters;
}

const AUTO_CONN_PREFIX = "Shared story";

function buildStoryDigest(
  location: Location,
  appearances: LocationAppearance[],
): string {
  if (appearances.length === 0) {
    return "Not yet on the page — named in the atlas but no matching scenes.";
  }

  const lines: string[] = [
    `Appears in ${appearances.length} scene${appearances.length === 1 ? "" : "s"}.`,
    "",
  ];

  for (const a of appearances) {
    const bit = a.scene.synopsis?.trim() || a.scene.title;
    const cast = [
      a.scene.pov,
      ...(a.scene.characters ?? []),
    ]
      .map((n) => n.trim())
      .filter(Boolean);
    lines.push(
      `• ${a.chapterTitle} / ${a.scene.title}${a.tagged ? "" : " (prose)"}`,
    );
    if (bit && bit !== a.scene.title) lines.push(`  ${bit}`);
    if (cast.length) lines.push(`  People: ${[...new Set(cast)].join(", ")}`);
  }

  if (location.inhabitants.length) {
    lines.push("", `Frequent faces: ${location.inhabitants.join(", ")}`);
  }

  return lines.join("\n").trim();
}

function inferKind(name: string, appearanceCount: number): LocationKind {
  const n = name.toLowerCase();
  if (/street|road|lane|alley|path/.test(n)) return "exterior";
  if (/garden|yard|park|river|bank|wood|forest|field/.test(n)) return "exterior";
  if (/town|city|village|harbor|harbour/.test(n)) return "settlement";
  if (/door|gate|threshold|crossing|bridge/.test(n)) return "threshold";
  if (/study|room|house|hall|kitchen|chamber|office|inn/.test(n))
    return "interior";
  if (appearanceCount >= 3) return "landmark";
  return "unspecified";
}

function enrichLocationFromStory(
  location: Location,
  appearances: LocationAppearance[],
): Location {
  const storyDigest = buildStoryDigest(location, appearances);
  let next: Location = { ...location, storyDigest };

  if (next.kind === "unspecified" && appearances.length > 0) {
    next = {
      ...next,
      kind: inferKind(next.name, appearances.length),
    };
  }

  if (!filled(next.shortBio) && appearances.length > 0) {
    const first =
      appearances.find((a) => a.scene.synopsis.trim()) ?? appearances[0];
    if (first?.scene.synopsis.trim()) {
      const bio = first.scene.synopsis.trim();
      next = {
        ...next,
        shortBio: bio.length > 140 ? `${bio.slice(0, 137).trim()}…` : bio,
      };
    }
  }

  if (!filled(next.wiki) && appearances.length > 0) {
    next = {
      ...next,
      wiki: `Compiled from the manuscript as of this draft. Edit freely — the “From the manuscript” digest below stays in sync with scenes.\n\n${storyDigest}`,
    };
  }

  if (
    !filled(next.story.firstImpression) &&
    appearances[0]?.scene.synopsis.trim()
  ) {
    next = {
      ...next,
      story: {
        ...next.story,
        firstImpression: appearances[0].scene.synopsis.trim(),
      },
    };
  }

  if (!filled(next.story.changes) && appearances.length > 1) {
    const turns = appearances
      .slice(1)
      .map((a) => a.scene.synopsis.trim() || a.scene.title)
      .filter(Boolean);
    if (turns.length) {
      next = {
        ...next,
        story: { ...next.story, changes: turns.join(" · ") },
      };
    }
  }

  // Inhabitants from cast on appearing scenes
  const people = new Set(next.inhabitants.map((n) => n.trim()).filter(Boolean));
  for (const a of appearances) {
    if (a.scene.pov.trim()) people.add(a.scene.pov.trim());
    for (const n of a.scene.characters ?? []) {
      if (n.trim()) people.add(n.trim());
    }
  }
  next = { ...next, inhabitants: [...people].sort((a, b) => a.localeCompare(b)) };

  const tags = new Set(next.tags);
  tags.add("from-story");
  const manual = next.connections.filter(
    (c) => !c.notes.startsWith(AUTO_CONN_PREFIX),
  );
  next = { ...next, tags: [...tags], connections: manual };

  const touched =
    next.kind !== location.kind ||
    next.shortBio !== location.shortBio ||
    next.wiki !== location.wiki ||
    next.storyDigest !== location.storyDigest ||
    next.story.firstImpression !== location.story.firstImpression ||
    next.story.changes !== location.story.changes ||
    next.inhabitants.join("|") !== location.inhabitants.join("|") ||
    next.tags.join("|") !== location.tags.join("|");

  if (!touched) return location;
  return { ...next, updatedAt: Date.now() };
}

function buildAutoConnections(
  location: Location,
  appearances: LocationAppearance[],
  chapters: Chapter[],
  roster: Location[],
): LocationConnection[] {
  const manual = location.connections.filter(
    (c) => !c.notes.startsWith(AUTO_CONN_PREFIX),
  );
  const counts = new Map<string, number>();

  for (const a of appearances) {
    const chapter = chapters.find((c) => c.id === a.chapterId);
    if (!chapter) continue;
    for (const s of chapter.scenes ?? []) {
      const name = s.location.trim();
      if (!name || locationMatchesName(location, name)) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }

  const auto: LocationConnection[] = [];
  for (const [name, count] of [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)) {
    const linked = findLocationByName(roster, name);
    const already = manual.some(
      (r) =>
        (linked && r.toLocationId === linked.id) || namesMatch(r.toName, name),
    );
    if (already) continue;
    auto.push(
      createLocationConnection({
        id: `auto-loc-${location.id}-${name.trim().toLowerCase()}`,
        toLocationId: linked?.id ?? "",
        toName: linked?.name ?? name,
        label: "nearby in story",
        notes: `${AUTO_CONN_PREFIX} (${count})`,
      }),
    );
  }

  return [...manual, ...auto];
}

export function ensureBookLocations(
  book: Omit<
    Book,
    | "locations"
    | "research"
    | "trash"
    | "developmentalEditor"
    | "betaReaders"
    | "dump"
  > & {
    locations?: Location[];
    research?: Book["research"];
    trash?: Book["trash"];
    developmentalEditor?: Book["developmentalEditor"];
    betaReaders?: Book["betaReaders"];
    critique?: Book["critique"];
    dump?: Book["dump"];
  },
): Book {
  const raw = book.locations ?? [];
  const normalized: Book = {
    ...book,
    research: book.research ?? [],
    trash: book.trash ?? [],
    developmentalEditor: book.developmentalEditor ?? {
      memory: [],
      passes: [],
    },
    betaReaders: book.betaReaders ?? {
      readers: [],
      memory: [],
      reviews: [],
    },
    critique: book.critique ?? {
      memory: [],
      reviews: [],
    },
    dump: book.dump ?? { pages: [], activePageId: "" },
    locations: raw.map((l) =>
      createLocation({
        ...l,
        name: l.name || "Unnamed",
        sensory: { ...emptySensory(), ...l.sensory },
        place: { ...emptyPlace(), ...l.place },
        story: { ...emptyStory(), ...l.story },
        connections: l.connections ?? [],
        inhabitants: l.inhabitants ?? [],
        belongsToIds: l.belongsToIds ?? [],
        continuityNotes: l.continuityNotes,
        aliases: l.aliases ?? [],
        tags: l.tags ?? [],
        storyDigest: l.storyDigest ?? "",
      }),
    ),
  };
  return syncLocationsFromManuscript(normalized);
}

export function renameLocationInChapters(
  chapters: Chapter[],
  oldName: string,
  newName: string,
): Chapter[] {
  if (!oldName.trim() || namesMatch(oldName, newName)) return chapters;
  return chapters.map((ch) => ({
    ...ch,
    scenes: (ch.scenes ?? []).map((s) => ({
      ...s,
      location: namesMatch(s.location, oldName) ? newName : s.location,
      updatedAt: Date.now(),
    })),
    updatedAt: Date.now(),
  }));
}

export function syncLocationsFromManuscript(book: Book): Book {
  const tagged = collectTaggedLocations(book.chapters);
  const existing = book.locations ?? [];
  const canon = canonicalizeNames([
    ...tagged,
    ...existing.flatMap((l) => [l.name, ...l.aliases]),
  ]);

  let locations = [...existing];
  let created = false;
  for (const name of canon.values()) {
    if (findLocationByName(locations, name)) continue;
    locations.push(
      createLocation({
        name,
        tags: ["from-story"],
      }),
    );
    created = true;
  }

  const knownNames = locations.map((l) => l.name);
  const chapters = tagScenesWithKnownLocations(book.chapters, knownNames);
  const chaptersChanged = chapters !== book.chapters;

  let locationsChanged = created;
  locations = locations.map((l) => {
    const appearances = locationAppearances(chapters, l);
    const enriched = enrichLocationFromStory(l, appearances);
    if (enriched !== l) locationsChanged = true;
    return enriched;
  });

  locations = locations.map((l) => {
    const appearances = locationAppearances(chapters, l);
    const connections = buildAutoConnections(l, appearances, chapters, locations);
    const same =
      JSON.stringify(connections) === JSON.stringify(l.connections);
    if (same) return l;
    locationsChanged = true;
    return { ...l, connections, updatedAt: Date.now() };
  });

  // Fix connection target ids
  locations = locations.map((l) => {
    let relChanged = false;
    const connections = l.connections.map((r) => {
      if (r.toLocationId) return r;
      if (!r.toName.trim()) return r;
      const linked = findLocationByName(locations, r.toName);
      if (!linked) return r;
      relChanged = true;
      return { ...r, toLocationId: linked.id, toName: linked.name };
    });
    if (!relChanged) return l;
    locationsChanged = true;
    return { ...l, connections, updatedAt: Date.now() };
  });

  if (!locationsChanged && !chaptersChanged) return book;

  return {
    ...book,
    chapters,
    locations,
    updatedAt: Date.now(),
  };
}

export const KIND_OPTIONS: { value: LocationKind; label: string }[] = [
  { value: "interior", label: "Interior" },
  { value: "exterior", label: "Exterior" },
  { value: "settlement", label: "Settlement" },
  { value: "landmark", label: "Landmark" },
  { value: "threshold", label: "Threshold" },
  { value: "region", label: "Region" },
  { value: "unspecified", label: "Unspecified" },
];
