import Link from "next/link";
import { InfoIcon, BookOpenIcon, ArrowRightIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AppTopbar } from "@/components/app/app-topbar";
import { HashChip } from "@/components/app/hash-chip";
import { JobStateBadge } from "@/components/app/job-state-badge";
import { getOgPublicClient, DATA_POLICY_ABI, getDataPolicyAddress } from "@/lib/publish/onchain";
import { formatUnits } from "viem";

async function fetchJobsFromEnvio() {
  const query = `
    query GetJobs {
      Job(order_by: { timestamp: desc }) {
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
  try {
    const res = await fetch(process.env.NEXT_PUBLIC_ENVIO_GRAPHQL_URL ?? process.env.NEXT_PUBLIC_ENVIO_GRAPHQL_URL ?? "http://127.0.0.1:8080/v1/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data?.Job || [];
  } catch (e) {
    console.error("Envio fetch failed", e);
    return [];
  }
}

async function hydrateJobs() {
  const indexerJobs = await fetchJobsFromEnvio();
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
        escrow = formatUnits(total, 18);
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
        settledAmount: j.royaltySettled ? formatUnits(BigInt(j.royaltySettled), 18) : null,
        state: j.state,
      };
    })
  );

  return hydrated;
}

export default async function ResearcherDashboard() {
  const myJobs = await hydrateJobs();
  const activeJobs = myJobs.filter((j) =>
    ["Requested", "Granted", "Running"].includes(j.state)
  );
  const completedJobs = myJobs.filter((j) => j.state === "Completed");
  const totalSpent = myJobs.reduce(
    (acc, j) => acc + parseFloat(j.settledAmount ?? "0"),
    0
  );
  
  // Calculate locked escrow across active jobs
  const escrowLocked = activeJobs.reduce(
    (acc, j) => acc + parseFloat(j.escrow ?? "0"),
    0
  );

  return (
    <div className="flex flex-col min-h-full">
      <AppTopbar title="Research" />

      <div className="flex-1 p-6 flex flex-col gap-6">

        {/* Explainer banner */}
        <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 px-4 py-3">
          <InfoIcon className="size-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Securely browse premium datasets, request fine-tuning access, and train AI models automatically without ever exposing the underlying data. You choose the dataset and epochs, Licen handles the compute orchestration and guarantees your escrow refunds.
          </p>
        </div>

        {/* Stat row */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            {
              label: "My Sessions",
              value: myJobs.length,
              sub: `${activeJobs.length} active sessions`,
              note: "Training sessions you have requested across all datasets",
            },
            {
              label: "Active Sessions",
              value: activeJobs.length,
              sub: "running on 0G compute",
              note: "Active sessions execute securely until completion or failure.",
            },
            {
              label: "Total Spent",
              value: `${totalSpent.toLocaleString()} USDC`,
              sub: "paid directly to owners",
              note: "Total royalties you've paid from completed AI training sessions",
            },
            {
              label: "Total Completed",
              value: completedJobs.length,
              sub: escrowLocked > 0 ? `${escrowLocked} USDC locked` : "no active escrow",
              note: "Number of times you have successfully trained models on licensed datasets",
            },
          ].map((s) => (
            <Card key={s.label}>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {s.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1">
                <p className="text-xl font-semibold tabular-nums">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.sub}</p>
                <p className="text-[11px] text-muted-foreground/60 leading-relaxed border-t border-border pt-1.5 mt-0.5">
                  {s.note}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* My recent jobs */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">My Sessions</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                A summary of your training sessions. Go to{" "}
                <Link href="/app/sessions" className="underline underline-offset-2 hover:text-foreground">My Sessions</Link>{" "}
                to view full execution details, manage each one and request new ones.
              </p>
            </div>
            <Button asChild size="sm" variant="ghost" className="h-7 text-xs shrink-0">
              <Link href="/app/sessions">
                View all <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </Button>
          </div>

          {myJobs.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                <BookOpenIcon className="size-8 text-muted-foreground/40" />
                <div>
                  <p className="text-sm font-medium">No jobs yet</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[36ch]">
                    Browse the marketplace to find a dataset and submit your first training request.
                  </p>
                </div>
                <Button asChild size="sm" className="h-7 text-xs gap-1 mt-1">
                  <Link href="/app/marketplace">browse marketplace →</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {myJobs.slice(0, 6).map((j) => (
                <Link
                  key={j.jobId}
                  href={`/app/sessions/${j.jobId}`}
                  className="group flex items-center gap-3 rounded-md border border-border px-4 py-3 hover:border-foreground/20 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{j.datasetLabel}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <HashChip hash={j.jobId} />
                      <span className="text-[10px] text-muted-foreground/60">·</span>
                      <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1 py-0.5 rounded">{j.purposeLabel}</span>
                      <span className="text-[10px] text-muted-foreground/60">·</span>
                      <span className="text-[10px] text-muted-foreground">{j.requestedEpochs} epochs requested</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="font-mono text-xs font-medium">{j.escrow} USDC</p>
                      <p className="text-[10px] text-muted-foreground">
                        {j.settledAmount ? `${j.settledAmount} settled` : "escrow locked"}
                      </p>
                    </div>
                    <JobStateBadge state={j.state as any} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Marketplace CTA */}
        <Card className="bg-muted/20">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <BookOpenIcon className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Browse the Marketplace</CardTitle>
            </div>
            <CardDescription className="text-xs">
              A summary of available datasets. Go to{" "}
              <Link href="/app/marketplace" className="underline underline-offset-2 hover:text-foreground">Marketplace</Link>{" "}
              to filter by purpose, check policy terms, and submit a training request.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-muted-foreground mb-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-foreground font-medium">1. Find a dataset</span>
                <span>Filter by purpose, rate, and TEE requirements</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-foreground font-medium">2. Configure & escrow</span>
                <span>Set epoch count, approve USDC, lock escrow in one tx</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-foreground font-medium">3. Job completes</span>
                <span>0G Compute runs fine-tuning; royalties settle on-chain</span>
              </div>
            </div>
            <Separator className="mb-4" />
            <Button asChild size="sm" className="h-7 text-xs gap-1">
              <Link href="/app/marketplace">
                <BookOpenIcon data-icon="inline-start" />
                open marketplace
              </Link>
            </Button>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
