"use client";

import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { ClaudeDeepenButton } from "@/components/Characters/ClaudeDeepenButton";
import { DepthMeter } from "@/components/Characters/DepthMeter";
import { EncyclopediaPanel } from "@/components/Encyclopedia/EncyclopediaPanel";
import { Button } from "@/components/ui/button";
import { useBook } from "@/providers/BookProvider";
import {
  createEncyclopediaEntry,
  encyclopediaAppearances,
  encyclopediaCompleteness,
  encyclopediaDepth,
  findEncyclopediaByTitle,
  nextEncyclopediaStackColor,
  sortEncyclopediaStacks,
  ENCYCLOPEDIA_STACK_PALETTE,
  ENCYCLOPEDIA_STACK_STARTERS,
} from "@/lib/encyclopedia";
import {
  discoverEncyclopediaWithClaude,
  enrichEncyclopediaWithClaude,
  mergeEnrichmentIntoEncyclopedia,
  useClaudeStatus,
} from "@/hooks/useClaudeEnrichment";
import type { EncyclopediaEntry } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SeriesBibleStrip } from "@/components/Series/SeriesBibleStrip";

type StackItem = {
  entry: EncyclopediaEntry;
  appearances: number;
  completeness: number;
  depth: ReturnType<typeof encyclopediaDepth>;
};

