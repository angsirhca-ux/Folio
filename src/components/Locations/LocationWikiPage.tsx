"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import {
  LocationAppearancesRail,
  LocationsBackLink,
} from "@/components/Locations/LocationAppearancesRail";
import { ClaudeDeepenButton } from "@/components/Characters/ClaudeDeepenButton";
import { DepthMeter } from "@/components/Characters/DepthMeter";
import { WikiField } from "@/components/Characters/WikiField";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useBook } from "@/providers/BookProvider";
import {
  KIND_OPTIONS,
  locationAppearances,
  locationCompleteness,
  locationDepth,
} from "@/lib/locations";
import { useLocationDeepen } from "@/hooks/useClaudeEnrichment";
import {
  povColor,
  type Location,
  type LocationKind,
} from "@/lib/types";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "sensory", label: "Sensory" },
  { id: "place", label: "Place" },
  { id: "story", label: "Story" },
  { id: "people", label: "People" },
  { id: "connections", label: "Links" },
  { id: "appearances", label: "On the page" },
] as const;

export function LocationWikiPage({ locationId }: { locationId: string }) {
  const router = useRouter();
  const {
    book,
    hydrated,
    updateLocation,
    replaceLocation,
    deleteLocation,
    addLocationConnection,
    updateLocationConnection,
    removeLocationConnection,
    focusScene,
    promoteLocationToSeriesBible,
  } = useBook();
  const [pendingDelete, setPendingDelete] = useState(false);
  const [connLabel, setConnLabel] = useState("");
  const [connTarget, setConnTarget] = useState("");

  const location = useMemo(
    () => (book.locations ?? []).find((l) => l.id === locationId),
    [book.locations, locationId],
  );

  const others = useMemo(
    () => (book.locations ?? []).filter((l) => l.id !== locationId),
    [book.locations, locationId],
  );

  const appearances = useMemo(
    () => (location ? locationAppearances(book.chapters, location) : []),
    [book.chapters, location],
  );

  const onApplyEnrichment = useCallback(
    (next: Location) => {
      replaceLocation(next);
    },
    [replaceLocation],
  );

  const {
    status: claudeStatus,
    busy: deepenBusy,
    error: deepenError,
    doneAt: deepenDoneAt,
    deepen,
  } = useLocationDeepen(book, location, onApplyEnrichment);

  const completeness = location ? locationCompleteness(location) : 0;
  const depth = location
    ? locationDepth(location, appearances.length)
    : "stub";
  const accent = location ? povColor(location.name) : "var(--accent)";

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-1 w-16 overflow-hidden rounded-full bg-[rgba(176,141,87,0.2)]">
          <div className="folio-loading-bar h-full w-1/2 rounded-full bg-[var(--accent)]" />
        </div>
      </div>
    );
  }

  if (!location) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <p className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
          Location not found
        </p>
        <Link
          href="/locations"
          className="mt-6 inline-block font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)] underline underline-offset-4"
        >
          Back to atlas
        </Link>
      </div>
    );
  }

  function patch(partial: Parameters<typeof updateLocation>[1]) {
    updateLocation(locationId, partial);
  }

  function patchNested<K extends "sensory" | "place" | "story">(
    key: K,
    field: keyof Location[K],
    value: string,
  ) {
    updateLocation(locationId, {
      [key]: { ...location![key], [field]: value },
    } as Partial<Location>);
  }

  return (
    <div className="relative min-h-screen">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-56 opacity-40"
        style={{
          background: `linear-gradient(180deg, color-mix(in srgb, ${accent} 18%, transparent), transparent)`,
        }}
        aria-hidden
      />

      <div className="relative mx-auto grid max-w-5xl gap-10 px-5 pb-28 pt-8 sm:px-8 lg:grid-cols-[11rem_minmax(0,1fr)] lg:px-10 lg:pt-10">
        <aside className="hidden lg:block">
          <div className="sticky top-8 space-y-8">
            <LocationsBackLink />
            <nav aria-label="Wiki sections" className="space-y-2">
              {SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="block font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
                >
                  {s.label}
                </a>
              ))}
            </nav>
            <DepthMeter
              depth={depth}
              completeness={completeness}
              variant="location"
            />
            <p className="font-[family-name:var(--font-ui)] text-xs leading-relaxed text-[var(--ink-faint)]">
              {appearances.length === 0
                ? "Waiting for a first scene."
                : `${appearances.length} appearance${appearances.length === 1 ? "" : "s"} in the manuscript.`}
            </p>
          </div>
        </aside>

        <article className="min-w-0">
          <div className="mb-6 flex items-center justify-between gap-4 lg:hidden">
            <LocationsBackLink />
            <button
              type="button"
              aria-label="Delete location"
              onClick={() => setPendingDelete(true)}
              className="rounded-full p-2 text-[var(--ink-faint)] transition-colors hover:text-[#6B3A2A]"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>

          <motion.header
            id="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
            className="scroll-mt-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <input
                  value={location.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  aria-label="Location name"
                  className="w-full bg-transparent font-[family-name:var(--font-display)] text-4xl font-medium tracking-tight text-[var(--ink)] focus:outline-none sm:text-5xl"
                />
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-2">
                    <span className="sr-only">Kind</span>
                    <select
                      value={location.kind}
                      onChange={(e) =>
                        patch({ kind: e.target.value as LocationKind })
                      }
                      className="rounded-full border border-[rgba(45,42,38,0.1)] bg-[rgba(247,243,234,0.6)] px-3 py-1.5 font-[family-name:var(--font-ui)] text-xs uppercase tracking-[0.14em] text-[var(--ink-muted)] focus:outline-none"
                    >
                      {KIND_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <ClaudeDeepenButton
                    configured={claudeStatus?.configured ?? null}
                    busy={deepenBusy}
                    onClick={() => void deepen()}
                  />
                  {book.seriesId ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full text-xs"
                      onClick={() =>
                        promoteLocationToSeriesBible(location.id)
                      }
                    >
                      Promote to series
                    </Button>
                  ) : null}
                  {deepenDoneAt ? (
                    <span className="font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)]">
                      Updated
                    </span>
                  ) : null}
                </div>
                {deepenError ? (
                  <p className="mt-3 font-[family-name:var(--font-ui)] text-xs text-[#6B3A2A]">
                    {deepenError}
                  </p>
                ) : null}
                {claudeStatus?.configured === false ? (
                  <p className="mt-3 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)]">
                    Add ANTHROPIC_API_KEY to .env.local (see env.example), then
                    restart the server.
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Delete location"
                onClick={() => setPendingDelete(true)}
                className="hidden rounded-full p-2 text-[var(--ink-faint)] transition-colors hover:text-[#6B3A2A] lg:inline-flex"
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>

            <WikiField
              className="mt-8"
              label="Atlas blurb"
              hint="One line for the roster — what this place is at a glance."
              value={location.shortBio}
              onChange={(shortBio) => patch({ shortBio })}
              placeholder="A quiet room that listens before anyone speaks."
              rows={2}
            />

            <WikiField
              className="mt-8"
              label="Wiki"
              hint="Your notes — sync never overwrites this once you’ve written something."
              value={location.wiki}
              onChange={(wiki) => patch({ wiki })}
              placeholder="Write what you know so far about this place."
              rows={5}
              inputClassName="text-[1.05rem] leading-[1.75]"
            />

            {location.storyDigest ? (
              <div className="mt-10 rounded-sm border-l-2 border-[var(--accent)] pl-5">
                <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                  From the manuscript
                </p>
                <p className="mt-1 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)]">
                  Auto-updated from scenes and prose mentions.
                </p>
                <pre className="mt-4 whitespace-pre-wrap font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
                  {location.storyDigest}
                </pre>
              </div>
            ) : null}

            <WikiField
              className="mt-8"
              label="Also known as"
              value={location.aliases.join(", ")}
              onChange={(raw) =>
                patch({
                  aliases: raw
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="Other names, nicknames for the place…"
              multiline={false}
            />

            <WikiField
              className="mt-6"
              label="Tags"
              value={location.tags.join(", ")}
              onChange={(raw) =>
                patch({
                  tags: raw
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="opening, refuge, danger…"
              multiline={false}
            />
          </motion.header>

          <WikiSection id="sensory" title="Sensory" index={1}>
            <div className="grid gap-8 sm:grid-cols-2">
              <WikiField
                label="Sight"
                value={location.sensory.sight}
                onChange={(v) => patchNested("sensory", "sight", v)}
                rows={3}
              />
              <WikiField
                label="Sound"
                value={location.sensory.sound}
                onChange={(v) => patchNested("sensory", "sound", v)}
                rows={3}
              />
              <WikiField
                label="Smell"
                value={location.sensory.smell}
                onChange={(v) => patchNested("sensory", "smell", v)}
                rows={2}
              />
              <WikiField
                label="Atmosphere"
                value={location.sensory.atmosphere}
                onChange={(v) => patchNested("sensory", "atmosphere", v)}
                rows={3}
              />
            </div>
          </WikiSection>

          <WikiSection id="place" title="Place" index={2}>
            <div className="grid gap-8 sm:grid-cols-2">
              <WikiField
                label="Region"
                value={location.place.region}
                onChange={(v) => patchNested("place", "region", v)}
                multiline={false}
              />
              <WikiField
                label="Scale"
                value={location.place.scale}
                onChange={(v) => patchNested("place", "scale", v)}
                placeholder="Room, street, town…"
                multiline={false}
              />
            </div>
            <WikiField
              className="mt-8"
              label="Access"
              hint="How you arrive — door, path, invitation."
              value={location.place.access}
              onChange={(v) => patchNested("place", "access", v)}
              rows={2}
            />
            <WikiField
              className="mt-8"
              label="Landmarks"
              value={location.place.landmarks}
              onChange={(v) => patchNested("place", "landmarks", v)}
              rows={2}
            />
          </WikiSection>

          <WikiSection id="story" title="Story" index={3}>
            <WikiField
              label="Function"
              hint="What this place does in the plot."
              value={location.story.function}
              onChange={(v) => patchNested("story", "function", v)}
              rows={3}
            />
            <WikiField
              className="mt-8"
              label="First impression"
              value={location.story.firstImpression}
              onChange={(v) => patchNested("story", "firstImpression", v)}
              rows={2}
            />
            <WikiField
              className="mt-8"
              label="How it changes"
              value={location.story.changes}
              onChange={(v) => patchNested("story", "changes", v)}
              rows={3}
            />
            <WikiField
              className="mt-8"
              label="Secrets"
              value={location.secrets}
              onChange={(secrets) => patch({ secrets })}
              rows={3}
            />
          </WikiSection>

          <WikiSection id="people" title="People" index={4}>
            <WikiField
              label="Who belongs here"
              hint="Names from the cast who inhabit or frequent this place."
              value={location.inhabitants.join(", ")}
              onChange={(raw) =>
                patch({
                  inhabitants: raw
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="Elena, Marcus…"
              multiline={false}
            />
          </WikiSection>

          <WikiSection id="connections" title="Links" index={5}>
            {location.connections.length === 0 ? (
              <p className="font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)]">
                No links yet. Connect places that border, lead to, or echo each
                other.
              </p>
            ) : (
              <ul className="space-y-6">
                {location.connections.map((r) => {
                  const linked = others.find((o) => o.id === r.toLocationId);
                  return (
                    <li
                      key={r.id}
                      className="border-b border-[rgba(45,42,38,0.08)] pb-6"
                    >
                      <div className="flex flex-wrap items-baseline gap-3">
                        <input
                          value={r.label}
                          onChange={(e) =>
                            updateLocationConnection(locationId, r.id, {
                              label: e.target.value,
                            })
                          }
                          placeholder="Label"
                          className="min-w-[8rem] flex-1 bg-transparent font-[family-name:var(--font-ui)] text-xs uppercase tracking-[0.16em] text-[var(--ink-faint)] focus:outline-none"
                        />
                        {linked ? (
                          <Link
                            href={`/locations/${linked.id}`}
                            className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)] underline decoration-[rgba(176,141,87,0.3)] underline-offset-4"
                          >
                            {linked.name}
                          </Link>
                        ) : (
                          <input
                            value={r.toName}
                            onChange={(e) =>
                              updateLocationConnection(locationId, r.id, {
                                toName: e.target.value,
                              })
                            }
                            placeholder="Place"
                            className="bg-transparent font-[family-name:var(--font-display)] text-lg text-[var(--ink)] focus:outline-none"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            removeLocationConnection(locationId, r.id)
                          }
                          className="ml-auto font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)] hover:text-[#6B3A2A]"
                        >
                          Remove
                        </button>
                      </div>
                      <textarea
                        value={r.notes}
                        onChange={(e) =>
                          updateLocationConnection(locationId, r.id, {
                            notes: e.target.value,
                          })
                        }
                        placeholder="How they relate…"
                        rows={2}
                        className="mt-3 w-full resize-none bg-transparent font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)] placeholder:text-[var(--ink-faint)] focus:outline-none"
                      />
                    </li>
                  );
                })}
              </ul>
            )}

            <form
              className="mt-8 flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!connLabel.trim()) return;
                const target = others.find((o) => o.id === connTarget);
                addLocationConnection(locationId, {
                  label: connLabel.trim(),
                  toLocationId: target?.id ?? "",
                  toName: target?.name ?? "",
                });
                setConnLabel("");
                setConnTarget("");
              }}
            >
              <label className="min-w-[8rem] flex-1">
                <span className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                  New link
                </span>
                <input
                  value={connLabel}
                  onChange={(e) => setConnLabel(e.target.value)}
                  placeholder="opens onto, leads to…"
                  className="mt-2 w-full border-0 border-b border-[rgba(45,42,38,0.1)] bg-transparent pb-2 font-[family-name:var(--font-body)] text-sm focus:border-[var(--accent)] focus:outline-none"
                />
              </label>
              <label className="min-w-[10rem] flex-1">
                <span className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                  With
                </span>
                <select
                  value={connTarget}
                  onChange={(e) => setConnTarget(e.target.value)}
                  className="mt-2 w-full border-0 border-b border-[rgba(45,42,38,0.1)] bg-transparent pb-2 font-[family-name:var(--font-body)] text-sm text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none"
                >
                  <option value="">Somewhere else…</option>
                  {others.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="submit"
                size="sm"
                variant="outline"
                className="rounded-full"
                disabled={!connLabel.trim()}
              >
                Add
              </Button>
            </form>
          </WikiSection>

          <WikiSection id="appearances" title="On the page" index={6}>
            <LocationAppearancesRail
              appearances={appearances}
              onOpenScene={focusScene}
            />
          </WikiSection>
        </article>
      </div>

      <ConfirmDialog
        open={pendingDelete}
        onOpenChange={setPendingDelete}
        title={`Delete ${location.name}?`}
        description="This wiki entry will move to Trash. Scene location tags keep the name; you can restore the page from Trash."
        confirmLabel="Move to trash"
        onConfirm={() => {
          deleteLocation(locationId);
          router.push("/locations");
        }}
      />
    </div>
  );
}

function WikiSection({
  id,
  title,
  index,
  children,
}: {
  id: string;
  title: string;
  index: number;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{
        duration: 0.45,
        delay: 0.04,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      className="mt-16 scroll-mt-8 border-t border-[rgba(45,42,38,0.1)] pt-10"
    >
      <h2 className="flex items-baseline gap-3 font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
        <span className="font-[family-name:var(--font-ui)] text-sm text-[var(--ink-faint)]">
          {String(index).padStart(2, "0")}
        </span>
        {title}
      </h2>
      <div className="mt-8">{children}</div>
    </motion.section>
  );
}
