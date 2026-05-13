"use client";

import * as React from "react";
import Link from "next/link";
import {
  InfoIcon, Loader2, ArrowRightIcon, CheckCircle2, XCircle,
  Cpu, Clock, Zap, Download, RefreshCw
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { AppTopbar } from "@/components/app/app-topbar";
import { HashChip } from "@/components/app/hash-chip";
import { JobStateBadge } from "@/components/app/job-state-badge";
import { getOgPublicClient, DATA_POLICY_ABI, getDataPolicyAddress } from "@/lib/publish/onchain";
import { formatUnits } from "viem";
import { usePrivy } from "@privy-io/react-auth";
import { cn } from "@/lib/utils";

type JobState = "Requested" | "Granted" | "Dispatching" | "Running" | "Completed" | "Failed" | "TimedOut" | "Refunded";

type HydratedJob = {
  jobId: string;
  datasetRoot: string;
  datasetLabel: string;
  requestedEpochs: number;
  actualEpochs: number | null;
  escrow: string;
  settledAmount: string | null;
  state: JobState;
  createdAt: string;
  updatedAt: string;
  resultHash: string | null;
  failReason: string | null;
};

const ACTIVE_STATES: JobState[] = ["Requested", "Granted", "Dispatching", "Running"];

const STATE_MESSAGE: Record<string, string> = {
  Requested:   "Waiting for orchestrator to pick up your job...",
  Granted:     "Access confirmed. Preparing compute resources...",
  Dispatching: "Decrypting dataset and submitting to compute node...",
  Running:     "Fine-tuning in progress on 0G Compute...",
  Completed:   "Training complete. Royalties settled on-chain.",
  Failed:      "Job failed. Your escrow has been refunded.",
  TimedOut:    "Job timed out. Your escrow has been refunded.",
  Refunded:    "Refund issued to your wallet.",
};

function ElapsedTime({ isoDate }: { isoDate: string }) {
  const [elapsed, setElapsed] = React.useState("");

  React.useEffect(() => {
    const tick = () => {
      const secs = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
      if (secs < 60) setElapsed(`${secs}s ago`);
      else if (secs < 3600) setElapsed(`${Math.floor(secs / 60)}m ago`);
      else setElapsed(`${Math.floor(secs / 3600)}h ago`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isoDate]);

  return <span>{elapsed}</span>;
}

function useJobProgress(jobId: string, isActive: boolean) {
  const [completedEpochs, setCompletedEpochs] = React.useState<number | null>(null);
  const [orchestratorStatus, setOrchestratorStatus] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isActive) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/orchestrator/job-status?jobId=${jobId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.found) {
          setCompletedEpochs(data.completedEpochs ?? 0);
          setOrchestratorStatus(data.status);
        }
      } catch { /* silent */ }
    };

    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [jobId, isActive]);

  return { completedEpochs, orchestratorStatus };
}

