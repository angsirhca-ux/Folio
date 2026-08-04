"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowDown, ArrowUp, Music, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ManuscriptIndexControls,
  useManuscriptIndex,
} from "@/components/Manuscript/ManuscriptIndexControls";
import { composeSoundtrackWithClaude } from "@/hooks/useClaudeEnrichment";
import { useBook } from "@/providers/BookProvider";
import { CLARENCE } from "@/lib/clarence";
import { sortSoundtrackSongs } from "@/lib/soundtrack";
import { cn } from "@/lib/utils";

export function SoundtrackPage() {
  const {
    book,
    hydrated,
    addSoundtrackSong,
    updateSoundtrackSong,
    deleteSoundtrackSong,
    moveSoundtrackSong,
    applySoundtrackFromClaude,
  } = useBook();
  const indexApi = useManuscriptIndex();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [populateMessage, setPopulateMessage] = useState<string | null>(null);

  const songs = useMemo(
    () => sortSoundtrackSongs(book.soundtrack ?? []),
    [book.soundtrack],
  );

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-1 w-16 overflow-hidden rounded-full bg-[rgba(176,141,87,0.2)]">
          <div className="folio-loading-bar h-full w-1/2 rounded-full bg-[var(--accent)]" />
        </div>
      </div>
    );
  }

  function createSong() {
    const id = addSoundtrackSong({ title: "New track", artist: "" });
    setExpandedId(id);
  }

  async function runComposeSoundtrack() {
    indexApi.setError(null);
    setPopulateMessage(null);
    const before = songs.length;
    const index = await indexApi.ensureIndex();
    indexApi.setPhase("applying");
    try {
      const payload = await composeSoundtrackWithClaude(book, index);
      if (!payload.songs.length) {
        throw new Error("Clarence returned an empty playlist.");
      }
      applySoundtrackFromClaude(payload);
      setPopulateMessage(
        `Queued ${payload.songs.length} track${payload.songs.length === 1 ? "" : "s"} from the manuscript reading${before ? " (merged with yours)" : ""}.`,
      );
      window.setTimeout(() => setPopulateMessage(null), 4800);
    } finally {
      indexApi.setPhase("idle");
    }
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 55% 35% at 78% 8%, color-mix(in srgb, var(--accent) 18%, transparent), transparent 68%), radial-gradient(ellipse 40% 30% at 12% 70%, rgba(45,42,38,0.05), transparent 70%), linear-gradient(180deg, #E6DFD2 0%, #EDE8E0 45%, #F2EDE4 100%)",
        }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-3xl px-5 pb-28 pt-10 sm:px-8">
        <header className="mb-10 max-w-xl">
          <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.28em] text-[var(--ink-faint)]">
            For the ride home
          </p>
          <h1 className="mt-3 flex items-baseline gap-3 font-[family-name:var(--font-display)] text-4xl font-medium tracking-tight text-[var(--ink)] sm:text-5xl">
            <Music
              className="relative top-0.5 h-8 w-8 text-[var(--accent)] sm:h-9 sm:w-9"
              strokeWidth={1.25}
            />
            Soundtrack
          </h1>
          <p className="mt-4 font-[family-name:var(--font-ui)] text-base leading-relaxed text-[var(--ink-muted)]">
            A listening list for the book — Clarence builds fifteen tracks from
            the manuscript reading (mood, cast, arc). Add your own, delete what
            doesn’t fit. Not canon. Just vibes.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              className="gap-1.5 rounded-full"
              onClick={createSong}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
              Add track
            </Button>
            <ManuscriptIndexControls
              api={indexApi}
              onPopulate={runComposeSoundtrack}
              populateLabel={CLARENCE.composeSoundtrackLabel}
              populateTitle={CLARENCE.composeSoundtrackTitle}
            />
            {populateMessage ? (
              <span className="font-[family-name:var(--font-ui)] text-xs text-[var(--ink-muted)]">
                {populateMessage}
              </span>
            ) : null}
          </div>
        </header>

        {songs.length === 0 ? (
          <div className="flex min-h-[14rem] flex-col items-center justify-center gap-3 rounded-[1.75rem] border border-dashed border-[rgba(45,42,38,0.14)] bg-[rgba(247,243,234,0.4)] px-6 text-center">
            <p className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
              Silence so far
            </p>
            <p className="max-w-sm font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)]">
              Compose from the manuscript reading, or drop in the first song
              that already feels like chapter one.
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <Button
                size="sm"
                className="gap-1.5 rounded-full"
                onClick={createSong}
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                Add track
              </Button>
              <ManuscriptIndexControls
                api={indexApi}
                onPopulate={runComposeSoundtrack}
                populateLabel={CLARENCE.composeSoundtrackLabel}
              />
            </div>
          </div>
        ) : (
          <ol className="space-y-0">
            {songs.map((song, index) => {
              const open = expandedId === song.id;
              return (
                <motion.li
                  key={song.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.35,
                    delay: Math.min(index * 0.03, 0.24),
                    ease: [0.25, 0.1, 0.25, 1],
                  }}
                  className={cn(
                    "border-b border-[rgba(45,42,38,0.08)] py-4 first:pt-0 last:border-b-0",
                  )}
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    <span className="mt-1 w-7 shrink-0 font-[family-name:var(--font-ui)] text-sm tabular-nums text-[var(--ink-faint)]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() =>
                        setExpandedId(open ? null : song.id)
                      }
                    >
                      <p className="font-[family-name:var(--font-display)] text-xl tracking-tight text-[var(--ink)] sm:text-2xl">
                        {song.title.trim() || "Untitled track"}
                      </p>
                      <p className="mt-0.5 font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)]">
                        {song.artist.trim() || "Unknown artist"}
                        {song.placement.trim()
                          ? ` · ${song.placement.trim()}`
                          : ""}
                      </p>
                      {!open && song.note.trim() ? (
                        <p className="mt-2 line-clamp-2 font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-faint)]">
                          {song.note}
                        </p>
                      ) : null}
                    </button>
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        aria-label="Move earlier"
                        disabled={index === 0}
                        onClick={() => moveSoundtrackSong(song.id, "up")}
                        className="rounded-full p-1.5 text-[var(--ink-faint)] disabled:opacity-30 hover:bg-[rgba(45,42,38,0.06)] hover:text-[var(--ink)]"
                      >
                        <ArrowUp className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                      <button
                        type="button"
                        aria-label="Move later"
                        disabled={index === songs.length - 1}
                        onClick={() => moveSoundtrackSong(song.id, "down")}
                        className="rounded-full p-1.5 text-[var(--ink-faint)] disabled:opacity-30 hover:bg-[rgba(45,42,38,0.06)] hover:text-[var(--ink)]"
                      >
                        <ArrowDown className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                      <button
                        type="button"
                        aria-label="Delete track"
                        onClick={() => deleteSoundtrackSong(song.id)}
                        className="rounded-full p-1.5 text-[var(--ink-faint)] hover:bg-[rgba(45,42,38,0.06)] hover:text-[#6B3A2A]"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>

                  {open ? (
                    <div className="mt-4 space-y-3 border-t border-[rgba(45,42,38,0.08)] pt-4 pl-10 sm:pl-11">
                      <label className="block">
                        <span className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                          Title
                        </span>
                        <input
                          value={song.title}
                          onChange={(e) =>
                            updateSoundtrackSong(song.id, {
                              title: e.target.value,
                            })
                          }
                          className="mt-1.5 w-full bg-transparent font-[family-name:var(--font-display)] text-lg text-[var(--ink)] focus:outline-none"
                        />
                      </label>
                      <label className="block">
                        <span className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                          Artist
                        </span>
                        <input
                          value={song.artist}
                          onChange={(e) =>
                            updateSoundtrackSong(song.id, {
                              artist: e.target.value,
                            })
                          }
                          className="mt-1.5 w-full border-0 border-b border-[rgba(45,42,38,0.1)] bg-transparent pb-2 font-[family-name:var(--font-ui)] text-sm text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none"
                        />
                      </label>
                      <label className="block">
                        <span className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                          Placement
                        </span>
                        <input
                          value={song.placement}
                          onChange={(e) =>
                            updateSoundtrackSong(song.id, {
                              placement: e.target.value,
                            })
                          }
                          placeholder="Opening, Midpoint, Climax…"
                          className="mt-1.5 w-full border-0 border-b border-[rgba(45,42,38,0.1)] bg-transparent pb-2 font-[family-name:var(--font-ui)] text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:border-[var(--accent)] focus:outline-none"
                        />
                      </label>
                      <label className="block">
                        <span className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                          Why it fits
                        </span>
                        <textarea
                          value={song.note}
                          onChange={(e) =>
                            updateSoundtrackSong(song.id, {
                              note: e.target.value,
                            })
                          }
                          rows={3}
                          placeholder="Mood, character, or the beat of the story it rides with…"
                          className="mt-1.5 w-full resize-none bg-transparent font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)] placeholder:text-[var(--ink-faint)] focus:outline-none"
                        />
                      </label>
                    </div>
                  ) : null}
                </motion.li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
