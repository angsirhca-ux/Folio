"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import {
  AppearancesRail,
  CharactersBackLink,
} from "@/components/Characters/AppearancesRail";
import { ClarenceButton } from "@/components/Characters/ClaudeDeepenButton";
import { CLARENCE } from "@/lib/clarence";
import { DepthMeter } from "@/components/Characters/DepthMeter";
import { WikiField } from "@/components/Characters/WikiField";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useBook } from "@/providers/BookProvider";
import {
  ROLE_OPTIONS,
  characterAppearances,
  characterCompleteness,
  characterDepth,
} from "@/lib/characters";
import { useCharacterDeepen } from "@/hooks/useClaudeEnrichment";
import {
  povColor,
  type Character,
  type CharacterRole,
} from "@/lib/types";
import { ContinuityNotesSection } from "@/components/Bible/ContinuityNotesSection";
import { MembershipChecklist } from "@/components/Bible/MembershipChecklist";
import { NameContinuityPanel } from "@/components/Bible/NameContinuityPanel";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "identity", label: "Identity" },
  { id: "psychology", label: "Inner life" },
  { id: "voice", label: "Voice" },
  { id: "arc", label: "Arc" },
  { id: "relationships", label: "Ties" },
  { id: "continuity", label: "As-of" },
  { id: "appearances", label: "On the page" },
] as const;

