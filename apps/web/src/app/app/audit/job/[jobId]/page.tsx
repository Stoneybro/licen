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

const MOCK_JOBS: any[] = [];
const MOCK_DATASETS: any[] = [];

export default async function AuditJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = MOCK_JOBS.find((j) => j.jobId === jobId);
  if (!job) notFound();

  const dataset = MOCK_DATASETS.find((d) => d.datasetRoot === job.datasetRoot);

  return (
    <div className="flex flex-col min-h-full">
      <AppTopbar title="Audit — Job" />
      <div className="flex-1 p-6 flex flex-col gap-4 max-w-2xl">

        <Button asChild variant="ghost" size="sm" className="h-7 -ml-2 text-xs text-muted-foreground w-fit">
          <Link href="/app/audit">
            <ArrowLeftIcon data-icon="inline-start" />
            Audit log
          </Link>
        </Button>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">Job ID</p>
            <HashChip hash={job.jobId} front={14} back={10} />
          </div>
          <JobStateBadge state={job.state} />
        </div>

        {/* Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Summary</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Dataset</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">{dataset?.label ?? "Unknown"}</span>
                <HashChip hash={job.datasetRoot} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Requester</span>
              <HashChip hash={job.requester} front={10} back={8} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Provider</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">{job.providerId}</span>
                <HashChip hash={job.provider} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Purpose</span>
              <Badge variant="secondary" className="font-mono text-[10px] h-4">{job.purposeLabel}</Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Requested epochs</span>
              <span className="font-mono font-medium">{job.requestedEpochs}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Actual epochs run</span>
              <span className="font-mono font-medium">{job.actualEpochs ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Escrow locked</span>
              <span className="font-mono font-medium">{job.escrow} USDC</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Settled royalty</span>
              <span className="font-mono font-medium">{job.settledAmount ? `${job.settledAmount} USDC` : "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Refund issued</span>
              <span className="font-mono font-medium">{job.refundAmount ? `${job.refundAmount} USDC` : "—"}</span>
            </div>
            {job.resultHash && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Result hash</span>
                  <HashChip hash={job.resultHash} front={10} back={8} />
                </div>
              </>
            )}
            {job.attestationRef && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Attestation ref</span>
                <HashChip hash={job.attestationRef} front={10} back={8} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* On-chain event log */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">On-chain Event Log</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-0 p-0">
            {job.events.map((e, i) => (
              <div key={i} className="flex items-start gap-3 px-6 py-3 border-b border-border last:border-0">
                <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                  <div className="size-1.5 rounded-full bg-muted-foreground" />
                  {i < job.events.length - 1 && <div className="w-px h-6 bg-border" />}
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="font-mono text-[10px] h-4">{e.topic}</Badge>
                    <span className="text-[10px] text-muted-foreground">block #{e.blockNumber.toLocaleString()}</span>
                    <span className="text-[10px] text-muted-foreground">{e.timestamp.replace("T", " ").slice(0, 19)} UTC</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/app/audit/tx/${e.txHash}`} className="hover:underline">
                      <HashChip hash={e.txHash} front={10} back={8} />
                    </Link>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5">
                    {Object.entries(e.args).map(([k, v]) => (
                      <span key={k} className="text-[10px] text-muted-foreground">
                        <span className="text-foreground/60">{k}:</span> {v}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
