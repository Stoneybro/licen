import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, RefreshCwIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AppTopbar } from "@/components/app/app-topbar";
import { HashChip } from "@/components/app/hash-chip";
import { JobStateBadge } from "@/components/app/job-state-badge";
import { MOCK_JOBS, MOCK_DATASETS, type JobState } from "@/lib/mock";

const STATE_ORDER: JobState[] = ["Requested", "Granted", "Running", "Completed"];

const REASON_MAP: Record<string, string> = {
  COMPUTE_OOM: "Compute node ran out of memory during training execution.",
  TTL_EXCEEDED: "Job TTL expired before compute accepted the workload.",
  ATTESTATION_FAILED: "Attestation verification failed for the compute environment.",
};

function getTimelineNodes(state: JobState): { state: JobState | string; status: "completed" | "active" | "pending" | "fork" }[] {
  const nodes: { state: JobState | string; status: "completed" | "active" | "pending" | "fork" }[] = [];

  const mainIdx = STATE_ORDER.indexOf(state as JobState);
  const isFork = state === "Failed" || state === "TimedOut";
  const isRefunded = state === "Refunded";

  STATE_ORDER.forEach((s, i) => {
    if (isFork || isRefunded) {
      if (i < 3) {
        if (s === "Running" && (isFork || isRefunded)) {
          nodes.push({ state: s, status: "completed" });
        } else {
          nodes.push({ state: s, status: i < 3 ? "completed" : "pending" });
        }
      }
    } else {
      if (i <= mainIdx) nodes.push({ state: s, status: i === mainIdx ? "active" : "completed" });
      else nodes.push({ state: s, status: "pending" });
    }
  });

  if (isFork || isRefunded) {
    nodes.push({ state: state === "Refunded" ? "Failed/TimedOut" : state, status: "fork" });
    if (isRefunded) nodes.push({ state: "Refunded", status: "active" });
  }

  return nodes;
}