export function CharacterWikiPage({ characterId }: { characterId: string }) {
  const router = useRouter();
  const {
    book,
    hydrated,
    updateCharacter,
    replaceCharacter,
    deleteCharacter,
    addCharacterRelationship,
    updateCharacterRelationship,
    removeCharacterRelationship,
    setCharacterBelongsToEntries,
    focusScene,
    promoteCharacterToSeriesBible,
  } = useBook();
  const [pendingDelete, setPendingDelete] = useState(false);
  const [relLabel, setRelLabel] = useState("");
  const [relTarget, setRelTarget] = useState("");

  const character = useMemo(
    () => (book.characters ?? []).find((c) => c.id === characterId),
    [book.characters, characterId],
  );

  const onApplyEnrichment = useCallback(
    (next: Character) => {
      replaceCharacter(next);
    },
    [replaceCharacter],
  );

  const {
    status: claudeStatus,
    busy: deepenBusy,
    error: deepenError,
    doneAt: deepenDoneAt,
    deepen,
  } = useCharacterDeepen(book, character, onApplyEnrichment);

  const others = useMemo(
    () => (book.characters ?? []).filter((c) => c.id !== characterId),
    [book.characters, characterId],
  );

  const appearances = useMemo(
    () => (character ? characterAppearances(book.chapters, character) : []),
    [book.chapters, character],
  );

  const completeness = character ? characterCompleteness(character) : 0;
  const depth = character
    ? characterDepth(character, appearances.length)
    : "stub";
  const accent = character ? povColor(character.name) : "var(--accent)";

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-1 w-16 overflow-hidden rounded-full bg-[rgba(176,141,87,0.2)]">
          <div className="folio-loading-bar h-full w-1/2 rounded-full bg-[var(--accent)]" />
        </div>
      </div>
    );
  }

  if (!character) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <p className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
          Character not found
        </p>
        <Link
          href="/characters"
          className="mt-6 inline-block font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)] underline underline-offset-4"
        >
          Back to cast
        </Link>
      </div>
    );
  }

  function patch(partial: Parameters<typeof updateCharacter>[1]) {
    updateCharacter(characterId, partial);
  }

  function patchNested<
    K extends "identity" | "psychology" | "voice" | "arc",
  >(key: K, field: keyof Character[K], value: string) {
    updateCharacter(characterId, {
      [key]: { ...character![key], [field]: value },
    } as Partial<Character>);
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
            <CharactersBackLink />
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
            <DepthMeter depth={depth} completeness={completeness} />
            <p className="font-[family-name:var(--font-ui)] text-xs leading-relaxed text-[var(--ink-faint)]">
              {appearances.length === 0
                ? "Waiting for a first scene."
                : `${appearances.length} appearance${appearances.length === 1 ? "" : "s"} in the manuscript.`}
            </p>
          </div>
        </aside>

        <article className="min-w-0">
          <div className="mb-6 flex items-center justify-between gap-4 lg:hidden">
            <CharactersBackLink />
            <button
              type="button"
              aria-label="Delete character"
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
                  value={character.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  aria-label="Character name"
                  className="w-full bg-transparent font-[family-name:var(--font-display)] text-4xl font-medium tracking-tight text-[var(--ink)] focus:outline-none sm:text-5xl"
                />
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-2">
                    <span className="sr-only">Role</span>
                    <select
                      value={character.role}
                      onChange={(e) =>
                        patch({ role: e.target.value as CharacterRole })
                      }
                      className="rounded-full border border-[rgba(45,42,38,0.1)] bg-[rgba(247,243,234,0.6)] px-3 py-1.5 font-[family-name:var(--font-ui)] text-xs uppercase tracking-[0.14em] text-[var(--ink-muted)] focus:outline-none"
                    >
                      {ROLE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <ClarenceButton
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
                        promoteCharacterToSeriesBible(character.id)
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
                    {CLARENCE.needsKeyHint}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Delete character"
                onClick={() => setPendingDelete(true)}
                className="hidden rounded-full p-2 text-[var(--ink-faint)] transition-colors hover:text-[#6B3A2A] lg:inline-flex"
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>

            <WikiField
              className="mt-8"
              label="Cast blurb"
              hint="One line for the roster — who they are at a glance."
              value={character.shortBio}
              onChange={(shortBio) => patch({ shortBio })}
              placeholder="A woman who listens to houses before she trusts people."
              rows={2}
            />

            <WikiField
              className="mt-8"
              label="Wiki"
              hint="Your notes — sync never overwrites this once you’ve written something."
              value={character.wiki}
              onChange={(wiki) => patch({ wiki })}
              placeholder="Write what you know so far. Leave blanks; fill them when the story tells you."
              rows={5}
              inputClassName="text-[1.05rem] leading-[1.75]"
            />

            {character.storyDigest ? (
              <div className="mt-10 rounded-sm border-l-2 border-[var(--accent)] pl-5">
                <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                  From the manuscript
                </p>
                <p className="mt-1 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)]">
                  Auto-updated from scenes, POV, cast tags, and prose mentions.
                </p>
                <pre className="mt-4 whitespace-pre-wrap font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
                  {character.storyDigest}
                </pre>
              </div>
            ) : null}

            <WikiField
              className="mt-8"
              label="Also known as"
              value={character.aliases.join(", ")}
              onChange={(raw) =>
                patch({
                  aliases: raw
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="Nicknames, titles, false names…"
              multiline={false}
            />

            <WikiField
              className="mt-6"
              label="Tags"
              value={character.tags.join(", ")}
              onChange={(raw) =>
                patch({
                  tags: raw
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="pov, foil, ensemble…"
              multiline={false}
            />
          </motion.header>

          <WikiSection id="identity" title="Identity" index={1}>
            <div className="grid gap-8 sm:grid-cols-2">
              <WikiField
                label="Age"
                value={character.identity.age}
                onChange={(v) => patchNested("identity", "age", v)}
                placeholder="As precise or vague as the story needs"
                multiline={false}
              />
              <WikiField
                label="Occupation"
                value={character.identity.occupation}
                onChange={(v) => patchNested("identity", "occupation", v)}
                placeholder="What they do — or claim to"
                multiline={false}
              />
            </div>
            <WikiField
              className="mt-8"
              label="Appearance"
              value={character.identity.appearance}
              onChange={(v) => patchNested("identity", "appearance", v)}
              placeholder="What a careful reader would notice"
              rows={3}
            />
            <WikiField
              className="mt-8"
              label="Distinguishing"
              value={character.identity.distinguishing}
              onChange={(v) => patchNested("identity", "distinguishing", v)}
              placeholder="Gesture, scar, habit, object"
              rows={2}
            />
          </WikiSection>

          <WikiSection id="psychology" title="Inner life" index={2}>
            <div className="grid gap-8 sm:grid-cols-2">
              <WikiField
                label="Wants"
                hint="External desire"
                value={character.psychology.wants}
                onChange={(v) => patchNested("psychology", "wants", v)}
                placeholder="What they chase on the surface"
                rows={3}
              />
              <WikiField
                label="Needs"
                hint="What the story must teach them"
                value={character.psychology.needs}
                onChange={(v) => patchNested("psychology", "needs", v)}
                placeholder="Often the opposite of the want"
                rows={3}
              />
              <WikiField
                label="Fears"
                value={character.psychology.fears}
                onChange={(v) => patchNested("psychology", "fears", v)}
                rows={3}
              />
              <WikiField
                label="Flaws"
                value={character.psychology.flaws}
                onChange={(v) => patchNested("psychology", "flaws", v)}
                rows={3}
              />
            </div>
            <WikiField
              className="mt-8"
              label="Strengths"
              value={character.psychology.strengths}
              onChange={(v) => patchNested("psychology", "strengths", v)}
              rows={2}
            />
            <WikiField
              className="mt-8"
              label="Secrets"
              hint="What they hide — from others, or from themselves."
              value={character.secrets}
              onChange={(secrets) => patch({ secrets })}
              rows={3}
            />
          </WikiSection>

          <WikiSection id="voice" title="Voice" index={3}>
            <WikiField
              label="Speech"
              value={character.voice.speechNotes}
              onChange={(v) => patchNested("voice", "speechNotes", v)}
              placeholder="Rhythm, diction, what they never say"
              rows={3}
            />
            <WikiField
              className="mt-8"
              label="Mannerisms"
              value={character.voice.mannerisms}
              onChange={(v) => patchNested("voice", "mannerisms", v)}
              rows={2}
            />
            <WikiField
              className="mt-8"
              label="Sample line"
              value={character.voice.sample}
              onChange={(v) => patchNested("voice", "sample", v)}
              placeholder="A sentence only they would say"
              rows={2}
              inputClassName="italic"
            />
          </WikiSection>

          <WikiSection id="arc" title="Arc" index={4}>
            <WikiField
              label="Begins"
              value={character.arc.startingPoint}
              onChange={(v) => patchNested("arc", "startingPoint", v)}
              placeholder="Where we find them"
              rows={2}
            />
            <WikiField
              className="mt-8"
              label="Turns"
              value={character.arc.turningPoints}
              onChange={(v) => patchNested("arc", "turningPoints", v)}
              placeholder="Pressures and pivots — update as you write"
              rows={3}
            />
            <WikiField
              className="mt-8"
              label="Ends"
              hint="Leave blank until the draft earns it."
              value={character.arc.endingPoint}
              onChange={(v) => patchNested("arc", "endingPoint", v)}
              rows={2}
            />
          </WikiSection>

          <WikiSection id="relationships" title="Ties" index={5}>
            <MembershipChecklist
              label="Belongs to"
              hint="Encyclopedia cards this person is part of — faction, species, institution."
              items={(book.encyclopedia ?? []).map((e) => ({
                id: e.id,
                label: e.title,
                href: `/encyclopedia/${e.id}`,
              }))}
              selected={character.belongsToIds ?? []}
              onChange={(ids) =>
                setCharacterBelongsToEntries(characterId, ids)
              }
              emptyHint="Add encyclopedia cards first, then mark membership here."
            />

            <div className="mt-10">
            {character.relationships.length === 0 ? (
              <p className="font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)]">
                No ties yet. Add how they stand toward others — rival, sister,
                debt.
              </p>
            ) : (
              <ul className="space-y-6">
                {character.relationships.map((r) => {
                  const linked = others.find((o) => o.id === r.toCharacterId);
                  return (
                    <li
                      key={r.id}
                      className="border-b border-[rgba(45,42,38,0.08)] pb-6"
                    >
                      <div className="flex flex-wrap items-baseline gap-3">
                        <input
                          value={r.label}
                          onChange={(e) =>
                            updateCharacterRelationship(characterId, r.id, {
                              label: e.target.value,
                            })
                          }
                          placeholder="Label"
                          className="min-w-[8rem] flex-1 bg-transparent font-[family-name:var(--font-ui)] text-xs uppercase tracking-[0.16em] text-[var(--ink-faint)] focus:outline-none"
                        />
                        {linked ? (
                          <Link
                            href={`/characters/${linked.id}`}
                            className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)] underline decoration-[rgba(176,141,87,0.3)] underline-offset-4"
                          >
                            {linked.name}
                          </Link>
                        ) : (
                          <input
                            value={r.toName}
                            onChange={(e) =>
                              updateCharacterRelationship(characterId, r.id, {
                                toName: e.target.value,
                              })
                            }
                            placeholder="Name"
                            className="bg-transparent font-[family-name:var(--font-display)] text-lg text-[var(--ink)] focus:outline-none"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            removeCharacterRelationship(characterId, r.id)
                          }
                          className="ml-auto font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)] hover:text-[#6B3A2A]"
                        >
                          Remove
                        </button>
                      </div>
                      <textarea
                        value={r.notes}
                        onChange={(e) =>
                          updateCharacterRelationship(characterId, r.id, {
                            notes: e.target.value,
                          })
                        }
                        placeholder="What the bond costs…"
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
                if (!relLabel.trim()) return;
                const target = others.find((o) => o.id === relTarget);
                addCharacterRelationship(characterId, {
                  label: relLabel.trim(),
                  toCharacterId: target?.id ?? "",
                  toName: target?.name ?? "",
                });
                setRelLabel("");
                setRelTarget("");
              }}
            >
              <label className="min-w-[8rem] flex-1">
                <span className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                  New tie
                </span>
                <input
                  value={relLabel}
                  onChange={(e) => setRelLabel(e.target.value)}
                  placeholder="rival, mentor…"
                  className="mt-2 w-full border-0 border-b border-[rgba(45,42,38,0.1)] bg-transparent pb-2 font-[family-name:var(--font-body)] text-sm focus:border-[var(--accent)] focus:outline-none"
                />
              </label>
              <label className="min-w-[10rem] flex-1">
                <span className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                  With
                </span>
                <select
                  value={relTarget}
                  onChange={(e) => setRelTarget(e.target.value)}
                  className="mt-2 w-full border-0 border-b border-[rgba(45,42,38,0.1)] bg-transparent pb-2 font-[family-name:var(--font-body)] text-sm text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none"
                >
                  <option value="">Someone else…</option>
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
                disabled={!relLabel.trim()}
              >
                Add
              </Button>
            </form>
            </div>
          </WikiSection>

          <WikiSection id="continuity" title="As-of notes" index={6}>
            <ContinuityNotesSection
              notes={character.continuityNotes ?? []}
              onChange={(continuityNotes) => patch({ continuityNotes })}
            />
          </WikiSection>

          <WikiSection id="appearances" title="On the page" index={7}>
            <NameContinuityPanel
              book={book}
              name={character.name}
              aliases={character.aliases ?? []}
              entityKind="character"
              entityId={character.id}
              onOpenScene={focusScene}
            />
            <div className="mt-10 border-t border-[rgba(45,42,38,0.08)] pt-8">
              <p className="mb-4 font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                Scene timeline
              </p>
              <AppearancesRail
                appearances={appearances}
                onOpenScene={focusScene}
              />
            </div>
          </WikiSection>
        </article>
      </div>

      <ConfirmDialog
        open={pendingDelete}
        onOpenChange={setPendingDelete}
        title={`Delete ${character.name}?`}
        description="Their wiki entry will move to Trash. Scene cast tags keep the name; you can restore the page from Trash."
        confirmLabel="Move to trash"
        onConfirm={() => {
          deleteCharacter(characterId);
          router.push("/characters");
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
