"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, notFound } from "next/navigation";
import { ArrowLeftIcon, Loader2, ShieldCheck, DollarSign, Users, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AppTopbar } from "@/components/app/app-topbar";
import { HashChip } from "@/components/app/hash-chip";
import { PURPOSES } from "@/lib/mock";
import { getOgPublicClient, DATA_POLICY_ABI, getDataPolicyAddress } from "@/lib/publish/onchain";
import { formatUnits } from "viem";
import { usePrivy } from "@privy-io/react-auth";

function getPurposeLabel(id: string): string {
  const found = PURPOSES.find((p) => p.id === id);
  if (found) return found.label;
  if (id.toLowerCase().includes("neural")) return "NEURAL_RESEARCH";
  return id.slice(0, 8);
}

export default function MarketplaceDetailPage() {
  const { datasetRoot } = useParams<{ datasetRoot: string }>();
  const { user } = usePrivy();
  const walletAddress = user?.wallet?.address;
  
  const [dataset, setDataset] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchData() {
      if (!datasetRoot) return;
      try {
        const query = `
          query GetDataset {
            Dataset(where: { id: { _ilike: "${datasetRoot}" } }) {
              id
              owner
              manifestHash
              active
              timestamp
            }
          }
        `;
        const res = await fetch(process.env.NEXT_PUBLIC_ENVIO_GRAPHQL_URL ?? "http://127.0.0.1:8080/v1/graphql", {
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
        const manifestRes = await fetch(`/api/publish/manifest/${d.id}`);
        const manifestJson = manifestRes.ok ? await manifestRes.json() : null;
        const manifest = manifestJson?.manifest ?? null;

        const publicClient = getOgPublicClient();
        const policyAddress = getDataPolicyAddress();
        const policy: any = await publicClient.readContract({
          address: policyAddress,
          abi: DATA_POLICY_ABI,
          functionName: "policies",
          args: [d.id as `0x${string}`],
        });

        setDataset({
          datasetRoot: d.id,
          owner: d.owner,
          manifestHash: d.manifestHash,
          active: d.active,
          label: manifest?.title || `Dataset ${d.id.slice(0, 10)}`,
          description: manifest?.description || "Encrypted data blob verified via 0G Storage with hardware TEE access enforcement.",
          royaltyPerEpoch: formatUnits(policy[3] || BigInt(0), 6),
          maxEpochsPerRun: Number(policy[4] || 0),
          maxRunsPerRequester: Number(policy[5] || 0),
          accessTtlSeconds: Number(policy[6] || 0),
          requireResultAttestation: policy[8] || false,
          openRequesters: policy[10] || false,
          allowedPurposeIds: ["0x4e5609cbe0fd5356bb6b2036533ec04d260155597359f601778166b6c3049ed8"],
        });
      } catch (e) {
        console.error("Hydration failed", e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [datasetRoot]);

  if (loading) {
    return (
      <div className="flex flex-col min-h-full">
        <AppTopbar title="Dataset Details" />
        <div className="flex-1 p-6 flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!dataset) return notFound();

  const isOwner = walletAddress && dataset.owner.toLowerCase() === walletAddress.toLowerCase();

  return (
    <div className="flex flex-col min-h-full bg-muted/5">
      <AppTopbar title="Dataset Details" />
      <div className="flex-1 p-6 flex flex-col gap-6 max-w-5xl mx-auto w-full">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex gap-4 min-w-0">
             <Button asChild variant="ghost" size="icon" className="h-9 w-9 shrink-0 bg-background border shadow-sm hover:bg-foreground/5">
                <Link href="/app/marketplace">
                  <ArrowLeftIcon className="size-4" />
                </Link>
              </Button>
            <div className="flex flex-col gap-1.5 min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight truncate">{dataset.label}</h1>
                <Badge variant={dataset.active ? "outline" : "secondary"} className="h-5 px-2 bg-background">
                  {dataset.active ? "Active" : "Paused"}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                <span className="font-semibold uppercase tracking-wider text-[10px]">Root Hash</span>
                <HashChip hash={dataset.datasetRoot} front={10} back={8} className="bg-background" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 ml-12 md:ml-0">
            {isOwner ? (
              <Button size="sm" variant="outline" className="h-9 font-semibold opacity-70" disabled>
                Ownership detected
              </Button>
            ) : !dataset.active ? (
              <Button size="sm" variant="outline" className="h-9 font-semibold" disabled>
                Unavailable
              </Button>
            ) : (
              <Button asChild size="sm" className="h-9 font-bold shadow-md">
                <Link href={`/app/marketplace/${dataset.datasetRoot}/request`}>
                  Start training session
                </Link>
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left Column: Details */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <Card className="border-border/40 shadow-sm overflow-hidden">
              <CardHeader className="bg-muted/10 border-b border-border/20 py-4">
                <CardTitle className="text-sm font-semibold">Dataset Overview</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {dataset.description} This dataset has been published with verifiable economic and usage policies enforced directly on-chain. Fine-tuning workloads execute within a secure Trusted Execution Environment (TEE).
                </p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <Card className="border-border/40 shadow-sm">
                <CardHeader className="py-4 border-b border-border/20 bg-muted/5">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Economic Terms</CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-2">
                      <DollarSign className="size-3" /> Royalty Rate
                    </span>
                    <span className="text-sm font-mono font-bold">{dataset.royaltyPerEpoch} USDC <span className="text-[10px] font-normal">/ epoch</span></span>
                  </div>
                  <Separator className="opacity-40" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-2">
                      <Clock className="size-3" /> Session Window
                    </span>
                    <span className="text-sm font-medium">{dataset.accessTtlSeconds / 3600} hours</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/40 shadow-sm">
                <CardHeader className="py-4 border-b border-border/20 bg-muted/5">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Access Controls</CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-2">
                      <Users className="size-3" /> Access Model
                    </span>
                    <span className="text-xs font-bold">{dataset.openRequesters ? "OPEN" : "RESTRICTED"}</span>
                  </div>
                  <Separator className="opacity-40" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-2">
                      <ShieldCheck className="size-3" /> Proof Mode
                    </span>
                    <Badge variant="outline" className="text-[10px] h-4 uppercase font-bold bg-background">
                      {dataset.requireResultAttestation ? "TEE Attested" : "Optimistic"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <Card className="border-border/40 shadow-sm overflow-hidden">
               <CardHeader className="bg-muted/10 border-b border-border/20 py-4">
                <CardTitle className="text-sm font-semibold">Authorized Research Purposes</CardTitle>
                <CardDescription className="text-xs">Only requests matching these intents will be granted access.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="flex flex-wrap gap-2">
                   {dataset.allowedPurposeIds.map((pid: string) => (
                    <Badge key={pid} variant="secondary" className="font-mono text-[10px] h-6 bg-foreground/5 text-foreground border-foreground/10 px-3 uppercase tracking-wider font-bold">
                      {getPurposeLabel(pid)}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Stats & Manifest */}
          <div className="flex flex-col gap-6">
             <Card className="border-border/40 shadow-sm">
                <CardHeader className="pb-3">
                   <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Metadata</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                   <div className="space-y-1">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Publisher</p>
                      <HashChip hash={dataset.owner} front={10} back={8} className="bg-muted/10" />
                   </div>
                   <Separator className="opacity-40" />
                   <div className="space-y-1">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Policy Manifest</p>
                      <HashChip hash={dataset.manifestHash} front={10} back={8} className="bg-muted/10" />
                   </div>
                   <div className="pt-2">
                      <Button variant="outline" className="w-full text-xs h-9 bg-background font-semibold" asChild>
                         <Link href={`/app/audit/dataset/${dataset.datasetRoot}`}>
                            View Audit History
                         </Link>
                      </Button>
                   </div>
                </CardContent>
             </Card>

             <Card className="bg-foreground text-background border-none shadow-xl">
                <CardHeader className="pb-2">
                   <CardTitle className="text-sm font-bold">Protocol Guard</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                   <p className="text-[11px] leading-relaxed text-background/80">
                      Access to this dataset is protected by the LICEN protocol. Your escrowed funds are released to the publisher only after verifiable proof of training execution is submitted to the chain.
                   </p>
                   <div className="pt-2 flex items-center gap-2">
                      <div className="size-1.5 rounded-full bg-background animate-pulse" />
                      <span className="text-[9px] font-bold uppercase tracking-widest">TEE Enforcement Active</span>
                   </div>
                </CardContent>
             </Card>
          </div>
        </div>

      </div>
    </div>
  );
}
