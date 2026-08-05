import type {
  Book,
  Character,
  CharacterRole,
  Chapter,
} from "@/lib/types";
import {
  characterAppearances,
  characterMatchesName,
  createRelationship,
  namesMatch,
} from "@/lib/characters";
import { getSceneHtmlParts } from "@/lib/manuscriptScenes";
import {
  MANUSCRIPT_CONTEXT_BUDGET,
  packBalancedExcerpts,
} from "@/lib/manuscriptContext";
import { expandNameFormsForProse, nameMentionedInText } from "@/lib/nameContinuity";

const AUTO_WIKI_PREFIX = "Compiled from the manuscript";

export type CharacterEnrichmentPayload = {
  role?: CharacterRole;
  shortBio?: string;
  wiki?: string;
  aliases?: string[];
  tags?: string[];
  identity?: Partial<Character["identity"]>;
  psychology?: Partial<Character["psychology"]>;
  voice?: Partial<Character["voice"]>;
  arc?: Partial<Character["arc"]>;
  secrets?: string;
  relationships?: Array<{
    toName: string;
    label: string;
    notes?: string;
  }>;
};

export type DiscoveredCharacter = {
  name: string;
  role?: CharacterRole;
  shortBio?: string;
  evidence?: string;
  /** Other forms of the same person (Lily for Lily Chen). */
  aliases?: string[];
  /**
   * present = on-stage in this window (acts, speaks, is there).
   * mentioned = only talked about / remembered / narrated — do not treat as cast presence.
   */
  presence?: "present" | "mentioned";
};

export type EnrichApplyMode = "fill-empty" | "deepen";

function filled(value: string | undefined | null): boolean {
  return Boolean(value && value.trim());
}

function isAutoWiki(wiki: string): boolean {
  return wiki.trim().startsWith(AUTO_WIKI_PREFIX);
}

export function shouldFillField(
  current: string | undefined,
  incoming: string | undefined,
  mode: EnrichApplyMode = "fill-empty",
): boolean {
  if (!incoming?.trim()) return false;
  if (mode === "deepen") return true;
  if (!filled(current)) return true;
  if (isAutoWiki(current ?? "")) return true;
  return false;
}

