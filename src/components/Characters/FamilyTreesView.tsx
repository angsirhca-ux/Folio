"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBook } from "@/providers/BookProvider";
import {
  characterName,
  createFamilyTreeLink,
  createFamilyTreeUnion,
  layoutFamilyTree,
  sortFamilyTrees,
} from "@/lib/familyTrees";
import { povColor } from "@/lib/types";
import { cn } from "@/lib/utils";

export function FamilyTreesView() {
  const {
    book,
    addFamilyTree,
    updateFamilyTree,
    deleteFamilyTree,
  } = useBook();
  const trees = useMemo(
    () => sortFamilyTrees(book.familyTrees ?? []),
    [book.familyTrees],
  );
  const characters = book.characters ?? [];
  const [activeId, setActiveId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");

  const active =
    trees.find((t) => t.id === activeId) ?? trees[0] ?? null;

  function createTree() {
    const name = draftName.trim() || "Family tree";
    const id = addFamilyTree(name);
    setActiveId(id);
    setDraftName("");
    setAdding(false);
  }

  function commitRename() {
    if (!active) return;
    const name = renameDraft.trim();
    if (name) updateFamilyTree(active.id, { name });
    setRenaming(false);
    setRenameDraft("");
  }

  if (trees.length === 0 && !adding) {
    return (
      <div className="flex min-h-[16rem] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[rgba(45,42,38,0.14)] bg-[rgba(247,243,234,0.4)] px-6 py-16 text-center">
        <p className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
          No family trees yet
        </p>
        <p className="max-w-sm font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
          Chart bloodlines and partnerships for this cast. You can keep several
          trees — one per house, clan, or family.
        </p>
        <Button
          size="sm"
          className="mt-2 gap-1.5 rounded-full"
          onClick={() => setAdding(true)}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
          New tree
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        {trees.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setActiveId(t.id);
              setRenaming(false);
            }}
            className={cn(
              "rounded-full px-3.5 py-1.5 font-[family-name:var(--font-ui)] text-sm transition-colors",
              (active?.id ?? "") === t.id
                ? "bg-[rgba(45,42,38,0.1)] text-[var(--ink)]"
                : "text-[var(--ink-muted)] hover:bg-[rgba(45,42,38,0.05)] hover:text-[var(--ink)]",
            )}
          >
            {t.name}
          </button>
        ))}
        {adding ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              createTree();
            }}
          >
            <input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="Tree name"
              className="h-8 w-40 rounded-full border border-[rgba(45,42,38,0.12)] bg-[rgba(247,243,234,0.9)] px-3 font-[family-name:var(--font-ui)] text-sm text-[var(--ink)] focus:outline-none"
            />
            <Button type="submit" size="sm" className="rounded-full">
              Add
            </Button>
            <button
              type="button"
              aria-label="Cancel"
              onClick={() => {
                setAdding(false);
                setDraftName("");
              }}
              className="rounded-full p-1.5 text-[var(--ink-faint)] hover:text-[var(--ink)]"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)] transition-colors hover:bg-[rgba(45,42,38,0.05)] hover:text-[var(--ink)]"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            New tree
          </button>
        )}
      </div>

      {active ? (
        <TreeCanvas
          treeId={active.id}
          name={active.name}
          renaming={renaming}
          renameDraft={renameDraft}
          onStartRename={() => {
            setRenaming(true);
            setRenameDraft(active.name);
          }}
          onRenameDraft={setRenameDraft}
          onCommitRename={commitRename}
          onCancelRename={() => {
            setRenaming(false);
            setRenameDraft("");
          }}
          onDelete={() => {
            deleteFamilyTree(active.id);
            setActiveId(null);
          }}
          memberIds={active.memberIds}
          links={active.links}
          unions={active.unions}
          characters={characters}
          onChange={(partial) => updateFamilyTree(active.id, partial)}
        />
      ) : null}
    </div>
  );
}

