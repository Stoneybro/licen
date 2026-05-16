"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeftIcon, ClockIcon, UsersIcon, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AppTopbar } from "@/components/app/app-topbar";
import { HashChip } from "@/components/app/hash-chip";
import { JobStateBadge } from "@/components/app/job-state-badge";
import { PURPOSES } from "@/lib/mock";
import { getOgPublicClient, DATA_POLICY_ABI, getDataPolicyAddress } from "@/lib/publish/onchain";
import { formatEther } from "viem";

function getPurposeLabel(id: string): string {
  const found = PURPOSES.find((p) => p.id === id);
  if (found) return found.label;
  if (id.toLowerCase().includes("neural")) return "NEURAL_RESEARCH";
  return id.slice(0, 8);
}

const OPTIONAL_MANIFEST_FIELDS = [
  { key: "legalText", label: "Legal Terms" },
  { key: "usageTaxonomy", label: "Usage Taxonomy" },
  { key: "taskConstraints", label: "Task Constraints" },
  { key: "complianceNotes", label: "Compliance Notes" },
  { key: "attribution", label: "Attribution Rules" },
  { key: "derivativeRights", label: "Derivative Rights" },
] as const;

export default function DatasetDetailPage() {
  const { datasetRoot } = useParams<{ datasetRoot: string }>();
  const [dataset, setDataset] = React.useState<any>(null);
  const [jobs, setJobs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchData = React.useCallback(async (silent = false) => {
    if (!datasetRoot) return;
    if (!silent) setLoading(true);
    try {
        // 1. Fetch Dataset & Jobs from Envio
        const query = `
          query GetDatasetAndJobs {
            Dataset(where: { id: { _ilike: "${datasetRoot}" } }) {
              id
              owner
              manifestHash
              active
              timestamp
            }
            Job(where: { datasetRoot: { _ilike: "${datasetRoot}" } }, order_by: { timestamp: desc }) {
              id
              state
              requestedEpochs
              actualEpochs
              royaltySettled
              timestamp
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
        const jobList = json.data?.Job || [];
        
        if (!d) {
          setLoading(false);
          return;
        }

        // 2. Load manifest from local summary API (FAST)
        const summaryRes = await fetch("/api/publish/manifests/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ datasetRoots: [d.id] }),
        });
        const summaryJson = summaryRes.ok ? await summaryRes.json() : { manifests: {} };
        const manifest = summaryJson.manifests?.[d.id.toLowerCase()] ?? null;

        // 3. Hydrate Policy from On-chain
        const publicClient = getOgPublicClient();
        const policyAddress = getDataPolicyAddress();
        const policy: any = await publicClient.readContract({
          address: policyAddress,
          abi: DATA_POLICY_ABI,
          functionName: "policies",
          args: [d.id as `0x${string}`],
        });

        const lifetimeRoyalties = jobList.reduce((acc: bigint, j: any) => {
          return acc + (j.royaltySettled ? BigInt(j.royaltySettled) : BigInt(0));
        }, BigInt(0));

        setDataset({
          datasetRoot: d.id,
          manifestHash: d.manifestHash,
          manifestUri: manifest?.manifestUri ?? null,
          active: d.active,
          label: manifest?.title || `Secure Dataset ${d.id.slice(2, 6).toUpperCase()}`,
          description: manifest?.description || "Encrypted data blob verified via 0G Storage with hardware TEE access enforcement.",
          createdAt: manifest?.createdAt || null,
          ownerAddress: manifest?.ownerAddress || null,
          legalText: manifest?.legalText || "",
          usageTaxonomy: manifest?.usageTaxonomy || "",
          taskConstraints: manifest?.taskConstraints || "",
          complianceNotes: manifest?.complianceNotes || "",
          attribution: manifest?.attribution || "",
          derivativeRights: manifest?.derivativeRights || "",
          royaltyPerEpoch: formatEther(policy[3] || BigInt(0)),
          maxEpochsPerRun: Number(policy[4] || 0),
          maxRunsPerRequester: Number(policy[5] || 0),
          openRequesters: policy[10] || false,
          requireResultAttestation: policy[8] || false,
          allowedPurposeIds: ["0x4e5609cbe0fd5356bb6b2036533ec04d260155597359f601778166b6c3049ed8"],
          policyExpiry: policy[7] ? new Date(Number(policy[7]) * 1000).toISOString() : "2026-12-31T00:00:00Z",
          lifetimeRoyalties: formatEther(lifetimeRoyalties),
          jobCount: jobList.length,
        });

        setJobs(jobList.map((j: any) => ({
          jobId: j.id,
          state: j.state,
          requestedEpochs: j.requestedEpochs,
          actualEpochs: j.actualEpochs,
          settledAmount: j.royaltySettled ? formatEther(BigInt(j.royaltySettled)) : null,
          createdAt: new Date(Number(j.timestamp) * 1000).toISOString(),
        })));

    } catch (err) {
      console.error("Hydration failed", err);
    } finally {
      setLoading(false);
    }
  }, [datasetRoot]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  React.useEffect(() => {
    if (!datasetRoot) return;
    const id = setInterval(() => fetchData(true), 10000);
    return () => clearInterval(id);
  }, [datasetRoot, fetchData]);

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

  if (!dataset) return null;

  return (
    <div className="flex flex-col min-h-full bg-muted/5">
      <AppTopbar title="Dataset Details" />
      <div className="flex-1 p-6 flex flex-col gap-6 max-w-7xl mx-auto w-full">

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex gap-4 min-w-0">
            <Button asChild variant="ghost" size="icon" className="h-9 w-9 shrink-0 bg-background border shadow-sm">
              <Link href="/app/datasets">
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
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 mt-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-semibold uppercase tracking-wider text-[10px]">Root Hash</span>
                  <HashChip hash={dataset.datasetRoot} front={10} back={8} />
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-semibold uppercase tracking-wider text-[10px]">Manifest</span>
                  <HashChip hash={dataset.manifestHash} front={10} back={8} />
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 ml-12 md:ml-0">
            <Button variant="outline" size="sm" className="h-9 font-semibold">Pause Access</Button>
            <Button size="sm" className="h-9 font-bold shadow-md">Update Policy</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left Column: Details & History */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Overview Card */}
            <Card className="border-border/40 shadow-sm overflow-hidden flex flex-col">
              <CardHeader className="bg-muted/10 border-b border-border/20 py-3 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-semibold">Dataset Overview</CardTitle>
                {dataset.createdAt && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="font-semibold uppercase tracking-wider text-[9px]">Published</span>
                    <span>{new Date(dataset.createdAt).toLocaleString()}</span>
                  </div>
                )}
              </CardHeader>
              <CardContent className="pt-4 pb-5 flex-1">
                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                  {dataset.description}
                </p>
              </CardContent>
              <div className="bg-muted/30 border-t border-border/20 px-6 py-3">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  This dataset is hosted on 0G Storage and its access is strictly enforced by the 0G Compute network via Trusted Execution Environments (TEEs).
                </p>
              </div>
            </Card>

            {OPTIONAL_MANIFEST_FIELDS.some(({ key }) => Boolean(dataset[key])) && (
              <Card className="border-border/40 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/10 border-b border-border/20 py-3">
                  <CardTitle className="text-sm font-semibold">Manifest Details</CardTitle>
                  <CardDescription className="text-xs">Terms and metadata loaded from the public manifest stored on 0G Storage.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5 pt-4">
                  {OPTIONAL_MANIFEST_FIELDS.map(({ key, label }) =>
                    dataset[key] ? (
                      <div key={key} className="space-y-1.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
                        <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{dataset[key]}</p>
                      </div>
                    ) : null
                  )}
                </CardContent>
              </Card>
            )}

            {/* Access Policy Card */}
            <Card className="border-border/40 shadow-sm">
              <CardHeader className="py-4 border-b border-border/20">
                <CardTitle className="text-sm font-semibold">On-chain Access Policy</CardTitle>
                <CardDescription className="text-xs">Rules and economic terms enforced by the smart contract.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-1 md:grid-cols-2">
                  <div className="p-6 border-b md:border-b-0 md:border-r border-border/20 space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Royalty Rate</p>
                        <p className="font-mono text-sm font-bold">{dataset.royaltyPerEpoch} 0G <span className="text-[10px] font-normal text-muted-foreground">/ epoch</span></p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Expiry Date</p>
                        <div className="flex items-center gap-1.5">
                          <ClockIcon className="size-3 text-muted-foreground" />
                          <span className="text-sm font-medium">{dataset.policyExpiry.split("T")[0]}</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Max Epochs / Session</p>
                        <p className="font-mono text-sm font-bold">{dataset.maxEpochsPerRun}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Researcher Limit</p>
                        <p className="text-sm font-medium">{dataset.maxRunsPerRequester} <span className="text-[10px] font-normal text-muted-foreground">runs cap</span></p>
                      </div>
                    </div>
                  </div>
                  <div className="p-6 space-y-6 bg-muted/5">
                    <div className="space-y-3">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Authorized Purposes</p>
                      <div className="flex flex-wrap gap-1.5">
                        {dataset.allowedPurposeIds.map((pid: string) => (
                          <Badge key={pid} variant="secondary" className="font-mono text-[10px] h-5 bg-foreground/5 text-foreground border-foreground/10">
                            {getPurposeLabel(pid)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Access Model</p>
                      {dataset.openRequesters ? (
                        <div className="flex items-center gap-2 text-xs font-semibold">
                          <UsersIcon className="size-3.5 text-muted-foreground" />
                          OPEN ACCESS <span className="text-[10px] font-normal text-muted-foreground">(Any researcher can request)</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs font-semibold">
                          <UsersIcon className="size-3.5 text-muted-foreground" />
                          RESTRICTED ACCESS <span className="text-[10px] font-normal text-muted-foreground">(Whitelisted wallets only)</span>
                        </div>
                      )}
                    </div>
                    {dataset.manifestUri && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Manifest Root</p>
                        <HashChip hash={dataset.manifestUri} front={10} back={8} />
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sessions History */}
            <Card className="border-border/40 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between py-4 border-b border-border/20">
                <div className="space-y-1">
                  <CardTitle className="text-sm font-semibold">Recent Training Activity</CardTitle>
                  <CardDescription className="text-xs">Real-time usage logs for this dataset.</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="h-8 text-xs font-semibold opacity-50 cursor-not-allowed" disabled>
                  Full Audit Trail
                  <Badge variant="outline" className="ml-2 text-[8px] h-3.5 px-1 uppercase tracking-tighter opacity-70">Soon</Badge>
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-muted/10">
                    <TableRow>
                      <TableHead className="pl-6 text-[10px] font-bold uppercase tracking-wider">Session ID</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider text-center">Status</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider text-center">Epochs</TableHead>
                      <TableHead className="text-right pr-6 text-[10px] font-bold uppercase tracking-wider">Royalty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-12">
                          <div className="flex flex-col items-center gap-2">
                            <p className="text-sm font-medium text-muted-foreground">No sessions yet</p>
                            <p className="text-xs text-muted-foreground/60">This dataset hasn't been used for training yet.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      jobs.map((j) => (
                        <TableRow key={j.jobId} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="pl-6">
                            <Link href={`/app/sessions/${j.jobId}`} className="group flex flex-col gap-0.5">
                              <HashChip hash={j.jobId} front={8} back={6} className="group-hover:border-foreground/40 transition-colors" />
                              <span className="text-[10px] text-muted-foreground ml-1">{j.createdAt.split("T")[0]}</span>
                            </Link>
                          </TableCell>
                          <TableCell className="text-center">
                            <JobStateBadge state={j.state} />
                          </TableCell>
                          <TableCell className="text-center text-xs font-mono font-medium">
                            {j.actualEpochs ?? j.requestedEpochs}
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <span className="text-xs font-mono font-bold">{j.settledAmount ?? "-"} 0G</span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Performance Stats */}
          <div className="flex flex-col gap-6">
            <Card className="border-border/40 shadow-sm bg-background">
              <CardHeader className="pb-4">
                <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Revenue Performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-1.5">
                  <p className="text-3xl font-bold tracking-tight tabular-nums">{dataset.lifetimeRoyalties} <span className="text-sm font-medium text-muted-foreground tracking-normal">0G</span></p>
                  <p className="text-xs text-muted-foreground">Total royalties earned life-to-date</p>
                </div>
                
                <Separator className="opacity-40" />
                
                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-1">
                    <p className="text-2xl font-bold tracking-tight tabular-nums">{dataset.jobCount}</p>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Training Runs</p>
                  </div>
                  
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Successful completions</span>
                      <span className="font-bold">{jobs.filter(j => j.state === "Completed").length}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Active in-flight sessions</span>
                      <span className="font-bold">{jobs.filter(j => ["Running", "Granted", "Requested"].includes(j.state)).length}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-border/40 shadow-sm bg-muted/10 border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Management</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start text-xs h-9 bg-background" disabled>
                  Edit Public Manifest
                </Button>
                <Button variant="outline" className="w-full justify-start text-xs h-9 bg-background text-destructive hover:bg-destructive/5 hover:text-destructive border-destructive/20" disabled>
                  Revoke Dataset Access
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

      </div>
    </div>
  );
}
