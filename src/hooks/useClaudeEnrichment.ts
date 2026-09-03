"use client";

import { useCallback, useEffect, useState } from "react";
import type { Book, Character, EncyclopediaEntry, Location, ManuscriptIndexData, ResearchEntry, StoryMap } from "@/lib/types";
import {
  applyCharacterEnrichment,
  type CharacterEnrichmentPayload,
  type DiscoveredCharacter,
} from "@/lib/characterEnrichment";
import {
  applyLocationEnrichment,
  type DiscoveredLocation,
  type LocationEnrichmentPayload,
} from "@/lib/locationEnrichment";
import {
  applyResearchEnrichment,
  type DiscoveredResearch,
  type ResearchEnrichmentPayload,
} from "@/lib/researchEnrichment";
import {
  applyEncyclopediaEnrichment,
  type DiscoveredEncyclopedia,
  type EncyclopediaEnrichmentPayload,
} from "@/lib/encyclopediaEnrichment";
import type { MapLayoutPayload } from "@/lib/mapLayout";
import type { PlotThreadDiscoverPayload } from "@/lib/plotThreadEnrichment";
import type { ChronicleDiscoverPayload } from "@/lib/chronicleEnrichment";
import type { SoundtrackComposePayload } from "@/lib/soundtrackCompose";

type ClaudeStatus = {
  configured: boolean;
  model: string | null;
};

function bookPayload(book: Book) {
  return {
    title: book.title,
    chapters: book.chapters,
    characters: book.characters ?? [],
    locations: book.locations ?? [],
    research: book.research ?? [],
    encyclopedia: book.encyclopedia ?? [],
    encyclopediaStacks: book.encyclopediaStacks ?? [],
    plotThreads: book.plotThreads ?? [],
    clarenceContext: book.clarenceContext,
  };
}

export function useClaudeStatus() {
  const [status, setStatus] = useState<ClaudeStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/characters/enrich")
      .then((r) => r.json())
      .then((data: ClaudeStatus) => {
        if (!cancelled) setStatus(data);
      })
      .catch(() => {
        if (!cancelled) setStatus({ configured: false, model: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}

export async function enrichCharacterWithClaude(
  book: Book,
  characterId: string,
): Promise<CharacterEnrichmentPayload> {
  const res = await fetch("/api/characters/enrich", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      book: bookPayload(book),
      characterId,
    }),
  });
  const data = (await res.json()) as {
    enrichment?: CharacterEnrichmentPayload;
    error?: string;
  };
  if (!res.ok || !data.enrichment) {
    throw new Error(data.error || "Enrichment failed.");
  }
  return data.enrichment;
}

export async function discoverCastWithClaude(
  book: Book,
): Promise<DiscoveredCharacter[]> {
  const res = await fetch("/api/characters/discover", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ book: bookPayload(book) }),
  });
  const data = (await res.json()) as {
    characters?: DiscoveredCharacter[];
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || "Discovery failed.");
  }
  return data.characters ?? [];
}

export async function populatePlotThreadsWithClaude(
  book: Book,
): Promise<PlotThreadDiscoverPayload> {
  const res = await fetch("/api/plot-threads/discover", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      book: {
        title: book.title,
        chapters: book.chapters,
        plotThreads: book.plotThreads ?? [],
      },
    }),
  });
  const data = (await res.json()) as PlotThreadDiscoverPayload & {
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || "Could not populate plot threads.");
  }
  return {
    threads: data.threads ?? [],
    assignments: data.assignments ?? [],
  };
}

export async function discoverChronicleWithClaude(
  book: Book,
): Promise<ChronicleDiscoverPayload> {
  const res = await fetch("/api/chronicle/discover", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      book: {
        title: book.title,
        chapters: book.chapters,
        chronicle: book.chronicle ?? [],
        characters: book.characters ?? [],
        locations: book.locations ?? [],
        encyclopedia: book.encyclopedia ?? [],
      },
    }),
  });
  const data = (await res.json()) as ChronicleDiscoverPayload & {
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || "Could not populate chronicle.");
  }
  return { events: data.events ?? [] };
}