function ActiveJobCard({ job }: { job: HydratedJob }) {
  const isRunning = job.state === "Running";
  const isDispatching = job.state === "Dispatching";

  const { completedEpochs, orchestratorStatus } = useJobProgress(
    job.jobId,
    isRunning || isDispatching
  );

  const displayEpochs = isRunning && completedEpochs !== null
    ? completedEpochs
    : (job.actualEpochs ?? null);

  const epochProgress = displayEpochs !== null
    ? Math.round((displayEpochs / job.requestedEpochs) * 100)
    : isRunning ? 5 : 0;

  return (
    <Card className={cn(
      "border transition-all duration-500",
      isRunning ? "border-blue-500/30 shadow-md shadow-blue-500/5" :
      isDispatching ? "border-amber-500/30 shadow-md shadow-amber-500/5" :
      "border-border/50"
    )}>
      <CardContent className="p-5 flex flex-col gap-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <JobStateBadge state={job.state} />
              <span className="text-[10px] text-muted-foreground font-medium">
                <ElapsedTime isoDate={job.updatedAt} />
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {STATE_MESSAGE[job.state]}
            </p>
          </div>
          <Button asChild variant="ghost" size="icon" className="size-7 shrink-0 text-muted-foreground hover:text-foreground">
            <Link href={`/app/sessions/${job.jobId}`}>
              <ArrowRightIcon className="size-3.5" />
            </Link>
          </Button>
        </div>

        <Separator className="opacity-40" />

        {/* Dataset + epochs */}
        <div className="flex items-center justify-between gap-4 text-xs">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">Dataset</span>
            <HashChip hash={job.datasetRoot} />
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">Epochs</span>
            <span className="font-mono font-bold text-sm">
              {displayEpochs !== null ? displayEpochs : "—"}
              <span className="text-muted-foreground font-normal text-xs"> / {job.requestedEpochs}</span>
            </span>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">Locked</span>
            <span className="font-mono font-bold text-sm">{job.escrow} USDC</span>
          </div>
        </div>

        {/* Training progress bar — only for Running state */}
        {isRunning && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="font-semibold flex items-center gap-1.5">
                <Cpu className="size-3" />
                Training Progress
              </span>
              <span className="font-mono font-bold text-foreground">{epochProgress}%</span>
            </div>
            <Progress value={epochProgress} className="h-1.5" />
          </div>
        )}

        {/* Dispatching spinner */}
        {isDispatching && (
          <div className="flex items-center gap-2 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
            <Loader2 className="size-3 animate-spin shrink-0" />
            Preparing secure execution environment...
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function HistoricalJobRow({ job }: { job: HydratedJob }) {
  const isCompleted = job.state === "Completed";
  const isFailed = job.state === "Failed" || job.state === "TimedOut";

  return (
    <div className="flex items-center gap-4 px-4 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer border-b border-border/20 last:border-0">
      <Link href={`/app/sessions/${job.jobId}`} className="flex items-center gap-4 flex-1 min-w-0">
        <div className="shrink-0">
          {isCompleted ? (
            <CheckCircle2 className="size-4 text-foreground" />
          ) : isFailed ? (
            <XCircle className="size-4 text-destructive/60" />
          ) : (
            <div className="size-4 rounded-full border-2 border-border" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <HashChip hash={job.jobId} front={8} back={6} />
            <span className="text-[10px] text-muted-foreground">
              {job.createdAt.replace("T", " ").slice(0, 16)} UTC
            </span>
          </div>
          <HashChip hash={job.datasetRoot} className="mt-1 opacity-60" />
        </div>

        <div className="hidden sm:flex flex-col items-end gap-0.5 shrink-0">
          <span className="font-mono text-xs font-bold">
            {job.actualEpochs ?? job.requestedEpochs} epochs
          </span>
          <span className="text-[10px] text-muted-foreground">
            {job.settledAmount ? `${job.settledAmount} settled` : `${job.escrow} locked`}
          </span>
        </div>

        <div className="shrink-0">
          <JobStateBadge state={job.state} />
        </div>

        {isCompleted && job.resultHash && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[10px] gap-1.5 shrink-0"
            onClick={(e) => {
              e.preventDefault();
              window.open(`/api/mock/model/${job.jobId}`, "_blank");
            }}
          >
            <Download className="size-3" />
            Model
          </Button>
        )}
      </Link>
    </div>
  );
}

export default function SessionsPage() {
  const { user } = usePrivy();
  const walletAddress = user?.wallet?.address;

  const [jobs, setJobs] = React.useState<HydratedJob[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [lastRefresh, setLastRefresh] = React.useState<Date | null>(null);

  const fetchAndHydrate = React.useCallback(async (silent = false) => {
    if (!walletAddress) { setLoading(false); return; }
    if (!silent) setLoading(true);

    try {
      const query = `
        query GetJobs {
          Job(
            where: { requester: { _ilike: "${walletAddress}" } },
            order_by: { timestamp: desc }
          ) {
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
        }
      `;

      const res = await fetch(process.env.NEXT_PUBLIC_ENVIO_GRAPHQL_URL ?? "http://127.0.0.1:8080/v1/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      const json = await res.json();
      const indexerJobs = json.data?.Job || [];

      const publicClient = getOgPublicClient();
      const policyAddress = getDataPolicyAddress();

      const hydrated: HydratedJob[] = await Promise.all(
        indexerJobs.map(async (j: any) => {
          let escrow = "0";
          let settledAmount: string | null = null;

          try {
            const policy: any = await publicClient.readContract({
              address: policyAddress,
              abi: DATA_POLICY_ABI,
              functionName: "policies",
              args: [j.datasetRoot as `0x${string}`],
            });
            const royaltyPerEpoch = policy[3] || BigInt(0);
            escrow = formatUnits(royaltyPerEpoch * BigInt(j.requestedEpochs), 6);
            if (j.royaltySettled) {
              settledAmount = formatUnits(BigInt(j.royaltySettled), 6);
            }
          } catch { /* fallback */ }

          return {
            jobId: j.id,
            datasetRoot: j.datasetRoot,
            datasetLabel: `Dataset ${j.datasetRoot.slice(0, 10)}`,
            requestedEpochs: j.requestedEpochs,
            actualEpochs: j.actualEpochs ?? null,
            escrow,
            settledAmount,
            state: j.state as JobState,
            createdAt: new Date(Number(j.timestamp) * 1000).toISOString(),
            updatedAt: new Date(Number(j.lastUpdatedTimestamp || j.timestamp) * 1000).toISOString(),
            resultHash: j.resultHash ?? null,
            failReason: j.failReason ?? null,
          };
        })
      );

      setJobs(hydrated);
      setLastRefresh(new Date());
    } catch (e) {
      console.error("Fetch failed", e);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  // Initial load
  React.useEffect(() => {
    fetchAndHydrate();
  }, [fetchAndHydrate]);

  // Auto-poll every 8 seconds when there are active jobs
  React.useEffect(() => {
    const hasActive = jobs.some((j) => ACTIVE_STATES.includes(j.state));
    if (!hasActive) return;

    const id = setInterval(() => fetchAndHydrate(true), 8000);
    return () => clearInterval(id);
  }, [jobs, fetchAndHydrate]);

  const activeJobs = jobs.filter((j) => ACTIVE_STATES.includes(j.state));
  const historyJobs = jobs.filter((j) => !ACTIVE_STATES.includes(j.state));

  return (
    <div className="flex flex-col min-h-full">
      <AppTopbar title="My Sessions" />
      <div className="flex-1 p-6 flex flex-col gap-6 max-w-3xl mx-auto w-full">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Training Sessions</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {loading
                ? "Fetching sessions..."
                : `${jobs.length} session${jobs.length !== 1 ? "s" : ""}${lastRefresh ? ` · updated ${lastRefresh.toLocaleTimeString()}` : ""}`}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-2 text-xs"
            onClick={() => fetchAndHydrate()}
            disabled={loading}
          >
            <RefreshCw className={cn("size-3", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
          <InfoIcon className="size-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your USDC is locked in escrow when you submit a request. 0G Compute nodes fine-tune the model inside a secure enclave — once complete, royalties are settled on-chain and any unused escrow is returned to you automatically.
          </p>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <Loader2 className="size-6 animate-spin text-muted-foreground/40" />
          </div>
        ) : !walletAddress ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-sm font-semibold">Wallet not connected</p>
              <p className="text-xs text-muted-foreground max-w-[32ch]">Connect your wallet to view your training sessions.</p>
            </CardContent>
          </Card>
        ) : jobs.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
              <div className="size-14 rounded-2xl bg-muted/50 flex items-center justify-center">
                <Zap className="size-7 text-muted-foreground/40" />
              </div>
              <div>
                <p className="text-sm font-semibold">No training sessions yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[36ch]">
                  Head to the Marketplace to discover datasets and start your first fine-tuning run.
                </p>
              </div>
              <Button asChild size="sm" className="h-9 px-6 font-bold shadow-sm mt-1">
                <Link href="/app/marketplace">Explore Marketplace</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-6">

            {/* Active jobs — rich animated cards */}
            {activeJobs.length > 0 && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active</span>
                  <div className="flex-1 h-px bg-border/40" />
                  <Badge variant="outline" className="text-[10px] h-4 font-mono">{activeJobs.length}</Badge>
                </div>
                {activeJobs.map((job) => (
                  <ActiveJobCard key={job.jobId} job={job} />
                ))}
              </div>
            )}

            {/* Historical jobs — compact table-style list */}
            {historyJobs.length > 0 && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">History</span>
                  <div className="flex-1 h-px bg-border/40" />
                  <Badge variant="outline" className="text-[10px] h-4 font-mono">{historyJobs.length}</Badge>
                </div>
                <Card className="border-border/40 shadow-sm overflow-hidden">
                  <CardContent className="p-0">
                    {historyJobs.map((job) => (
                      <HistoricalJobRow key={job.jobId} job={job} />
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
