import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { AppTopbar } from "@/components/app/app-topbar";
import { HashChip } from "@/components/app/hash-chip";
import { MOCK_JOBS } from "@/lib/mock";

export default async function AuditTxPage({ params }: { params: Promise<{ txHash: string }> }) {
  const { txHash } = await params;

  const match = MOCK_JOBS.flatMap((j) =>
    j.events
      .filter((e) => e.txHash === txHash)
      .map((e) => ({ event: e, job: j }))
  )[0];

  if (!match) notFound();

  const { event, job } = match;

  return (
    <div className="flex flex-col min-h-full">
      <AppTopbar title="Audit — Transaction" />
      <div className="flex-1 p-6 flex flex-col gap-4 max-w-2xl">

        <Button asChild variant="ghost" size="sm" className="h-7 -ml-2 text-xs text-muted-foreground w-fit">
          <Link href="/app/audit">
            <ArrowLeftIcon data-icon="inline-start" />
            Audit log
          </Link>
        </Button>

        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">Transaction</p>
          <HashChip hash={txHash} front={16} back={12} />
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Transaction Details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Event</span>
              <Badge variant="secondary" className="font-mono text-[10px] h-4">{event.topic}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Block</span>
              <span className="font-mono font-medium">#{event.blockNumber.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Timestamp</span>
              <span className="font-mono">{event.timestamp.replace("T", " ").slice(0, 19)} UTC</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Job ID</span>
              <Link href={`/app/audit/job/${job.jobId}`} className="hover:underline">
                <HashChip hash={job.jobId} front={10} back={8} />
              </Link>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Dataset</span>
              <Link href={`/app/audit/dataset/${job.datasetRoot}`} className="hover:underline">
                <HashChip hash={job.datasetRoot} front={10} back={8} />
              </Link>
            </div>
            <Separator />
            <div className="flex flex-col gap-1.5">
              <span className="text-muted-foreground">Event arguments</span>
              <div className="rounded-md bg-muted px-3 py-2 flex flex-col gap-1">
                {Object.entries(event.args).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className="font-mono text-muted-foreground">{k}</span>
                    <span className="font-mono text-foreground">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button asChild size="sm" variant="outline" className="h-7 text-xs">
            <Link href={`/app/audit/job/${job.jobId}`}>View full job →</Link>
          </Button>
          <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
            <Link href={`/app/audit/dataset/${job.datasetRoot}`}>View dataset →</Link>
          </Button>
        </div>

      </div>
    </div>
  );
}