export async function composeSoundtrackWithClaude(
  book: Book,
  manuscriptIndex: ManuscriptIndexData,
): Promise<SoundtrackComposePayload> {
  const res = await fetch("/api/soundtrack/compose", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      book: {
        title: book.title,
        author: book.author,
        chapters: book.chapters,
        soundtrack: book.soundtrack ?? [],
        soundtrackTaste: book.soundtrackTaste ?? [],
      },
      manuscriptIndex,
    }),
  });
  const data = (await res.json()) as SoundtrackComposePayload & {
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || "Could not compose soundtrack.");
  }
  return {
    arcBlurb: data.arcBlurb ?? "",
    songs: data.songs ?? [],
  };
}

export function mergeEnrichmentIntoCharacter(
  character: Character,
  enrichment: CharacterEnrichmentPayload,
  roster: Character[],
): Character {
  return applyCharacterEnrichment(character, enrichment, roster, "deepen");
}

export function useCharacterDeepen(
  book: Book,
  character: Character | undefined,
  onApply: (next: Character) => void,
) {
  const status = useClaudeStatus();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneAt, setDoneAt] = useState<number | null>(null);

  const deepen = useCallback(async () => {
    if (!character) return;
    setBusy(true);
    setError(null);
    try {
      const enrichment = await enrichCharacterWithClaude(book, character.id);
      const latest =
        (book.characters ?? []).find((c) => c.id === character.id) ?? character;
      const merged = mergeEnrichmentIntoCharacter(
        latest,
        enrichment,
        book.characters ?? [],
      );
      onApply(merged);
      setDoneAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enrichment failed.");
    } finally {
      setBusy(false);
    }
  }, [book, character, onApply]);

  return { status, busy, error, doneAt, deepen };
}

export async function enrichLocationWithClaude(
  book: Book,
  locationId: string,
): Promise<LocationEnrichmentPayload> {
  const res = await fetch("/api/locations/enrich", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      book: bookPayload(book),
      locationId,
    }),
  });
  const data = (await res.json()) as {
    enrichment?: LocationEnrichmentPayload;
    error?: string;
  };
  if (!res.ok || !data.enrichment) {
    throw new Error(data.error || "Enrichment failed.");
  }
  return data.enrichment;
}

export async function discoverLocationsWithClaude(
  book: Book,
): Promise<DiscoveredLocation[]> {
  const res = await fetch("/api/locations/discover", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ book: bookPayload(book) }),
  });
  const data = (await res.json()) as {
    locations?: DiscoveredLocation[];
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || "Discovery failed.");
  }
  return data.locations ?? [];
}

export function mergeEnrichmentIntoLocation(
  location: Location,
  enrichment: LocationEnrichmentPayload,
  roster: Location[],
): Location {
  return applyLocationEnrichment(location, enrichment, roster, "deepen");
}

export function useLocationDeepen(
  book: Book,
  location: Location | undefined,
  onApply: (next: Location) => void,
) {
  const status = useClaudeStatus();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneAt, setDoneAt] = useState<number | null>(null);

  const deepen = useCallback(async () => {
    if (!location) return;
    setBusy(true);
    setError(null);
    try {
      const enrichment = await enrichLocationWithClaude(book, location.id);
      const latest =
        (book.locations ?? []).find((l) => l.id === location.id) ?? location;
      const merged = mergeEnrichmentIntoLocation(
        latest,
        enrichment,
        book.locations ?? [],
      );
      onApply(merged);
      setDoneAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enrichment failed.");
    } finally {
      setBusy(false);
    }
  }, [book, location, onApply]);

  return { status, busy, error, doneAt, deepen };
}

export async function enrichResearchWithClaude(
  book: Book,
  entryId: string,
): Promise<ResearchEnrichmentPayload> {
  const res = await fetch("/api/research/enrich", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      book: bookPayload(book),
      entryId,
    }),
  });
  const data = (await res.json()) as {
    enrichment?: ResearchEnrichmentPayload;
    error?: string;
  };
  if (!res.ok || !data.enrichment) {
    throw new Error(data.error || "Enrichment failed.");
  }
  return data.enrichment;
}

