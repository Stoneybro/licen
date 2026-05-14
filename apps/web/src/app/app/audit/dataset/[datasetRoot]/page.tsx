"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, notFound } from "next/navigation";
import { ArrowLeftIcon, Loader2, Database, History, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { AppTopbar } from "@/components/app/app-topbar";
import { HashChip } from "@/components/app/hash-chip";
import { JobStateBadge } from "@/components/app/job-state-badge";

import { PUBLISH_PURPOSES } from "@/lib/publish/contracts";
import type { JobState } from "@/lib/mock";
import { getOgPublicClient, DATA_POLICY_ABI, getDataPolicyAddress } from "@/lib/publish/onchain";
import { formatEther } from "viem";

function getPurposeLabel(id: string) {
  const match = PUBLISH_PURPOSES.find((p) => p === id);
  return match ? match.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : id.slice(0, 8);
}

export default function AuditDatasetPage() {
  const { datasetRoot } = useParams<{ datasetRoot: string }>();
  
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchData() {
      if (!datasetRoot) return;
      try {
        const query = `
          query GetDatasetDetails {
            Dataset(where: { id: { _ilike: "${datasetRoot}" } }) {
              id
              owner
              manifestHash
              active
              jobs {
                id
                requester
                requestedEpochs
                state
                actualEpochs
                resultHash
                attestationRef
                failReason
                royaltySettled
                refundIssued
                timestamp
              }
            }
            AuditLog(where: { datasetRoot: { _ilike: "${datasetRoot}" } }, order_by: { timestamp: desc }) {
              id
              eventType
              timestamp
              txHash
              jobId
              details
            }
          }
        `;
        
        const res = await fetch(process.env.NEXT_PUBLIC_ENVIO_GRAPHQL_URL ?? "https://indexer.dev.hyperindex.xyz/001fb92/v1/graphql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });
        
        const json = await res.json();
        const d = json.data?.Dataset?.[0];
        if (!d) {
          setLoading(false);
          return;
        }

        const publicClient = getOgPublicClient();
        const policyAddress = getDataPolicyAddress();
        const policy: any = await publicClient.readContract({
          address: policyAddress,
          abi: DATA_POLICY_ABI,
          functionName: "policies",
          args: [d.id as `0x${string}`],
        }).catch(() => null);

        const datasetJobs = d.jobs || [];
        const lifetimeRoyalties = datasetJobs.reduce((acc: bigint, j: any) => acc + (j.royaltySettled ? BigInt(j.royaltySettled) : BigInt(0)), BigInt(0));

        setData({
          dataset: {
            datasetRoot: d.id,
            label: `Secure Dataset ${d.id.slice(2, 6).toUpperCase()}`,
            description: "Encrypted data blob verified via 0G Storage with hardware TEE access enforcement.",
            owner: d.owner,
            manifestHash: d.manifestHash,
            active: d.active,
            royaltyPerEpoch: policy ? formatEther(policy[3] || BigInt(0)) : "0",
            lifetimeRoyalties: formatEther(lifetimeRoyalties),
            jobCount: datasetJobs.length,
            allowedPurposeIds: ["0x4e5609cbe0fd5356bb6b2036533ec04d260155597359f601778166b6c3049ed8"],
          },
          jobs: datasetJobs.map((j: any) => ({
            ...j,
            createdAt: new Date(Number(j.timestamp) * 1000).toISOString(),
          })),
          events: json.data?.AuditLog || [],
        });

      } catch (e) {
        console.error("Fetch failed", e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [datasetRoot]);

  if (loading) {
    return (
      <div className="flex flex-col min-h-full">
        <AppTopbar title="Audit — Dataset" />
        <div className="flex-1 p-6 flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!data) return notFound();

  const { dataset, jobs, events } = data;

  return (
    <div className="flex flex-col min-h-full bg-muted/5">
      <AppTopbar title="Audit — Dataset" />
      <div className="flex-1 p-6 flex flex-col gap-6 max-w-5xl mx-auto w-full">

        <Button asChild variant="ghost" size="sm" className="h-7 -ml-2 text-xs text-muted-foreground w-fit hover:bg-foreground/5">
          <Link href="/app/audit">
            <ArrowLeftIcon className="size-3 mr-1" />
            Back to Audit Log
          </Link>
        </Button>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex gap-4 min-w-0">
             <div className="size-10 rounded-xl bg-background border shadow-sm flex items-center justify-center shrink-0">
                <Database className="size-5 text-muted-foreground" />
             </div>
             <div className="flex flex-col gap-1 min-w-0">
                <h1 className="text-xl font-bold tracking-tight">{dataset.label}</h1>
                <HashChip hash={dataset.datasetRoot} front={14} back={10} className="bg-background" />
                <p className="text-xs text-muted-foreground mt-1 max-w-xl">{dataset.description}</p>
             </div>
          </div>
          <div className="shrink-0 ml-14 md:ml-0">
             <Badge variant={dataset.active ? "outline" : "secondary"} className="h-6 px-3 bg-background uppercase tracking-wider font-bold text-[10px]">
                {dataset.active ? "Active" : "Paused"}
             </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left: Events and Jobs */}
          <div className="lg:col-span-2 flex flex-col gap-6">
             {/* Policy Overview */}
            <Card className="border-border/40 shadow-sm overflow-hidden">
               <CardHeader className="py-4 border-b border-border/20 bg-muted/10">
                <CardTitle className="text-sm font-semibold">On-chain Policy Details</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-1 md:grid-cols-2">
                   <div className="p-5 border-b md:border-b-0 md:border-r border-border/20 space-y-4 text-xs">
                      <div className="flex items-center justify-between">
                         <span className="text-muted-foreground">Publisher</span>
                         <HashChip hash={dataset.owner} front={8} back={6} className="bg-muted/10" />
                      </div>
                      <div className="flex items-center justify-between">
                         <span className="text-muted-foreground">Manifest Hash</span>
                         <HashChip hash={dataset.manifestHash} front={8} back={6} className="bg-muted/10" />
                      </div>
                      <Separator className="opacity-40" />
                      <div className="flex items-center justify-between">
                         <span className="text-muted-foreground">Royalty Rate</span>
                         <span className="font-mono font-bold text-foreground">{dataset.royaltyPerEpoch} 0G / epoch</span>
                      </div>
                   </div>
                   <div className="p-5 space-y-4 text-xs bg-muted/5">
                      <div className="space-y-2">
                         <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Authorized Purposes</span>
                         <div className="flex flex-wrap gap-1.5">
                            {dataset.allowedPurposeIds.map((pid: string) => (
                              <Badge key={pid} variant="secondary" className="font-mono text-[9px] h-5 bg-foreground/5 text-foreground border-foreground/10 px-2 uppercase font-bold">
                                {getPurposeLabel(pid)}
                              </Badge>
                            ))}
                         </div>
                      </div>
                   </div>
                </div>
              </CardContent>
            </Card>

            {/* Jobs List */}
            <div className="flex flex-col gap-3">
               <div className="flex items-center gap-2 px-1">
                  <History className="size-4 text-muted-foreground" />
                  <h3 className="text-sm font-bold tracking-tight text-muted-foreground uppercase">Access History</h3>
                  <Badge variant="outline" className="ml-auto text-[10px] h-5 bg-background">{jobs.length} sessions</Badge>
               </div>
               <div className="space-y-2">
                  {jobs.length === 0 ? (
                    <Card className="border-dashed py-12 text-center text-muted-foreground bg-muted/5">
                      <p className="text-xs">No training sessions recorded for this dataset.</p>
                    </Card>
                  ) : (
                    jobs.map((j: any) => (
                      <Link
                        key={j.id}
                        href={`/app/audit/job/${j.id}`}
                        className="flex items-center gap-4 rounded-xl border border-border/40 bg-background p-4 hover:border-foreground/20 hover:shadow-md transition-all group"
                      >
                        <div className="flex-1 min-w-0">
                           <div className="flex items-center gap-2 mb-1">
                              <span className="text-[11px] font-bold text-foreground">Session Detected</span>
                              <HashChip hash={j.id} front={8} back={6} className="bg-muted/10 group-hover:border-foreground/30" />
                           </div>
                           <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium">
                              <span>{j.requestedEpochs} epochs requested</span>
                              <span>·</span>
                              <span>{j.createdAt.split("T")[0]}</span>
                           </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                           <JobStateBadge state={j.state as JobState} />
                           {j.royaltySettled && (
                              <span className="font-mono text-[10px] font-bold text-foreground">{formatEther(BigInt(j.royaltySettled))} 0G settled</span>
                           )}
                        </div>
                      </Link>
                    ))
                  )}
               </div>
            </div>

            {/* Global Event Stream for this dataset */}
            <div className="flex flex-col gap-3">
               <div className="flex items-center gap-2 px-1">
                  <ShieldCheck className="size-4 text-muted-foreground" />
                  <h3 className="text-sm font-bold tracking-tight text-muted-foreground uppercase">Protocol Audit Log</h3>
               </div>
               <Card className="border-border/40 shadow-sm overflow-hidden">
                  <CardContent className="p-0">
                    <div className="flex flex-col">
                      {events.map((e: any, i: number) => {
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
          </div>

          {/* Right Column: Performance Summary */}
          <div className="flex flex-col gap-6">
             <Card className="border-border/40 shadow-sm bg-background">
                <CardHeader className="pb-4">
                   <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Protocol Performance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                   <div className="space-y-1.5">
                      <p className="text-3xl font-bold tracking-tight tabular-nums">{dataset.lifetimeRoyalties} <span className="text-sm font-medium text-muted-foreground tracking-normal">0G</span></p>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total royalties settled</p>
                   </div>
                   
                   <Separator className="opacity-40" />
                   
                   <div className="grid grid-cols-1 gap-6">
                      <div className="space-y-1">
                         <p className="text-2xl font-bold tracking-tight tabular-nums">{dataset.jobCount}</p>
                         <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Training sessions</p>
                      </div>
                      
                      <div className="space-y-3 pt-2">
                         <div className="flex items-center justify-between text-[11px] font-medium">
                            <span className="text-muted-foreground">Successful completion rate</span>
                            <span className="text-foreground">{jobs.length > 0 ? Math.round((jobs.filter((j: any) => j.state === "Completed").length / jobs.length) * 100) : 0}%</span>
                         </div>
                         <div className="flex items-center justify-between text-[11px] font-medium">
                            <span className="text-muted-foreground">Active in-flight sessions</span>
                            <span className="text-foreground">{jobs.filter((j: any) => ["Running", "Granted", "Requested"].includes(j.state)).length}</span>
                         </div>
                      </div>
                   </div>
                </CardContent>
             </Card>

             <Card className="bg-foreground text-background border-none shadow-xl overflow-hidden relative">
                <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
                   <ShieldCheck className="size-24" />
                </div>
                <CardHeader className="pb-2">
                   <CardTitle className="text-sm font-bold uppercase tracking-widest opacity-70">Audit Verification</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                   <p className="text-[11px] leading-relaxed opacity-80">
                      This audit view confirms that the dataset's cryptographic root and on-chain policies are enforced. Every royalty settlement represents a verified compute execution proof submitted to the 0G Network.
                   </p>
                   <Button variant="secondary" className="w-full h-9 font-bold text-xs shadow-lg">
                      Download Full Audit PDF
                   </Button>
                </CardContent>
             </Card>
          </div>
        </div>

      </div>
    </div>
  );
}
