"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useBook } from "@/providers/BookProvider";
import {
  findSeries,
  seriesCharactersMissingFromBook,
  seriesEncyclopediaMissingFromBook,
  seriesLocationsMissingFromBook,
} from "@/lib/series";

export function SeriesBibleStrip({
  kind,
}: {
  kind: "characters" | "locations" | "encyclopedia";
}) {
  const router = useRouter();
  const {
    book,
    librarySeries,
    bringSeriesCharacterIntoBook,
    bringSeriesLocationIntoBook,
    bringSeriesEncyclopediaIntoBook,
  } = useBook();

  const series = findSeries(librarySeries, book.seriesId);
  if (!series) {
    if (librarySeries.length === 0) return null;
    return (
      <div className="mb-6 rounded-2xl border border-dashed border-[rgba(45,42,38,0.12)] px-4 py-3">
        <p className="font-[family-name:var(--font-ui)] text-xs leading-relaxed text-[var(--ink-muted)]">
          Assign this book to a series on the{" "}
          <Link href="/books" className="text-[var(--accent)] underline-offset-2 hover:underline">
            Books
          </Link>{" "}
          shelf to share cast, places, and encyclopedia across manuscripts.
        </p>
      </div>
    );
  }

  if (kind === "characters") {
    const missing = seriesCharactersMissingFromBook(series, book);
    return (
      <SeriesStripShell
        seriesId={series.id}
        seriesTitle={series.title}
        sharedCount={series.characters.length}
        emptyHint="This book already has everyone from the series bible — or the bible is empty. Open a character wiki to promote them into the series."
        missing={missing.map((c) => ({
          id: c.id,
          title: c.name,
          blurb: c.shortBio,
          onBring: () => {
            const id = bringSeriesCharacterIntoBook(c.id);
            if (id) router.push(`/characters/${id}`);
          },
        }))}
      />
    );
  }

  if (kind === "locations") {
    const missing = seriesLocationsMissingFromBook(series, book);
    return (
      <SeriesStripShell
        seriesId={series.id}
        seriesTitle={series.title}
        sharedCount={series.locations.length}
        emptyHint="This book already has every series place — or the bible is empty. Open a place wiki to promote it into the series."
        missing={missing.map((l) => ({
          id: l.id,
          title: l.name,
          blurb: l.shortBio,
          onBring: () => {
            const id = bringSeriesLocationIntoBook(l.id);
            if (id) router.push(`/locations/${id}`);
          },
        }))}
      />
    );
  }

  const missing = seriesEncyclopediaMissingFromBook(series, book);
  return (
    <SeriesStripShell
      seriesId={series.id}
      seriesTitle={series.title}
      sharedCount={(series.encyclopedia ?? []).length}
      emptyHint="This book already has every series article — or the bible is empty. Open an encyclopedia wiki to promote it into the series."
      missing={missing.map((e) => ({
        id: e.id,
        title: e.title,
        blurb: e.shortBio,
        onBring: () => {
          const id = bringSeriesEncyclopediaIntoBook(e.id);
          if (id) router.push(`/encyclopedia/${id}`);
        },
      }))}
    />
  );
}

function SeriesStripShell({
  seriesId,
  seriesTitle,
  sharedCount,
  emptyHint,
  missing,
}: {
  seriesId: string;
  seriesTitle: string;
  sharedCount: number;
  emptyHint: string;
  missing: Array<{
    id: string;
    title: string;
    blurb: string;
    onBring: () => void;
  }>;
}) {
  return (
    <div className="mb-6 rounded-2xl border border-[rgba(45,42,38,0.08)] bg-[rgba(247,243,234,0.45)] px-4 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
            Series bible
          </p>
          <Link
            href={`/series/${seriesId}`}
            className="mt-1 inline-block font-[family-name:var(--font-display)] text-lg text-[var(--ink)] hover:text-[color-mix(in_srgb,var(--accent)_65%,var(--ink))]"
          >
            {seriesTitle}
          </Link>
        </div>
        <p className="font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)]">
          {sharedCount} shared
        </p>
      </div>
      {missing.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {missing.slice(0, 8).map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2"
            >
              <span className="font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)]">
                {item.title}
                {item.blurb ? (
                  <span className="text-[var(--ink-faint)]"> — {item.blurb}</span>
                ) : null}
              </span>
              <button
                type="button"
                className="font-[family-name:var(--font-ui)] text-xs text-[var(--accent)] hover:underline"
                onClick={item.onBring}
              >
                Bring into book
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 font-[family-name:var(--font-ui)] text-xs italic text-[var(--ink-faint)]">
          {emptyHint}
        </p>
      )}
    </div>
  );
}