export async function discoverResearchWithClaude(
  book: Book,
): Promise<DiscoveredResearch[]> {
  const res = await fetch("/api/research/discover", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ book: bookPayload(book) }),
  });
  const data = (await res.json()) as {
    entries?: DiscoveredResearch[];
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || "Discovery failed.");
  }
  return data.entries ?? [];
}

export function mergeEnrichmentIntoResearch(
  entry: ResearchEntry,
  enrichment: ResearchEnrichmentPayload,
  roster: ResearchEntry[],
): ResearchEntry {
  return applyResearchEnrichment(entry, enrichment, roster, "deepen");
}

export async function layoutMapWithClaude(
  book: Book,
): Promise<{ layout: MapLayoutPayload; map: StoryMap }> {
  const res = await fetch("/api/map/layout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      book: {
        title: book.title,
        chapters: book.chapters,
        locations: book.locations ?? [],
        map: book.map,
      },
    }),
  });
  const data = (await res.json()) as {
    layout?: MapLayoutPayload;
    map?: StoryMap;
    error?: string;
  };
  if (!res.ok || !data.map || !data.layout) {
    throw new Error(data.error || "Map layout failed.");
  }
  return { layout: data.layout, map: data.map };
}

export type BuildMapFromStoryResult = {
  locationsToAdd: Location[];
  layout: MapLayoutPayload;
  map: StoryMap;
  summary?: string;
  stats: {
    added: number;
    pins: number;
    regions: number;
    connections: number;
  };
};

/** Discover missing places + layout pins/regions from the manuscript (one round-trip). */
export async function buildMapFromStoryWithClaude(
  book: Book,
): Promise<BuildMapFromStoryResult> {
  const res = await fetch("/api/map/build", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      book: {
        title: book.title,
        chapters: book.chapters,
        locations: book.locations ?? [],
        map: book.map,
      },
    }),
  });
  const data = (await res.json()) as BuildMapFromStoryResult & {
    error?: string;
  };
  if (!res.ok || !data.map || !data.layout) {
    throw new Error(data.error || "Map build failed.");
  }
  return {
    locationsToAdd: data.locationsToAdd ?? [],
    layout: data.layout,
    map: data.map,
    summary: data.summary ?? data.layout.summary,
    stats: data.stats ?? {
      added: data.locationsToAdd?.length ?? 0,
      pins: data.layout.pins.length,
      regions: data.layout.regions?.length ?? 0,
      connections: data.layout.connections?.length ?? 0,
    },
  };
}

export function useResearchDeepen(
  book: Book,
  entry: ResearchEntry | undefined,
  onApply: (next: ResearchEntry) => void,
) {
  const status = useClaudeStatus();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneAt, setDoneAt] = useState<number | null>(null);

  const deepen = useCallback(async () => {
    if (!entry) return;
    setBusy(true);
    setError(null);
    try {
      const enrichment = await enrichResearchWithClaude(book, entry.id);
      const latest =
        (book.research ?? []).find((e) => e.id === entry.id) ?? entry;
      const merged = mergeEnrichmentIntoResearch(
        latest,
        enrichment,
        book.research ?? [],
      );
      onApply(merged);
      setDoneAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enrichment failed.");
    } finally {
      setBusy(false);
    }
  }, [book, entry, onApply]);

  return { status, busy, error, doneAt, deepen };
}

export async function enrichEncyclopediaWithClaude(
  book: Book,
  entryId: string,
): Promise<EncyclopediaEnrichmentPayload> {
  const res = await fetch("/api/encyclopedia/enrich", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      book: bookPayload(book),
      entryId,
    }),
  });
  const data = (await res.json()) as {
    enrichment?: EncyclopediaEnrichmentPayload;
    error?: string;
  };
  if (!res.ok || !data.enrichment) {
    throw new Error(data.error || "Enrichment failed.");
  }
  return data.enrichment;
}

export async function discoverEncyclopediaWithClaude(
  book: Book,
): Promise<DiscoveredEncyclopedia[]> {
  const res = await fetch("/api/encyclopedia/discover", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ book: bookPayload(book) }),
  });
  const data = (await res.json()) as {
    entries?: DiscoveredEncyclopedia[];
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || "Discovery failed.");
  }
  return data.entries ?? [];
}

