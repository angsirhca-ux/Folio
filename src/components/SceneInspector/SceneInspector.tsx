"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { WikiField } from "@/components/Characters/WikiField";
import { Button } from "@/components/ui/button";
import { useBook } from "@/providers/BookProvider";
import { findScene, formatRelativeDate } from "@/lib/scenes";
import {
  readingMinutes,
  SCENE_STATUS_META,
  type SceneStatus,
} from "@/lib/types";
import { cn, formatWordCount } from "@/lib/utils";

const STATUS_OPTIONS = Object.keys(SCENE_STATUS_META) as SceneStatus[];

function splitList(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

interface SceneInspectorProps {
  open: boolean;
  onClose: () => void;
  sceneId: string | null;
  onSceneIdChange?: (sceneId: string) => void;
  /** When set, scene switcher is limited to this chapter's scenes. */
  chapterId?: string | null;
}

export function SceneInspector({
  open,
  onClose,
  sceneId,
  onSceneIdChange,
  chapterId,
}: SceneInspectorProps) {
  const { book, updateScene, toggleSceneThread } = useBook();
  const found = sceneId ? findScene(book.chapters, sceneId) : null;
  const scene = found?.scene ?? null;
  const chapter = found?.chapter ?? null;
  const plotThreads = book.plotThreads ?? [];


  const switcherChapter =
    (chapterId
      ? book.chapters.find((c) => c.id === chapterId)
      : chapter) ?? null;
  const switcherScenes = switcherChapter?.scenes ?? [];

  const characterNames = (book.characters ?? [])
    .map((c) => c.name)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const locationNames = (book.locations ?? [])
    .map((l) => l.name)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  const mins = scene ? readingMinutes(scene.wordCount) : 0;

  return (
    <AnimatePresence>
      {open ? (
        <motion.aside
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
          className="fixed bottom-0 right-0 top-0 z-50 flex w-[min(100vw,24rem)] flex-col border-l border-[var(--border)] bg-[var(--sidebar)] shadow-[-12px_0_40px_var(--shadow)]"
        >
          <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-6 py-5">
            <div className="min-w-0">
              <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.28em] text-[var(--ink-faint)]">
                Scene
              </p>
              <h2 className="mt-1 truncate font-[family-name:var(--font-display)] text-lg font-medium tracking-wide text-[var(--ink)]">
                {scene?.title?.trim() || "Untitled scene"}
              </h2>
              {chapter ? (
                <p className="mt-1 truncate font-[family-name:var(--font-ui)] text-xs text-[var(--ink-muted)]">
                  {chapter.title}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              aria-label="Close scene details"
              onClick={onClose}
              className="rounded-lg p-1.5 text-[var(--ink-faint)] hover:bg-[rgba(45,42,38,0.06)] hover:text-[var(--ink)]"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>

          {!scene ? (
            <div className="flex flex-1 items-center justify-center px-6">
              <p className="max-w-[14rem] text-center font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
                Select a scene from the Contents list or storyboard to edit its
                details.
              </p>
            </div>
          ) : (
            <div className="folio-scroll min-h-0 flex-1 space-y-6 px-6 py-5">
              {switcherScenes.length > 1 && onSceneIdChange ? (
                <label className="block">
                  <span className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                    In this chapter
                  </span>
                  <select
                    value={scene.id}
                    onChange={(e) => onSceneIdChange(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-[rgba(45,42,38,0.1)] bg-[var(--paper)] px-3 py-2 font-[family-name:var(--font-ui)] text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                  >
                    {switcherScenes.map((s, i) => (
                      <option key={s.id} value={s.id}>
                        {i + 1}. {s.title?.trim() || "Untitled"}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <WikiField
                label="Title"
                value={scene.title}
                onChange={(title) => updateScene(scene.id, { title })}
                placeholder="Scene title"
                multiline={false}
              />

              <WikiField
                label="Synopsis"
                hint="What happens — for the corkboard and timeline, not the manuscript."
                value={scene.synopsis}
                onChange={(synopsis) => updateScene(scene.id, { synopsis })}
                placeholder="A beat or two…"
                rows={3}
              />

              <div>
                <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                  Status
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {STATUS_OPTIONS.map((status) => {
                    const meta = SCENE_STATUS_META[status];
                    const active = scene.status === status;
                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => updateScene(scene.id, { status })}
                        className={cn(
                          "rounded-full px-2.5 py-1 font-[family-name:var(--font-ui)] text-[0.7rem] transition-colors",
                          active
                            ? "ring-1 ring-[rgba(45,42,38,0.12)]"
                            : "opacity-70 hover:opacity-100",
                        )}
                        style={{
                          color: meta.color,
                          backgroundColor: meta.bg,
                        }}
                      >
                        {meta.shortLabel}
                      </button>
                    );
                  })}
                </div>
              </div>

              <WikiField
                label="POV"
                value={scene.pov}
                onChange={(pov) => updateScene(scene.id, { pov })}
                placeholder="Whose eyes?"
                multiline={false}
              />
              {characterNames.length > 0 ? (
                <SuggestionRow
                  label="Cast"
                  names={characterNames}
                  onPick={(name) => updateScene(scene.id, { pov: name })}
                />
              ) : null}

              <WikiField
                label="Location"
                value={scene.location}
                onChange={(location) => updateScene(scene.id, { location })}
                placeholder="Where are we?"
                multiline={false}
              />
              {locationNames.length > 0 ? (
                <SuggestionRow
                  label="Places"
                  names={locationNames}
                  onPick={(name) => updateScene(scene.id, { location: name })}
                />
              ) : null}

              <WikiField
                label="Characters present"
                hint="Comma-separated. Used by filters and the cast digest."
                value={scene.characters.join(", ")}
                onChange={(v) =>
                  updateScene(scene.id, { characters: splitList(v) })
                }
                placeholder="Names…"
                rows={2}
              />
              {characterNames.length > 0 ? (
                <SuggestionRow
                  label="Add"
                  names={characterNames.filter(
                    (n) =>
                      !scene.characters.some(
                        (c) => c.toLowerCase() === n.toLowerCase(),
                      ),
                  )}
                  onPick={(name) =>
                    updateScene(scene.id, {
                      characters: [...scene.characters, name],
                    })
                  }
                />
              ) : null}

              <WikiField
                label="Labels"
                hint="Comma-separated tags — romance, chase, flashback…"
                value={scene.labels.join(", ")}
                onChange={(v) =>
                  updateScene(scene.id, { labels: splitList(v) })
                }
                placeholder="Tags…"
                multiline={false}
              />

              <WikiField
                label="Act"
                value={scene.act}
                onChange={(act) => updateScene(scene.id, { act })}
                placeholder="I, II, III…"
                multiline={false}
              />

              <div>
                <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                  Plot threads
                </p>
                {plotThreads.length === 0 ? (
                  <p className="mt-2 font-[family-name:var(--font-ui)] text-xs leading-relaxed text-[var(--ink-muted)]">
                    Add threads on Timeline (Tracks) to assign romance, mystery,
                    and other arcs here.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {plotThreads.map((t) => {
                      const on = (scene.threadIds ?? []).includes(t.id);
                      return (
                        <li key={t.id}>
                          <button
                            type="button"
                            onClick={() => toggleSceneThread(scene.id, t.id)}
                            className={cn(
                              "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors",
                              on
                                ? "bg-[rgba(45,42,38,0.05)]"
                                : "hover:bg-[rgba(45,42,38,0.03)]",
                            )}
                          >
                            <span
                              className={cn(
                                "flex h-3.5 w-3.5 items-center justify-center rounded border",
                                on
                                  ? "border-transparent"
                                  : "border-[rgba(45,42,38,0.2)]",
                              )}
                              style={{
                                backgroundColor: on ? t.color : "transparent",
                              }}
                            />
                            <span className="font-[family-name:var(--font-ui)] text-sm text-[var(--ink)]">
                              {t.name}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <WikiField
                label="Scene notes"
                hint="Private — never appears in the manuscript."
                value={scene.notes}
                onChange={(notes) => updateScene(scene.id, { notes })}
                placeholder="Questions, continuity, reminders…"
                rows={4}
              />

              <dl className="space-y-1.5 border-t border-[rgba(45,42,38,0.08)] pt-4 font-[family-name:var(--font-ui)] text-[0.75rem] text-[var(--ink-muted)]">
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--ink-faint)]">Words</dt>
                  <dd>{formatWordCount(scene.wordCount)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--ink-faint)]">Reading</dt>
                  <dd>{mins < 1 ? "< 1 min" : `${mins} min`}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--ink-faint)]">Updated</dt>
                  <dd>{formatRelativeDate(scene.updatedAt)}</dd>
                </div>
              </dl>
            </div>
          )}

          <div className="border-t border-[var(--border)] px-6 py-4">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="w-full"
              onClick={onClose}
            >
              Done
            </Button>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}

function SuggestionRow({
  label,
  names,
  onPick,
}: {
  label: string;
  names: string[];
  onPick: (name: string) => void;
}) {
  if (names.length === 0) return null;
  return (
    <div className="-mt-3">
      <p className="sr-only">{label}</p>
      <div className="flex flex-wrap gap-1">
        {names.slice(0, 8).map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => onPick(name)}
            className="rounded-full bg-[rgba(45,42,38,0.05)] px-2 py-0.5 font-[family-name:var(--font-ui)] text-[0.65rem] text-[var(--ink-muted)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--ink)]"
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}
