import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { JobState } from "@/lib/mock";

type ExtendedJobState = JobState | "Dispatching";

const STATE_CONFIG: Record<ExtendedJobState, { label: string; className: string; pulse?: string }> = {
  Requested:   { label: "Queued",       className: "border-border text-muted-foreground",                          pulse: "bg-muted-foreground/50" },
  Granted:     { label: "Queued",       className: "border-border text-muted-foreground",                          pulse: "bg-muted-foreground/50" },
  Dispatching: { label: "Dispatching",  className: "border-amber-500/60 text-amber-600 dark:text-amber-400",       pulse: "bg-amber-500" },
  Running:     { label: "Training",     className: "border-blue-500/60 text-blue-600 dark:text-blue-400",          pulse: "bg-blue-500" },
  Completed:   { label: "Completed",    className: "bg-foreground text-background border-transparent" },
  Failed:      { label: "Failed",       className: "border-destructive/60 text-destructive",                       pulse: "bg-destructive" },
  TimedOut:    { label: "Timed Out",    className: "border-muted-foreground text-muted-foreground" },
  Refunded:    { label: "Refunded",     className: "border-border text-muted-foreground" },
};

export function JobStateBadge({ state }: { state: ExtendedJobState }) {
  const cfg = STATE_CONFIG[state] ?? STATE_CONFIG["Requested"];
  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] font-semibold tracking-wide flex items-center gap-1.5 h-5 w-fit", cfg.className)}
    >
      {cfg.pulse && (
        <span
          className={cn(
            "size-1.5 rounded-full shrink-0",
            cfg.pulse,
            state !== "Completed" && "animate-pulse"
          )}
        />
      )}
      {cfg.label}
    </Badge>
  );
}
