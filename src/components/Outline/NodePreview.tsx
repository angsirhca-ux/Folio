"use client";

import { formatRelativeDate } from "@/lib/scenes";
import type { Scene } from "@/lib/types";
import { readingMinutes, SCENE_STATUS_META } from "@/lib/types";
import { formatWordCount } from "@/lib/utils";

export function NodePreview({ scene }: { scene: Scene }) {
  const mins = readingMinutes(scene.wordCount);
  return (
    <div className="w-[17.5rem] rounded-2xl border border-[rgba(45,42,38,0.06)] bg-[rgba(247,243,234,0.96)] p-4 shadow-[0_20px_50px_rgba(45,42,38,0.14)] backdrop-blur-xl">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className="rounded-full px-2 py-0.5 font-[family-name:var(--font-ui)] text-[0.6rem] tracking-wide"
          style={{
            color: SCENE_STATUS_META[scene.status].color,
            backgroundColor: SCENE_STATUS_META[scene.status].bg,
          }}
        >
          {SCENE_STATUS_META[scene.status].label}
        </span>
        <span className="font-[family-name:var(--font-ui)] text-[0.6rem] text-[var(--ink-faint)]">
          {formatRelativeDate(scene.updatedAt)}
        </span>
      </div>

      <h4 className="font-[family-name:var(--font-display)] text-lg font-medium tracking-wide text-[var(--ink)]">
        {scene.title || "Untitled Scene"}
      </h4>

      <p className="mt-2 line-clamp-4 font-[family-name:var(--font-ui)] text-[0.8rem] leading-relaxed text-[var(--ink-muted)]">
        {scene.synopsis?.trim() || "No synopsis yet."}
      </p>

      <dl className="mt-4 space-y-1.5 border-t border-[rgba(45,42,38,0.06)] pt-3 font-[family-name:var(--font-ui)] text-[0.7rem] text-[var(--ink-muted)]">
        {scene.pov ? (
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--ink-faint)]">POV</dt>
            <dd>{scene.pov}</dd>
          </div>
        ) : null}
        {scene.characters.length > 0 ? (
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--ink-faint)]">Characters</dt>
            <dd className="text-right">{scene.characters.join(", ")}</dd>
          </div>
        ) : null}
        {scene.location ? (
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--ink-faint)]">Location</dt>
            <dd>{scene.location}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--ink-faint)]">Words</dt>
          <dd>{formatWordCount(scene.wordCount)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--ink-faint)]">Reading</dt>
          <dd>{mins < 1 ? "< 1 min" : `${mins} min`}</dd>
        </div>
        {scene.notes ? (
          <div className="pt-1">
            <dt className="mb-0.5 text-[var(--ink-faint)]">Notes</dt>
            <dd className="line-clamp-3 text-[var(--ink-muted)]">{scene.notes}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
