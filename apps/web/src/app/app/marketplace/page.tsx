"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRightIcon, InfoIcon, Loader2 } from "lucide-react";
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

export default function MarketplacePage() {
  const { user } = usePrivy();
  const walletAddress = user?.wallet?.address;

  const [datasets, setDatasets] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchAndHydrate() {
      try {
        const query = `
          query GetDatasets {
            Dataset(where: { active: { _eq: true } }, order_by: { timestamp: desc }) {
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
        const indexerDatasets = json.data?.Dataset || [];

        const publicClient = getOgPublicClient();
        const policyAddress = getDataPolicyAddress();

        const hydrated = await Promise.all(
          indexerDatasets.map(async (d: any) => {
            try {
              const policy: any = await publicClient.readContract({
                address: policyAddress,
                abi: DATA_POLICY_ABI,
                functionName: "policies",
                args: [d.id as `0x${string}`],
              });

              return {
                datasetRoot: d.id,
                owner: d.owner,
                active: d.active,
                label: `Dataset ${d.id.slice(0, 10)}`,
                description: "Encrypted data blob verified via 0G Storage with hardware TEE access enforcement.",
                royaltyPerEpoch: formatUnits(policy[3] || BigInt(0), 6),
                maxEpochsPerRun: policy[4] || 0,
                maxRunsPerRequester: policy[5] || 0,
                openRequesters: policy[10] || false,
                allowedPurposeIds: ["0x4e5609cbe0fd5356bb6b2036533ec04d260155597359f601778166b6c3049ed8"],
              };
            } catch (err) {
              console.error(`Failed to hydrate dataset ${d.id}:`, err);
              return null;
            }
          })
        );

        setDatasets(hydrated.filter(Boolean));
      } catch (e) {
        console.error("Fetch failed", e);
      } finally {
        setLoading(false);
      }
    }

    fetchAndHydrate();
  }, []);

  return (
    <div className="flex flex-col min-h-full">
      <AppTopbar title="Marketplace" />
      <div className="flex-1 p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {loading ? "Discovering datasets..." : `${datasets.length} datasets available`}
          </p>
        </div>

        {/* Overview */}
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
          <InfoIcon className="size-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Browse datasets available for AI training. Each one is published by its owner with specific usage rules and a royalty rate. Click <span className="text-foreground font-medium">Start training</span> to request access — your payment is locked securely upfront and released to the owner only once your training session completes.
          </p>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : datasets.length === 0 ? (
          <Card className="border-dashed mt-4">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <InfoIcon className="size-8 text-muted-foreground/40" />
              <div>
                <p className="text-sm font-medium text-foreground">No datasets available</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[36ch]">
                  There are currently no active datasets in the marketplace. Check back later when publishers have uploaded new data.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {datasets.map((d) => {
              const isOwner = walletAddress && d.owner.toLowerCase() === walletAddress.toLowerCase();
              return (
                <Card key={d.datasetRoot} className="flex flex-col border-border/40 shadow-sm hover:border-border/80 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-sm font-semibold tracking-tight leading-snug">{d.label}</CardTitle>
                        <HashChip hash={d.datasetRoot} className="mt-1" />
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {d.active ? (
                          <Badge variant="outline" className="text-[10px] h-4 bg-background">Active</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] h-4">Paused</Badge>
                        )}
                      </div>
                    </div>
                    <CardDescription className="text-xs mt-1.5 line-clamp-2 leading-relaxed">{d.description}</CardDescription>
                  </CardHeader>
  
                  <CardContent className="flex flex-col gap-4 flex-1">
                    {/* Pricing */}
                    <div className="grid grid-cols-3 gap-2 text-[11px] bg-muted/10 p-2.5 rounded-md border border-border/20">
                      <div>
                        <p className="text-muted-foreground uppercase tracking-wider font-bold text-[9px]">Rate</p>
                        <p className="font-mono font-bold text-foreground">{d.royaltyPerEpoch} USDC</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground uppercase tracking-wider font-bold text-[9px]">Max epochs</p>
                        <p className="font-mono font-bold text-foreground">{d.maxEpochsPerRun}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground uppercase tracking-wider font-bold text-[9px]">Limit</p>
                        <p className="font-mono font-bold text-foreground">{d.maxRunsPerRequester} runs</p>
                      </div>
                    </div>
  
                    <Separator className="opacity-40" />
  
                    {/* Purposes */}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Allowed Research Domains</p>
                      <div className="flex flex-wrap gap-1.5">
                        {d.allowedPurposeIds.map((pid: string) => (
                          <Badge key={pid} variant="secondary" className="text-[10px] h-5 font-mono px-2 bg-foreground/5 text-foreground border-foreground/10">
                            {getPurposeLabel(pid)}
                          </Badge>
                        ))}
                      </div>
                    </div>
  
                    <div className="flex items-center justify-between mt-auto pt-4">
                      <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                        <div className="size-1.5 rounded-full bg-muted-foreground/40" />
                        {d.openRequesters ? "OPEN ACCESS" : "RESTRICTED ACCESS"}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button asChild size="sm" variant="ghost" className="h-8 text-xs font-medium hover:bg-foreground/5">
                          <Link href={`/app/marketplace/${d.datasetRoot}`}>
                            View Details
                            <ArrowRightIcon className="size-3 ml-1.5" />
                          </Link>
                        </Button>
                        {isOwner ? (
                          <Button size="sm" variant="outline" className="h-8 text-xs font-semibold opacity-70" disabled>
                            Ownership detected
                          </Button>
                        ) : !d.active ? (
                          <Button size="sm" variant="outline" className="h-8 text-xs font-semibold" disabled>
                            Unavailable
                          </Button>
                        ) : (
                          <Button asChild size="sm" className="h-8 text-xs font-bold shadow-sm">
                            <Link href={`/app/marketplace/${d.datasetRoot}/request`}>
                              Start training
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