function TreeCanvas({
  treeId,
  name,
  renaming,
  renameDraft,
  onStartRename,
  onRenameDraft,
  onCommitRename,
  onCancelRename,
  onDelete,
  memberIds,
  links,
  unions,
  characters,
  onChange,
}: {
  treeId: string;
  name: string;
  renaming: boolean;
  renameDraft: string;
  onStartRename: () => void;
  onRenameDraft: (v: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onDelete: () => void;
  memberIds: string[];
  links: import("@/lib/types").FamilyTreeLink[];
  unions: import("@/lib/types").FamilyTreeUnion[];
  characters: import("@/lib/types").Character[];
  onChange: (
    partial: Partial<
      Pick<
        import("@/lib/types").FamilyTree,
        "memberIds" | "links" | "unions" | "name"
      >
    >,
  ) => void;
}) {
  const tree = useMemo(
    () => ({
      id: treeId,
      name,
      order: 0,
      memberIds,
      links,
      unions,
      createdAt: 0,
      updatedAt: 0,
    }),
    [treeId, name, memberIds, links, unions],
  );
  const layout = useMemo(() => layoutFamilyTree(tree), [tree]);
  const [addPersonId, setAddPersonId] = useState("");
  const [partnerPick, setPartnerPick] = useState<string | null>(null);

  const available = characters.filter((c) => !memberIds.includes(c.id));

  function addMember(id: string) {
    if (!id || memberIds.includes(id)) return;
    onChange({ memberIds: [...memberIds, id] });
    setAddPersonId("");
  }

  function removeMember(id: string) {
    onChange({
      memberIds: memberIds.filter((m) => m !== id),
      links: links.filter((l) => l.parentId !== id && l.childId !== id),
      unions: unions.filter((u) => u.aId !== id && u.bId !== id),
    });
    if (partnerPick === id) setPartnerPick(null);
  }

  function setPrimaryParent(childId: string, parentId: string) {
    const rest = links.filter((l) => l.childId !== childId);
    if (!parentId) {
      onChange({ links: rest });
      return;
    }
    onChange({
      links: [...rest, createFamilyTreeLink({ parentId, childId })],
    });
  }

  function addParent(childId: string, parentId: string) {
    if (!parentId) return;
    if (
      links.some((l) => l.childId === childId && l.parentId === parentId)
    ) {
      return;
    }
    onChange({
      links: [...links, createFamilyTreeLink({ parentId, childId })],
    });
  }

  function togglePartner(id: string) {
    if (partnerPick === id) {
      setPartnerPick(null);
      return;
    }
    if (!partnerPick) {
      setPartnerPick(id);
      return;
    }
    if (partnerPick === id) return;
    const exists = unions.some(
      (u) =>
        (u.aId === partnerPick && u.bId === id) ||
        (u.aId === id && u.bId === partnerPick),
    );
    if (!exists) {
      onChange({
        unions: [
          ...unions,
          createFamilyTreeUnion({ aId: partnerPick, bId: id }),
        ],
      });
    }
    setPartnerPick(null);
  }

  function clearPartner(unionId: string) {
    onChange({ unions: unions.filter((u) => u.id !== unionId) });
  }

  return (
    <div className="rounded-2xl border border-[rgba(45,42,38,0.08)] bg-[rgba(247,243,234,0.45)] px-4 py-6 sm:px-6">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {renaming ? (
            <form
              className="flex items-center gap-2"
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
                className="bg-transparent font-[family-name:var(--font-display)] text-2xl tracking-tight text-[var(--ink)] focus:outline-none"
              />
              <button
                type="button"
                onClick={onCancelRename}
                className="rounded-full p-1 text-[var(--ink-faint)]"
                aria-label="Cancel rename"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            </form>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-[var(--ink)]">
                {name}
              </h2>
              <button
                type="button"
                aria-label="Rename tree"
                onClick={onStartRename}
                className="rounded-full p-1.5 text-[var(--ink-faint)] hover:bg-[rgba(45,42,38,0.06)] hover:text-[var(--ink)]"
              >
                <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
              <button
                type="button"
                aria-label="Delete tree"
                onClick={onDelete}
                className="rounded-full p-1.5 text-[var(--ink-faint)] hover:bg-[rgba(45,42,38,0.06)] hover:text-[#6B3A2A]"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            </div>
          )}
          <p className="mt-1 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)]">
            {memberIds.length === 0
              ? "Add people from the cast, then set parents and partners."
              : partnerPick
                ? `Choose a partner for ${characterName(characters, partnerPick)}…`
                : "Tap Partner on someone, then tap their partner. Set parents under each person."}
          </p>
        </div>

        {available.length > 0 ? (
          <div className="flex items-center gap-2">
            <select
              value={addPersonId}
              onChange={(e) => setAddPersonId(e.target.value)}
              aria-label="Add person to tree"
              className="h-9 max-w-[12rem] rounded-full border border-[rgba(45,42,38,0.1)] bg-[rgba(247,243,234,0.9)] px-3 font-[family-name:var(--font-ui)] text-sm text-[var(--ink)] focus:outline-none"
            >
              <option value="">Add person…</option>
              {available.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || "Unnamed"}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              className="rounded-full"
              disabled={!addPersonId}
              onClick={() => addMember(addPersonId)}
            >
              Add
            </Button>
          </div>
        ) : null}
      </div>

      {memberIds.length === 0 ? (
        <p className="py-10 text-center font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)]">
          {characters.length === 0
            ? "Create characters on the Roster first, then add them here."
            : "Choose someone from the cast to place on this tree."}
        </p>
      ) : (
        <div className="space-y-10">
          {layout.generations.map((gen, gi) => (
            <motion.div
              key={`${treeId}-gen-${gi}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                delay: Math.min(gi * 0.05, 0.3),
                ease: [0.25, 0.1, 0.25, 1],
              }}
              className="relative"
            >
              {gi > 0 ? (
                <div
                  className="pointer-events-none absolute -top-6 left-1/2 h-6 w-px -translate-x-1/2 bg-[rgba(45,42,38,0.14)]"
                  aria-hidden
                />
              ) : null}
              <p className="mb-3 text-center font-[family-name:var(--font-ui)] text-[0.6rem] uppercase tracking-[0.2em] text-[var(--ink-faint)]">
                Generation {gi + 1}
              </p>
              <div className="flex flex-wrap items-start justify-center gap-6 sm:gap-8">
                {gen.map((unit) => {
                  if (unit.kind === "union") {
                    return (
                      <div
                        key={unit.unionId}
                        className="flex flex-wrap items-start justify-center gap-2"
                      >
                        <PersonNode
                          characterId={unit.aId}
                          characters={characters}
                          memberIds={memberIds}
                          parents={layout.parentsOf.get(unit.aId) ?? []}
                          selectedForPartner={partnerPick === unit.aId}
                          onRemove={() => removeMember(unit.aId)}
                          onParent={(pid) => setPrimaryParent(unit.aId, pid)}
                          onAddParent={(pid) => addParent(unit.aId, pid)}
                          onPartner={() => togglePartner(unit.aId)}
                        />
                        <div className="flex flex-col items-center pt-5">
                          <span
                            className="h-px w-6 bg-[rgba(45,42,38,0.25)]"
                            aria-hidden
                          />
                          <button
                            type="button"
                            onClick={() => clearPartner(unit.unionId)}
                            className="mt-1 font-[family-name:var(--font-ui)] text-[0.6rem] uppercase tracking-[0.14em] text-[var(--ink-faint)] hover:text-[#6B3A2A]"
                            title="Remove partnership"
                          >
                            &
                          </button>
                        </div>
                        <PersonNode
                          characterId={unit.bId}
                          characters={characters}
                          memberIds={memberIds}
                          parents={layout.parentsOf.get(unit.bId) ?? []}
                          selectedForPartner={partnerPick === unit.bId}
                          onRemove={() => removeMember(unit.bId)}
                          onParent={(pid) => setPrimaryParent(unit.bId, pid)}
                          onAddParent={(pid) => addParent(unit.bId, pid)}
                          onPartner={() => togglePartner(unit.bId)}
                        />
                      </div>
                    );
                  }
                  return (
                    <PersonNode
                      key={unit.id}
                      characterId={unit.id}
                      characters={characters}
                      memberIds={memberIds}
                      parents={layout.parentsOf.get(unit.id) ?? []}
                      selectedForPartner={partnerPick === unit.id}
                      onRemove={() => removeMember(unit.id)}
                      onParent={(pid) => setPrimaryParent(unit.id, pid)}
                      onAddParent={(pid) => addParent(unit.id, pid)}
                      onPartner={() => togglePartner(unit.id)}
                    />
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function PersonNode({
  characterId,
  characters,
  memberIds,
  parents,
  selectedForPartner,
  onRemove,
  onParent,
  onAddParent,
  onPartner,
}: {
  characterId: string;
  characters: import("@/lib/types").Character[];
  memberIds: string[];
  parents: string[];
  selectedForPartner: boolean;
  onRemove: () => void;
  onParent: (parentId: string) => void;
  onAddParent: (parentId: string) => void;
  onPartner: () => void;
}) {
  const name = characterName(characters, characterId);
  const accent = povColor(name);
  const others = memberIds.filter((id) => id !== characterId);
  const parentOptions = others.filter((id) => !parents.includes(id));

  return (
    <div className="w-[9.5rem] shrink-0">
      <div
        className={cn(
          "relative rounded-xl border bg-[rgba(252,249,243,0.92)] px-3 py-3 shadow-[0_8px_20px_rgba(45,42,38,0.05)]",
          selectedForPartner
            ? "border-[color-mix(in_srgb,var(--accent)_50%,rgba(45,42,38,0.1))] ring-2 ring-[color-mix(in_srgb,var(--accent)_30%,transparent)]"
            : "border-[rgba(45,42,38,0.1)]",
        )}
      >
        <span
          className="absolute inset-x-0 top-0 h-1 rounded-t-xl"
          style={{ background: accent }}
          aria-hidden
        />
        <Link
          href={`/characters/${characterId}`}
          className="mt-1 block truncate font-[family-name:var(--font-display)] text-base text-[var(--ink)] hover:text-[color-mix(in_srgb,var(--accent)_65%,var(--ink))]"
        >
          {name}
        </Link>
        <div className="mt-2 flex flex-wrap gap-1">
          <button
            type="button"
            onClick={onPartner}
            className="rounded-full px-2 py-0.5 font-[family-name:var(--font-ui)] text-[0.62rem] uppercase tracking-[0.1em] text-[var(--ink-muted)] hover:bg-[rgba(45,42,38,0.06)]"
          >
            Partner
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-full px-2 py-0.5 font-[family-name:var(--font-ui)] text-[0.62rem] uppercase tracking-[0.1em] text-[var(--ink-faint)] hover:bg-[rgba(107,58,42,0.08)] hover:text-[#6B3A2A]"
          >
            Remove
          </button>
        </div>
      </div>

      <label className="mt-2 block">
        <span className="sr-only">Parent of {name}</span>
        <select
          value={parents[0] ?? ""}
          onChange={(e) => onParent(e.target.value)}
          className="w-full rounded-lg border border-transparent bg-transparent px-1 py-1 font-[family-name:var(--font-ui)] text-[0.7rem] text-[var(--ink-muted)] focus:border-[rgba(45,42,38,0.12)] focus:outline-none"
        >
          <option value="">No parent</option>
          {others.map((id) => (
            <option key={id} value={id}>
              Child of {characterName(characters, id)}
            </option>
          ))}
        </select>
      </label>
      {parents.length === 1 && parentOptions.length > 0 ? (
        <label className="mt-0.5 block">
          <span className="sr-only">Second parent of {name}</span>
          <select
            value={parents[1] ?? ""}
            onChange={(e) => {
              if (e.target.value) onAddParent(e.target.value);
            }}
            className="w-full rounded-lg border border-transparent bg-transparent px-1 py-1 font-[family-name:var(--font-ui)] text-[0.7rem] text-[var(--ink-faint)] focus:border-[rgba(45,42,38,0.12)] focus:outline-none"
          >
            <option value="">+ Second parent</option>
            {parentOptions.map((id) => (
              <option key={id} value={id}>
                {characterName(characters, id)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {parents.length > 1 ? (
        <p className="mt-0.5 px-1 font-[family-name:var(--font-ui)] text-[0.65rem] text-[var(--ink-faint)]">
          & {characterName(characters, parents[1])}
        </p>
      ) : null}
    </div>
  );
}
