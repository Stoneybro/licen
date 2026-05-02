import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { AppTopbar } from "@/components/app/app-topbar";
import { HashChip } from "@/components/app/hash-chip";


export default async function AuditTxPage({ params }: { params: Promise<{ txHash: string }> }) {
  const { txHash } = await params;

  const query = `
    query GetAuditLog {
      AuditLog(where: { txHash: { _ilike: "${txHash}" } }) {
        id
        eventType
        timestamp
        txHash
        jobId
        datasetRoot
        details
      }
    }
  `;

  let event: any = null;

  try {
    const res = await fetch(process.env.NEXT_PUBLIC_ENVIO_GRAPHQL_URL ?? process.env.NEXT_PUBLIC_ENVIO_GRAPHQL_URL ?? "http://127.0.0.1:8080/v1/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      cache: "no-store",
    });
    if (res.ok) {
      const json = await res.json();
      event = json.data?.AuditLog?.[0];
    }
  } catch (err) {
    console.error("Failed to fetch audit data from indexer", err);
  }

  if (!event) notFound();

  const args = event.details ? JSON.parse(event.details) : {};

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
              <Badge variant="secondary" className="font-mono text-[10px] h-4">{event.eventType}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Timestamp</span>
              <span className="font-mono">{new Date(Number(event.timestamp) * 1000).toLocaleString()} UTC</span>
            </div>
            <Separator />
            {event.jobId && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Job ID</span>
                <Link href={`/app/audit/job/${event.jobId}`} className="hover:underline">
                  <HashChip hash={event.jobId} front={10} back={8} />
                </Link>
              </div>
            )}
            {event.datasetRoot && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Dataset</span>
                <Link href={`/app/audit/dataset/${event.datasetRoot}`} className="hover:underline">
                  <HashChip hash={event.datasetRoot} front={10} back={8} />
                </Link>
              </div>
            )}
            <Separator />
            <div className="flex flex-col gap-1.5">
              <span className="text-muted-foreground">Event arguments</span>
              <div className="rounded-md bg-muted px-3 py-2 flex flex-col gap-1">
                {Object.entries(args).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className="font-mono text-muted-foreground">{k}</span>
                    <span className="font-mono text-foreground">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          {event.jobId && (
            <Button asChild size="sm" variant="outline" className="h-7 text-xs">
              <Link href={`/app/audit/job/${event.jobId}`}>View full job →</Link>
            </Button>
          )}
          {event.datasetRoot && (
            <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
              <Link href={`/app/audit/dataset/${event.datasetRoot}`}>View dataset →</Link>
            </Button>
          )}
        </div>

      </div>
    </div>
  );
}
