"use client";

import Link from "next/link";

type Item = { id: string; label: string; href?: string };

export function MembershipChecklist({
  label,
  hint,
  items,
  selected,
  onChange,
  emptyHint,
}: {
  label: string;
  hint?: string;
  items: Item[];
  selected: string[];
  onChange: (ids: string[]) => void;
  emptyHint?: string;
}) {
  return (
    <div>
      <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
        {label}
      </p>
      {hint ? (
        <p className="mt-1 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)]">
          {hint}
        </p>
      ) : null}
      {items.length === 0 ? (
        <p className="mt-3 font-[family-name:var(--font-ui)] text-sm italic text-[var(--ink-faint)]">
          {emptyHint || "Nothing to link yet."}
        </p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {items.map((item) => {
            const on = selected.includes(item.id);
            return (
              <li key={item.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[rgba(45,42,38,0.06)] bg-[rgba(247,243,234,0.35)] px-3 py-2">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => {
                      const next = on
                        ? selected.filter((id) => id !== item.id)
                        : [...selected, item.id];
                      onChange(next);
                    }}
                    className="rounded border-[rgba(45,42,38,0.2)]"
                  />
                  {item.href ? (
                    <Link
                      href={item.href}
                      onClick={(e) => e.stopPropagation()}
                      className="font-[family-name:var(--font-ui)] text-sm text-[var(--ink)] hover:text-[var(--accent)]"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span className="font-[family-name:var(--font-ui)] text-sm text-[var(--ink)]">
                      {item.label}
                    </span>
                  )}
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
