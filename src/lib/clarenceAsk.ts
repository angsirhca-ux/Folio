/**
 * Pre-populate questions for Clarence — especially first-person manuscripts
 * where the narrator’s name isn’t on the page.
 */

import type { Book, Chapter, Character, Scene } from "./types";
import { getSceneHtmlParts } from "./manuscriptScenes";
import { scenePlainText } from "./nameContinuity";
import { createCharacter, findCharacterByName } from "./characters";

const FIRST_PERSON_RE =
  /\b(I|I'm|I’ve|I'd|I'll|me|my|myself|mine)\b/gi;

const AMBIGUOUS_POV = new Set([
  "",
  "i",
  "me",
  "myself",
  "narrator",
  "the narrator",
  "protagonist",
  "mc",
  "main character",
  "?",
  "—",
  "-",
]);

export type ClarenceAskAnswers = {
  narratorName: string;
  /** Freeform author notes Clarence should respect while filling sheets. */
  authorNotes: string;
  /** Tag empty/ambiguous first-person scenes with this POV. */
  applyPovToScenes: boolean;
};

export type FirstPersonProbe = {
  likelyFirstPerson: boolean;
  /** Needs the author to name who “I” is before cast populate. */
  needsNarratorAsk: boolean;
  firstPersonSceneCount: number;
  sampledSceneCount: number;
  emptyOrAmbiguousPovCount: number;
  /** Names already on POV/cast tags — good dialog suggestions. */
  suggestedNames: string[];
};

function povIsAmbiguous(pov: string | undefined): boolean {
  return AMBIGUOUS_POV.has((pov ?? "").trim().toLowerCase());
}

function sceneLooksFirstPerson(prose: string): boolean {
  if (!prose || prose.length < 40) return false;
  const sample = prose.slice(0, 1200);
  const hits = sample.match(FIRST_PERSON_RE);
  return (hits?.length ?? 0) >= 4;
}

function collectSuggestedNames(chapters: Chapter[], characters: Character[]): string[] {
  const names = new Set<string>();
  for (const c of characters) {
    if (c.name.trim()) names.add(c.name.trim());
  }
  for (const ch of chapters) {
    for (const s of ch.scenes ?? []) {
      if (s.pov.trim() && !povIsAmbiguous(s.pov)) names.add(s.pov.trim());
      for (const n of s.characters ?? []) {
        if (n.trim()) names.add(n.trim());
      }
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b)).slice(0, 24);
}

/**
 * Probe whether this manuscript reads as first person without a clear
 * named narrator — Clarence should ask before populating cast sheets.
 */
export function probeFirstPersonNarrator(book: Book): FirstPersonProbe {
  const chapters = book.chapters ?? [];
  const characters = book.characters ?? [];
  const suggestedNames = collectSuggestedNames(chapters, characters);

  let sampled = 0;
  let firstPerson = 0;
  let emptyAmbiguous = 0;
  let namedPovScenes = 0;

  for (const chapter of chapters) {
    const parts = getSceneHtmlParts(chapter.content ?? "");
    (chapter.scenes ?? []).forEach((scene, i) => {
      const prose = scenePlainText(parts[i] ?? "");
      if (!prose || prose.length < 40) return;
      sampled += 1;
      if (sceneLooksFirstPerson(prose)) {
        firstPerson += 1;
        if (povIsAmbiguous(scene.pov)) emptyAmbiguous += 1;
      }
      if (!povIsAmbiguous(scene.pov)) namedPovScenes += 1;
    });
  }

  const likelyFirstPerson =
    sampled > 0 && firstPerson / sampled >= 0.35 && firstPerson >= 2;

  const hasProtagonist = characters.some((c) => c.role === "protagonist");
  const hasStoredNarrator = Boolean(book.clarenceContext?.narratorName?.trim());
  const hasDominantNamedPov = namedPovScenes >= Math.max(2, Math.ceil(sampled * 0.4));

  const needsNarratorAsk =
    likelyFirstPerson &&
    !hasStoredNarrator &&
    !hasProtagonist &&
    !hasDominantNamedPov &&
    emptyAmbiguous >= 1;

  return {
    likelyFirstPerson,
    needsNarratorAsk,
    firstPersonSceneCount: firstPerson,
    sampledSceneCount: sampled,
    emptyOrAmbiguousPovCount: emptyAmbiguous,
    suggestedNames,
  };
}

/** True when Clarence should open the ask dialog before populate. */
export function shouldAskBeforePopulate(book: Book): boolean {
  return probeFirstPersonNarrator(book).needsNarratorAsk;
}

export type ApplyNarratorResult = {
  chapters: Chapter[];
  characters: Character[];
  clarenceContext: NonNullable<Book["clarenceContext"]>;
  povTagged: number;
  createdCharacter: Character | null;
};

/**
 * Persist author answers: narrator as protagonist, optional POV tags on
 * first-person scenes that still lack a named POV.
 */
export function applyClarenceAskAnswers(
  book: Book,
  answers: ClarenceAskAnswers,
): ApplyNarratorResult {
  const narratorName = answers.narratorName.trim();
  const clarenceContext: NonNullable<Book["clarenceContext"]> = {
    narratorName: narratorName || undefined,
    authorNotes: answers.authorNotes.trim() || undefined,
    updatedAt: Date.now(),
  };

  let characters = [...(book.characters ?? [])];
  let createdCharacter: Character | null = null;

  if (narratorName) {
    const existing = findCharacterByName(characters, narratorName);
    if (existing) {
      characters = characters.map((c) =>
        c.id === existing.id
          ? {
              ...c,
              name:
                narratorName.length > c.name.length ? narratorName : c.name,
              role: "protagonist" as const,
              updatedAt: Date.now(),
            }
          : c.role === "protagonist" && c.id !== existing.id
            ? { ...c, role: "unspecified" as const, updatedAt: Date.now() }
            : c,
      );
    } else {
      createdCharacter = createCharacter({
        name: narratorName,
        role: "protagonist",
        tags: ["from-story", "clarence", "narrator"],
      });
      characters = [
        ...characters.map((c) =>
          c.role === "protagonist"
            ? { ...c, role: "unspecified" as const, updatedAt: Date.now() }
            : c,
        ),
        createdCharacter,
      ];
    }
  }

  let povTagged = 0;
  let chapters = book.chapters ?? [];

  if (narratorName && answers.applyPovToScenes) {
    chapters = chapters.map((chapter) => {
      const parts = getSceneHtmlParts(chapter.content ?? "");
      let changed = false;
      const scenes = (chapter.scenes ?? []).map((scene, i) => {
        if (!povIsAmbiguous(scene.pov)) return scene;
        const prose = scenePlainText(parts[i] ?? "");
        if (!sceneLooksFirstPerson(prose)) return scene;
        changed = true;
        povTagged += 1;
        const cast = scene.characters ?? [];
        const inCast = cast.some(
          (n) => n.trim().toLowerCase() === narratorName.toLowerCase(),
        );
        return {
          ...scene,
          pov: narratorName,
          characters: inCast ? cast : [...cast, narratorName],
          updatedAt: Date.now(),
        } satisfies Scene;
      });
      return changed ? { ...chapter, scenes, updatedAt: Date.now() } : chapter;
    });
  }

  return {
    chapters,
    characters,
    clarenceContext,
    povTagged,
    createdCharacter,
  };
}

/** Prompt block for enrich / index calls. */
export function clarenceAuthorHintsBlock(
  context: Book["clarenceContext"] | undefined,
): string {
  if (!context?.narratorName?.trim() && !context?.authorNotes?.trim()) {
    return "";
  }
  const lines = ["AUTHOR GUIDANCE (trust this over guessing):"];
  if (context.narratorName?.trim()) {
    lines.push(
      `First-person narrator / protagonist is “${context.narratorName.trim()}”. Treat “I/me/my” as this person.`,
    );
  }
  if (context.authorNotes?.trim()) {
    lines.push(`Author notes: ${context.authorNotes.trim()}`);
  }
  return lines.join("\n");
}