export function EncyclopediaPage() {
  const {
    book,
    hydrated,
    addEncyclopedia,
    upsertEncyclopedia,
    replaceEncyclopedia,
    addEncyclopediaStack,
    updateEncyclopediaStack,
    deleteEncyclopediaStack,
    ensureEncyclopediaStack,
    applyEncyclopediaStarter,
  } = useBook();
  const claude = useClaudeStatus();
  const [search, setSearch] = useState("");
  const [dossierBusy, setDossierBusy] = useState(false);
  const [dossierMessage, setDossierMessage] = useState<string | null>(null);
  const [dossierError, setDossierError] = useState<string | null>(null);
  const [newStackId, setNewStackId] = useState<string>("");
  const [addingStack, setAddingStack] = useState(false);
  const [newStackName, setNewStackName] = useState("");
  const [newStackColor, setNewStackColor] = useState<string>(
    ENCYCLOPEDIA_STACK_PALETTE[0],
  );
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [railOpen, setRailOpen] = useState(false);
  const [railEntryId, setRailEntryId] = useState<string | null>(null);

  const entries = book.encyclopedia ?? [];
  const stackDefs = useMemo(
    () => sortEncyclopediaStacks(book.encyclopediaStacks ?? []),
    [book.encyclopediaStacks],
  );

  const activeNewStackId = newStackId || stackDefs[0]?.id || "";

  const stacks = useMemo(() => {
    const q = search.trim().toLowerCase();
    const byStack = new Map<string, StackItem[]>();

    for (const stack of stackDefs) byStack.set(stack.id, []);

    const orphanKey = "__orphan__";
    byStack.set(orphanKey, []);

    for (const entry of entries) {
      const appearances = encyclopediaAppearances(book.chapters, entry);
      const completeness = encyclopediaCompleteness(entry);
      const depth = encyclopediaDepth(entry, appearances.length);
      const stackName =
        stackDefs.find((s) => s.id === entry.stackId)?.name ?? "Unsorted";
      if (q) {
        const hay = [
          entry.title,
          entry.shortBio,
          entry.wiki,
          entry.summary,
          stackName,
          ...entry.aliases,
          ...entry.tags,
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) continue;
      }
      const key = byStack.has(entry.stackId) ? entry.stackId : orphanKey;
      const bucket = byStack.get(key) ?? [];
      bucket.push({
        entry,
        appearances: appearances.length,
        completeness,
        depth,
      });
      byStack.set(key, bucket);
    }

    const shelves: Array<{
      id: string;
      label: string;
      color: string;
      items: StackItem[];
      customizable: boolean;
    }> = stackDefs.map((stack) => ({
      id: stack.id,
      label: stack.name,
      color: stack.color,
      items: byStack.get(stack.id) ?? [],
      customizable: true,
    }));

    const orphans = byStack.get(orphanKey) ?? [];
    if (orphans.length) {
      shelves.push({
        id: orphanKey,
        label: "Unsorted",
        color: "#8A847A",
        items: orphans,
        customizable: false,
      });
    }

    return shelves.filter(
      (stack) => stack.items.length > 0 || (!q && stack.customizable),
    );
  }, [entries, book.chapters, search, stackDefs]);

  function openCard(entryId: string) {
    setRailEntryId(entryId);
    setRailOpen(true);
  }

  function createAndOpen(stackId: string = activeNewStackId, title?: string) {
    const id = addEncyclopedia(
      title
        ? { title, stackId: stackId || undefined }
        : { stackId: stackId || undefined },
    );
    openCard(id);
  }

  function commitNewStack() {
    const name = newStackName.trim();
    if (!name) {
      setAddingStack(false);
      setNewStackName("");
      return;
    }
    const id = addEncyclopediaStack(name, newStackColor);
    setNewStackId(id);
    setAddingStack(false);
    setNewStackName("");
    setNewStackColor(nextEncyclopediaStackColor(book.encyclopediaStacks ?? []));
  }

  function commitRename(stackId: string) {
    const name = renameDraft.trim();
    if (name) updateEncyclopediaStack(stackId, { name });
    setRenamingId(null);
    setRenameDraft("");
  }

  function beginAddStack() {
    setNewStackColor(nextEncyclopediaStackColor(stackDefs));
    setAddingStack(true);
  }

  const runDeepenDossier = useCallback(async () => {
    setDossierBusy(true);
    setDossierError(null);
    setDossierMessage("Scanning manuscript for world canon…");

    try {
      const discovered = await discoverEncyclopediaWithClaude(book);
      let rosterSnapshot = [...(book.encyclopedia ?? [])];
      const created: EncyclopediaEntry[] = [];

      for (const d of discovered) {
        if (findEncyclopediaByTitle(rosterSnapshot, d.title)) continue;
        const stackId = ensureEncyclopediaStack(
          d.stackName?.trim() || "General",
        );
        const next = createEncyclopediaEntry({
          title: d.title,
          stackId,
          shortBio: d.shortBio ?? "",
          tags: ["from-story", "claude"],
        });
        created.push(next);
        rosterSnapshot.push(next);
      }

      if (created.length) {
        upsertEncyclopedia(created);
        setDossierMessage(
          `Added ${created.length}. Deepening ${rosterSnapshot.length}…`,
        );
      } else {
        setDossierMessage(`Deepening ${rosterSnapshot.length}…`);
      }

      let enriched = 0;
      for (let i = 0; i < rosterSnapshot.length; i++) {
        const target = rosterSnapshot[i];
        setDossierMessage(`Deepening ${i + 1} of ${rosterSnapshot.length}…`);
        try {
          const enrichment = await enrichEncyclopediaWithClaude(
            { ...book, encyclopedia: rosterSnapshot },
            target.id,
          );
          let merged = mergeEnrichmentIntoEncyclopedia(
            target,
            enrichment,
            rosterSnapshot,
          );
          if (enrichment.stackName?.trim()) {
            const stackId = ensureEncyclopediaStack(enrichment.stackName);
            merged = { ...merged, stackId };
          }
          replaceEncyclopedia(merged);
          rosterSnapshot = rosterSnapshot.map((e) =>
            e.id === merged.id ? merged : e,
          );
          enriched += 1;
        } catch {
          // continue
        }
      }

      setDossierMessage(
        `Done — ${enriched} deepened${created.length ? `, ${created.length} added` : ""}.`,
      );
    } catch (e) {
      setDossierError(
        e instanceof Error ? e.message : "Encyclopedia deepen failed.",
      );
      setDossierMessage(null);
    } finally {
      setDossierBusy(false);
    }
  }, [
    book,
    upsertEncyclopedia,
    replaceEncyclopedia,
    ensureEncyclopediaStack,
  ]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-1 w-16 overflow-hidden rounded-full bg-[rgba(176,141,87,0.2)]">
          <div className="folio-loading-bar h-full w-1/2 rounded-full bg-[var(--accent)]" />
        </div>
      </div>
    );
  }

  const totalCards = stacks.reduce((n, s) => n + s.items.length, 0);

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 70% 45% at 18% 8%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 70%), radial-gradient(ellipse 55% 40% at 88% 18%, rgba(45,42,38,0.06), transparent 65%), linear-gradient(180deg, #E8E0D4 0%, #EDE8E0 42%, #F4EFE6 100%)",
        }}
        aria-hidden
      />

      <div
        className={cn(
          "relative mx-auto max-w-6xl px-5 pb-28 pt-10 transition-[padding] duration-400 ease-[cubic-bezier(0.25,0.1,0.25,1)] sm:px-8 lg:px-10",
          railOpen ? "lg:pr-[calc(26rem+1.5rem)] lg:max-w-none" : "",
        )}
      >
        <header className="mb-10 max-w-2xl">
          <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.28em] text-[var(--ink-faint)]">
            World bible
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-medium tracking-tight text-[var(--ink)] sm:text-5xl">
            Encyclopedia
          </h1>
          <p className="mt-4 font-[family-name:var(--font-ui)] text-base leading-relaxed text-[var(--ink-muted)]">
            Name your own stacks — case files, period detail, craft notes,
            whatever fits the book. Open a card beside the stacks to edit
            without leaving the shelf. Characters and places stay in their own
            tabs; Research holds outside sources.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <ClaudeDeepenButton
              configured={claude?.configured ?? null}
              busy={dossierBusy}
              label="Deepen encyclopedia with Claude"
              onClick={() => void runDeepenDossier()}
            />
            {dossierMessage ? (
              <span className="font-[family-name:var(--font-ui)] text-xs text-[var(--ink-muted)]">
                {dossierMessage}
              </span>
            ) : null}
            {dossierError ? (
              <span className="font-[family-name:var(--font-ui)] text-xs text-[#6B3A2A]">
                {dossierError}
              </span>
            ) : null}
          </div>
        </header>

        <SeriesBibleStrip kind="encyclopedia" />

        <div className="mb-10 flex flex-wrap items-center gap-2 rounded-2xl border border-[rgba(45,42,38,0.08)] bg-[rgba(247,243,234,0.7)] px-3 py-2.5 shadow-[0_10px_36px_rgba(45,42,38,0.06)] backdrop-blur-xl sm:gap-3 sm:px-4">
          <label className="relative flex min-w-[10rem] max-w-md flex-1 items-center">
            <Search
              className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-[var(--ink-faint)]"
              strokeWidth={1.5}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search stacks…"
              className="h-9 w-full rounded-full border border-transparent bg-[rgba(45,42,38,0.04)] pl-9 pr-9 font-[family-name:var(--font-ui)] text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] transition-colors focus:border-[var(--border)] focus:bg-[rgba(247,243,234,0.9)] focus:outline-none"
            />
            {search ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearch("")}
                className="absolute right-2 rounded-full p-1 text-[var(--ink-faint)] hover:text-[var(--ink)]"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            ) : null}
          </label>

          {stackDefs.length > 0 ? (
            <select
              value={activeNewStackId}
              onChange={(e) => setNewStackId(e.target.value)}
              aria-label="Stack for new card"
              className="h-9 rounded-full border border-transparent bg-[rgba(45,42,38,0.04)] px-3 font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)] focus:outline-none"
            >
              {stackDefs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          ) : null}

          {addingStack ? (
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                commitNewStack();
              }}
            >
              <input
                autoFocus
                value={newStackName}
                onChange={(e) => setNewStackName(e.target.value)}
                placeholder="Stack name"
                className="h-9 w-36 rounded-full border border-[rgba(45,42,38,0.12)] bg-[rgba(247,243,234,0.9)] px-3 font-[family-name:var(--font-ui)] text-sm text-[var(--ink)] focus:outline-none"
              />
              <div className="flex items-center gap-1.5" role="group" aria-label="Stack color">
                {ENCYCLOPEDIA_STACK_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Color ${c}`}
                    aria-pressed={newStackColor === c}
                    onClick={() => setNewStackColor(c)}
                    className={cn(
                      "h-4 w-4 rounded-full transition-opacity",
                      newStackColor === c
                        ? "ring-2 ring-[var(--ink)] ring-offset-1 ring-offset-[#EDE8E0]"
                        : "opacity-65 hover:opacity-100",
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <Button type="submit" size="sm" className="rounded-full">
                Add
              </Button>
              <button
                type="button"
                onClick={() => {
                  setAddingStack(false);
                  setNewStackName("");
                }}
                className="rounded-full p-1.5 text-[var(--ink-faint)] hover:text-[var(--ink)]"
                aria-label="Cancel"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            </form>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 rounded-full"
              onClick={beginAddStack}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
              New stack
            </Button>
          )}

          <Button
            size="sm"
            className="ml-auto gap-1.5 rounded-full"
            onClick={() => createAndOpen(activeNewStackId)}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            New card
          </Button>
        </div>

        {totalCards === 0 && search ? (
          <p className="py-16 text-center font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
            No cards match
          </p>
        ) : stacks.length === 0 ? (
          <div className="flex min-h-[14rem] flex-col items-center justify-center gap-4 rounded-[1.75rem] border border-dashed border-[rgba(45,42,38,0.14)] bg-[rgba(247,243,234,0.4)] px-6 py-10 text-center">
            <p className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
              No stacks yet
            </p>
            <p className="max-w-sm font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)]">
              Start blank, or drop in a starter pack for your genre — then rename
              freely.
            </p>
            <div className="mt-2 grid w-full max-w-lg gap-2 sm:grid-cols-2">
              {ENCYCLOPEDIA_STACK_STARTERS.filter((s) => s.id !== "blank").map(
                (starter) => (
                  <button
                    key={starter.id}
                    type="button"
                    onClick={() => applyEncyclopediaStarter(starter.id)}
                    className="rounded-2xl border border-[rgba(45,42,38,0.1)] bg-[rgba(252,249,243,0.85)] px-4 py-3 text-left transition-colors hover:border-[color-mix(in_srgb,var(--accent)_40%,rgba(45,42,38,0.1))]"
                  >
                    <span className="block font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
                      {starter.label}
                    </span>
                    <span className="mt-1 block font-[family-name:var(--font-ui)] text-xs leading-relaxed text-[var(--ink-muted)]">
                      {starter.hint}
                    </span>
                  </button>
                ),
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="mt-2 gap-1.5 rounded-full"
              onClick={beginAddStack}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
              Name your own stack
            </Button>
          </div>
        ) : (
          <div className="space-y-12">
            {stacks.map((stack, stackIndex) => (
              <StackShelf
                key={stack.id}
                stackId={stack.id}
                label={stack.label}
                color={stack.color}
                items={stack.items}
                index={stackIndex}
                customizable={stack.customizable}
                selectedId={railEntryId}
                renaming={renamingId === stack.id}
                renameDraft={renameDraft}
                onRenameDraft={setRenameDraft}
                onStartRename={() => {
                  setRenamingId(stack.id);
                  setRenameDraft(stack.label);
                }}
                onCommitRename={() => commitRename(stack.id)}
                onCancelRename={() => {
                  setRenamingId(null);
                  setRenameDraft("");
                }}
                onColorChange={(color) =>
                  updateEncyclopediaStack(stack.id, { color })
                }
                onDelete={() => deleteEncyclopediaStack(stack.id)}
                onAdd={() => createAndOpen(stack.id)}
                onOpenCard={openCard}
              />
            ))}
          </div>
        )}
      </div>

      <EncyclopediaPanel
        open={railOpen}
        onClose={() => {
          setRailOpen(false);
          setRailEntryId(null);
        }}
        entryId={railEntryId}
        onEntryIdChange={(id) => {
          setRailEntryId(id);
          if (id) setRailOpen(true);
        }}
      />
    </div>
  );
}

function StackShelf({
  stackId,
  label,
  color,
  items,
  index,
  customizable,
  selectedId,
  renaming,
  renameDraft,
  onRenameDraft,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onColorChange,
  onDelete,
  onAdd,
  onOpenCard,
}: {
  stackId: string;
  label: string;
  color: string;
  items: StackItem[];
  index: number;
  customizable: boolean;
  selectedId: string | null;
  renaming: boolean;
  renameDraft: string;
  onRenameDraft: (v: string) => void;
  onStartRename: () => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onColorChange: (color: string) => void;
  onDelete: () => void;
  onAdd: () => void;
  onOpenCard: (id: string) => void;
}) {
  const accent = color;

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.55,
        delay: Math.min(index * 0.06, 0.36),
        ease: [0.25, 0.1, 0.25, 1],
      }}
      aria-labelledby={`stack-${stackId}`}
    >
      <div className="mb-4 flex items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: accent }}
              aria-hidden
            />
            Stack
          </p>
          {renaming ? (
            <form
              className="mt-1 flex flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                onCommitRename();
              }}
            >
              <input
                autoFocus
                value={renameDraft}
                onChange={(e) => onRenameDraft(e.target.value)}
                onBlur={onCommitRename}
                className="w-full max-w-xs bg-transparent font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--ink)] focus:outline-none"
              />
              <button
                type="button"
                onClick={onCancelRename}
                className="rounded-full p-1 text-[var(--ink-faint)] hover:text-[var(--ink)]"
                aria-label="Cancel rename"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            </form>
          ) : (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2
                id={`stack-${stackId}`}
                className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--ink)]"
              >
                {label}
              </h2>
              {customizable ? (
                <>
                  <button
                    type="button"
                    aria-label={`Rename ${label}`}
                    onClick={onStartRename}
                    className="rounded-full p-1.5 text-[var(--ink-faint)] transition-colors hover:bg-[rgba(45,42,38,0.06)] hover:text-[var(--ink)]"
                  >
                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${label} stack`}
                    onClick={onDelete}
                    className="rounded-full p-1.5 text-[var(--ink-faint)] transition-colors hover:bg-[rgba(45,42,38,0.06)] hover:text-[#6B3A2A]"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                </>
              ) : null}
            </div>
          )}
          {customizable ? (
            <div
              className="mt-3 flex flex-wrap items-center gap-1.5"
              role="group"
              aria-label={`${label} color`}
            >
              {ENCYCLOPEDIA_STACK_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  aria-pressed={accent === c}
                  onClick={() => onColorChange(c)}
                  className={cn(
                    "h-3.5 w-3.5 rounded-full transition-opacity",
                    accent === c
                      ? "ring-2 ring-[var(--ink)] ring-offset-1 ring-offset-[#EDE8E0]"
                      : "opacity-55 hover:opacity-100",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          ) : null}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 rounded-full"
          onClick={onAdd}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
          Add card
        </Button>
      </div>

      <div
        className="relative overflow-hidden rounded-[1.75rem] border border-[rgba(45,42,38,0.08)] px-4 py-5 sm:px-6 sm:py-6"
        style={{
          background: `linear-gradient(165deg, color-mix(in srgb, ${accent} 10%, #F7F3EA), #F1EBE1 55%, color-mix(in srgb, ${accent} 6%, #E8E0D4))`,
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.45), 0 18px 40px rgba(45,42,38,0.06)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-x-8 top-3 h-px opacity-40"
          style={{ background: accent }}
          aria-hidden
        />

        {items.length === 0 ? (
          <button
            type="button"
            onClick={onAdd}
            className="flex min-h-[11rem] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[rgba(45,42,38,0.14)] bg-[rgba(247,243,234,0.35)] px-6 text-center transition-colors hover:border-[color-mix(in_srgb,var(--accent)_45%,rgba(45,42,38,0.14))] hover:bg-[rgba(247,243,234,0.55)]"
          >
            <span className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
              Empty stack
            </span>
            <span className="max-w-xs font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)]">
              Add the first card for {label}.
            </span>
          </button>
        ) : (
          <ul className="flex gap-4 overflow-x-auto pb-2 pt-1 [scrollbar-width:thin]">
            {items.map((item, cardIndex) => (
              <StackCard
                key={item.entry.id}
                item={item}
                index={cardIndex}
                accent={accent}
                stackLabel={label}
                selected={selectedId === item.entry.id}
                onOpen={() => onOpenCard(item.entry.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </motion.section>
  );
}

function StackCard({
  item,
  index,
  accent,
  stackLabel,
  selected,
  onOpen,
}: {
  item: StackItem;
  index: number;
  accent: string;
  stackLabel: string;
  selected: boolean;
  onOpen: () => void;
}) {
  const { entry, appearances, completeness, depth } = item;

  return (
    <motion.li
      initial={{ opacity: 0, y: 14, rotate: -1.5 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{
        duration: 0.45,
        delay: Math.min(index * 0.05, 0.3),
        ease: [0.25, 0.1, 0.25, 1],
      }}
      className="w-[15.5rem] shrink-0"
    >
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "group relative flex h-[17.5rem] w-full flex-col overflow-hidden rounded-[1.35rem] border bg-[rgba(252,249,243,0.92)] text-left shadow-[0_14px_28px_rgba(45,42,38,0.08)] transition-transform duration-300",
          "hover:-translate-y-1.5 hover:rotate-[-1deg]",
          selected
            ? "border-[color-mix(in_srgb,var(--accent)_55%,rgba(45,42,38,0.1))] ring-2 ring-[color-mix(in_srgb,var(--accent)_35%,transparent)]"
            : "border-[rgba(45,42,38,0.1)]",
        )}
      >
        {entry.coverImage ? (
          <span className="relative block h-24 w-full shrink-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={entry.coverImage}
              alt=""
              className="h-full w-full object-cover"
            />
            <span
              className="absolute inset-x-0 top-0 h-1.5"
              style={{ background: accent }}
              aria-hidden
            />
          </span>
        ) : (
          <span
            className="absolute inset-x-0 top-0 h-1.5"
            style={{ background: accent }}
            aria-hidden
          />
        )}
        <span className="flex min-h-0 flex-1 flex-col p-5 pt-4">
          <span className="font-[family-name:var(--font-ui)] text-[0.62rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
            {stackLabel}
          </span>
          <h3 className="mt-2 font-[family-name:var(--font-display)] text-2xl leading-tight text-[var(--ink)] transition-colors group-hover:text-[color-mix(in_srgb,var(--accent)_65%,var(--ink))]">
            {entry.title || "Untitled"}
          </h3>
          <p
            className={cn(
              "mt-2 line-clamp-3 flex-1 font-[family-name:var(--font-ui)] text-sm leading-relaxed",
              entry.shortBio
                ? "text-[var(--ink-muted)]"
                : "italic text-[var(--ink-faint)]",
            )}
          >
            {entry.shortBio || "Open the card to write this piece of the world."}
          </p>
          <div className="mt-3 space-y-2">
            <DepthMeter
              depth={depth}
              completeness={completeness}
              compact
              variant="encyclopedia"
              className="w-full"
            />
            <p className="font-[family-name:var(--font-ui)] text-[0.7rem] text-[var(--ink-faint)]">
              {appearances === 0
                ? "Not yet on the page"
                : appearances === 1
                  ? "1 scene"
                  : `${appearances} scenes`}
            </p>
          </div>
        </span>
      </button>
    </motion.li>
  );
}
