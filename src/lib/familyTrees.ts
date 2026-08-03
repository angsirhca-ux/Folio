import type { Book, Character, FamilyTree, FamilyTreeLink, FamilyTreeUnion } from "./types";
import { createId } from "./utils";

export function createFamilyTreeLink(
  partial: Partial<FamilyTreeLink> & { parentId: string; childId: string },
): FamilyTreeLink {
  return {
    id: partial.id ?? createId(),
    parentId: partial.parentId,
    childId: partial.childId,
  };
}

export function createFamilyTreeUnion(
  partial: Partial<FamilyTreeUnion> & { aId: string; bId: string },
): FamilyTreeUnion {
  const [aId, bId] =
    partial.aId < partial.bId
      ? [partial.aId, partial.bId]
      : [partial.bId, partial.aId];
  return {
    id: partial.id ?? createId(),
    aId,
    bId,
  };
}

export function createFamilyTree(
  partial: Partial<FamilyTree> & { name: string },
  existingCount = 0,
): FamilyTree {
  const now = Date.now();
  return {
    id: partial.id ?? createId(),
    name: partial.name.trim() || "Family tree",
    order: partial.order ?? existingCount,
    memberIds: partial.memberIds ?? [],
    links: partial.links ?? [],
    unions: partial.unions ?? [],
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
  };
}

export function sortFamilyTrees(trees: FamilyTree[]): FamilyTree[] {
  return [...trees].sort(
    (a, b) => a.order - b.order || a.name.localeCompare(b.name),
  );
}

export function ensureBookFamilyTrees(
  book: Omit<Book, "familyTrees"> & { familyTrees?: FamilyTree[] },
): Book {
  const trees = (book.familyTrees ?? []).map((t, i) =>
    createFamilyTree(
      {
        ...t,
        name: t.name || "Family tree",
        order: t.order ?? i,
        memberIds: t.memberIds ?? [],
        links: (t.links ?? []).map((l) =>
          createFamilyTreeLink({
            id: l.id,
            parentId: l.parentId,
            childId: l.childId,
          }),
        ),
        unions: (t.unions ?? []).map((u) =>
          createFamilyTreeUnion({ id: u.id, aId: u.aId, bId: u.bId }),
        ),
      },
      i,
    ),
  );
  return {
    ...(book as Book),
    familyTrees: sortFamilyTrees(trees),
  };
}

/** Drop a deleted character from every tree. */
export function pruneCharacterFromFamilyTrees(
  trees: FamilyTree[],
  characterId: string,
): FamilyTree[] {
  return trees.map((t) => {
    if (!t.memberIds.includes(characterId)) return t;
    return {
      ...t,
      memberIds: t.memberIds.filter((id) => id !== characterId),
      links: t.links.filter(
        (l) => l.parentId !== characterId && l.childId !== characterId,
      ),
      unions: t.unions.filter(
        (u) => u.aId !== characterId && u.bId !== characterId,
      ),
      updatedAt: Date.now(),
    };
  });
}

export type FamilyTreeUnit =
  | { kind: "person"; id: string }
  | { kind: "union"; aId: string; bId: string; unionId: string };

export type FamilyTreeLayout = {
  generations: FamilyTreeUnit[][];
  /** childId → parent ids present in the tree */
  parentsOf: Map<string, string[]>;
  /** parentId → child ids */
  childrenOf: Map<string, string[]>;
};

/**
 * Lay out a tree into generation rows.
 * Partners at the same depth sit together as a union unit.
 */
export function layoutFamilyTree(tree: FamilyTree): FamilyTreeLayout {
  const members = new Set(tree.memberIds);
  const parentsOf = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();

  for (const link of tree.links) {
    if (!members.has(link.parentId) || !members.has(link.childId)) continue;
    if (link.parentId === link.childId) continue;
    const parents = parentsOf.get(link.childId) ?? [];
    if (!parents.includes(link.parentId)) parents.push(link.parentId);
    parentsOf.set(link.childId, parents);
    const children = childrenOf.get(link.parentId) ?? [];
    if (!children.includes(link.childId)) children.push(link.childId);
    childrenOf.set(link.parentId, children);
  }

  const depth = new Map<string, number>();
  const visiting = new Set<string>();

  function getDepth(id: string): number {
    if (depth.has(id)) return depth.get(id)!;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const parents = (parentsOf.get(id) ?? []).filter((p) => members.has(p));
    const d =
      parents.length === 0
        ? 0
        : Math.max(...parents.map((p) => getDepth(p))) + 1;
    visiting.delete(id);
    depth.set(id, d);
    return d;
  }

  for (const id of members) getDepth(id);

  const partnerOf = new Map<string, { other: string; unionId: string }>();
  for (const u of tree.unions) {
    if (!members.has(u.aId) || !members.has(u.bId)) continue;
    partnerOf.set(u.aId, { other: u.bId, unionId: u.id });
    partnerOf.set(u.bId, { other: u.aId, unionId: u.id });
  }

  // Partners share the shallower depth so they sit on one row.
  for (const [id, { other }] of partnerOf) {
    const d = Math.min(getDepth(id), getDepth(other));
    depth.set(id, d);
    depth.set(other, d);
  }

  const maxD = members.size === 0 ? -1 : Math.max(0, ...[...depth.values()]);
  const byGen: string[][] = Array.from({ length: maxD + 1 }, () => []);
  for (const id of members) {
    byGen[depth.get(id) ?? 0]?.push(id);
  }

  const generations: FamilyTreeUnit[][] = byGen.map((ids) => {
    const seen = new Set<string>();
    const units: FamilyTreeUnit[] = [];
    const sorted = [...ids].sort((a, b) => a.localeCompare(b));
    for (const id of sorted) {
      if (seen.has(id)) continue;
      const partner = partnerOf.get(id);
      if (partner && ids.includes(partner.other) && !seen.has(partner.other)) {
        const [aId, bId] =
          id < partner.other ? [id, partner.other] : [partner.other, id];
        units.push({
          kind: "union",
          aId,
          bId,
          unionId: partner.unionId,
        });
        seen.add(aId);
        seen.add(bId);
      } else {
        units.push({ kind: "person", id });
        seen.add(id);
      }
    }
    return units;
  });

  return { generations, parentsOf, childrenOf };
}

export function characterName(
  characters: Character[],
  id: string,
): string {
  return characters.find((c) => c.id === id)?.name?.trim() || "Unnamed";
}
