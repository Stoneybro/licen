import Link from "next/link";
import { SearchIcon, InfoIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppTopbar } from "@/components/app/app-topbar";
import { HashChip } from "@/components/app/hash-chip";
import { JobStateBadge } from "@/components/app/job-state-badge";
import { MOCK_JOBS, MOCK_DATASETS } from "@/lib/mock";

const RECENT_EVENTS = MOCK_JOBS.flatMap((j) =>
  j.events.map((e) => ({ ...e, jobId: j.jobId, datasetLabel: j.datasetLabel }))
)
  .sort((a, b) => b.blockNumber - a.blockNumber)
  .slice(0, 10);

export default function AuditPage() {
  return (
    <div className="flex flex-col min-h-full">
      <AppTopbar title="Audit" />

      <div className="flex-1 p-6 flex flex-col gap-6 max-w-3xl">

        {/* Explainer */}
        <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 px-4 py-3">
          <InfoIcon className="size-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="text-foreground font-medium">Public audit log.</span>{" "}
            Every state transition in the LICEN protocol — access requests, grants, job starts,
            completions, and royalty settlements — is recorded as an on-chain event indexed by
            Envio HyperIndex. All data here is public and verifiable.
          </p>
        </div>

        {/* Search */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <SearchIcon className="size-4" />
              Lookup
            </CardTitle>
            <CardDescription className="text-xs">
              Paste a transaction hash, job ID, or dataset root to drill into any protocol event.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex gap-2">
              <input
                readOnly
                placeholder="0x… txHash, jobId, or datasetRoot"
                className="flex-1 h-8 rounded-md border border-border bg-background px-3 text-xs font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button className="h-8 px-3 rounded-md border border-border text-xs font-medium hover:bg-muted transition-colors">
                Search
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {MOCK_JOBS.slice(0, 3).map((j) => (
                <Link
                  key={j.jobId}
                  href={`/app/audit/job/${j.jobId}`}
                  className="inline-flex items-center gap-1 h-6 px-2 rounded border border-border text-[10px] font-mono text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                >
                  job: {j.jobId.slice(0, 12)}…
                </Link>
              ))}
              {MOCK_DATASETS.slice(0, 2).map((d) => (
                <Link
                  key={d.datasetRoot}
                  href={`/app/audit/dataset/${d.datasetRoot}`}
                  className="inline-flex items-center gap-1 h-6 px-2 rounded border border-border text-[10px] font-mono text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                >
                  dataset: {d.datasetRoot.slice(0, 12)}…
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Shortcut cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: "By Job", href: `/app/audit/job/${MOCK_JOBS[0].jobId}`, desc: "Full lifecycle of a single training job" },
            { label: "By Dataset", href: `/app/audit/dataset/${MOCK_DATASETS[0].datasetRoot}`, desc: "All jobs and events for a dataset" },
            { label: "By Tx", href: `/app/audit/tx/${MOCK_JOBS[0].events[0].txHash}`, desc: "Decode a single transaction hash" },
          ].map((c) => (
            <Link key={c.label} href={c.href}>
              <Card className="h-full hover:border-foreground/20 transition-colors cursor-pointer">
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs font-medium">{c.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{c.desc}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Recent events */}
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-medium">Recent Protocol Events</h3>
          <div className="flex flex-col gap-1">
            {RECENT_EVENTS.map((e, i) => (
              <Link
                key={i}
                href={`/app/audit/tx/${e.txHash}`}
                className="flex items-center gap-3 rounded-md border border-border px-4 py-2.5 hover:border-foreground/20 transition-colors"
              >
                <div className="flex-1 min-w-0 flex items-center gap-3">
                  <Badge variant="secondary" className="font-mono text-[10px] h-4 shrink-0">{e.topic}</Badge>
                  <span className="text-xs text-muted-foreground truncate">{e.datasetLabel}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-[10px] text-muted-foreground">#{e.blockNumber.toLocaleString()}</span>
                  <HashChip hash={e.txHash} />
                </div>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
