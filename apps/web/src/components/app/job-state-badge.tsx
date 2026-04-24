import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { JobState } from "@/lib/mock";

const STATE_CONFIG: Record<JobState, { label: string; className: string }> = {
  Requested: { label: "Requested", className: "border-border text-muted-foreground" },
  Granted:   { label: "Granted",   className: "border-border text-foreground" },
  Running:   { label: "Running",   className: "border-foreground text-foreground" },
  Completed: { label: "Completed", className: "bg-foreground text-background border-transparent" },
  Failed:    { label: "Failed",    className: "border-destructive text-foreground" },
  TimedOut:  { label: "Timed Out", className: "border-muted-foreground text-muted-foreground" },
  Refunded:  { label: "Refunded",  className: "border-border text-muted-foreground" },
};

export function JobStateBadge({ state }: { state: JobState }) {
  const cfg = STATE_CONFIG[state];
  return (
    <Badge variant="outline" className={cn("text-xs font-mono", cfg.className)}>
      {cfg.label}
    </Badge>
  );
}
