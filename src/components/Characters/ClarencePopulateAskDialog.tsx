"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type {
  ClarenceAskAnswers,
  FirstPersonProbe,
} from "@/lib/clarenceAsk";
import { CLARENCE } from "@/lib/clarence";
import { cn } from "@/lib/utils";

export function ClarencePopulateAskDialog({
  open,
  onOpenChange,
  probe,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  probe: FirstPersonProbe | null;
  onConfirm: (answers: ClarenceAskAnswers) => void;
}) {
  const [narratorName, setNarratorName] = useState("");
  const [authorNotes, setAuthorNotes] = useState("");
  const [applyPov, setApplyPov] = useState(true);

  useEffect(() => {
    if (!open) return;
    setNarratorName(probe?.suggestedNames[0] ?? "");
    setAuthorNotes("");
    setApplyPov(true);
  }, [open, probe]);

  const canContinue = narratorName.trim().length >= 2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(92vw,26rem)]">
        <DialogHeader>
          <DialogTitle>Quick check before {CLARENCE.name} populates</DialogTitle>
          <DialogDescription>
            This manuscript reads like first person, but the narrator isn’t
            clearly named on the scene cards. Tell {CLARENCE.name} who “I” is
            so traits, goals, and cast presence stay attached to the right
            person.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <label className="block">
            <span className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
              Who is the narrator / protagonist?
            </span>
            <input
              value={narratorName}
              onChange={(e) => setNarratorName(e.target.value)}
              placeholder="Full name if you have it"
              autoFocus
              className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--paper)] px-3 py-2.5 font-[family-name:var(--font-ui)] text-sm text-[var(--ink)] outline-none focus:border-[color-mix(in_srgb,var(--accent)_55%,var(--border))]"
            />
          </label>

          {probe && probe.suggestedNames.length > 0 ? (
            <div>
              <p className="mb-2 font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
                Suggestions from the book
              </p>
              <div className="flex flex-wrap gap-2">
                {probe.suggestedNames.slice(0, 8).map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setNarratorName(name)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 font-[family-name:var(--font-ui)] text-xs transition-colors",
                      narratorName.trim().toLowerCase() === name.toLowerCase()
                        ? "bg-[var(--accent-soft)] text-[var(--ink)]"
                        : "bg-[rgba(45,42,38,0.04)] text-[var(--ink-muted)] hover:bg-[var(--accent-soft)]",
                    )}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={applyPov}
              onChange={(e) => setApplyPov(e.target.checked)}
              className="mt-1"
            />
            <span className="font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
              Tag first-person scenes that still have no POV with this name
              {probe && probe.emptyOrAmbiguousPovCount
                ? ` (${probe.emptyOrAmbiguousPovCount} scene${probe.emptyOrAmbiguousPovCount === 1 ? "" : "s"})`
                : ""}
              .
            </span>
          </label>

          <label className="block">
            <span className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
              Anything else {CLARENCE.name} should know?{" "}
              <span className="normal-case tracking-normal text-[var(--ink-faint)]">
                (optional)
              </span>
            </span>
            <textarea
              value={authorNotes}
              onChange={(e) => setAuthorNotes(e.target.value)}
              rows={3}
              placeholder="e.g. She’s pretending to be older than she is; don’t invent a last name."
              className="mt-2 w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--paper)] px-3 py-2.5 font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink)] outline-none focus:border-[color-mix(in_srgb,var(--accent)_55%,var(--border))]"
            />
          </label>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!canContinue}
              onClick={() => {
                onConfirm({
                  narratorName: narratorName.trim(),
                  authorNotes: authorNotes.trim(),
                  applyPovToScenes: applyPov,
                });
              }}
            >
              Continue populate
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
