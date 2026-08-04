"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ManuscriptIndexControls,
  useManuscriptIndex,
} from "@/components/Manuscript/ManuscriptIndexControls";
import { useBook } from "@/providers/BookProvider";
import { sortChronicleEvents } from "@/lib/chronicle";
import { sortEncyclopediaStacks } from "@/lib/encyclopedia";
import { cn } from "@/lib/utils";

export function ChroniclePage() {
  const {
    book,
    hydrated,
    addChronicleEvent,
    updateChronicleEvent,
    deleteChronicleEvent,
    moveChronicleEvent,
    applyChronicleFromClaude,
  } = useBook();
  const indexApi = useManuscriptIndex();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [populateMessage, setPopulateMessage] = useState<string | null>(null);

  const events = useMemo(
    () => sortChronicleEvents(book.chronicle ?? []),
    [book.chronicle],
  );

  const stacks = useMemo(
    () => sortEncyclopediaStacks(book.encyclopediaStacks ?? []),
    [book.encyclopediaStacks],
  );

  const entryById = useMemo(() => {
    const map = new Map((book.encyclopedia ?? []).map((e) => [e.id, e]));
    return map;
  }, [book.encyclopedia]);

  const characterById = useMemo(() => {
    const map = new Map((book.characters ?? []).map((c) => [c.id, c]));
    return map;
  }, [book.characters]);

  const locationById = useMemo(() => {
    const map = new Map((book.locations ?? []).map((l) => [l.id, l]));
    return map;
  }, [book.locations]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-1 w-16 overflow-hidden rounded-full bg-[rgba(176,141,87,0.2)]">
          <div className="folio-loading-bar h-full w-1/2 rounded-full bg-[var(--accent)]" />
        </div>
      </div>
    );
  }

  function createEvent() {
    const id = addChronicleEvent({ title: "New event" });
    setExpandedId(id);
  }

  async function runPopulateChronicle() {
    indexApi.setError(null);
    setPopulateMessage(null);
    const before = new Set(
      (book.chronicle ?? []).map((e) => e.title.trim().toLowerCase()),
    );
    const index = await indexApi.ensureIndex();
    indexApi.setPhase("applying");
    try {
      const events = index.chronicle ?? [];
      if (!events.length) {
        throw new Error("No world-history events in the manuscript reading.");
      }
      applyChronicleFromClaude({ events });
      const added = events.filter(
        (e) => !before.has(e.title.trim().toLowerCase()),
      ).length;
      const updated = events.length - added;
      const parts: string[] = [];
      if (added > 0) {
        parts.push(`${added} new event${added === 1 ? "" : "s"}`);
      }
      if (updated > 0) {
        parts.push(`${updated} updated`);
      }
      setPopulateMessage(
        parts.length > 0
          ? `Applied ${parts.join(", ")} from the manuscript reading.`
          : "Chronicle updated from the manuscript reading.",
      );
      window.setTimeout(() => setPopulateMessage(null), 4200);
    } finally {
      indexApi.setPhase("idle");
    }
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 65% 40% at 20% 6%, color-mix(in srgb, var(--accent) 14%, transparent), transparent 70%), linear-gradient(180deg, #E8E0D4 0%, #EDE8E0 48%, #F4EFE6 100%)",
        }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-3xl px-5 pb-28 pt-10 sm:px-8">
        <header className="mb-10 max-w-xl">
          <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.28em] text-[var(--ink-faint)]">
            World bible
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-medium tracking-tight text-[var(--ink)] sm:text-5xl">
            Chronicle
          </h1>
          <p className="mt-4 font-[family-name:var(--font-ui)] text-base leading-relaxed text-[var(--ink-muted)]">
            Lore history for the world — ages, wars, founding moments. This is
            not the plot{" "}
            <Link
              href="/timeline"
              className="text-[var(--accent)] underline-offset-2 hover:underline"
            >
              Timeline
            </Link>
            ; link events to encyclopedia cards, cast, and places.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              className="gap-1.5 rounded-full"
              onClick={createEvent}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
              New event
            </Button>
            <ManuscriptIndexControls
              api={indexApi}
              onPopulate={runPopulateChronicle}
              populateTitle="Apply world-history events from the manuscript reading — lore ages and wars, not plot beats"
            />
            {populateMessage ? (
              <span className="font-[family-name:var(--font-ui)] text-xs text-[var(--ink-muted)]">
                {populateMessage}
              </span>
            ) : null}
          </div>
        </header>

        {events.length === 0 ? (
          <div className="flex min-h-[14rem] flex-col items-center justify-center gap-3 rounded-[1.75rem] border border-dashed border-[rgba(45,42,38,0.14)] bg-[rgba(247,243,234,0.4)] px-6 text-center">
            <p className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
              No chronicle yet
            </p>
            <p className="max-w-sm font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)]">
              Start with the earliest age or the first rupture that still echoes
              in the story — or let Clarence pull lore from the manuscript.
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <Button
                size="sm"
                className="gap-1.5 rounded-full"
                onClick={createEvent}
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                New event
              </Button>
              <ManuscriptIndexControls
                api={indexApi}
                onPopulate={runPopulateChronicle}
                populateTitle="Apply world-history events from the manuscript reading"
              />
            </div>
          </div>
        ) : (
          <ol className="relative space-y-0 border-l border-[rgba(45,42,38,0.12)] pl-6 sm:pl-8">
            {events.map((event, index) => {
              const open = expandedId === event.id;
              return (
                <motion.li
                  key={event.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.4,
                    delay: Math.min(index * 0.04, 0.28),
                    ease: [0.25, 0.1, 0.25, 1],
                  }}
                  className="relative pb-10 last:pb-0"
                >
                  <span
                    className="absolute -left-[1.65rem] top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--accent)] sm:-left-[2.15rem]"
                    aria-hidden
                  />
                  <div className="rounded-[1.25rem] border border-[rgba(45,42,38,0.08)] bg-[rgba(252,249,243,0.72)] px-4 py-4 shadow-[0_10px_28px_rgba(45,42,38,0.05)] sm:px-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() =>
                          setExpandedId(open ? null : event.id)
                        }
                      >
                        <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                          {event.whenLabel.trim() || "When unset"}
                        </p>
                        <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl tracking-tight text-[var(--ink)]">
                          {event.title.trim() || "Untitled event"}
                        </h2>
                        {!open && event.summary.trim() ? (
                          <p className="mt-2 line-clamp-2 font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
                            {event.summary}
                          </p>
                        ) : null}
                      </button>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label="Move earlier"
                          disabled={index === 0}
                          onClick={() => moveChronicleEvent(event.id, "up")}
                          className="rounded-full p-1.5 text-[var(--ink-faint)] disabled:opacity-30 hover:bg-[rgba(45,42,38,0.06)] hover:text-[var(--ink)]"
                        >
                          <ArrowUp className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </button>
                        <button
                          type="button"
                          aria-label="Move later"
                          disabled={index === events.length - 1}
                          onClick={() => moveChronicleEvent(event.id, "down")}
                          className="rounded-full p-1.5 text-[var(--ink-faint)] disabled:opacity-30 hover:bg-[rgba(45,42,38,0.06)] hover:text-[var(--ink)]"
                        >
                          <ArrowDown className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </button>
                        <button
                          type="button"
                          aria-label="Delete event"
                          onClick={() => deleteChronicleEvent(event.id)}
                          className="rounded-full p-1.5 text-[var(--ink-faint)] hover:bg-[rgba(45,42,38,0.06)] hover:text-[#6B3A2A]"
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </button>
                      </div>
                    </div>

                    {open ? (
                      <div className="mt-5 space-y-4 border-t border-[rgba(45,42,38,0.08)] pt-5">
                        <label className="block">
                          <span className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                            Title
                          </span>
                          <input
                            value={event.title}
                            onChange={(e) =>
                              updateChronicleEvent(event.id, {
                                title: e.target.value,
                              })
                            }
                            className="mt-2 w-full bg-transparent font-[family-name:var(--font-display)] text-xl text-[var(--ink)] focus:outline-none"
                          />
                        </label>
                        <label className="block">
                          <span className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                            When
                          </span>
                          <input
                            value={event.whenLabel}
                            onChange={(e) =>
                              updateChronicleEvent(event.id, {
                                whenLabel: e.target.value,
                              })
                            }
                            placeholder="Age of Ash, 1123, Before the war…"
                            className="mt-2 w-full border-0 border-b border-[rgba(45,42,38,0.1)] bg-transparent pb-2 font-[family-name:var(--font-ui)] text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:border-[var(--accent)] focus:outline-none"
                          />
                        </label>
                        <label className="block">
                          <span className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                            Summary
                          </span>
                          <textarea
                            value={event.summary}
                            onChange={(e) =>
                              updateChronicleEvent(event.id, {
                                summary: e.target.value,
                              })
                            }
                            rows={4}
                            placeholder="What happened in the world — not the novel’s plot beat."
                            className="mt-2 w-full resize-none bg-transparent font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)] placeholder:text-[var(--ink-faint)] focus:outline-none"
                          />
                        </label>

                        <LinkPicker
                          label="Encyclopedia"
                          options={(book.encyclopedia ?? []).map((e) => ({
                            id: e.id,
                            name: e.title,
                            hint: stacks.find((s) => s.id === e.stackId)?.name,
                          }))}
                          selected={event.linkedEntryIds}
                          onChange={(linkedEntryIds) =>
                            updateChronicleEvent(event.id, { linkedEntryIds })
                          }
                          hrefFor={(id) => `/encyclopedia/${id}`}
                          resolveName={(id) => entryById.get(id)?.title}
                        />
                        <LinkPicker
                          label="Characters"
                          options={(book.characters ?? []).map((c) => ({
                            id: c.id,
                            name: c.name,
                          }))}
                          selected={event.linkedCharacterIds}
                          onChange={(linkedCharacterIds) =>
                            updateChronicleEvent(event.id, {
                              linkedCharacterIds,
                            })
                          }
                          hrefFor={(id) => `/characters/${id}`}
                          resolveName={(id) => characterById.get(id)?.name}
                        />
                        <LinkPicker
                          label="Locations"
                          options={(book.locations ?? []).map((l) => ({
                            id: l.id,
                            name: l.name,
                          }))}
                          selected={event.linkedLocationIds}
                          onChange={(linkedLocationIds) =>
                            updateChronicleEvent(event.id, {
                              linkedLocationIds,
                            })
                          }
                          hrefFor={(id) => `/locations/${id}`}
                          resolveName={(id) => locationById.get(id)?.name}
                        />

                        <ChronicleMapPlacement
                          eventId={event.id}
                          mapMarker={event.mapMarker}
                          linkedLocationIds={event.linkedLocationIds}
                        />
                      </div>
                    ) : null}
                  </div>
                </motion.li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

function ChronicleMapPlacement({
  eventId,
  mapMarker,
  linkedLocationIds,
}: {
  eventId: string;
  mapMarker?: { mapId: string; x: number; y: number };
  linkedLocationIds: string[];
}) {
  const { book, updateChronicleEvent } = useBook();
  const map = book.map;
  if (!map) return null;

  const pinFromLinked = (() => {
    for (const locId of linkedLocationIds) {
      const pin = map.pins.find((p) => p.locationId === locId);
      if (pin) return pin;
    }
    return null;
  })();

  const placedHere = mapMarker?.mapId === map.id;

  return (
    <div>
      <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
        On the map
      </p>
      <p className="mt-1 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)]">
        Optional — a soft marker on “{map.name}”, not a second atlas.
      </p>
      {placedHere ? (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Link
            href="/map"
            className="font-[family-name:var(--font-ui)] text-xs text-[var(--accent)] hover:underline"
          >
            View on map
          </Link>
          <button
            type="button"
            className="font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)] hover:text-[#6B3A2A]"
            onClick={() =>
              updateChronicleEvent(eventId, { mapMarker: undefined })
            }
          >
            Clear marker
          </button>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            className="font-[family-name:var(--font-ui)] text-xs text-[var(--accent)] hover:underline"
            onClick={() =>
              updateChronicleEvent(eventId, {
                mapMarker: {
                  mapId: map.id,
                  x: pinFromLinked?.x ?? 0.5,
                  y: pinFromLinked?.y ?? 0.5,
                },
              })
            }
          >
            {pinFromLinked
              ? "Place near linked place"
              : "Place on map (center)"}
          </button>
        </div>
      )}
    </div>
  );
}

function LinkPicker({
  label,
  options,
  selected,
  onChange,
  hrefFor,
  resolveName,
}: {
  label: string;
  options: Array<{ id: string; name: string; hint?: string }>;
  selected: string[];
  onChange: (ids: string[]) => void;
  hrefFor: (id: string) => string;
  resolveName: (id: string) => string | undefined;
}) {
  const [pick, setPick] = useState("");
  const available = options.filter((o) => !selected.includes(o.id));

  return (
    <div>
      <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
        {label}
      </p>
      {selected.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {selected.map((id) => (
            <li key={id}>
              <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(45,42,38,0.1)] bg-[rgba(247,243,234,0.7)] px-2.5 py-1">
                <Link
                  href={hrefFor(id)}
                  className="font-[family-name:var(--font-ui)] text-xs text-[var(--ink)] hover:text-[var(--accent)]"
                >
                  {resolveName(id) || "Missing"}
                </Link>
                <button
                  type="button"
                  aria-label="Remove link"
                  onClick={() => onChange(selected.filter((x) => x !== id))}
                  className="text-[var(--ink-faint)] hover:text-[#6B3A2A]"
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 font-[family-name:var(--font-ui)] text-xs italic text-[var(--ink-faint)]">
          None linked
        </p>
      )}
      {available.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            className={cn(
              "h-8 rounded-full border border-[rgba(45,42,38,0.1)] bg-[rgba(247,243,234,0.7)] px-3 font-[family-name:var(--font-ui)] text-xs text-[var(--ink)] focus:outline-none",
            )}
          >
            <option value="">Add…</option>
            {available.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
                {o.hint ? ` (${o.hint})` : ""}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 rounded-full text-xs"
            disabled={!pick}
            onClick={() => {
              if (!pick || selected.includes(pick)) return;
              onChange([...selected, pick]);
              setPick("");
            }}
          >
            Link
          </Button>
        </div>
      ) : null}
    </div>
  );
}