export default async function JobDetailPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = MOCK_JOBS.find((j) => j.jobId === jobId);
  if (!job) notFound();

  const dataset = MOCK_DATASETS.find((d) => d.datasetRoot === job.datasetRoot);
  const timelineNodes = getTimelineNodes(job.state);
  const epochProgress = job.actualEpochs !== null
    ? Math.round((job.actualEpochs / job.requestedEpochs) * 100)
    : job.state === "Running" ? 45 : job.state === "Requested" || job.state === "Granted" ? 0 : 100;

  const isTerminal = job.state === "Completed" || job.state === "Failed" || job.state === "TimedOut" || job.state === "Refunded";
  const needsRefund = job.state === "Failed" || job.state === "TimedOut";
  const reasonCode = job.events.find((e) => e.topic === "JobFailed" || e.topic === "JobTimedOut")?.args?.reasonCode;

  return (
    <div className="flex flex-col min-h-full">
      <AppTopbar title="Job Detail" />

      <div className="flex-1 p-6 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm" className="h-7 -ml-2 text-xs text-muted-foreground">
                <Link href="/app/jobs">
                  <ArrowLeftIcon data-icon="inline-start" />
                  Jobs
                </Link>
              </Button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <HashChip hash={job.jobId} front={10} back={8} className="text-sm" />
              <JobStateBadge state={job.state} />
              {job.state === "Running" && (
                <Badge variant="outline" className="text-[10px] h-4 animate-pulse">live</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Created {job.createdAt.replace("T", " ").slice(0, 16)} UTC · Updated {job.updatedAt.replace("T", " ").slice(0, 16)} UTC
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {needsRefund && (
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5">
                Request refund
              </Button>
            )}
            {job.state === "Completed" && (
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5">
                Download receipt
              </Button>
            )}
          </div>
        </div>

        {/* Failed / Timeout alert */}
        {(job.state === "Failed" || job.state === "TimedOut") && reasonCode && (
          <Alert>
            <AlertDescription className="text-xs">
              <span className="font-medium">{reasonCode}:</span>{" "}
              {REASON_MAP[reasonCode] ?? "An unknown error occurred."}{" "}
              <span className="text-muted-foreground">A refund will be issued automatically, or you can request it below.</span>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Left column */}
          <div className="flex flex-col gap-4 lg:col-span-2">
            {/* State Timeline */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Job Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="flex flex-col gap-0">
                  {timelineNodes.map((node, i) => {
                    const event = job.events.find((e) => {
                      const topicMap: Record<string, string> = {
                        Requested: "AccessRequested",
                        Granted: "AccessGranted",
                        Running: "JobStarted",
                        Completed: "JobCompleted",
                        Failed: "JobFailed",
                        TimedOut: "JobTimedOut",
                        Refunded: "RefundIssued",
                      };
                      return e.topic === topicMap[node.state as string];
                    });

                    const isLast = i === timelineNodes.length - 1;

                    return (
                      <li key={`${node.state}-${i}`} className="flex gap-4">
                        {/* Line + dot */}
                        <div className="flex flex-col items-center">
                          <div className={`size-2 rounded-full mt-1 shrink-0 ${
                            node.status === "completed" ? "bg-foreground" :
                            node.status === "active" ? "bg-foreground ring-2 ring-foreground/30" :
                            node.status === "fork" ? "bg-muted-foreground" :
                            "bg-border"
                          }`} />
                          {!isLast && (
                            <div className="w-px flex-1 bg-border my-1" style={{ minHeight: "20px" }} />
                          )}
                        </div>

                        {/* Content */}
                        <div className="pb-4 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm font-medium ${
                              node.status === "pending" ? "text-muted-foreground" :
                              node.status === "fork" ? "text-muted-foreground" : ""
                            }`}>
                              {node.state as string}
                            </span>
                            {node.status === "active" && job.state === "Running" && (
                              <Badge variant="outline" className="text-[10px] h-4 animate-pulse">in progress</Badge>
                            )}
                          </div>

                          {event && (
                            <div className="mt-1 flex items-center gap-2 flex-wrap">
                              <HashChip hash={event.txHash} label="tx" />
                              <span className="text-[10px] text-muted-foreground">
                                block {event.blockNumber.toLocaleString()} · {event.timestamp.replace("T", " ").slice(0, 16)} UTC
                              </span>
                            </div>
                          )}

                          {node.status === "active" && job.state === "Running" && (
                            <div className="mt-2 max-w-xs">
                              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                                <span>Epoch progress</span>
                                <span className="font-mono">{epochProgress}%</span>
                              </div>
                              <Progress value={epochProgress} className="h-1" />
                              <p className="text-[10px] text-muted-foreground mt-1">off-chain · orchestrator</p>
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </CardContent>
            </Card>

            {/* Event log */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Event Log</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {job.events.map((e, i) => (
                  <div key={i} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="font-mono text-[10px] h-4">{e.topic}</Badge>
                      <HashChip hash={e.txHash} label="tx" />
                      <span className="text-[10px] text-muted-foreground">
                        #{e.blockNumber.toLocaleString()} · {e.timestamp.replace("T", " ").slice(0, 16)} UTC
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 pl-1">
                      {Object.entries(e.args).map(([k, v]) => (
                        <span key={k} className="font-mono text-[10px] text-muted-foreground">
                          <span className="text-foreground">{k}</span>=<span>{v}</span>
                        </span>
                      ))}
                    </div>
                    {i < job.events.length - 1 && <Separator className="mt-1" />}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-4">
            {/* Escrow Ledger */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Escrow Ledger</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <LedgerRow label="Locked" value={`${job.escrow} lUSD`} txHash={job.events.find((e) => e.topic === "AccessGranted")?.txHash} />
                {job.settledAmount && (
                  <LedgerRow label="Settled to publisher" value={`${job.settledAmount} lUSD`} txHash={job.events.find((e) => e.topic === "RoyaltySettled")?.txHash} />
                )}
                {job.refundAmount && (
                  <LedgerRow label="Refunded to you" value={`${job.refundAmount} lUSD`} txHash={job.events.find((e) => e.topic === "RefundIssued")?.txHash} />
                )}
                {!job.settledAmount && !job.refundAmount && (
                  <p className="text-xs text-muted-foreground">Settlement pending job completion.</p>
                )}
                <Separator />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Net cost</span>
                  <span className="font-mono font-medium">
                    {job.settledAmount ?? "pending"} lUSD
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Compute */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Compute</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-xs">
                <InfoRow label="Provider" value={job.providerId} mono={false} />
                <InfoRow label="Provider addr" value={job.provider} mono />
                <InfoRow label="Purpose" value={job.purposeLabel} mono />
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Epochs</span>
                  <div className="flex items-center gap-1.5">
                    {job.actualEpochs !== null ? (
                      <>
                        <span className="font-mono font-medium">{job.actualEpochs}</span>
                        {job.actualEpochs !== job.requestedEpochs && (
                          <span className="text-muted-foreground font-mono">/ {job.requestedEpochs} req</span>
                        )}
                      </>
                    ) : (
                      <span className="font-mono text-muted-foreground">{job.requestedEpochs} requested</span>
                    )}
                  </div>
                </div>
                {job.actualEpochs !== null && job.actualEpochs !== job.requestedEpochs && (
                  <div className="mt-1">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                      <span>actual vs requested</span>
                      <span className="font-mono">{Math.round((job.actualEpochs / job.requestedEpochs) * 100)}%</span>
                    </div>
                    <Progress value={Math.round((job.actualEpochs / job.requestedEpochs) * 100)} className="h-1" />
                    {job.actualEpochs < job.requestedEpochs && (
                      <p className="text-[10px] text-muted-foreground mt-1">refund candidate — delta settled on completion</p>
                    )}
                  </div>
                )}
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">TEE required</span>
                  <Badge variant={dataset?.requireTEE ? "outline" : "secondary"} className="text-[10px] h-4">
                    {dataset?.requireTEE ? "Yes" : "No"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Attestation</span>
                  <Badge variant={job.attestationRef ? "outline" : "secondary"} className="text-[10px] h-4">
                    {job.attestationRef ? "present" : "not yet"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Artifacts */}
            {(job.resultHash || job.attestationRef) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Artifacts</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  {job.resultHash && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">Result hash</span>
                      <HashChip hash={job.resultHash} front={10} back={8} />
                    </div>
                  )}
                  {job.attestationRef && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">Attestation ref</span>
                      <HashChip hash={job.attestationRef} front={10} back={8} />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Policy snapshot */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Policy Snapshot</CardTitle>
                  <Badge variant="secondary" className="text-[10px] h-4">on-chain</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-xs">
                <InfoRow label="Dataset" value={job.datasetRoot} mono />
                <InfoRow label="Manifest" value={dataset?.manifestHash ?? "—"} mono />
                <Separator />
                <InfoRow label="Royalty/epoch" value={`${dataset?.royaltyPerEpoch ?? "—"} lUSD`} mono />
                <InfoRow label="TTL" value={`${dataset?.accessTtlSeconds ?? "—"}s`} mono />
                <InfoRow label="Policy expiry" value={dataset?.policyExpiry.split("T")[0] ?? "—"} mono={false} />
                {needsRefund && (
                  <Button size="sm" className="mt-2 h-8 text-xs w-full">
                    Request refund
                  </Button>
                )}
                {job.state === "Running" && (
                  <Button size="sm" variant="outline" className="mt-2 h-8 text-xs w-full gap-1.5">
                    <RefreshCwIcon className="size-3" />
                    Refresh status
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function LedgerRow({ label, value, txHash }: { label: string; value: string; txHash?: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="font-mono font-medium">{value}</span>
        {txHash && <HashChip hash={txHash} label="tx" />}
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground shrink-0">{label}</span>
      {mono ? (
        <HashChip hash={value} front={6} back={4} />
      ) : (
        <span className="font-medium text-right">{value}</span>
      )}
    </div>
  );
}
