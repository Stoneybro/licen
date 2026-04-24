import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, PencilIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AppTopbar } from "@/components/app/app-topbar";
import { HashChip } from "@/components/app/hash-chip";
import { JobStateBadge } from "@/components/app/job-state-badge";
import { MOCK_DATASETS, MOCK_JOBS, PURPOSES } from "@/lib/mock";

function getPurposeLabel(id: string): string {
  return PURPOSES.find((p) => p.id === id)?.label ?? id.slice(0, 8);
}

export default async function DatasetDetailPage({ params }: { params: Promise<{ datasetRoot: string }> }) {
  const { datasetRoot } = await params;
  const dataset = MOCK_DATASETS.find((d) => d.datasetRoot === datasetRoot);
  if (!dataset) notFound();

  const datasetJobs = MOCK_JOBS.filter((j) => j.datasetRoot === dataset.datasetRoot);

  return (
    <div className="flex flex-col min-h-full">
      <AppTopbar title="Dataset" />
      <div className="flex-1 p-6 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Button asChild variant="ghost" size="sm" className="h-7 -ml-2 text-xs text-muted-foreground w-fit">
              <Link href="/app/datasets">
                <ArrowLeftIcon data-icon="inline-start" />
                My Datasets
              </Link>
            </Button>
            <h2 className="text-base font-semibold">{dataset.label}</h2>
            <HashChip hash={dataset.datasetRoot} front={10} back={8} />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant={dataset.active ? "outline" : "secondary"} className="text-xs">
              {dataset.active ? "Active" : "Paused"}
            </Badge>
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5">
              <PencilIcon data-icon="inline-start" />
              Edit policy
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="flex flex-col gap-4 lg:col-span-2">
            {/* Jobs table */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Access Jobs ({datasetJobs.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6 text-xs">Job ID</TableHead>
                      <TableHead className="text-xs">Requester</TableHead>
                      <TableHead className="text-xs">Purpose</TableHead>
                      <TableHead className="text-xs text-right">Epochs</TableHead>
                      <TableHead className="text-xs text-right pr-6">Royalty</TableHead>
                      <TableHead className="text-xs">State</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {datasetJobs.map((j) => (
                      <TableRow key={j.jobId} className="cursor-pointer hover:bg-muted/40">
                        <TableCell className="pl-6">
                          <Link href={`/app/jobs/${j.jobId}`} className="block">
                            <HashChip hash={j.jobId} front={8} back={6} />
                          </Link>
                        </TableCell>
                        <TableCell>
                          <HashChip hash={j.requester} />
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{j.purposeLabel}</span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {j.actualEpochs ?? j.requestedEpochs}
                        </TableCell>
                        <TableCell className="text-right pr-6 font-mono text-xs">
                          {j.settledAmount ? `${j.settledAmount} lUSD` : "—"}
                        </TableCell>
                        <TableCell>
                          <JobStateBadge state={j.state} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Policy card */}
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Policy</CardTitle>
                  <Badge variant="secondary" className="text-[10px] h-4">on-chain</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-xs">
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground">Manifest hash</span>
                  <HashChip hash={dataset.manifestHash} front={8} back={6} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Rate</span>
                  <span className="font-mono font-medium">{dataset.royaltyPerEpoch} lUSD/epoch</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Min escrow</span>
                  <span className="font-mono font-medium">{dataset.minEscrow} lUSD</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Max epochs/run</span>
                  <span className="font-mono font-medium">{dataset.maxEpochsPerRun}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Max runs/requester</span>
                  <span className="font-mono font-medium">{dataset.maxRunsPerRequester}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">TTL</span>
                  <span className="font-mono font-medium">{dataset.accessTtlSeconds}s</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Policy expiry</span>
                  <span className="font-medium">{dataset.policyExpiry.split("T")[0]}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">TEE required</span>
                  <Badge variant={dataset.requireTEE ? "outline" : "secondary"} className="text-[10px] h-4">
                    {dataset.requireTEE ? "Yes" : "No"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Attestation</span>
                  <Badge variant={dataset.requireResultAttestation ? "outline" : "secondary"} className="text-[10px] h-4">
                    {dataset.requireResultAttestation ? "Required" : "Optional"}
                  </Badge>
                </div>
                <Separator />
                <div>
                  <span className="text-muted-foreground block mb-1.5">Allowed purposes</span>
                  <div className="flex flex-wrap gap-1">
                    {dataset.allowedPurposeIds.map((pid) => (
                      <Badge key={pid} variant="secondary" className="text-[10px] h-4 font-mono">
                        {getPurposeLabel(pid)}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Access</span>
                  <span className="font-medium">{dataset.allowedRequesters.length === 0 ? "Open" : "Restricted"}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Lifetime royalties</span>
                  <span className="font-mono font-medium">{dataset.lifetimeRoyalties} lUSD</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
