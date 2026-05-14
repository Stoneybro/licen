"use client";

import * as React from "react";
import Link from "next/link";
import { InfoIcon, ArrowRightIcon, DatabaseIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AppTopbar } from "@/components/app/app-topbar";
import { HashChip } from "@/components/app/hash-chip";
import { usePrivy } from "@privy-io/react-auth";

export default function PublisherDashboard() {
  const { user } = usePrivy();
  const walletAddress = user?.wallet?.address;

  const [myDatasets, setMyDatasets] = React.useState<any[]>([]);
  const [activeJobsOnMyDatasets, setActiveJobsOnMyDatasets] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchDashboardData() {
      if (!walletAddress) return;
      try {
        const res = await fetch("/api/app/dataset-summaries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ownerAddress: walletAddress, includeJobStats: true }),
        });
        const json = await res.json();
        const datasets = (json.datasets ?? []).map((d: any) => ({
          datasetRoot: d.datasetRoot,
          active: d.active,
          label: d.title,
          royaltyPerEpoch: d.policy?.royaltyPerEpoch ?? 0,
          lifetimeRoyalties: `${Number(d.stats?.lifetimeRoyalties ?? 0) / 1_000_000}`,
          jobCount: d.stats?.jobCount ?? 0,
          activeJobCount: d.stats?.activeJobCount ?? 0,
        }));

        setMyDatasets(datasets);
        setActiveJobsOnMyDatasets(
          datasets.filter((d: any) => d.activeJobCount > 0)
        );
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    if (walletAddress) {
      fetchDashboardData();
    } else {
      setLoading(false);
    }
  }, [walletAddress]);

  if (loading) {
    return (
      <div className="flex flex-col min-h-full">
        <AppTopbar title="Publish" />
        <div className="flex-1 p-6 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const activeDatasets = myDatasets.filter((d) => d.active);
  const totalRoyalties = myDatasets.reduce((acc, d) => acc + parseFloat(d.lifetimeRoyalties.replace(",", "")), 0);
  const totalJobs = myDatasets.reduce((acc, d) => acc + d.jobCount, 0);

  return (
    <div className="flex flex-col min-h-full">
      <AppTopbar title="Publish" />
      <div className="flex-1 p-6 flex flex-col gap-6">

        {/* Explainer banner */}
        <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 px-4 py-3">
          <InfoIcon className="size-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
           Securely upload your datasets, set your own usage rules, and earn royalties automatically every time an AI model trains on your data. You control the price and the permissions, Licen handles the enforcement and guarantees your payments.
          </p>
        </div>

        {/* Stat row */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">My Datasets</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <p className="text-xl font-semibold tabular-nums">{myDatasets.length}</p>
              <p className="text-xs text-muted-foreground">{activeDatasets.length} active datasets</p>
              <p className="text-[11px] text-muted-foreground/60 leading-relaxed border-t border-border pt-1.5 mt-0.5">
                Datasets you have uploaded and made available for AI training
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Active Policies</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <p className="text-xl font-semibold tabular-nums">{activeDatasets.length}</p>
              <p className="text-xs text-muted-foreground">accepting requests now</p>
              <p className="text-[11px] text-muted-foreground/60 leading-relaxed border-t border-border pt-1.5 mt-0.5">
               Active policies can receive researcher requests until paused or expired.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Earnings</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <p className="text-xl font-semibold tabular-nums">{totalRoyalties.toLocaleString()} USDC</p>
              <p className="text-xs text-muted-foreground">paid directly to your wallet</p>
              <p className="text-[11px] text-muted-foreground/60 leading-relaxed border-t border-border pt-1.5 mt-0.5">
                Total royalties you've earned from completed AI training sessions
              </p>
            </CardContent>
          </Card>

          <Card className={activeJobsOnMyDatasets.length > 0 ? "border-foreground/30" : ""}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Training Sessions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <p className="text-xl font-semibold tabular-nums">{totalJobs}</p>
              <div className="flex items-center gap-1.5">
                {activeJobsOnMyDatasets.length > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-foreground animate-pulse" />
                    <span className="text-xs font-medium">{activeJobsOnMyDatasets.length} running now</span>
                  </span>
                )}
                {activeJobsOnMyDatasets.length === 0 && (
                  <p className="text-xs text-muted-foreground">none in flight</p>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground/60 leading-relaxed border-t border-border pt-1.5 mt-0.5">
                {activeJobsOnMyDatasets.length > 0
                  ? "Payments are securely locked, you get paid as soon as they finish"
                  : "Number of times AI researchers have trained models on your datasets"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Datasets summary table */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">My Datasets</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                A summary of your published datasets. Go to{" "}
                <Link href="/app/datasets" className="underline underline-offset-2 hover:text-foreground">My Datasets</Link>{" "}
                to view full policy details, manage each one and create new ones.
              </p>
            </div>
            <Button asChild size="sm" variant="ghost" className="h-7 text-xs shrink-0">
              <Link href="/app/datasets">
                Manage all <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </Button>
          </div>

          {myDatasets.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                <DatabaseIcon className="size-8 text-muted-foreground/40" />
                <div>
                  <p className="text-sm font-medium">No datasets yet</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[36ch]">
                    Publish your first dataset and start earning royalties securely on-chain.
                  </p>
                </div>
                <Button asChild size="sm" className="h-7 text-xs gap-1 mt-1">
                  <Link href="/app/datasets/new">Publish new dataset →</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6 text-xs">Dataset</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Rate</TableHead>
                      <TableHead className="text-xs text-right">Earnings</TableHead>
                      <TableHead className="text-xs text-right pr-6">Sessions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myDatasets.map((d) => (
                      <TableRow key={d.datasetRoot} className="cursor-pointer hover:bg-muted/40">
                        <TableCell className="pl-6">
                          <Link href={`/app/datasets/${d.datasetRoot}`} className="block">
                            <p className="text-sm font-medium">{d.label}</p>
                            <HashChip hash={d.datasetRoot} className="mt-0.5" />
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant={d.active ? "outline" : "secondary"} className="text-[10px] h-4">
                            {d.active ? "Active" : "Paused"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{d.royaltyPerEpoch} USDC/epoch</TableCell>
                        <TableCell className="text-right font-mono text-xs">{d.lifetimeRoyalties} USDC</TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex items-center justify-end gap-2">
                            <span className="font-mono text-xs">{d.jobCount}</span>
                            {d.activeJobCount > 0 && (
                              <Badge variant="outline" className="text-[10px] h-4 bg-muted/50">{d.activeJobCount} active</Badge>
                            )}
                          </div>
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
    </div>
  );
}
