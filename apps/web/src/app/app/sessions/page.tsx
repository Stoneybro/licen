"use client";

import * as React from "react";
import Link from "next/link";
import { InfoIcon, Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AppTopbar } from "@/components/app/app-topbar";
import { HashChip } from "@/components/app/hash-chip";
import { JobStateBadge } from "@/components/app/job-state-badge";
import { getOgPublicClient, DATA_POLICY_ABI, getDataPolicyAddress } from "@/lib/publish/onchain";
import { formatUnits } from "viem";
import { usePrivy } from "@privy-io/react-auth";
import { cn } from "@/lib/utils";

export default function SessionsPage() {
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
            providerId: "0G Compute",
            purposeLabel: "NEURAL_RESEARCH",
            requestedEpochs: j.requestedEpochs,
            actualEpochs: j.actualEpochs,
            escrow,
            settledAmount: j.royaltySettled ? formatUnits(BigInt(j.royaltySettled), 18) : null,
            refundAmount: j.refundIssued ? formatUnits(BigInt(j.refundIssued), 18) : null,
            resultHash: j.resultHash,
            attestationRef: j.attestationRef,
            state: j.state,
            createdAt: new Date(Number(j.timestamp) * 1000).toISOString(),
            updatedAt: new Date(Number(j.lastUpdatedTimestamp) * 1000).toISOString(),
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

  return (
    <div className="flex flex-col min-h-full">
      <AppTopbar title="My Sessions" />
      <div className="flex-1 p-6 flex flex-col gap-6 max-w-7xl mx-auto w-full">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight">Training Sessions</h2>
            <p className="text-sm text-muted-foreground">
              {loading ? "Fetching your history..." : `${jobs.length} session${jobs.length !== 1 ? "s" : ""} found for your wallet`}
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

        {/* Overview */}
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 px-4 py-4">
          <InfoIcon className="size-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            A training session is started when you request access to a dataset. Your payment is locked securely upfront in the policy escrow. 0G Compute nodes execute the fine-tuning workload within a TEE, ensuring the dataset remains encrypted at all times. Once complete, royalties are paid to the owner and any unused escrow is automatically returned to your wallet.
          </p>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-muted-foreground/40" />
          </div>
        ) : !walletAddress ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="size-12 rounded-full bg-muted/50 flex items-center justify-center mb-2">
                <InfoIcon className="size-6 text-muted-foreground/40" />
              </div>
              <div>
                <p className="text-sm font-semibold">Wallet not connected</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[32ch]">
                  Please connect your wallet to view your private training sessions and history.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : jobs.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="size-12 rounded-full bg-muted/50 flex items-center justify-center mb-2">
                <InfoIcon className="size-6 text-muted-foreground/40" />
              </div>
              <div>
                <p className="text-sm font-semibold">No sessions yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[36ch]">
                  You have not requested any training sessions yet. Head to the Marketplace to discover datasets and start your first run.
                </p>
              </div>
              <Button asChild size="sm" className="h-9 px-6 mt-2 font-bold shadow-sm">
                <Link href="/app/marketplace">Explore Marketplace</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/40 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/10">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6 text-[10px] font-bold uppercase tracking-wider">Session Details</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider">Dataset</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider">Domain</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-center">Epochs</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right">Locked Escrow</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider pr-6 text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((j) => (
                    <TableRow key={j.jobId} className="group cursor-pointer hover:bg-muted/30 transition-colors">
                      <TableCell className="pl-6 py-4">
                        <Link href={`/app/sessions/${j.jobId}`} className="block space-y-1">
                          <HashChip hash={j.jobId} front={8} back={6} className="group-hover:border-foreground/40 transition-colors" />
                          <p className="text-[10px] text-muted-foreground ml-1 font-medium">{j.createdAt.split("T")[0]} · {j.createdAt.split("T")[1].slice(0, 5)} UTC</p>
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-[180px]">
                        <p className="text-xs font-semibold truncate">{j.datasetLabel}</p>
                        <HashChip hash={j.datasetRoot} className="mt-1" />
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-mono text-[10px] h-5 bg-foreground/5 text-foreground border-foreground/10 px-2">
                          {j.purposeLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="font-mono text-xs font-bold">
                          {j.actualEpochs !== null ? (
                            <span className="flex items-center justify-center gap-1">
                              {j.actualEpochs}
                              {j.actualEpochs !== j.requestedEpochs && (
                                <span className="text-muted-foreground font-normal">/ {j.requestedEpochs}</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-muted-foreground font-normal">{j.requestedEpochs} req</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <p className="font-mono text-xs font-bold text-foreground">{j.escrow} USDC</p>
                        {j.settledAmount && (
                          <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-tighter">{j.settledAmount} settled</p>
                        )}
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <JobStateBadge state={j.state as any} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
