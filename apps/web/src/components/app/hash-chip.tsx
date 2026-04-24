"use client";

import * as React from "react";
import { CopyIcon, CheckIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { truncHash } from "@/lib/mock";

type HashChipProps = {
  hash: string;
  label?: string;
  front?: number;
  back?: number;
  className?: string;
  explorerHref?: string;
};

export function HashChip({ hash, label, front = 6, back = 4, className, explorerHref }: HashChipProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(hash).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const display = truncHash(hash, front, back);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-1 font-mono text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors",
            className
          )}
        >
          {label && <span className="text-muted-foreground/60 font-sans mr-0.5">{label}</span>}
          <span>{display}</span>
          <button onClick={handleCopy} className="ml-0.5 hover:text-foreground transition-colors" aria-label="Copy">
            {copied ? (
              <CheckIcon className="size-3 text-foreground" />
            ) : (
              <CopyIcon className="size-3" />
            )}
          </button>
          {explorerHref && (
            <a
              href={explorerHref}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
              aria-label="View on explorer"
            >
              ↗
            </a>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <span className="font-mono text-xs break-all">{hash}</span>
      </TooltipContent>
    </Tooltip>
  );
}
