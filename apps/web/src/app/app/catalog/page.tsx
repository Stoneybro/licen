import Link from "next/link";
import { ArrowRightIcon, InfoIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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

export default function CatalogPage() {
  return (
    <div className="flex flex-col min-h-full">
      <AppTopbar title="Catalog" />
      <div className="flex-1 p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{MOCK_DATASETS.length} datasets available</p>
        </div>

        {/* Overview */}
        <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 px-4 py-3">
          <InfoIcon className="size-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            The catalog lists all datasets with an active on-chain policy.
            Each dataset has a <span className="text-foreground font-medium">DataPolicy</span> deployed by its owner
            that defines the royalty rate, allowed training purposes, provider requirements, and epoch caps.
            Pick a dataset, review its terms, and click <span className="text-foreground font-medium">Request access</span> to
            start the escrow flow. Your lUSD is locked upfront, the training job runs on 0G Compute,
            and royalties settle automatically when the job completes — unused escrow is refunded to you.
            Datasets you own show as <span className="text-foreground font-medium">You own this</span> and cannot be requested.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {MOCK_DATASETS.map((d) => {
            const isOwner = d.owner === ME;
            return (
              <Card key={d.datasetRoot} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm font-medium leading-snug">{d.label}</CardTitle>
                      <HashChip hash={d.datasetRoot} className="mt-1" />
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {d.active ? (
                        <Badge variant="outline" className="text-[10px] h-4">Active</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] h-4">Paused</Badge>
                      )}
                      {d.requireTEE && (
                        <Badge variant="outline" className="text-[10px] h-4">TEE Required</Badge>
                      )}
                    </div>
                  </div>
                  <CardDescription className="text-xs mt-1 line-clamp-2">{d.description}</CardDescription>
                </CardHeader>

                <CardContent className="flex flex-col gap-3 flex-1">
                  {/* Pricing */}
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Rate</p>
                      <p className="font-mono font-medium">{d.royaltyPerEpoch} lUSD/ep</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Min escrow</p>
                      <p className="font-mono font-medium">{d.minEscrow} lUSD</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Max epochs</p>
                      <p className="font-mono font-medium">{d.maxEpochsPerRun}/run</p>
                    </div>
                  </div>

                  <Separator />

                  {/* Purposes */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Allowed purposes</p>
                    <div className="flex flex-wrap gap-1">
                      {d.allowedPurposeIds.map((pid) => (
                        <Badge key={pid} variant="secondary" className="text-[10px] h-4 font-mono">
                          {getPurposeLabel(pid)}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-auto pt-2">
                    <span className="text-xs text-muted-foreground">
                      {d.allowedRequesters.length === 0 ? "Open policy" : "Restricted access"}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
                        <Link href={`/app/catalog/${d.datasetRoot}`}>
                          Details
                          <ArrowRightIcon data-icon="inline-end" />
                        </Link>
                      </Button>
                      {isOwner ? (
                        <Button size="sm" variant="outline" className="h-7 text-xs" disabled>
                          You own this
                        </Button>
                      ) : !d.active ? (
                        <Button size="sm" variant="outline" className="h-7 text-xs" disabled>
                          Paused
                        </Button>
                      ) : (
                        <Button asChild size="sm" className="h-7 text-xs">
                          <Link href={`/app/catalog/${d.datasetRoot}/request`}>
                            Request access
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
      </div>
    </div>
  );
}
