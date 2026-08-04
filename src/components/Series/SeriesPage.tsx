"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useBook } from "@/providers/BookProvider";
import { booksInSeries, findSeries } from "@/lib/series";
import { createCharacter } from "@/lib/characters";
import { createLocation } from "@/lib/locations";
import {
  createEncyclopediaEntry,
  ensureEncyclopediaStackNamed,
  sortEncyclopediaStacks,
} from "@/lib/encyclopedia";
import { formatWordCount } from "@/lib/utils";
import { bookWordCount } from "@/lib/trash";

export function SeriesPage({ seriesId }: { seriesId: string }) {
  const router = useRouter();
  const {
    hydrated,
    libraryBooks,
    librarySeries,
    updateSeries,
    deleteSeries,
    assignBookToSeries,
    switchBook,
  } = useBook();
  const [pendingDelete, setPendingDelete] = useState(false);

  const series = useMemo(
    () => findSeries(librarySeries, seriesId),
    [librarySeries, seriesId],
  );

  const members = useMemo(
    () => (series ? booksInSeries(libraryBooks, series.id) : []),
    [libraryBooks, series],
  );

  const unassigned = useMemo(
    () => libraryBooks.filter((b) => !b.seriesId || b.seriesId === seriesId),
    [libraryBooks, seriesId],
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

  if (!series) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center">
        <p className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
          Series not found
        </p>
        <Link
          href="/books"
          className="mt-6 inline-block font-[family-name:var(--font-ui)] text-sm text-[var(--accent)]"
        >
          Back to Books
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 pb-24 pt-10 sm:px-8">
      <Link
        href="/books"
        className="inline-flex items-center gap-1.5 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)] transition-colors hover:text-[var(--ink-muted)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
        Books
      </Link>

      <header className="mt-6 mb-10">
        <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.28em] text-[var(--ink-faint)]">
          Series bible
        </p>
        <input
          value={series.title}
          onChange={(e) => updateSeries(series.id, { title: e.target.value })}
          aria-label="Series title"
          className="mt-3 w-full bg-transparent font-[family-name:var(--font-display)] text-4xl font-medium tracking-tight text-[var(--ink)] focus:outline-none"
        />
        <p className="mt-4 font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
          Shared cast, places, encyclopedia, and maps for every book in this
          series. Bring entries into a manuscript when that book needs them —
          books stay free to diverge.
        </p>
      </header>

      <section className="mb-10">
        <h2 className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
          Synopsis
        </h2>
        <textarea
          value={series.synopsis}
          onChange={(e) => updateSeries(series.id, { synopsis: e.target.value })}
          rows={3}
          placeholder="What holds these books together…"
          className="mt-3 w-full resize-none rounded-2xl border border-[rgba(45,42,38,0.08)] bg-[rgba(247,243,234,0.45)] px-4 py-3 font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:outline-none"
        />
      </section>

      <section className="mb-10">
        <h2 className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
          Books in this series
        </h2>
        <ul className="mt-3 divide-y divide-[rgba(45,42,38,0.06)] border-t border-[rgba(45,42,38,0.08)]">
          {members.length === 0 ? (
            <li className="py-4 font-[family-name:var(--font-ui)] text-sm italic text-[var(--ink-faint)]">
              No manuscripts assigned yet.
            </li>
          ) : (
            members.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <button
                  type="button"
                  onClick={() => {
                    switchBook(b.id);
                    router.push("/");
                  }}
                  className="text-left font-[family-name:var(--font-display)] text-lg text-[var(--ink)] hover:text-[color-mix(in_srgb,var(--accent)_65%,var(--ink))]"
                >
                  {b.title || "Untitled"}
                </button>
                <div className="flex items-center gap-3">
                  <span className="font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)]">
                    {formatWordCount(bookWordCount(b))}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-full text-xs"
                    onClick={() => assignBookToSeries(b.id, null)}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))
          )}
        </ul>
        <label className="mt-4 flex flex-wrap items-center gap-2">
          <span className="font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)]">
            Add book
          </span>
          <select
            className="h-9 rounded-full border border-[rgba(45,42,38,0.08)] bg-[rgba(247,243,234,0.55)] px-3 font-[family-name:var(--font-ui)] text-sm text-[var(--ink)] focus:outline-none"
            defaultValue=""
            onChange={(e) => {
              const id = e.target.value;
              if (!id) return;
              assignBookToSeries(id, series.id);
              e.target.value = "";
            }}
          >
            <option value="" disabled>
              Choose…
            </option>
            {unassigned
              .filter((b) => b.seriesId !== series.id)
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title || "Untitled"}
                </option>
              ))}
          </select>
        </label>
      </section>

      <section className="mb-10">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
            Shared cast
          </h2>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 rounded-full"
            onClick={() => {
              const c = createCharacter({ name: "New character" });
              updateSeries(series.id, {
                characters: [...series.characters, c],
              });
            }}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            Add
          </Button>
        </div>
        <ul className="mt-3 space-y-4">
          {series.characters.length === 0 ? (
            <li className="font-[family-name:var(--font-ui)] text-sm italic text-[var(--ink-faint)]">
              Empty — promote from a book’s Characters page, or add here.
            </li>
          ) : (
            series.characters.map((c) => (
              <li
                key={c.id}
                className="rounded-2xl border border-[rgba(45,42,38,0.06)] bg-[rgba(247,243,234,0.35)] px-4 py-3"
              >
                <input
                  value={c.name}
                  onChange={(e) =>
                    updateSeries(series.id, {
                      characters: series.characters.map((x) =>
                        x.id === c.id
                          ? { ...x, name: e.target.value, updatedAt: Date.now() }
                          : x,
                      ),
                    })
                  }
                  className="w-full bg-transparent font-[family-name:var(--font-display)] text-lg text-[var(--ink)] focus:outline-none"
                />
                <textarea
                  value={c.shortBio}
                  onChange={(e) =>
                    updateSeries(series.id, {
                      characters: series.characters.map((x) =>
                        x.id === c.id
                          ? {
                              ...x,
                              shortBio: e.target.value,
                              updatedAt: Date.now(),
                            }
                          : x,
                      ),
                    })
                  }
                  rows={2}
                  placeholder="One-line blurb for the series bible…"
                  className="mt-2 w-full resize-none bg-transparent font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)] placeholder:text-[var(--ink-faint)] focus:outline-none"
                />
                <button
                  type="button"
                  className="mt-2 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)] hover:text-[#6B3A2A]"
                  onClick={() =>
                    updateSeries(series.id, {
                      characters: series.characters.filter((x) => x.id !== c.id),
                    })
                  }
                >
                  Remove from bible
                </button>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="mb-10">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
            Shared places
          </h2>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 rounded-full"
            onClick={() => {
              const l = createLocation({ name: "New place" });
              updateSeries(series.id, {
                locations: [...series.locations, l],
              });
            }}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            Add
          </Button>
        </div>
        <ul className="mt-3 space-y-4">
          {series.locations.length === 0 ? (
            <li className="font-[family-name:var(--font-ui)] text-sm italic text-[var(--ink-faint)]">
              Empty — promote from Locations, or add here.
            </li>
          ) : (
            series.locations.map((l) => (
              <li
                key={l.id}
                className="rounded-2xl border border-[rgba(45,42,38,0.06)] bg-[rgba(247,243,234,0.35)] px-4 py-3"
              >
                <input
                  value={l.name}
                  onChange={(e) =>
                    updateSeries(series.id, {
                      locations: series.locations.map((x) =>
                        x.id === l.id
                          ? { ...x, name: e.target.value, updatedAt: Date.now() }
                          : x,
                      ),
                    })
                  }
                  className="w-full bg-transparent font-[family-name:var(--font-display)] text-lg text-[var(--ink)] focus:outline-none"
                />
                <textarea
                  value={l.shortBio}
                  onChange={(e) =>
                    updateSeries(series.id, {
                      locations: series.locations.map((x) =>
                        x.id === l.id
                          ? {
                              ...x,
                              shortBio: e.target.value,
                              updatedAt: Date.now(),
                            }
                          : x,
                      ),
                    })
                  }
                  rows={2}
                  placeholder="One-line place note…"
                  className="mt-2 w-full resize-none bg-transparent font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)] placeholder:text-[var(--ink-faint)] focus:outline-none"
                />
                <button
                  type="button"
                  className="mt-2 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)] hover:text-[#6B3A2A]"
                  onClick={() =>
                    updateSeries(series.id, {
                      locations: series.locations.filter((x) => x.id !== l.id),
                    })
                  }
                >
                  Remove from bible
                </button>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="mb-10">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
            Shared encyclopedia
          </h2>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 rounded-full"
            onClick={() => {
              let stacks = [...(series.encyclopediaStacks ?? [])];
              if (stacks.length === 0) {
                const ensured = ensureEncyclopediaStackNamed(stacks, "General");
                stacks = ensured.stacks;
              }
              const entry = createEncyclopediaEntry({
                title: "New article",
                stackId: stacks[0].id,
              });
              updateSeries(series.id, {
                encyclopediaStacks: sortEncyclopediaStacks(stacks),
                encyclopedia: [...(series.encyclopedia ?? []), entry],
              });
            }}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            Add
          </Button>
        </div>
        <ul className="mt-3 space-y-4">
          {(series.encyclopedia ?? []).length === 0 ? (
            <li className="font-[family-name:var(--font-ui)] text-sm italic text-[var(--ink-faint)]">
              Empty — promote from Encyclopedia, or add here.
            </li>
          ) : (
            (series.encyclopedia ?? []).map((e) => {
              const stackName =
                (series.encyclopediaStacks ?? []).find((s) => s.id === e.stackId)
                  ?.name ?? "General";
              return (
                <li
                  key={e.id}
                  className="rounded-2xl border border-[rgba(45,42,38,0.06)] bg-[rgba(247,243,234,0.35)] px-4 py-3"
                >
                  <p className="font-[family-name:var(--font-ui)] text-[0.62rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
                    {stackName}
                  </p>
                  <input
                    value={e.title}
                    onChange={(ev) =>
                      updateSeries(series.id, {
                        encyclopedia: (series.encyclopedia ?? []).map((x) =>
                          x.id === e.id
                            ? {
                                ...x,
                                title: ev.target.value,
                                updatedAt: Date.now(),
                              }
                            : x,
                        ),
                      })
                    }
                    className="mt-1 w-full bg-transparent font-[family-name:var(--font-display)] text-lg text-[var(--ink)] focus:outline-none"
                  />
                  <textarea
                    value={e.shortBio}
                    onChange={(ev) =>
                      updateSeries(series.id, {
                        encyclopedia: (series.encyclopedia ?? []).map((x) =>
                          x.id === e.id
                            ? {
                                ...x,
                                shortBio: ev.target.value,
                                updatedAt: Date.now(),
                              }
                            : x,
                        ),
                      })
                    }
                    rows={2}
                    placeholder="One-line canon blurb…"
                    className="mt-2 w-full resize-none bg-transparent font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)] placeholder:text-[var(--ink-faint)] focus:outline-none"
                  />
                  <button
                    type="button"
                    className="mt-2 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)] hover:text-[#6B3A2A]"
                    onClick={() =>
                      updateSeries(series.id, {
                        encyclopedia: (series.encyclopedia ?? []).filter(
                          (x) => x.id !== e.id,
                        ),
                      })
                    }
                  >
                    Remove from bible
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
          Shared maps
        </h2>
        <p className="mt-2 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)]">
          Promote from a book’s Map page. Pins rematch by place name when
          brought into another manuscript.
        </p>
        <ul className="mt-3 space-y-3">
          {(series.maps ?? []).length === 0 ? (
            <li className="font-[family-name:var(--font-ui)] text-sm italic text-[var(--ink-faint)]">
              Empty — open Map in a series book and promote.
            </li>
          ) : (
            (series.maps ?? []).map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[rgba(45,42,38,0.06)] bg-[rgba(247,243,234,0.35)] px-4 py-3"
              >
                <div>
                  <p className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
                    {m.name.trim() || "Map"}
                  </p>
                  <p className="mt-0.5 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)]">
                    {(m.pins ?? []).length} pins · {(m.regions ?? []).length}{" "}
                    regions
                    {(m.paths ?? []).length
                      ? ` · ${(m.paths ?? []).length} routes`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  className="font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)] hover:text-[#6B3A2A]"
                  onClick={() =>
                    updateSeries(series.id, {
                      maps: (series.maps ?? []).filter((x) => x.id !== m.id),
                    })
                  }
                >
                  Remove from bible
                </button>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="mb-12">
        <h2 className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
          Series notes
        </h2>
        <textarea
          value={series.notes}
          onChange={(e) => updateSeries(series.id, { notes: e.target.value })}
          rows={6}
          placeholder="Continuity rules, timeline, lore that spans books…"
          className="mt-3 w-full resize-none rounded-2xl border border-[rgba(45,42,38,0.08)] bg-[rgba(247,243,234,0.45)] px-4 py-3 font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:outline-none"
        />
      </section>

      <Button
        variant="ghost"
        className="gap-1.5 rounded-full text-[var(--ink-faint)] hover:text-[#6B3A2A]"
        onClick={() => setPendingDelete(true)}
      >
        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
        Delete series
      </Button>

      <ConfirmDialog
        open={pendingDelete}
        onOpenChange={setPendingDelete}
        title={`Delete “${series.title}”?`}
        description="Books stay on the shelf; only the shared bible is removed."
        confirmLabel="Delete series"
        onConfirm={() => {
          deleteSeries(series.id);
          router.push("/books");
        }}
      />
    </div>
  );
}