export function mergeEnrichmentIntoEncyclopedia(
  entry: EncyclopediaEntry,
  enrichment: EncyclopediaEnrichmentPayload,
  roster: EncyclopediaEntry[],
): EncyclopediaEntry {
  return applyEncyclopediaEnrichment(entry, enrichment, roster, "deepen");
}

export function useEncyclopediaDeepen(
  book: Book,
  entry: EncyclopediaEntry | undefined,
  onApply: (next: EncyclopediaEntry) => void,
  ensureStack?: (name: string) => string,
) {
  const status = useClaudeStatus();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneAt, setDoneAt] = useState<number | null>(null);

  const deepen = useCallback(async () => {
    if (!entry) return;
    setBusy(true);
    setError(null);
    try {
      const enrichment = await enrichEncyclopediaWithClaude(book, entry.id);
      const latest =
        (book.encyclopedia ?? []).find((e) => e.id === entry.id) ?? entry;
      let merged = mergeEnrichmentIntoEncyclopedia(
        latest,
        enrichment,
        book.encyclopedia ?? [],
      );
      if (enrichment.stackName?.trim() && ensureStack) {
        merged = {
          ...merged,
          stackId: ensureStack(enrichment.stackName),
        };
      }
      onApply(merged);
      setDoneAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enrichment failed.");
    } finally {
      setBusy(false);
    }
  }, [book, entry, onApply, ensureStack]);

  return { status, busy, error, doneAt, deepen };
}

export type ManuscriptIndexProgress = {
  pass: number;
  passCount: number;
  chapters?: number;
};

export async function indexManuscriptWithClaude(
  book: Book,
  opts?: {
    onProgress?: (progress: ManuscriptIndexProgress) => void;
  },
): Promise<{ index: import("@/lib/types").ManuscriptIndexData; passes: number }> {
  let res: Response;
  try {
    res = await fetch("/api/manuscript/index", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        book: {
          title: book.title,
          chapters: book.chapters,
          characters: book.characters ?? [],
          locations: book.locations ?? [],
          research: book.research ?? [],
          encyclopedia: book.encyclopedia ?? [],
          chronicle: book.chronicle ?? [],
          plotThreads: book.plotThreads ?? [],
          clarenceContext: book.clarenceContext,
        },
      }),
    });
  } catch {
    const desk = typeof window !== "undefined" && window.folioDesk?.isDesktop;
    throw new Error(
      desk
        ? "Couldn’t reach Folio’s local server — quit Folio Desk and reopen it, then try again."
        : "Network error talking to Clarence — check your connection and try again.",
    );
  }

  // Non-stream error responses (auth / thin manuscript)
  const contentType = res.headers.get("content-type") || "";
  if (!res.ok && !contentType.includes("ndjson")) {
    let message = "Could not index manuscript.";
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  if (!res.body) {
    throw new Error("Clarence returned an empty response.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let donePayload: {
    index?: import("@/lib/types").ManuscriptIndexData;
    passes?: number;
  } | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let msg: {
        type?: string;
        pass?: number;
        passCount?: number;
        chapters?: number;
        index?: import("@/lib/types").ManuscriptIndexData;
        passes?: number;
        error?: string;
      };
      try {
        msg = JSON.parse(trimmed) as typeof msg;
      } catch {
        continue;
      }
      if (msg.type === "start" || msg.type === "pass") {
        opts?.onProgress?.({
          pass: msg.pass ?? 0,
          passCount: msg.passCount ?? 1,
          chapters: msg.chapters,
        });
      } else if (msg.type === "done") {
        donePayload = { index: msg.index, passes: msg.passes };
      } else if (msg.type === "error") {
        throw new Error(msg.error || "Clarence couldn’t finish reading.");
      }
    }
  }

  if (!donePayload?.index) {
    throw new Error("Clarence finished without a reading — try again.");
  }
  return {
    index: donePayload.index,
    passes: donePayload.passes ?? 1,
  };
}
