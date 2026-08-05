import type {
  Book,
  Chapter,
  Character,
  CharacterDepth,
  CharacterRelationship,
  CharacterRole,
  Scene,
} from "./types";
import { createId } from "./utils";
import { getSceneHtmlParts } from "./manuscriptScenes";
import { normalizeContinuityNotes } from "./continuity";
import {
  expandNameForms,
  expandNameFormsForProse,
  nameMentionedInText,
  namesLikelySamePerson,
  preferCanonicalName,
  scenePlainText,
  suggestNameAliases,
} from "./nameContinuity";

export function emptyIdentity() {
  return { age: "", occupation: "", appearance: "", distinguishing: "" };
}

export function emptyPsychology() {
  return {
    wants: "",
    needs: "",
    fears: "",
    flaws: "",
    strengths: "",
  };
}

export function emptyVoice() {
  return { speechNotes: "", mannerisms: "", sample: "" };
}

export function emptyArc() {
  return { startingPoint: "", turningPoints: "", endingPoint: "" };
}

export function createCharacter(
  partial: Partial<Character> & { name: string },
): Character {
  const now = Date.now();
  return {
    id: partial.id ?? createId(),
    name: partial.name.trim() || "Unnamed",
    aliases: partial.aliases ?? [],
    role: partial.role ?? "unspecified",
    shortBio: partial.shortBio ?? "",
    wiki: partial.wiki ?? "",
    identity: { ...emptyIdentity(), ...partial.identity },
    psychology: { ...emptyPsychology(), ...partial.psychology },
    voice: { ...emptyVoice(), ...partial.voice },
    arc: { ...emptyArc(), ...partial.arc },
    relationships: partial.relationships ?? [],
    belongsToIds: partial.belongsToIds ?? [],
    continuityNotes: normalizeContinuityNotes(partial.continuityNotes),
    secrets: partial.secrets ?? "",
    tags: partial.tags ?? [],
    storyDigest: partial.storyDigest ?? "",
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
  };
}

/**
 * Collapse duplicate cast cards (“Lily” + “Lily Chen”) into one survivor.
 * Keeps the fuller name and richer sheet; returns survivors + ids to delete.
 */
export function collapseDuplicateCharacters(characters: Character[]): {
  kept: Character[];
  removedIds: string[];
} {
  const kept: Character[] = [];
  const removedIds: string[] = [];

  for (const c of characters) {
    const i = kept.findIndex((k) => namesLikelySamePerson(k.name, c.name));
    if (i < 0) {
      kept.push(c);
      continue;
    }
    const prev = kept[i]!;
    const canonical = preferCanonicalName(prev.name, c.name);
    const richer =
      characterCompleteness(c) > characterCompleteness(prev) ? c : prev;
    const thinner = richer.id === c.id ? prev : c;
    const aliasSet = new Set(
      [
        ...(prev.aliases ?? []),
        ...(c.aliases ?? []),
        prev.name,
        c.name,
        ...suggestNameAliases(canonical),
      ]
        .map((a) => a.trim())
        .filter((a) => a && a.toLowerCase() !== canonical.toLowerCase()),
    );
    kept[i] = {
      ...richer,
      name: canonical,
      aliases: [...aliasSet],
      role:
        richer.role !== "unspecified"
          ? richer.role
          : thinner.role !== "unspecified"
            ? thinner.role
            : richer.role,
      shortBio: richer.shortBio?.trim() || thinner.shortBio || "",
      wiki: richer.wiki?.trim() || thinner.wiki || "",
      updatedAt: Date.now(),
    };
    removedIds.push(thinner.id);
  }

  return { kept, removedIds };
}

