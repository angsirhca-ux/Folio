"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ClaudeDeepenButton({
  onClick,
  busy,
  disabled,
  configured,
  label = "Deepen with Claude",
  title,
  className,
}: {
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
  configured: boolean | null;
  label?: string;
  title?: string;
  className?: string;
}) {
  const ready = configured === true;
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={cn("gap-1.5 rounded-full", className)}
      onClick={onClick}
      disabled={disabled || busy || configured === false}
      title={
        configured === false
          ? "Add ANTHROPIC_API_KEY to .env.local"
          : title ??
            "Fill empty wiki fields from the manuscript via Claude"
      }
    >
      <Sparkles
        className={cn("h-3.5 w-3.5", busy && "animate-pulse")}
        strokeWidth={1.5}
      />
      {busy ? "Reading manuscript…" : ready ? label : "Claude unavailable"}
    </Button>
  );
}
