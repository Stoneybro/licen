"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeftIcon, ClockIcon, UsersIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AppTopbar } from "@/components/app/app-topbar";
import { HashChip } from "@/components/app/hash-chip";
import { PURPOSES } from "@/lib/mock";
import { getOgPublicClient, DATA_POLICY_ABI, getDataPolicyAddress } from "@/lib/publish/onchain";
import { formatUnits } from "viem";

function getPurposeLabel(id: string): string {
  return PURPOSES.find((p) => p.id === id)?.label ?? id.slice(0, 8);
}

export default function DatasetDetailPage() {
  const { datasetRoot } = useParams<{ datasetRoot: string }>();
  const [dataset, setDataset] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchDataset() {
      if (!datasetRoot) return;
      try {
        const query = `
          query GetDataset {
            Dataset(where: { id: { _ilike: "${datasetRoot}" } }) {
              id
              owner
              manifestHash
              active
            }
          }
        `;
        const res = await fetch("http://127.0.0.1:8080/v1/graphql", {
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
        });

        setDataset({
          datasetRoot: d.id,
          manifestHash: d.manifestHash,
          active: d.active,
          label: `Secure Dataset ${d.id.slice(2, 6).toUpperCase()}`,
          description: "Encrypted data blob verified via 0G Storage with hardware TEE access enforcement.",
          royaltyPerEpoch: formatUnits(policy[3] || BigInt(0), 18),
          maxEpochsPerRun: Number(policy[4] || 0),
          maxRunsPerRequester: Number(policy[5] || 0),
          openRequesters: policy[10] || false,
          requireResultAttestation: policy[8] || false,
          allowedPurposeIds: ["0x6e657572616c5f72657365617263680000000000000000000000000000000000"],
          policyExpiry: "2026-12-31T00:00:00Z",
          lifetimeRoyalties: "0",
          jobCount: 0,
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchDataset();
  }, [datasetRoot]);

  if (loading) {
    return (
      <div className="flex flex-col min-h-full">
        <AppTopbar title="Dataset Details" />
        <div className="flex-1 p-6 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading dataset...</p>
        </div>
      </div>
    );
  }

  if (!dataset) return null;

  const datasetJobs: any[] = []; // Clear mock jobs

  return (
    <div className="flex flex-col min-h-full">
      <AppTopbar title="Dataset Details" />
      <div className="flex-1 p-6 flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-start gap-4">
          <Button asChild variant="ghost" size="icon" className="h-8 w-8 mt-0.5 shrink-0">
            <Link href="/app/datasets">
              <ArrowLeftIcon />
            </Link>
          </Button>
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold truncate">{dataset.label}</h1>
              <Badge variant={dataset.active ? "outline" : "secondary"} className="text-[10px] h-4">
                {dataset.active ? "Active" : "Paused"}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>Root:</span>
                <HashChip hash={dataset.datasetRoot} />
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>Manifest:</span>
                <HashChip hash={dataset.manifestHash} />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2 max-w-3xl leading-relaxed">
              {dataset.description}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8">Pause Access</Button>
            <Button size="sm" className="h-8">Update Policy</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Policy & Rules */}
          <div className="md:col-span-2 flex flex-col gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Access Policy</CardTitle>
                <CardDescription className="text-xs">Rules enforced on-chain for this dataset.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 text-sm">
                <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Royalty Rate</span>
                    <span className="font-mono font-medium">{dataset.royaltyPerEpoch} USDC/epoch</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Policy Expiry</span>
                    <div className="flex items-center gap-1.5">
                      <ClockIcon className="size-3.5 text-muted-foreground" />
                      <span>{dataset.policyExpiry.split("T")[0]}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Max Epochs / Request</span>
                    <span className="font-mono">{dataset.maxEpochsPerRun}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Max Sessions / Researcher</span>
                    <span className="font-mono">{dataset.maxRunsPerRequester}</span>
                  </div>
                </div>

                <Separator />

                <div className="flex flex-col gap-3">
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1.5">Allowed Purposes</span>
                    <div className="flex flex-wrap gap-1.5">
                      {dataset.allowedPurposeIds.map((pid: string) => (
                        <Badge key={pid} variant="secondary" className="font-mono text-[10px] h-5">
                          {getPurposeLabel(pid)}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-xs text-muted-foreground block mb-1.5">Allowed Requesters</span>
                    {dataset.openRequesters ? (
                      <div className="flex items-center gap-1.5 text-xs font-medium">
                        <UsersIcon className="size-3.5 text-muted-foreground" />
                        Open to any approved researcher
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                         <div className="flex items-center gap-1.5 text-xs">
                          <UsersIcon className="size-3.5 text-muted-foreground" />
                          Restricted to specific researchers
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sessions History */}
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium">Training Sessions</CardTitle>
                  <CardDescription className="text-xs">History of all training jobs for this dataset.</CardDescription>
                </div>
                <Button asChild variant="outline" size="sm" className="h-7 text-xs">
                  <Link href={`/app/audit/dataset/${dataset.datasetRoot}`}>View Full Audit Log</Link>
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6 text-xs">Job ID</TableHead>
                      <TableHead className="text-xs">State</TableHead>
                      <TableHead className="text-xs">Epochs</TableHead>
                      <TableHead className="text-xs text-right pr-6">Settled (USDC)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {datasetJobs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-6 text-xs text-muted-foreground">
                          No training sessions yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      datasetJobs.map((j) => (
                        <TableRow key={j.jobId}>
                          <TableCell className="pl-6">
                            <Link href={`/app/sessions/${j.jobId}`} className="hover:underline">
                              <HashChip hash={j.jobId} front={8} back={6} />
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge variant={["Completed", "Refunded"].includes(j.state) ? "outline" : "secondary"} className="text-[10px] h-4">
                              {j.state}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-mono">{j.actualEpochs ?? j.requestedEpochs}</TableCell>
                          <TableCell className="text-right pr-6 text-xs font-mono">{j.settledAmount ?? "-"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar Stats */}
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dataset Performance</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-2xl font-semibold tabular-nums">{dataset.lifetimeRoyalties} USDC</span>
                  <span className="text-xs text-muted-foreground">Lifetime royalties earned</span>
                </div>
                <Separator />
                <div className="flex flex-col gap-1">
                  <span className="text-xl font-semibold tabular-nums">{dataset.jobCount}</span>
                  <span className="text-xs text-muted-foreground">Total training sessions</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

      </div>
    </div>
  );
}