function scenePlain(html: string): string {
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

function nameInProse(prose: string, names: string[]): boolean {
  return names.some((n) => nameMentionedInText(prose, n));
}

type EvidenceScene = {
  chapterIndex: number;
  chapterTitle: string;
  sceneIndex: number;
  sceneId: string;
  sceneTitle: string;
  asPov: boolean;
  tagged: boolean;
  proseMatch: boolean;
  location: string;
  synopsis: string;
  cast: string;
  prose: string;
};

function collectCharacterEvidence(
  book: Pick<Book, "chapters">,
  character: Character,
): EvidenceScene[] {
  const names = expandNameFormsForProse(character.name, character.aliases);
  const tagged = characterAppearances(book.chapters, character);
  const byScene = new Map<string, EvidenceScene>();

  for (const a of tagged) {
    const chapter = book.chapters.find((c) => c.id === a.chapterId);
    if (!chapter) continue;
    const htmlParts = getSceneHtmlParts(chapter.content);
    const prose = scenePlain(htmlParts[a.sceneIndex] ?? "");
    byScene.set(a.scene.id, {
      chapterIndex: a.chapterIndex,
      chapterTitle: a.chapterTitle,
      sceneIndex: a.sceneIndex,
      sceneId: a.scene.id,
      sceneTitle: a.scene.title,
      asPov: a.asPov,
      tagged: a.asPov || a.inCast,
      proseMatch: a.viaProse || nameInProse(prose, names),
      location: a.scene.location ?? "",
      synopsis: a.scene.synopsis ?? "",
      cast: [a.scene.pov, ...(a.scene.characters ?? [])]
        .filter(Boolean)
        .join(", "),
      prose,
    });
  }

  book.chapters.forEach((chapter, chapterIndex) => {
    const htmlParts = getSceneHtmlParts(chapter.content);
    (chapter.scenes ?? []).forEach((scene, sceneIndex) => {
      if (byScene.has(scene.id)) return;
      const prose = scenePlain(htmlParts[sceneIndex] ?? "");
      if (!prose || !nameInProse(prose, names)) return;
      byScene.set(scene.id, {
        chapterIndex,
        chapterTitle: chapter.title,
        sceneIndex,
        sceneId: scene.id,
        sceneTitle: scene.title,
        asPov: names.some((n) => namesMatch(scene.pov, n)),
        tagged: false,
        proseMatch: true,
        location: scene.location ?? "",
        synopsis: scene.synopsis ?? "",
        cast: [scene.pov, ...(scene.characters ?? [])].filter(Boolean).join(", "),
        prose,
      });
    });
  });

  return [...byScene.values()].sort(
    (a, b) => a.chapterIndex - b.chapterIndex || a.sceneIndex - b.sceneIndex,
  );
}

function evidenceToBlock(e: EvidenceScene): string {
  const flags = [
    e.asPov ? "POV" : null,
    e.tagged ? "cast (present)" : null,
    e.proseMatch && !e.tagged ? "mentioned in prose only — may not be present" : null,
  ]
    .filter(Boolean)
    .join(", ");

  return [
    `---`,
    `Chapter ${e.chapterIndex + 1}: ${e.chapterTitle}`,
    `Scene: ${e.sceneTitle}${flags ? ` [${flags}]` : ""}`,
    e.location ? `Location: ${e.location}` : "",
    e.synopsis ? `Synopsis: ${e.synopsis}` : "",
    e.cast ? `Cast: ${e.cast}` : "",
    `Prose:`,
    e.prose || "(empty)",
    "",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/** Build manuscript excerpts for one character across the entire book. */
export function buildCharacterManuscriptContext(
  book: Pick<Book, "title" | "chapters" | "characters">,
  character: Character,
): string {
  const evidence = collectCharacterEvidence(book, character);
  const chapterCount = book.chapters.length;
  const present = evidence.filter((e) => e.asPov || e.tagged);
  const mentioned = evidence.filter((e) => !e.asPov && !e.tagged && e.proseMatch);

  const preamble = [
    `Manuscript: ${book.title || "Untitled"}`,
    `Chapters in manuscript: ${chapterCount}`,
    `Character: ${character.name}`,
    character.aliases.length
      ? `Aliases: ${character.aliases.join(", ")}`
      : "",
    `Current role: ${character.role}`,
    character.shortBio ? `Current blurb: ${character.shortBio}` : "",
    character.wiki && !isAutoWiki(character.wiki)
      ? `Author wiki notes:\n${character.wiki}`
      : "",
    "",
    `On-stage (POV/cast): ${present.length} scene(s). Mentions only (talked about): ${mentioned.length}.`,
    `Use ON-STAGE scenes for where they are, what they do, and voice. Mentions-only scenes are gossip/memory — do not treat as cast presence.`,
    evidence.length === 0
      ? "No tagged or named appearances found. Full chapter excerpts follow when available."
      : `Evidence scenes: ${evidence.length} across ${new Set(evidence.map((e) => e.chapterIndex)).size} chapter(s). Prefer present scenes; skim mentions for relationships only.`,
    "",
  ]
    .filter((line) => line !== "")
    .join("\n");

  const byChapter: string[][] = book.chapters.map(() => []);
  // Present first within each chapter grouping via sort of evidence order
  const ordered = [...present, ...mentioned];
  for (const e of ordered) {
    byChapter[e.chapterIndex]?.push(evidenceToBlock(e));
  }

  // Sparse on-stage evidence: send clipped context from other scenes, clearly unlabeled as non-presence
  if (present.length < 3) {
    book.chapters.forEach((chapter, chapterIndex) => {
      const htmlParts = getSceneHtmlParts(chapter.content);
      (chapter.scenes ?? []).forEach((scene, sceneIndex) => {
        if (evidence.some((e) => e.sceneId === scene.id)) return;
        const prose = scenePlain(htmlParts[sceneIndex] ?? "");
        if (!prose) return;
        const clipped =
          prose.length > 900 ? `${prose.slice(0, 900).trim()}…` : prose;
        byChapter[chapterIndex].push(
          [
            `---`,
            `Chapter ${chapterIndex + 1}: ${chapter.title}`,
            `Scene: ${scene.title} [context only — ${character.name} not named here]`,
            `POV: ${scene.pov || "—"}`,
            `Cast: ${(scene.characters ?? []).join(", ") || "—"}`,
            `Prose:`,
            clipped,
            "",
          ].join("\n"),
        );
      });
    });
  }

  return packBalancedExcerpts(
    byChapter,
    MANUSCRIPT_CONTEXT_BUDGET,
    preamble,
  );
}

/** Cast discovery — entire book, balanced across chapters. */
export function buildDiscoveryContext(
  book: Pick<Book, "title" | "chapters" | "characters">,
): string {
  const known =
    (book.characters ?? []).map((c) => c.name).join(", ") || "(none)";
  const preamble = [
    `Manuscript: ${book.title || "Untitled"}`,
    `Chapters in manuscript: ${book.chapters.length}`,
    `Already in cast wiki: ${known}`,
    `Read the FULL manuscript below. Discover names from every chapter, not only the opening.`,
    "",
    "Excerpts:",
  ].join("\n");

  const byChapter: string[][] = book.chapters.map((chapter, chapterIndex) => {
    const htmlParts = getSceneHtmlParts(chapter.content);
    const blocks: string[] = [];
    for (let i = 0; i < htmlParts.length; i++) {
      const prose = scenePlain(htmlParts[i] ?? "");
      if (!prose) continue;
      const scene = chapter.scenes?.[i];
      blocks.push(
        `---\nChapter ${chapterIndex + 1}: ${chapter.title} / ${scene?.title ?? `Scene ${i + 1}`}\nPOV: ${scene?.pov || "—"}\nCast tags: ${(scene?.characters ?? []).join(", ") || "—"}\n${prose}\n`,
      );
    }
    return blocks;
  });

  return packBalancedExcerpts(
    byChapter,
    MANUSCRIPT_CONTEXT_BUDGET,
    preamble,
  );
}

export function characterSnapshotForPrompt(character: Character): string {
  return JSON.stringify(
    {
      name: character.name,
      aliases: character.aliases,
      role: character.role,
      shortBio: character.shortBio,
      wiki: isAutoWiki(character.wiki) ? "" : character.wiki,
      identity: character.identity,
      psychology: character.psychology,
      voice: character.voice,
      arc: character.arc,
      secrets: character.secrets,
      tags: character.tags.filter((t) => t !== "from-story"),
      belongsToIds: character.belongsToIds ?? [],
      continuityNotes: (character.continuityNotes ?? []).map((n) => ({
        asOf: n.asOf,
        note: n.note,
      })),
      relationships: character.relationships.map((r) => ({
        toName: r.toName,
        label: r.label,
        notes: r.notes,
      })),
    },
    null,
    2,
  );
}

export function applyCharacterEnrichment(
  character: Character,
  payload: CharacterEnrichmentPayload,
  roster: Character[],
  mode: EnrichApplyMode = "fill-empty",
): Character {
  let next: Character = { ...character };
  const fill = (current: string, incoming?: string) =>
    shouldFillField(current, incoming, mode);

  if (payload.role && (next.role === "unspecified" || mode === "deepen")) {
    next = { ...next, role: payload.role };
  }

  if (fill(next.shortBio, payload.shortBio)) {
    next = { ...next, shortBio: payload.shortBio!.trim() };
  }
  if (fill(next.wiki, payload.wiki)) {
    next = { ...next, wiki: payload.wiki!.trim() };
  }
  if (fill(next.secrets, payload.secrets)) {
    next = { ...next, secrets: payload.secrets!.trim() };
  }

  if (payload.aliases?.length) {
    const aliases = new Set(next.aliases.map((a) => a.trim()).filter(Boolean));
    for (const a of payload.aliases) {
      if (a.trim() && !characterMatchesName(next, a)) aliases.add(a.trim());
    }
    next = { ...next, aliases: [...aliases] };
  }

  const tags = new Set(next.tags);
  for (const t of payload.tags ?? []) {
    if (t.trim()) tags.add(t.trim().toLowerCase());
  }
  tags.add("claude");
  next = { ...next, tags: [...tags] };

  if (payload.identity) {
    const p = payload.identity;
    next = {
      ...next,
      identity: {
        age: fill(next.identity.age, p.age) ? p.age!.trim() : next.identity.age,
        occupation: fill(next.identity.occupation, p.occupation)
          ? p.occupation!.trim()
          : next.identity.occupation,
        appearance: fill(next.identity.appearance, p.appearance)
          ? p.appearance!.trim()
          : next.identity.appearance,
        distinguishing: fill(next.identity.distinguishing, p.distinguishing)
          ? p.distinguishing!.trim()
          : next.identity.distinguishing,
      },
    };
  }

  if (payload.psychology) {
    const p = payload.psychology;
    next = {
      ...next,
      psychology: {
        wants: fill(next.psychology.wants, p.wants)
          ? p.wants!.trim()
          : next.psychology.wants,
        needs: fill(next.psychology.needs, p.needs)
          ? p.needs!.trim()
          : next.psychology.needs,
        fears: fill(next.psychology.fears, p.fears)
          ? p.fears!.trim()
          : next.psychology.fears,
        flaws: fill(next.psychology.flaws, p.flaws)
          ? p.flaws!.trim()
          : next.psychology.flaws,
        strengths: fill(next.psychology.strengths, p.strengths)
          ? p.strengths!.trim()
          : next.psychology.strengths,
      },
    };
  }

  if (payload.voice) {
    const v = payload.voice;
    next = {
      ...next,
      voice: {
        speechNotes: fill(next.voice.speechNotes, v.speechNotes)
          ? v.speechNotes!.trim()
          : next.voice.speechNotes,
        mannerisms: fill(next.voice.mannerisms, v.mannerisms)
          ? v.mannerisms!.trim()
          : next.voice.mannerisms,
        sample: fill(next.voice.sample, v.sample)
          ? v.sample!.trim()
          : next.voice.sample,
      },
    };
  }

  if (payload.arc) {
    const a = payload.arc;
    next = {
      ...next,
      arc: {
        startingPoint: fill(next.arc.startingPoint, a.startingPoint)
          ? a.startingPoint!.trim()
          : next.arc.startingPoint,
        turningPoints: fill(next.arc.turningPoints, a.turningPoints)
          ? a.turningPoints!.trim()
          : next.arc.turningPoints,
        endingPoint: fill(next.arc.endingPoint, a.endingPoint)
          ? a.endingPoint!.trim()
          : next.arc.endingPoint,
      },
    };
  }

  if (payload.relationships?.length) {
    const rels =
      mode === "deepen"
        ? next.relationships.filter((r) => !r.notes.includes("(Clarence)") && !r.notes.includes("(Claude)"))
        : [...next.relationships];
    for (const r of payload.relationships) {
      if (!r.toName?.trim() || !r.label?.trim()) continue;
      const linked = roster.find(
        (c) =>
          c.id !== character.id &&
          (c.name.toLowerCase() === r.toName.trim().toLowerCase() ||
            c.aliases.some(
              (al) => al.toLowerCase() === r.toName.trim().toLowerCase(),
            )),
      );
      const exists = rels.some(
        (x) =>
          x.toName.toLowerCase() === r.toName.trim().toLowerCase() ||
          (linked && x.toCharacterId === linked.id),
      );
      if (exists) continue;
      rels.push(
        createRelationship({
          toCharacterId: linked?.id ?? "",
          toName: linked?.name ?? r.toName.trim(),
          label: r.label.trim(),
          notes: (
            r.notes?.trim() || "Inferred from the manuscript (Clarence)"
          ).slice(0, 400),
        }),
      );
    }
    next = { ...next, relationships: rels };
  }

  return { ...next, updatedAt: Date.now() };
}

export const ENRICH_TOOL_NAME = "save_character_wiki";

export const enrichCharacterTool = {
  name: ENRICH_TOOL_NAME,
  description:
    "Save an enriched character wiki grounded in the FULL manuscript evidence (all chapters). Infer traits, goals, and voice from what the character does and says — leave fields empty when the text does not support them.",
  input_schema: {
    type: "object" as const,
    properties: {
      role: {
        type: "string",
        enum: [
          "protagonist",
          "antagonist",
          "deuteragonist",
          "supporting",
          "minor",
          "unspecified",
        ],
      },
      shortBio: {
        type: "string",
        description:
          "One literary sentence for the cast list — who they are on the page, not a résumé.",
      },
      wiki: {
        type: "string",
        description:
          "2–5 short paragraphs covering the character across the WHOLE manuscript, not only early chapters. Ground in actions and dialogue.",
      },
      aliases: { type: "array", items: { type: "string" } },
      tags: { type: "array", items: { type: "string" } },
      identity: {
        type: "object",
        properties: {
          age: {
            type: "string",
            description: "Only if stated or strongly implied in the text.",
          },
          occupation: {
            type: "string",
            description: "Job/role as shown in the manuscript.",
          },
          appearance: {
            type: "string",
            description:
              "Physical traits the prose actually describes — hair, build, clothes, bearing.",
          },
          distinguishing: {
            type: "string",
            description:
              "Memorable details the text emphasizes (scar, accent, habit of dress).",
          },
        },
      },
      psychology: {
        type: "object",
        description:
          "Read goals and traits from behavior, dialogue, and interiority — do not invent a therapy profile.",
        properties: {
          wants: {
            type: "string",
            description:
              "External goal / what they are chasing in the story (plot desire). Cite what the text shows.",
          },
          needs: {
            type: "string",
            description:
              "Deeper need under the want, only if the manuscript supports it (growth toward…). ",
          },
          fears: {
            type: "string",
            description:
              "What they avoid or dread, as evidenced by choices or stated fear.",
          },
          flaws: {
            type: "string",
            description:
              "Character flaws / traits that cause trouble — shown in scenes, not labels.",
          },
          strengths: {
            type: "string",
            description:
              "Competencies and virtues the text demonstrates (not generic praise).",
          },
        },
      },
      voice: {
        type: "object",
        properties: {
          speechNotes: {
            type: "string",
            description:
              "How they talk — diction, rhythm, register — from quoted or paraphrased dialogue.",
          },
          mannerisms: {
            type: "string",
            description:
              "Physical/behavioral ticks the prose notes (gestures, habits).",
          },
          sample: {
            type: "string",
            description:
              "A line they would say, preferably quoted from the text.",
          },
        },
      },
      arc: {
        type: "object",
        properties: {
          startingPoint: {
            type: "string",
            description: "Where they begin — stance, wound, or situation.",
          },
          turningPoints: {
            type: "string",
            description: "Major turns from early AND later chapters.",
          },
          endingPoint: {
            type: "string",
            description:
              "Where they land by the latest evidence (or leave empty if unfinished).",
          },
        },
      },
      secrets: {
        type: "string",
        description:
          "Hidden facts the manuscript reveals to the reader or keeps from other characters.",
      },
      relationships: {
        type: "array",
        items: {
          type: "object",
          properties: {
            toName: { type: "string" },
            label: { type: "string" },
            notes: { type: "string" },
          },
          required: ["toName", "label"],
        },
      },
    },
  },
};

export const DISCOVER_TOOL_NAME = "save_discovered_cast";

export const discoverCastTool = {
  name: DISCOVER_TOOL_NAME,
  description:
    "List named people from the FULL manuscript (every chapter) who deserve cast wiki entries and are not already listed.",
  input_schema: {
    type: "object" as const,
    properties: {
      characters: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            role: {
              type: "string",
              enum: [
                "protagonist",
                "antagonist",
                "deuteragonist",
                "supporting",
                "minor",
                "unspecified",
              ],
            },
            shortBio: { type: "string" },
            evidence: {
              type: "string",
              description: "Brief quote or paraphrase proving they appear.",
            },
          },
          required: ["name"],
        },
      },
    },
    required: ["characters"],
  },
};

export function chaptersHaveProse(chapters: Chapter[]): boolean {
  return chapters.some((ch) => scenePlain(ch.content).length > 40);
}
