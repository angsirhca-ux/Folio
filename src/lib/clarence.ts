/** Folio’s house reader — the face of AI help. Not Anthropic’s brand. */
export const CLARENCE = {
  name: "Clarence",
  /** Default wiki deepen CTA */
  deepenLabel: "Ask Clarence",
  deepenTitle:
    "Clarence reads the manuscript and fills empty fields — he won’t overwrite what you wrote by hand",
  populateLabel: "Ask Clarence to populate",
  populateTitle:
    "Clarence applies seeds from his manuscript reading to this shelf",
  composeSoundtrackLabel: "Compose with Clarence",
  composeSoundtrackTitle:
    "Clarence builds a fifteen-slot score from your favorite artists (up to 4) plus the manuscript reading",
  rereadLabel: "Ask Clarence to reread",
  rereadTitle: "Force a fresh full manuscript reading",
  firstReadLabel: "Have Clarence read",
  firstReadTitle: "Clarence reads the manuscript so populate can seed empty shelves",
  reading: "Clarence is reading…",
  readingFull: "Clarence is reading the manuscript…",
  applying: "Clarence is applying…",
  unavailable: "Clarence is offline",
  needsKey:
    "Clarence needs an API key — add ANTHROPIC_API_KEY to .env.local (or Folio Desk’s Application Support .env)",
  needsKeyHint:
    "Clarence needs an API key. Web: add ANTHROPIC_API_KEY to .env.local. Folio Desk.app: put it in ~/Library/Application Support/Folio Desk/.env, then restart the app.",
  draftingFlags: "Clarence is drafting flags — keep this panel open.",
  buildMapLabel: "Ask Clarence to map it",
  buildMapTitle:
    "Clarence reads the story, finds places, and lays out the corkboard",
} as const;
