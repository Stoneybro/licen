import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AppTopbar } from "@/components/app/app-topbar";
import { HashChip } from "@/components/app/hash-chip";
import { MOCK_DATASETS, PURPOSES } from "@/lib/mock";

const ME = "0x4f3a8b2c1d9e6f7a0b5c3d2e1f8a9b4c5d6e7f80";

function getPurposeLabel(id: string): string {
  return PURPOSES.find((p) => p.id === id)?.label ?? id.slice(0, 8);
}

export default async function CatalogDetailPage({ params }: { params: Promise<{ datasetRoot: string }> }) {
  const { datasetRoot } = await params;
  const dataset = MOCK_DATASETS.find((d) => d.datasetRoot === datasetRoot);
  if (!dataset) notFound();

  const isOwner = dataset.owner === ME;

  return (
    <div className="flex flex-col min-h-full">
      <AppTopbar title="Dataset Details" />
      <div className="flex-1 p-6 flex flex-col gap-4 max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Button asChild variant="ghost" size="sm" className="h-7 -ml-2 text-xs text-muted-foreground w-fit">
              <Link href="/app/catalog">
                <ArrowLeftIcon data-icon="inline-start" />
                Catalog
              </Link>
            </Button>
            <h2 className="text-base font-semibold">{dataset.label}</h2>
            <HashChip hash={dataset.datasetRoot} front={10} back={8} />
            <p className="text-sm text-muted-foreground mt-1">{dataset.description}</p>
          </div>
          <div className="shrink-0">
            {isOwner ? (
              <Button size="sm" variant="outline" className="h-8 text-xs" disabled>You own this</Button>
            ) : !dataset.active ? (
              <Button size="sm" variant="outline" className="h-8 text-xs" disabled>Policy paused</Button>
            ) : (
              <Button asChild size="sm" className="h-8 text-xs">
                <Link href={`/app/catalog/${dataset.datasetRoot}/request`}>Request access →</Link>
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Policy</CardTitle>
                <Badge variant="secondary" className="text-[10px] h-4">on-chain</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-xs">
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
                <span className="text-muted-foreground">Access TTL</span>
                <span className="font-mono font-medium">{dataset.accessTtlSeconds}s</span>
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
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Access</span>
                <span className="font-medium">{dataset.allowedRequesters.length === 0 ? "Open" : "Restricted"}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Allowed Purposes</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {dataset.allowedPurposeIds.map((pid) => (
                <div key={pid} className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-mono text-xs">{getPurposeLabel(pid)}</Badge>
                </div>
              ))}
              <Separator />
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Manifest</span>
                <HashChip hash={dataset.manifestHash} front={10} back={8} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
