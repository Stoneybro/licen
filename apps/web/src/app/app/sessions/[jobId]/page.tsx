"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, notFound } from "next/navigation";
import { ArrowLeftIcon, RefreshCwIcon, Loader2 } from "lucide-react";
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
import { cn } from "@/lib/utils";

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

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const fetchAndHydrate = React.useCallback(async (isRefresh = false) => {
    if (!jobId) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
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
      
      const res = await fetch(process.env.NEXT_PUBLIC_ENVIO_GRAPHQL_URL ?? "http://127.0.0.1:8080/v1/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      
      const json = await res.json();
      const jobData = json.data?.Job?.[0];
      if (!jobData) {
        setLoading(false);
        return;
      }
      const summaryRes = await fetch("/api/app/dataset-summaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetRoots: [jobData.datasetRoot],
          includeJobStats: false,
        }),
      });
      const summaryJson = summaryRes.ok ? await summaryRes.json() : { datasets: [] };
      const datasetSummary = summaryJson.datasets?.[0] ?? null;

      const publicClient = getOgPublicClient();
      const policyAddress = getDataPolicyAddress();
      let policyDetails: any = null;
      let escrow = "0";

      try {
        const policy: any = await publicClient.readContract({
          address: policyAddress,
          abi: DATA_POLICY_ABI,
          functionName: "policies",
          args: [jobData.datasetRoot as `0x${string}`],
        });
        policyDetails = policy;
        const royaltyPerEpoch = policy[3] || BigInt(0);
        const total = royaltyPerEpoch * BigInt(jobData.requestedEpochs);
        escrow = formatUnits(total, 6);
      } catch (err) {
        console.error(`Failed to read policy for dataset ${jobData.datasetRoot}:`, err);
      }

      setJob({
        ...jobData,
        datasetLabel: datasetSummary?.title || `Dataset ${jobData.datasetRoot.slice(0, 10)}`,
        purposeLabel: "NEURAL_RESEARCH",
        providerId: "0G Compute",
        provider: "0x0000000000000000000000000000000000000000",
        escrow,
        createdAt: new Date(Number(jobData.timestamp) * 1000).toISOString(),
        updatedAt: new Date(Number(jobData.lastUpdatedTimestamp) * 1000).toISOString(),
        events: json.data.AuditLog || [],
        policySnapshot: policyDetails ? {
          manifestHash: policyDetails[2],
          royaltyPerEpoch: formatUnits(policyDetails[3], 6),
          accessTtlSeconds: Number(policyDetails[6]),
          policyExpiry: new Date(Number(policyDetails[7]) * 1000).toISOString()
        } : null,
      });

    } catch (e) {
      console.error("Hydration failed", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [jobId]);

  React.useEffect(() => {
    fetchAndHydrate();
  }, [fetchAndHydrate]);

  // Poll while the job is in any active (non-terminal) state
  const ACTIVE_STATES = ["Requested", "Granted", "Dispatching", "Running"];
  React.useEffect(() => {
    if (!job || !ACTIVE_STATES.includes(job.state)) return;

    const interval = setInterval(() => {
      fetchAndHydrate(true);
    }, 8000);

    return () => clearInterval(interval);
  }, [job?.state, fetchAndHydrate]);

  if (loading) {
    return (
      <div className="flex flex-col min-h-full">
        <AppTopbar title="Session Detail" />
        <div className="flex-1 p-6 flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!job) return null;

  const timelineNodes = getTimelineNodes(job.state);
  const epochProgress = job.actualEpochs !== null
    ? Math.round((job.actualEpochs / job.requestedEpochs) * 100)
    : job.state === "Running" ? 45 : job.state === "Requested" || job.state === "Granted" ? 0 : 100;

  const needsRefund = job.state === "Failed" || job.state === "TimedOut";
  const reasonCode = job.failReason;

  return (
    <div className="flex flex-col min-h-full bg-muted/5">
      <AppTopbar title="Session Detail" />

      <div className="flex-1 p-6 flex flex-col gap-6 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex gap-4 min-w-0">
             <Button asChild variant="ghost" size="icon" className="h-9 w-9 shrink-0 bg-background border shadow-sm hover:bg-foreground/5">
                <Link href="/app/sessions">
                  <ArrowLeftIcon className="size-4" />
                </Link>
              </Button>
            <div className="flex flex-col gap-1.5 min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold tracking-tight">Session</h1>
                <HashChip hash={job.id} front={10} back={8} className="bg-background" />
                <JobStateBadge state={job.state as any} />
              </div>
              <p className="text-xs text-muted-foreground">
                Created {job.createdAt.replace("T", " ").slice(0, 16)} UTC · Last move {job.updatedAt.replace("T", " ").slice(0, 16)} UTC
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-12 md:ml-0">
            <Button 
               variant="outline" 
               size="sm" 
               className="h-9 font-semibold gap-2"
               onClick={() => fetchAndHydrate(true)}
               disabled={refreshing}
            >
              <RefreshCwIcon className={cn("size-3.5", refreshing && "animate-spin")} />
              Refresh
            </Button>
            {needsRefund && (
              <Button size="sm" className="h-9 font-bold shadow-md">
                Claim Refund
              </Button>
            )}
          </div>
        </div>

        {/* Failed / Timeout alert */}
        {(job.state === "Failed" || job.state === "TimedOut") && reasonCode && (
          <Alert variant="destructive" className="bg-destructive/5 border-destructive/20 text-destructive">
            <AlertDescription className="text-xs font-medium">
              <span className="font-bold">{reasonCode}:</span>{" "}
              {REASON_MAP[reasonCode] ?? "An unexpected error occurred during execution."}{" "}
              Your escrow will be released for refund.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left column */}
          <div className="flex flex-col gap-6 lg:col-span-2">
            {/* Timeline */}
            <Card className="border-border/40 shadow-sm">
              <CardHeader className="py-4 border-b border-border/20 bg-muted/10">
                <CardTitle className="text-sm font-semibold">Job Lifecycle</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
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
                      <li key={`${node.state}-${i}`} className="flex gap-6">
                        {/* Line + dot */}
                        <div className="flex flex-col items-center">
                          <div className={cn(
                            "size-2.5 rounded-full mt-1.5 shrink-0 transition-all duration-500",
                            node.status === "completed" ? "bg-foreground" :
                            node.status === "active" ? "bg-foreground ring-4 ring-foreground/10 animate-pulse" :
                            node.status === "fork" ? "bg-muted-foreground/40" :
                            "bg-border/60"
                          )} />
                          {!isLast && (
                            <div className="w-px flex-1 bg-border/40 my-1" style={{ minHeight: "40px" }} />
                          )}
                        </div>

                        {/* Content */}
                        <div className="pb-8 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn(
                              "text-sm font-bold tracking-tight",
                              node.status === "pending" ? "text-muted-foreground/60" :
                              node.status === "fork" ? "text-muted-foreground/60" : "text-foreground"
                            )}>
                              {node.state as string}
                            </span>
                            {node.status === "active" && job.state === "Running" && (
                              <Badge variant="outline" className="text-[10px] h-4 uppercase tracking-widest font-bold bg-background">processing</Badge>
                            )}
                          </div>

                          {event && (
                            <div className="mt-2 flex flex-col gap-1.5">
                              <div className="flex items-center gap-2">
                                 <HashChip hash={event.txHash} label="tx" className="bg-muted/20" />
                                 <span className="text-[10px] text-muted-foreground font-medium">
                                   {new Date(Number(event.timestamp) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC
                                 </span>
                              </div>
                            </div>
                          )}

                          {node.status === "active" && job.state === "Running" && (
                            <div className="mt-4 max-w-sm bg-muted/20 p-3 rounded-lg border border-border/40">
                              <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                                <span>Training Progress</span>
                                <span className="font-mono text-foreground">{epochProgress}%</span>
                              </div>
                              <Progress value={epochProgress} className="h-1.5 bg-muted/40" />
                              <p className="text-[10px] text-muted-foreground mt-2 font-medium">
                                Fine-tuning dataset on 0G Compute node...
                              </p>
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </CardContent>
            </Card>

            {/* Event log detail */}
            <Card className="border-border/40 shadow-sm overflow-hidden">
               <CardHeader className="py-4 border-b border-border/20 bg-muted/10">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Protocol Audit Log</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="flex flex-col">
                  {job.events.map((e: any, i: number) => {
                    const args = e.details ? JSON.parse(e.details) : {};
                    return (
                      <div key={i} className="flex flex-col gap-2 p-5 border-b border-border/20 last:border-0 hover:bg-muted/5 transition-colors">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                             <Badge variant="secondary" className="font-mono text-[9px] font-bold h-5 bg-foreground text-background border-none px-1.5">
                               {e.eventType}
                             </Badge>
                             <HashChip hash={e.txHash} label="tx" front={8} back={6} className="bg-muted/10" />
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono font-medium">
                            {new Date(Number(e.timestamp) * 1000).toISOString().replace("T", " ").slice(0, 19)}
                          </span>
                        </div>
                        {Object.keys(args).length > 0 && (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 mt-1">
                            {Object.entries(args).map(([k, v]) => (
                              <div key={k} className="flex items-center gap-1.5 min-w-0">
                                <span className="text-[9px] font-bold text-muted-foreground uppercase shrink-0">{k}:</span>
                                <span className="text-[10px] font-mono text-foreground truncate">{String(v)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-6">
            {/* Payment Summary */}
            <Card className="border-border/40 shadow-sm bg-background">
              <CardHeader className="pb-4">
                <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Escrow Settlement</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <LedgerRow label="Initial Escrow" value={`${job.escrow} USDC`} isBold />
                  {job.royaltySettled && (
                    <LedgerRow label="Publisher Payout" value={`${formatUnits(BigInt(job.royaltySettled), 6)} USDC`} color="text-foreground" />
                  )}
                  {job.refundIssued && (
                    <LedgerRow label="Researcher Refund" value={`${formatUnits(BigInt(job.refundIssued), 6)} USDC`} color="text-foreground" />
                  )}
                </div>
                
                <Separator className="opacity-40" />
                
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Final Cost</span>
                  <p className="text-xl font-bold tracking-tight tabular-nums">
                    {job.royaltySettled ? `${formatUnits(BigInt(job.royaltySettled), 6)} USDC` : "Pending"}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Workload Specs */}
            <Card className="border-border/40 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Workload Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                <div className="space-y-1">
                   <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Secure Dataset</p>
                   <p className="font-bold truncate">{job.datasetLabel}</p>
                   <HashChip hash={job.datasetRoot} className="mt-1 bg-muted/20" />
                </div>
                <Separator className="opacity-20" />
                <div className="space-y-3">
                  <InfoRow label="Compute Cluster" value={job.providerId} />
                  <InfoRow label="TEEvaddr" value={job.provider} mono />
                  <InfoRow label="Intent" value={job.purposeLabel} />
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Requested Epochs</span>
                    <span className="font-mono font-bold">{job.requestedEpochs}</span>
                  </div>
                  {job.actualEpochs !== null && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-muted-foreground">Actual Run-time</span>
                      <span className="font-mono font-bold text-foreground">{job.actualEpochs} epochs</span>
                    </div>
                  )}
                </div>
                <Separator className="opacity-20" />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Hardware Proof</span>
                  <Badge variant={job.attestationRef ? "outline" : "secondary"} className="text-[9px] font-bold uppercase tracking-wider h-5 px-2">
                    {job.attestationRef ? "verified" : "pending"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Results */}
            {job.resultHash && (
              <Card className="border-border/40 shadow-sm bg-foreground text-background border-none overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                   <RefreshCwIcon className="size-20 rotate-12" />
                </div>
                <CardHeader className="pb-2">
                  <CardTitle className="text-[10px] font-bold uppercase tracking-widest opacity-70">Training Artifacts</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <p className="text-[9px] font-bold uppercase tracking-tighter opacity-60">Result Root Hash</p>
                    <HashChip hash={job.resultHash} front={10} back={8} className="bg-background/10 border-background/20 text-background" />
                  </div>
                  <Button
                    variant="secondary"
                    className="w-full h-9 font-bold text-xs shadow-lg"
                    onClick={() => window.open(`/api/mock/model/${job.id}`, "_blank")}
                  >
                    Download LoRA Adapter
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LedgerRow({ label, value, color, isBold }: { label: string; value: string; color?: string; isBold?: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground font-medium">{label}</span>
      <span className={cn("font-mono", isBold ? "font-bold text-sm" : "font-medium", color)}>{value}</span>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground font-medium shrink-0">{label}</span>
      {mono ? (
        <HashChip hash={value} front={6} back={4} className="bg-muted/20" />
      ) : (
        <span className="font-bold text-right truncate">{value}</span>
      )}
    </div>
  );
}
