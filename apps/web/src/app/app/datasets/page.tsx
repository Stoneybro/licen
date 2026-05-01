import Link from "next/link";
import { PlusIcon, InfoIcon, DatabaseIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AppTopbar } from "@/components/app/app-topbar";
import { HashChip } from "@/components/app/hash-chip";
import { MOCK_DATASETS } from "@/lib/mock";

const ME = "0x4f3a8b2c1d9e6f7a0b5c3d2e1f8a9b4c5d6e7f80";

export default function DatasetsPage() {
  const myDatasets = MOCK_DATASETS.filter((d) => d.owner === ME);

  return (
    <div className="flex flex-col min-h-full">
      <AppTopbar title="My Datasets" />
      <div className="flex-1 p-6 flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-sm text-muted-foreground">
              {myDatasets.length} published dataset{myDatasets.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Button asChild size="sm" className="h-8 gap-1.5 shrink-0">
            <Link href="/app/datasets/new">
              <PlusIcon data-icon="inline-start" />
              Publish dataset
            </Link>
          </Button>
        </div>

        {/* Overview note */}
        <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 px-4 py-3">
          <InfoIcon className="size-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Each dataset you publish is protected by secure usage rules that you define.  You control the price, the allowed purposes, and the limits. Researchers can request access only under the terms you set.
          </p>
        </div>

        {/* Dataset cards */}
        {myDatasets.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <DatabaseIcon className="size-8 text-muted-foreground/40" />
              <div>
                <p className="text-sm font-medium">No datasets yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[36ch]">
                 Publish an encrypted dataset, set its training rules, and make it available for approved researcher requests.
                </p>
              </div>
              <Button asChild size="sm" className="h-7 text-xs gap-1 mt-1">
                <Link href="/app/datasets/new">
                  <PlusIcon data-icon="inline-start" />
                  Publish your first dataset
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {myDatasets.map((d) => (
              <Card key={d.datasetRoot} className="hover:border-foreground/20 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <CardTitle className="text-sm font-medium truncate">{d.label}</CardTitle>
                      <HashChip hash={d.datasetRoot} />
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge variant={d.active ? "outline" : "secondary"} className="text-[10px] h-4">
                        {d.active ? "Active" : "Paused"}
                      </Badge>
                      {d.openRequesters && (
                        <Badge variant="secondary" className="text-[10px] h-4">Open</Badge>
                      )}
                    </div>
                  </div>
                  <CardDescription className="text-xs mt-1 line-clamp-2">{d.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-muted-foreground">Rate</span>
                      <span className="font-mono font-medium">{d.royaltyPerEpoch} lUSD/epoch</span>
                      <span className="text-[10px] text-muted-foreground/60">charged per epoch run</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-muted-foreground">Royalties earned</span>
                      <span className="font-mono font-medium">{d.lifetimeRoyalties} lUSD</span>
                      <span className="text-[10px] text-muted-foreground/60">settled lifetime</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-muted-foreground">Training Sessions</span>
                      <span className="font-mono font-medium">{d.jobCount}</span>
                      <span className="text-[10px] text-muted-foreground/60">
                        {d.activeJobCount > 0 ? `${d.activeJobCount} running now` : "none active"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-muted-foreground">Max epochs/session</span>
                      <span className="font-mono font-medium">{d.maxEpochsPerRun}</span>
                      <span className="text-[10px] text-muted-foreground/60">per request</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-muted-foreground">Max sessions</span>
                      <span className="font-mono font-medium">{d.maxRunsPerRequester}/researcher</span>
                      <span className="text-[10px] text-muted-foreground/60">lifetime cap</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-muted-foreground">Expires</span>
                      <span className="font-mono font-medium">{d.policyExpiry.split("T")[0]}</span>
                      <span className="text-[10px] text-muted-foreground/60">policy end date</span>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground/60">
                      {d.openRequesters ? "Open to all researchers" : `${d.allowedRequesters.length} approved researcher${d.allowedRequesters.length !== 1 ? "s" : ""}`}
                      {d.requireResultAttestation ? " · proof required" : ""}
                    </p>
                    <Button asChild size="sm" variant="ghost" className="h-6 text-xs">
                      <Link href={`/app/datasets/${d.datasetRoot}`}>Manage →</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
