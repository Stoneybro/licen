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
import { getOgPublicClient, DATA_POLICY_ABI, getDataPolicyAddress } from "@/lib/publish/onchain";
import { formatUnits } from "viem";

const STATE_ORDER = ["Requested", "Granted", "Running", "Completed"];

const REASON_MAP: Record<string, string> = {
  COMPUTE_OOM: "Compute node ran out of memory during training execution.",
  TTL_EXCEEDED: "Job TTL expired before compute accepted the workload.",
  ATTESTATION_FAILED: "Attestation verification failed for the compute environment.",
};

function getTimelineNodes(state: string): { state: string; status: "completed" | "active" | "pending" | "fork" }[] {
  const nodes: { state: string; status: "completed" | "active" | "pending" | "fork" }[] = [];

  const mainIdx = STATE_ORDER.indexOf(state);
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

async function fetchJobData(jobId: string) {
  const query = `
    query GetJob {
      Job(where: { id: { _ilike: "${jobId}" } }) {
        id
        datasetRoot
        requester
        requestedEpochs
        state
        timestamp
        txHash
        lastUpdatedTimestamp
        actualEpochs
        resultHash
        attestationRef
        failReason
        royaltySettled
        refundIssued
      }
      AuditLog(where: { jobId: { _ilike: "${jobId}" } }, order_by: { timestamp: asc }) {
        id
        eventType
        timestamp
        txHash
        details
      }
    }
  `;
  try {
    const res = await fetch("http://localhost:8080/v1/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.data?.Job?.[0]) return null;
    return {
      job: json.data.Job[0],
      events: json.data.AuditLog || [],
    };
  } catch (e) {
    console.error("Envio fetch failed", e);
    return null;
  }
}

async function hydrateJob(jobId: string) {
  const data = await fetchJobData(jobId);
  if (!data) return null;

  const publicClient = getOgPublicClient();
  const policyAddress = getDataPolicyAddress();
  let policyDetails: any = null;
  let escrow = "0";

  try {
    const policy: any = await publicClient.readContract({
      address: policyAddress,
      abi: DATA_POLICY_ABI,
      functionName: "policies",
      args: [data.job.datasetRoot as `0x${string}`],
    });
    policyDetails = policy;
    const royaltyPerEpoch = policy[3] || 0n;
    const total = royaltyPerEpoch * BigInt(data.job.requestedEpochs);
    escrow = formatUnits(total, 18);
  } catch (err) {
    console.error(`Failed to read policy for dataset ${data.job.datasetRoot}:`, err);
  }

  return {
    ...data.job,
    datasetLabel: `Secure Dataset ${data.job.datasetRoot.slice(2, 6).toUpperCase()}`,
    purposeLabel: "NEURAL_RESEARCH",
    providerId: "0G Compute",
    provider: "0x0000000000000000000000000000000000000000",
    escrow,
    createdAt: new Date(Number(data.job.timestamp) * 1000).toISOString(),
    updatedAt: new Date(Number(data.job.lastUpdatedTimestamp) * 1000).toISOString(),
    events: data.events,
    policySnapshot: policyDetails ? {
      manifestHash: policyDetails[2],
      royaltyPerEpoch: formatUnits(policyDetails[3], 18),
      accessTtlSeconds: Number(policyDetails[6]),
      policyExpiry: new Date(Number(policyDetails[7]) * 1000).toISOString()
    } : null,
  };
}

export default async function JobDetailPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await hydrateJob(jobId);
  if (!job) notFound();

  const timelineNodes = getTimelineNodes(job.state);
  const epochProgress = job.actualEpochs !== null
    ? Math.round((job.actualEpochs / job.requestedEpochs) * 100)
    : job.state === "Running" ? 45 : job.state === "Requested" || job.state === "Granted" ? 0 : 100;

  const needsRefund = job.state === "Failed" || job.state === "TimedOut";
  const reasonCode = job.failReason;

  return (
    <div className="flex flex-col min-h-full">
      <AppTopbar title="Session Detail" />

      <div className="flex-1 p-6 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm" className="h-7 -ml-2 text-xs text-muted-foreground">
                <Link href="/app/sessions">
                  <ArrowLeftIcon data-icon="inline-start" />
                  My Sessions
                </Link>
              </Button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <HashChip hash={job.id} front={10} back={8} className="text-sm" />
              <JobStateBadge state={job.state as any} />
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
                    const event = job.events.find((e: any) => {
                      const topicMap: Record<string, string> = {
                        Requested: "AccessRequested",
                        Granted: "AccessGranted",
                        Running: "JobStarted",
                        Completed: "JobCompleted",
                        Failed: "JobFailed",
                        TimedOut: "JobTimedOut",
                        Refunded: "RefundIssued",
                      };
                      return e.eventType === topicMap[node.state];
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
                                {new Date(Number(event.timestamp) * 1000).toISOString().replace("T", " ").slice(0, 16)} UTC
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
                {job.events.map((e: any, i: number) => (
                  <div key={i} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="font-mono text-[10px] h-4">{e.eventType}</Badge>
                      <HashChip hash={e.txHash} label="tx" />
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(Number(e.timestamp) * 1000).toISOString().replace("T", " ").slice(0, 16)} UTC
                      </span>
                    </div>
                    {e.details && (
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 pl-1">
                        {Object.entries(JSON.parse(e.details)).map(([k, v]) => (
                          <span key={k} className="font-mono text-[10px] text-muted-foreground">
                            <span className="text-foreground">{k}</span>=<span>{v as React.ReactNode}</span>
                          </span>
                        ))}
                      </div>
                    )}
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
                <CardTitle className="text-sm font-medium">Payment Ledger</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <LedgerRow label="Locked" value={`${job.escrow} lUSD`} txHash={job.events.find((e: any) => e.eventType === "AccessGranted")?.txHash} />
                {job.royaltySettled && (
                  <LedgerRow label="Settled to publisher" value={`${formatUnits(BigInt(job.royaltySettled), 18)} lUSD`} txHash={job.events.find((e: any) => e.eventType === "RoyaltySettled")?.txHash} />
                )}
                {job.refundIssued && (
                  <LedgerRow label="Refunded to you" value={`${formatUnits(BigInt(job.refundIssued), 18)} lUSD`} txHash={job.events.find((e: any) => e.eventType === "RefundIssued")?.txHash} />
                )}
                {!job.royaltySettled && !job.refundIssued && (
                  <p className="text-xs text-muted-foreground">Settlement pending job completion.</p>
                )}
                <Separator />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Net cost</span>
                  <span className="font-mono font-medium">
                    {job.royaltySettled ? formatUnits(BigInt(job.royaltySettled), 18) : "pending"} lUSD
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
                  <span className="text-muted-foreground">Proof required</span>
                  <Badge variant={job.attestationRef ? "outline" : "secondary"} className="text-[10px] h-4">
                    {job.attestationRef ? "verified" : "pending"}
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
                <InfoRow label="Manifest" value={job.policySnapshot?.manifestHash ?? "—"} mono />
                <Separator />
                <InfoRow label="Rate" value={`${job.policySnapshot?.royaltyPerEpoch ?? "—"} lUSD/epoch`} mono={false} />
                <InfoRow label="Session window" value={`${job.policySnapshot?.accessTtlSeconds ?? "—"}s`} mono={false} />
                <InfoRow label="Expires" value={job.policySnapshot?.policyExpiry.split("T")[0] ?? "—"} mono={false} />
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
