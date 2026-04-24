import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { AppTopbar } from "@/components/app/app-topbar";
import { HashChip } from "@/components/app/hash-chip";
import { JobStateBadge } from "@/components/app/job-state-badge";
import { MOCK_DATASETS, MOCK_JOBS, PURPOSES } from "@/lib/mock";

function getPurposeLabel(id: string) {
  return PURPOSES.find((p) => p.id === id)?.label ?? id.slice(0, 8);
}

export default async function AuditDatasetPage({ params }: { params: Promise<{ datasetRoot: string }> }) {
  const { datasetRoot } = await params;
  const dataset = MOCK_DATASETS.find((d) => d.datasetRoot === datasetRoot);
  if (!dataset) notFound();

  const datasetJobs = MOCK_JOBS.filter((j) => j.datasetRoot === datasetRoot);
  const allEvents = datasetJobs
    .flatMap((j) => j.events.map((e) => ({ ...e, jobId: j.jobId, jobState: j.state })))
    .sort((a, b) => b.blockNumber - a.blockNumber);

  return (
    <div className="flex flex-col min-h-full">
      <AppTopbar title="Audit — Dataset" />
      <div className="flex-1 p-6 flex flex-col gap-4 max-w-2xl">

        <Button asChild variant="ghost" size="sm" className="h-7 -ml-2 text-xs text-muted-foreground w-fit">
          <Link href="/app/audit">
            <ArrowLeftIcon data-icon="inline-start" />
            Audit log
          </Link>
        </Button>

        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">Dataset (public view — no keys exposed)</p>
          <h2 className="text-base font-semibold">{dataset.label}</h2>
          <HashChip hash={dataset.datasetRoot} front={14} back={10} />
          <p className="text-xs text-muted-foreground mt-1">{dataset.description}</p>
        </div>

        {/* Policy summary */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Policy (on-chain)</CardTitle>
              <Badge variant={dataset.active ? "outline" : "secondary"} className="text-[10px] h-4">
                {dataset.active ? "Active" : "Paused"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Owner</span>
              <HashChip hash={dataset.owner} front={10} back={8} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Manifest hash</span>
              <HashChip hash={dataset.manifestHash} front={10} back={8} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Rate</span>
              <span className="font-mono font-medium">{dataset.royaltyPerEpoch} lUSD/epoch</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Lifetime royalties settled</span>
              <span className="font-mono font-medium">{dataset.lifetimeRoyalties} lUSD</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total access jobs</span>
              <span className="font-mono font-medium">{dataset.jobCount}</span>
            </div>
            <Separator />
            <div>
              <span className="text-muted-foreground block mb-1">Allowed purposes</span>
              <div className="flex flex-wrap gap-1">
                {dataset.allowedPurposeIds.map((pid) => (
                  <Badge key={pid} variant="secondary" className="font-mono text-[10px] h-4">
                    {getPurposeLabel(pid)}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Jobs */}
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Access Jobs ({datasetJobs.length})</h3>
          {datasetJobs.map((j) => (
            <Link
              key={j.jobId}
              href={`/app/audit/job/${j.jobId}`}
              className="flex items-center gap-3 rounded-md border border-border px-4 py-2.5 hover:border-foreground/20 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <HashChip hash={j.jobId} />
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1 py-0.5 rounded">{j.purposeLabel}</span>
                  <span className="text-[10px] text-muted-foreground">{j.requestedEpochs} epochs</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-xs">{j.escrow} lUSD</span>
                <JobStateBadge state={j.state} />
              </div>
            </Link>
          ))}
        </div>

        {/* Full event log */}
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">All Events ({allEvents.length})</h3>
          <Card>
            <CardContent className="p-0">
              {allEvents.map((e, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-0">
                  <Badge variant="secondary" className="font-mono text-[10px] h-4 shrink-0">{e.topic}</Badge>
                  <Link href={`/app/audit/job/${e.jobId}`} className="hover:underline shrink-0">
                    <HashChip hash={e.jobId} />
                  </Link>
                  <div className="flex-1" />
                  <span className="font-mono text-[10px] text-muted-foreground shrink-0">#{e.blockNumber.toLocaleString()}</span>
                  <Link href={`/app/audit/tx/${e.txHash}`} className="hover:underline shrink-0">
                    <HashChip hash={e.txHash} />
                  </Link>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
