"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Book } from "@/lib/types";
import {
  buildNameContinuityReport,
  type NameBibleHit,
} from "@/lib/nameContinuity";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<NameBibleHit["kind"], string> = {
  character: "Cast",
  location: "Place",
  encyclopedia: "Encyclopedia",
  research: "Research",
};

/**
 * Quiet continuity hygiene: how this name (and aliases) show up in prose
 * and elsewhere in the bible. Local string matching only — no AI.
 */
export function NameContinuityPanel({
  book,
  name,
  aliases,
  entityKind,
  entityId,
  onOpenScene,
}: {
  book: Book;
  name: string;
  aliases: string[];
  entityKind: "character" | "location";
  entityId: string;
  onOpenScene: (chapterId: string, sceneIndex: number) => void;
}) {
  const router = useRouter();
  const report = useMemo(
    () =>
      buildNameContinuityReport(book, {
        name,
        aliases,
        exclude: { kind: entityKind, id: entityId },
      }),
    [book, name, aliases, entityKind, entityId],
  );

  const proseTotal = report.proseHits.length;
  const bibleTotal = report.bibleHits.length;

  if (report.forms.length === 0) {
    return (
      <p className="font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)]">
        Give this entry a name to scan the manuscript and bible.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
          Appears as
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {report.formTally.map((t) => (
            <span
              key={t.form}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-[family-name:var(--font-ui)] text-xs",
                t.proseCount > 0
                  ? "border-[color-mix(in_srgb,var(--accent)_40%,var(--border))] bg-[var(--accent-soft)] text-[var(--ink)]"
                  : "border-[var(--border)] text-[var(--ink-faint)]",
              )}
              title={
                t.canonical
                  ? "Canonical name"
                  : t.proseCount
                    ? "Alias found in prose"
                    : "Alias not found in prose yet"
              }
            >
              {t.form}
              <span className="tabular-nums text-[0.65rem] opacity-70">
                {t.proseCount}
              </span>
            </span>
          ))}
        </div>
        {report.proseOnlyAliases.length > 0 ? (
          <p className="mt-2 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-muted)]">
            Prose prefers{" "}
            {report.proseOnlyAliases.map((a) => `“${a}”`).join(", ")} — the
            canonical name hasn’t appeared yet.
          </p>
        ) : null}
        {report.unusedAliases.length > 0 ? (
          <p className="mt-2 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)]">
            Not yet in prose:{" "}
            {report.unusedAliases.map((a) => `“${a}”`).join(", ")}.
          </p>
        ) : null}
      </div>

      <div>
        <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
          In the prose
          {proseTotal ? (
            <span className="ml-2 normal-case tracking-normal text-[var(--ink-muted)]">
              · {proseTotal} scene{proseTotal === 1 ? "" : "s"}
            </span>
          ) : null}
        </p>
        {proseTotal === 0 ? (
          <p className="mt-2 font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
            No prose hits for this name or its aliases yet. Tags still count in
            the timeline below.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {report.proseHits.slice(0, 12).map((hit) => (
              <li key={`${hit.chapterId}:${hit.sceneIndex}:${hit.matchedAs}`}>
                <button
                  type="button"
                  onClick={() => {
                    onOpenScene(hit.chapterId, hit.sceneIndex);
                    router.push("/");
                  }}
                  className="group w-full rounded-xl border border-transparent px-2 py-2 text-left transition-colors hover:border-[rgba(45,42,38,0.08)] hover:bg-[rgba(45,42,38,0.03)]"
                >
                  <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="font-[family-name:var(--font-ui)] text-sm text-[var(--ink)] group-hover:text-[color-mix(in_srgb,var(--accent)_70%,var(--ink))]">
                      {hit.sceneTitle}
                    </span>
                    <span className="font-[family-name:var(--font-ui)] text-[0.65rem] text-[var(--ink-faint)]">
                      {hit.chapterTitle}
                    </span>
                    <span className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.12em] text-[var(--accent)]">
                      as {hit.matchedAs}
                    </span>
                  </span>
                  {hit.excerpt ? (
                    <span className="mt-1 block font-[family-name:var(--font-body)] text-[0.8rem] leading-snug text-[var(--ink-muted)]">
                      {hit.excerpt}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
        {proseTotal > 12 ? (
          <p className="mt-2 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)]">
            Showing 12 of {proseTotal}. Use Find (⌘F) for a full pass.
          </p>
        ) : null}
      </div>

      <div>
        <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
          Elsewhere in the bible
          {bibleTotal ? (
            <span className="ml-2 normal-case tracking-normal text-[var(--ink-muted)]">
              · {bibleTotal}
            </span>
          ) : null}
        </p>
        {bibleTotal === 0 ? (
          <p className="mt-2 font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
            No other wiki cards mention this name yet.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {report.bibleHits.slice(0, 16).map((hit) => (
              <li key={`${hit.kind}:${hit.id}:${hit.where}:${hit.matchedAs}`}>
                <Link
                  href={hit.href}
                  className="group flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-[rgba(45,42,38,0.03)]"
                >
                  <span className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.12em] text-[var(--ink-faint)]">
                    {KIND_LABEL[hit.kind]}
                  </span>
                  <span className="font-[family-name:var(--font-ui)] text-sm text-[var(--ink)] group-hover:text-[color-mix(in_srgb,var(--accent)_70%,var(--ink))]">
                    {hit.title}
                  </span>
                  <span className="font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)]">
                    {hit.where}
                    {hit.matchedAs.toLowerCase() !== name.trim().toLowerCase()
                      ? ` · as ${hit.matchedAs}`
                      : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
