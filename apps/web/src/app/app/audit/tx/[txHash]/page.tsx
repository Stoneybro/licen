"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, notFound } from "next/navigation";
import { ArrowLeftIcon, Loader2, Globe, FileText, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { AppTopbar } from "@/components/app/app-topbar";
import { HashChip } from "@/components/app/hash-chip";

export default function AuditTxPage() {
  const { txHash } = useParams<{ txHash: string }>();
  
  const [event, setEvent] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchData() {
      if (!txHash) return;
      try {
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
        const res = await fetch(process.env.NEXT_PUBLIC_ENVIO_GRAPHQL_URL ?? "http://127.0.0.1:8080/v1/graphql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });
        const json = await res.json();
        const e = json.data?.AuditLog?.[0];
        if (!e) {
          setLoading(false);
          return;
        }
        setEvent(e);
      } catch (err) {
        console.error("Fetch failed", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [txHash]);

  if (loading) {
    return (
      <div className="flex flex-col min-h-full">
        <AppTopbar title="Audit — Transaction" />
        <div className="flex-1 p-6 flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!event) return notFound();

  const args = event.details ? JSON.parse(event.details) : {};

  return (
    <div className="flex flex-col min-h-full bg-muted/5">
      <AppTopbar title="Audit — Transaction" />
      <div className="flex-1 p-6 flex flex-col gap-6 max-w-4xl mx-auto w-full">

        <Button asChild variant="ghost" size="sm" className="h-7 -ml-2 text-xs text-muted-foreground w-fit hover:bg-foreground/5">
          <Link href="/app/audit">
            <ArrowLeftIcon className="size-3 mr-1" />
            Back to Audit Log
          </Link>
        </Button>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex gap-4 min-w-0">
             <div className="size-10 rounded-xl bg-background border shadow-sm flex items-center justify-center shrink-0">
                <Globe className="size-5 text-muted-foreground" />
             </div>
             <div className="flex flex-col gap-1 min-w-0">
                <h1 className="text-xl font-bold tracking-tight">Transaction Proof</h1>
                <HashChip hash={event.txHash} front={16} back={12} className="bg-background" />
             </div>
          </div>
          <div className="shrink-0 ml-14 md:ml-0">
             <Badge variant="secondary" className="h-6 px-3 bg-foreground text-background border-none uppercase tracking-wider font-bold text-[10px]">
                {event.eventType}
             </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-6">
            <Card className="border-border/40 shadow-sm">
              <CardHeader className="pb-4 bg-muted/10 border-b border-border/20 py-4">
                <CardTitle className="text-sm font-semibold">Decoded Event Arguments</CardTitle>
                <CardDescription className="text-xs">Indexed fields extracted from the transaction receipt.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid gap-3">
                  {Object.entries(args).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-4 py-2 border-b border-border/10 last:border-0">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{k}</span>
                      <span className="text-xs font-mono font-medium text-foreground bg-muted/20 px-2 py-1 rounded truncate max-w-md">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-border/40 shadow-sm">
               <CardHeader className="pb-3 bg-muted/5">
                  <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Protocol Context</CardTitle>
               </CardHeader>
               <CardContent className="space-y-4 pt-4">
                  <div className="space-y-1">
                     <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">Observed At</p>
                     <p className="text-xs font-mono font-bold">{new Date(Number(event.timestamp) * 1000).toLocaleString()} UTC</p>
                  </div>
                  <Separator className="opacity-40" />
                  {event.jobId && (
                     <div className="space-y-2">
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">Linked Session</p>
                        <HashChip hash={event.jobId} front={8} back={6} className="bg-muted/10" />
                        <Button variant="outline" size="sm" className="w-full text-[10px] h-7 bg-background font-bold" asChild>
                           <Link href={`/app/audit/job/${event.jobId}`} className="flex items-center gap-1.5">
                              View full job <ArrowRight className="size-2.5" />
                           </Link>
                        </Button>
                     </div>
                  )}
                  {event.datasetRoot && (
                     <div className="space-y-2">
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">Linked Dataset</p>
                        <HashChip hash={event.datasetRoot} front={8} back={6} className="bg-muted/10" />
                        <Button variant="outline" size="sm" className="w-full text-[10px] h-7 bg-background font-bold" asChild>
                           <Link href={`/app/audit/dataset/${event.datasetRoot}`} className="flex items-center gap-1.5">
                              View dataset <ArrowRight className="size-2.5" />
                           </Link>
                        </Button>
                     </div>
                  )}
               </CardContent>
            </Card>

            <Card className="bg-muted/10 border-dashed shadow-none">
                <CardHeader className="pb-2">
                   <div className="flex items-center gap-2">
                      <FileText className="size-3 text-muted-foreground" />
                      <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Indexer Meta</CardTitle>
                   </div>
                </CardHeader>
                <CardContent>
                   <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Internal ID</span>
                      <span className="font-mono">{event.id}</span>
                   </div>
                </CardContent>
            </Card>
          </div>
        </div>

      </div>
    </div>
  );
}