export function createRelationship(
  partial: Partial<CharacterRelationship> & { label: string },
): CharacterRelationship {
  return {
    id: partial.id ?? createId(),
    toCharacterId: partial.toCharacterId ?? "",
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

/** Fraction of wiki fields completed (0–1), excluding name. */
export function characterCompleteness(c: Character): number {
  const fields = [
    c.shortBio,
    c.wiki,
    c.role !== "unspecified" ? "x" : "",
    c.identity.age,
    c.identity.occupation,
    c.identity.appearance,
    c.identity.distinguishing,
    c.psychology.wants,
    c.psychology.needs,
    c.psychology.fears,
    c.psychology.flaws,
    c.psychology.strengths,
    c.voice.speechNotes,
    c.voice.mannerisms,
    c.voice.sample,
    c.arc.startingPoint,
    c.arc.turningPoints,
    c.arc.endingPoint,
    c.secrets,
    c.relationships.length > 0 ? "x" : "",
    c.aliases.length > 0 ? "x" : "",
    c.tags.length > 0 ? "x" : "",
  ];
  return countFilled(fields) / fields.length;
}

export function characterDepth(
  c: Character,
  appearanceCount = 0,
): CharacterDepth {
  const complete = characterCompleteness(c);
  const hasSketch =
    filled(c.shortBio) || c.role !== "unspecified" || filled(c.wiki);
  const hasPortrait =
    countFilled([
      c.identity.appearance,
      c.identity.occupation,
      c.psychology.wants,
      c.psychology.fears,
      c.psychology.flaws,
    ]) >= 2;
  const hasLiving =
    (countFilled([
      c.voice.speechNotes,
      c.voice.mannerisms,
      c.voice.sample,
      c.arc.startingPoint,
      c.arc.turningPoints,
      c.arc.endingPoint,
    ]) >= 2 &&
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

export function characterMatchesName(c: Character, name: string): boolean {
  if (!name.trim()) return false;
  const forms = expandNameForms(c.name, c.aliases ?? []);
  if (forms.some((f) => namesMatch(f, name))) return true;
  // POV/cast tag may be a given name while the card holds a full name (or reverse).
  const tagForms = expandNameForms(name.trim(), []);
  return forms.some((f) => tagForms.some((t) => namesMatch(f, t)));
}

export function findCharacterByName(
  characters: Character[],
  name: string,
): Character | undefined {
  return characters.find((c) => characterMatchesName(c, name));
}

export interface CharacterAppearance {
  chapterId: string;
  chapterTitle: string;
  chapterIndex: number;
  scene: Scene;
  sceneIndex: number;
  asPov: boolean;
  /** Named in scene cast tags. */
  inCast: boolean;
  /** Found in scene prose (name or alias) without a cast/POV tag. */
  viaProse: boolean;
  /**
   * present = on-page (POV or cast tag).
   * mentioned = name appears in prose only (talked about / narrated) — not proof they are in the scene.
   */
  presence: "present" | "mentioned";
  /** Which form matched in prose, when viaProse. */
  matchedAs?: string;
}

/** Scenes where this character is cast, POV, or named in prose. */
export function characterAppearances(
  chapters: Chapter[],
  character: Character,
): CharacterAppearance[] {
  // POV/cast via characterMatchesName. Prose: no bare surnames.
  const proseForms = expandNameFormsForProse(
    character.name,
    character.aliases ?? [],
  );
  const out: CharacterAppearance[] = [];

  chapters.forEach((chapter, chapterIndex) => {
    const parts = getSceneHtmlParts(chapter.content ?? "");
    (chapter.scenes ?? []).forEach((scene, sceneIndex) => {
      const asPov = characterMatchesName(character, scene.pov);
      const inCast = (scene.characters ?? []).some((n) =>
        characterMatchesName(character, n),
      );
      let viaProse = false;
      let matchedAs: string | undefined;
      if (!asPov && !inCast && proseForms.length) {
        const prose = scenePlainText(parts[sceneIndex] ?? "");
        for (const form of proseForms) {
          if (nameMentionedInText(prose, form)) {
            viaProse = true;
            matchedAs = form;
            break;
          }
        }
      }
      if (asPov || inCast || viaProse) {
        const present = asPov || inCast;
        out.push({
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          chapterIndex,
          scene,
          sceneIndex,
          asPov,
          inCast,
          viaProse,
          presence: present ? "present" : "mentioned",
          matchedAs,
        });
      }
    });
  });
  return out;
}

/** On-page only — POV or cast tag. Excludes “talked about” prose hits. */
export function characterPresentAppearances(
  chapters: Chapter[],
  character: Character,
): CharacterAppearance[] {
  return characterAppearances(chapters, character).filter(
    (a) => a.presence === "present",
  );
}

/** Unique names mentioned on scenes that have no wiki entry yet. */
export function orphanMentions(
  chapters: Chapter[],
  characters: Character[],
): string[] {
  const names = new Set<string>();
  for (const ch of chapters) {
    for (const s of ch.scenes ?? []) {
      if (s.pov.trim()) names.add(s.pov.trim());
      for (const n of s.characters ?? []) {
        if (n.trim()) names.add(n.trim());
      }
    }
  }
  return [...names]
    .filter((n) => !findCharacterByName(characters, n))
    .sort((a, b) => a.localeCompare(b));
}

export function ensureBookCharacters(
  book: Omit<
    Book,
    | "characters"
    | "locations"
    | "research"
    | "trash"
    | "developmentalEditor"
    | "betaReaders"
    | "dump"
  > & {
    characters?: Character[];
    locations?: Book["locations"];
    research?: Book["research"];
    trash?: Book["trash"];
    developmentalEditor?: Book["developmentalEditor"];
    betaReaders?: Book["betaReaders"];
    critique?: Book["critique"];
    dump?: Book["dump"];
  },
): Book {
  const raw = book.characters ?? [];
  const normalized: Book = {
    ...book,
    locations: book.locations ?? [],
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
    characters: raw.map((c) =>
      createCharacter({
        ...c,
        name: c.name || "Unnamed",
        identity: { ...emptyIdentity(), ...c.identity },
        psychology: { ...emptyPsychology(), ...c.psychology },
        voice: { ...emptyVoice(), ...c.voice },
        arc: { ...emptyArc(), ...c.arc },
        relationships: c.relationships ?? [],
        aliases: c.aliases ?? [],
        belongsToIds: c.belongsToIds ?? [],
        continuityNotes: normalizeContinuityNotes(c.continuityNotes),
        tags: c.tags ?? [],
        storyDigest: c.storyDigest ?? "",
      }),
    ),
  };
  return syncCharactersFromManuscript(normalized);
}

/** Rewrite scene cast/POV strings when a character is renamed. */
export function renameCharacterInChapters(
  chapters: Chapter[],
  oldName: string,
  newName: string,
): Chapter[] {
  if (!oldName.trim() || namesMatch(oldName, newName)) return chapters;
  return chapters.map((ch) => ({
    ...ch,
    scenes: (ch.scenes ?? []).map((s) => ({
      ...s,
      pov: namesMatch(s.pov, oldName) ? newName : s.pov,
      characters: (s.characters ?? []).map((n) =>
        namesMatch(n, oldName) ? newName : n,
      ),
      updatedAt: Date.now(),
    })),
    updatedAt: Date.now(),
  }));
}

const AUTO_REL_PREFIX = "Shared scenes";

function collectTaggedNames(chapters: Chapter[]): string[] {
  const names = new Set<string>();
  for (const ch of chapters) {
    for (const s of ch.scenes ?? []) {
      if (s.pov.trim()) names.add(s.pov.trim());
      for (const n of s.characters ?? []) {
        if (n.trim()) names.add(n.trim());
      }
    }
  }
  return [...names];
}

/** Merge case variants onto a canonical spelling (first seen / longest). */
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

function tagScenesWithKnownNames(
  chapters: Chapter[],
  knownNames: string[],
): Chapter[] {
  if (knownNames.length === 0) return chapters;
  let changed = false;

  const next = chapters.map((ch) => {
    const parts = getSceneHtmlParts(ch.content);
    let chapterChanged = false;
    const scenes = (ch.scenes ?? []).map((scene, i) => {
      const html = parts[i] ?? "";
      const text = scenePlainText(html);
      if (!text) return scene;
      const cast = [...(scene.characters ?? [])];
      let sceneChanged = false;
      for (const name of knownNames) {
        if (!nameMentionedInText(text, name)) continue;
        if (cast.some((n) => namesMatch(n, name))) continue;
        if (namesMatch(scene.pov, name)) continue;
        cast.push(name);
        sceneChanged = true;
      }
      if (!sceneChanged) return scene;
      chapterChanged = true;
      return { ...scene, characters: cast, updatedAt: Date.now() };
    });
    if (!chapterChanged) return ch;
    changed = true;
    return { ...ch, scenes, updatedAt: Date.now() };
  });

  return changed ? next : chapters;
}

function buildStoryDigest(
  character: Character,
  appearances: CharacterAppearance[],
  coNames: { name: string; count: number }[],
): string {
  const present = appearances.filter((a) => a.presence === "present");
  const mentioned = appearances.filter((a) => a.presence === "mentioned");
  if (present.length === 0 && mentioned.length === 0) {
    return "Not yet on the page — tag them as POV or cast on scenes.";
  }

  const povCount = present.filter((a) => a.asPov).length;
  const lines: string[] = [
    present.length
      ? `Present in ${present.length} scene${present.length === 1 ? "" : "s"}${
          povCount ? ` (${povCount} as POV)` : ""
        }.`
      : "Not cast or POV on any scene yet.",
    mentioned.length
      ? `Mentioned (talked about) in ${mentioned.length} other scene${mentioned.length === 1 ? "" : "s"}.`
      : "",
    "",
  ].filter((l) => l !== "");

  for (const a of present) {
    const bit = a.scene.synopsis?.trim() || a.scene.title;
    const loc = a.scene.location?.trim();
    lines.push(
      `• ${a.chapterTitle} / ${a.scene.title}${a.asPov ? " (POV)" : " (cast)"}${
        loc ? ` — ${loc}` : ""
      }`,
    );
    if (bit && bit !== a.scene.title) {
      lines.push(`  ${bit}`);
    }
  }

  if (mentioned.length) {
    lines.push("", "Mentioned only:");
    for (const a of mentioned.slice(0, 12)) {
      lines.push(
        `• ${a.chapterTitle} / ${a.scene.title}${
          a.matchedAs ? ` (as “${a.matchedAs}”)` : ""
        }`,
      );
    }
  }

  const locations = [
    ...new Set(
      present
        .map((a) => a.scene.location?.trim())
        .filter((v): v is string => Boolean(v)),
    ),
  ];
  if (locations.length) {
    lines.push("", `Places: ${locations.join(", ")}`);
  }

  if (coNames.length) {
    lines.push(
      "",
      `Often with: ${coNames
        .slice(0, 6)
        .map((c) => `${c.name} (${c.count})`)
        .join(", ")}`,
    );
  }

  return lines.join("\n").trim();
}

function inferRole(
  povCount: number,
  appearanceCount: number,
  povRank: number,
): CharacterRole {
  if (appearanceCount <= 1 && povCount === 0) return "minor";
  if (povRank === 0 && povCount >= 1) return "protagonist";
  if (povRank === 1 && povCount >= 1) return "deuteragonist";
  if (povCount >= 1) return "supporting";
  if (appearanceCount >= 3) return "supporting";
  return "minor";
}

function coAppearances(
  appearances: CharacterAppearance[],
  self: Character,
): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const a of appearances) {
    const names = new Set<string>();
    if (a.scene.pov.trim()) names.add(a.scene.pov.trim());
    for (const n of a.scene.characters ?? []) {
      if (n.trim()) names.add(n.trim());
    }
    for (const n of names) {
      if (characterMatchesName(self, n)) continue;
      counts.set(n, (counts.get(n) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function enrichCharacterFromStory(
  character: Character,
  appearances: CharacterAppearance[],
  povRank: number,
  roster: Character[],
): Character {
  const povCount = appearances.filter((a) => a.asPov).length;
  const cos = coAppearances(appearances, character);
  const storyDigest = buildStoryDigest(character, appearances, cos);

  let next: Character = { ...character, storyDigest };

  if (next.role === "unspecified" && appearances.length > 0) {
    next = {
      ...next,
      role: inferRole(povCount, appearances.length, povRank),
    };
  }

  if (!filled(next.shortBio) && appearances.length > 0) {
    const povFirst =
      appearances.find((a) => a.asPov && a.scene.synopsis.trim()) ??
      appearances.find((a) => a.scene.synopsis.trim());
    if (povFirst?.scene.synopsis.trim()) {
      const bio = povFirst.scene.synopsis.trim();
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

  if (!filled(next.arc.startingPoint) && appearances[0]?.scene.synopsis.trim()) {
    next = {
      ...next,
      arc: {
        ...next.arc,
        startingPoint: appearances[0].scene.synopsis.trim(),
      },
    };
  }

  if (!filled(next.arc.turningPoints) && appearances.length > 1) {
    const turns = appearances
      .slice(1)
      .map((a) => a.scene.synopsis.trim() || a.scene.title)
      .filter(Boolean);
    if (turns.length) {
      next = {
        ...next,
        arc: { ...next.arc, turningPoints: turns.join(" · ") },
      };
    }
  }

  // Refresh auto relationships; keep manual ones
  const manualRels = next.relationships.filter(
    (r) => !r.notes.startsWith(AUTO_REL_PREFIX),
  );
  const autoRels: CharacterRelationship[] = [];
  for (const co of cos.filter((c) => c.count >= 1).slice(0, 8)) {
    const linked = findCharacterByName(roster, co.name);
    const alreadyManual = manualRels.some(
      (r) =>
        (linked && r.toCharacterId === linked.id) ||
        namesMatch(r.toName, co.name),
    );
    if (alreadyManual) continue;
    autoRels.push(
      createRelationship({
        id: `auto-${character.id}-${co.name.trim().toLowerCase()}`,
        toCharacterId: linked?.id ?? "",
        toName: linked?.name ?? co.name,
        label: "appears with",
        notes: `${AUTO_REL_PREFIX} (${co.count})`,
      }),
    );
  }
  next = { ...next, relationships: [...manualRels, ...autoRels] };

  const tags = new Set(next.tags);
  if (povCount > 0) tags.add("pov");
  tags.add("from-story");
  next = { ...next, tags: [...tags] };

  const touched =
    next.role !== character.role ||
    next.shortBio !== character.shortBio ||
    next.wiki !== character.wiki ||
    next.storyDigest !== character.storyDigest ||
    next.arc.startingPoint !== character.arc.startingPoint ||
    next.arc.turningPoints !== character.arc.turningPoints ||
    next.tags.join("|") !== character.tags.join("|") ||
    JSON.stringify(next.relationships) !== JSON.stringify(character.relationships);

  if (!touched) return character;
  return { ...next, updatedAt: Date.now() };
}

/**
 * Create wiki entries for every name cast on scenes, tag scenes when known
 * names appear in prose, and fill empty wiki fields from what is written.
 * Returns the same book reference when nothing changed.
 */
export function syncCharactersFromManuscript(book: Book): Book {
  const tagged = collectTaggedNames(book.chapters);
  const existing = book.characters ?? [];
  const canon = canonicalizeNames([
    ...tagged,
    ...existing.flatMap((c) => [c.name, ...c.aliases]),
  ]);

  let characters = [...existing];
  let created = false;
  for (const name of canon.values()) {
    if (findCharacterByName(characters, name)) continue;
    characters.push(
      createCharacter({
        name,
        tags: ["from-story"],
        shortBio: "",
        wiki: "",
      }),
    );
    created = true;
  }

  const knownNames = characters.map((c) => c.name);
  const chapters = tagScenesWithKnownNames(book.chapters, knownNames);
  const chaptersChanged = chapters !== book.chapters;

  // POV ranks for role inference
  const povCounts = characters.map((c) => ({
    id: c.id,
    count: characterAppearances(chapters, c).filter((a) => a.asPov).length,
  }));
  povCounts.sort((a, b) => b.count - a.count);
  const povRank = new Map(povCounts.map((p, i) => [p.id, i]));

  let charactersChanged = created;
  characters = characters.map((c) => {
    const appearances = characterAppearances(chapters, c);
    const enriched = enrichCharacterFromStory(
      c,
      appearances,
      povRank.get(c.id) ?? 99,
      characters,
    );
    if (enriched !== c) charactersChanged = true;
    return enriched;
  });

  // Second pass: fix relationship target ids after all characters exist
  const byName = characters;
  characters = characters.map((c) => {
    let relChanged = false;
    const relationships = c.relationships.map((r) => {
      if (r.toCharacterId) return r;
      if (!r.toName.trim()) return r;
      const linked = findCharacterByName(byName, r.toName);
      if (!linked) return r;
      relChanged = true;
      return { ...r, toCharacterId: linked.id, toName: linked.name };
    });
    if (!relChanged) return c;
    charactersChanged = true;
    return { ...c, relationships, updatedAt: Date.now() };
  });

  if (!charactersChanged && !chaptersChanged) return book;

  return {
    ...book,
    chapters,
    characters,
    updatedAt: Date.now(),
  };
}

export const ROLE_OPTIONS: { value: CharacterRole; label: string }[] = [
  { value: "protagonist", label: "Protagonist" },
  { value: "deuteragonist", label: "Deuteragonist" },
  { value: "antagonist", label: "Antagonist" },
  { value: "supporting", label: "Supporting" },
  { value: "minor", label: "Minor" },
  { value: "unspecified", label: "Unspecified" },
];
