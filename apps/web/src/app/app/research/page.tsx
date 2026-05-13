"use client";

import * as React from "react";
import Link from "next/link";
import { InfoIcon, BookOpenIcon, ArrowRightIcon, Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AppTopbar } from "@/components/app/app-topbar";
import { HashChip } from "@/components/app/hash-chip";
import { JobStateBadge } from "@/components/app/job-state-badge";
import { getOgPublicClient, DATA_POLICY_ABI, getDataPolicyAddress } from "@/lib/publish/onchain";
import { formatUnits } from "viem";
import { usePrivy } from "@privy-io/react-auth";
import { cn } from "@/lib/utils";

export default function ResearcherDashboard() {
  const { user } = usePrivy();
  const walletAddress = user?.wallet?.address;

  const [jobs, setJobs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const fetchAndHydrate = React.useCallback(async (isRefresh = false) => {
    if (!walletAddress) {
      setLoading(false);
      return;
    }

    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const query = `
        query GetMyJobs {
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
            royaltySettled
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

      const hydrated = await Promise.all(
        indexerJobs.map(async (j: any) => {
          let escrow = "0";
          try {
            const policy: any = await publicClient.readContract({
              address: policyAddress,
              abi: DATA_POLICY_ABI,
              functionName: "policies",
              args: [j.datasetRoot as `0x${string}`],
            });
            const royaltyPerEpoch = policy[3] || BigInt(0);
            const total = royaltyPerEpoch * BigInt(j.requestedEpochs);
            escrow = formatUnits(total, 6);
          } catch (err) {
            console.error(`Failed to read policy for dataset ${j.datasetRoot}:`, err);
          }

          return {
            jobId: j.id,
            datasetRoot: j.datasetRoot,
            datasetLabel: `Secure Dataset ${j.datasetRoot.slice(2, 6).toUpperCase()}`,
            requester: j.requester,
            purposeLabel: "NEURAL_RESEARCH",
            requestedEpochs: j.requestedEpochs,
            escrow,
            settledAmount: j.royaltySettled ? formatUnits(BigInt(j.royaltySettled), 6) : null,
            state: j.state,
          };
        })
      );

      setJobs(hydrated);
    } catch (e) {
      console.error("Fetch failed", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [walletAddress]);

  React.useEffect(() => {
    fetchAndHydrate();
  }, [fetchAndHydrate]);

  const activeJobs = jobs.filter((j) =>
    ["Requested", "Granted", "Running"].includes(j.state)
  );
  const completedJobs = jobs.filter((j) => j.state === "Completed");
  const totalSpent = jobs.reduce(
    (acc, j) => acc + parseFloat(j.settledAmount ?? "0"),
    0
  );
  
  const escrowLocked = activeJobs.reduce(
    (acc, j) => acc + parseFloat(j.escrow ?? "0"),
    0
  );

  return (
    <div className="flex flex-col min-h-full">
      <AppTopbar title="Research" />

      <div className="flex-1 p-6 flex flex-col gap-6 max-w-7xl mx-auto w-full">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight">Researcher Dashboard</h2>
            <p className="text-sm text-muted-foreground">
              {loading ? "Loading your research metrics..." : "Overview of your secure AI training activity"}
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-9 gap-2 font-semibold"
            onClick={() => fetchAndHydrate(true)}
            disabled={loading || refreshing || !walletAddress}
          >
            <RefreshCw className={cn("size-3.5", (loading || refreshing) && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {/* Explainer banner */}
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 px-4 py-4">
          <InfoIcon className="size-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Securely browse premium datasets, request fine-tuning access, and train AI models automatically without ever exposing the underlying data. You choose the dataset and epochs, Licen handles the compute orchestration and guarantees your escrow refunds.
          </p>
        </div>

        {/* Stat row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "My Sessions",
              value: jobs.length,
              sub: `${activeJobs.length} active sessions`,
              note: "Total training requests submitted",
            },
            {
              label: "Active Sessions",
              value: activeJobs.length,
              sub: "in flight right now",
              note: "Requested, granted, dispatching, or running",
            },
            {
              label: "Total Spent",
              value: `${totalSpent.toLocaleString()} USDC`,
              sub: "paid to publishers",
              note: "Total settled royalty payments",
            },
            {
              label: "Escrow Locked",
              value: `${escrowLocked.toLocaleString()} USDC`,
              sub: "in policy contracts",
              note: "Upfront payments pending settlement",
            },
          ].map((s) => (
            <Card key={s.label} className="border-border/40 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  {s.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-2xl font-bold tracking-tight tabular-nums">{s.value}</p>
                <p className="text-xs text-muted-foreground font-medium">{s.sub}</p>
                <p className="text-[10px] text-muted-foreground/50 border-t border-border/40 pt-2 mt-2 leading-tight">
                  {s.note}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* My recent jobs */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recent Activity</h3>
            </div>
            <Button asChild size="sm" variant="ghost" className="h-8 text-xs font-semibold hover:bg-foreground/5">
              <Link href="/app/sessions" className="flex items-center gap-1.5">
                View all sessions <ArrowRightIcon className="size-3" />
              </Link>
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground/40" />
            </div>
          ) : !walletAddress ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
                <p className="text-sm font-medium">Wallet not connected</p>
              </CardContent>
            </Card>
          ) : jobs.length === 0 ? (
            <Card className="border-dashed bg-muted/5">
              <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
                <div className="size-12 rounded-full bg-background border flex items-center justify-center mb-2">
                  <BookOpenIcon className="size-6 text-muted-foreground/40" />
                </div>
                <div>
                  <p className="text-sm font-semibold">No active jobs</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[32ch] mx-auto">
                    You haven't requested any training sessions yet.
                  </p>
                </div>
                <Button asChild size="sm" className="h-9 px-6 mt-2 font-bold shadow-sm">
                  <Link href="/app/marketplace">Open Marketplace</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {jobs.slice(0, 6).map((j) => (
                <Link
                  key={j.jobId}
                  href={`/app/sessions/${j.jobId}`}
                  className="group flex flex-col p-4 rounded-xl border border-border/40 bg-background hover:border-foreground/20 hover:shadow-md transition-all"
                >
                  <div className="flex justify-between items-start mb-3">
                    <HashChip hash={j.jobId} front={6} back={4} className="bg-muted/30 group-hover:border-foreground/30 transition-colors" />
                    <JobStateBadge state={j.state as any} />
                  </div>
                  <p className="text-sm font-bold truncate mb-1">{j.datasetLabel}</p>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="font-mono text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded border border-border/20">{j.purposeLabel}</span>
                    <span className="text-[10px] text-muted-foreground">{j.requestedEpochs} epochs</span>
                  </div>
                  <div className="mt-auto pt-3 border-t border-border/20 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">Current Escrow</p>
                      <p className="font-mono text-xs font-bold text-foreground">{j.escrow} USDC</p>
                    </div>
                    {j.settledAmount && (
                      <div className="text-right space-y-0.5">
                         <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">Settled</p>
                         <p className="font-mono text-xs font-bold text-foreground">{j.settledAmount} USDC</p>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Marketplace CTA */}
        <Card className="bg-foreground text-background border-none shadow-xl overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <BookOpenIcon className="size-32" />
          </div>
          <CardHeader className="relative z-10">
            <CardTitle className="text-lg font-bold tracking-tight">Expand your dataset access</CardTitle>
            <CardDescription className="text-background/70 text-xs max-w-2xl">
              Explore thousands of verified datasets available for secure fine-tuning. Filter by research domain, performance metrics, and economic terms.
            </CardDescription>
          </CardHeader>
          <CardContent className="relative z-10 pt-2">
            <Button asChild variant="secondary" className="font-bold h-10 px-8 shadow-lg hover:bg-background/90">
              <Link href="/app/marketplace" className="flex items-center gap-2">
                Browse Full Marketplace <ArrowRightIcon className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
