"use client";

import * as React from "react";
import Link from "next/link";
import { SearchIcon, InfoIcon, Loader2, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppTopbar } from "@/components/app/app-topbar";
import { HashChip } from "@/components/app/hash-chip";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export default function AuditPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<any>({ recentJobs: [], recentDatasets: [], recentEvents: [] });

  React.useEffect(() => {
    async function fetchAuditData() {
      const query = `
        query AuditOverview {
          Job(limit: 5, order_by: { timestamp: desc }) {
            id
          }
          Dataset(limit: 5, order_by: { timestamp: desc }) {
            id
          }
          AuditLog(limit: 15, order_by: { timestamp: desc }) {
            id
            eventType
            txHash
            datasetRoot
            timestamp
          }
        }
      `;

      try {
        const res = await fetch(process.env.NEXT_PUBLIC_ENVIO_GRAPHQL_URL ?? "http://127.0.0.1:8080/v1/graphql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });
        if (res.ok) {
          const json = await res.json();
          setData({
            recentJobs: json.data?.Job || [],
            recentDatasets: json.data?.Dataset || [],
            recentEvents: json.data?.AuditLog || [],
          });
        }
      } catch (err) {
        console.error("Failed to fetch audit data", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAuditData();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    const query = searchQuery.trim().toLowerCase();
    
    // Simple heuristic to guess what it is
    if (query.length === 66) { // tx hash
      router.push(`/app/audit/tx/${query}`);
    } else if (query.startsWith("0x")) {
       // Could be job ID or dataset root
       // In a real app we'd query the DB to check, but for now we'll guess jobId
       router.push(`/app/audit/job/${query}`);
    }
  };

  return (
    <div className="flex flex-col min-h-full bg-muted/5">
      <AppTopbar title="Audit" />

      <div className="flex-1 p-6 flex flex-col gap-6 max-w-4xl mx-auto w-full">

        {/* Explainer */}
        <div className="flex items-start gap-4 rounded-xl border border-border bg-background px-5 py-4 shadow-sm">
          <div className="size-10 rounded-full bg-foreground/5 flex items-center justify-center shrink-0">
            <InfoIcon className="size-5 text-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold tracking-tight">Public Protocol Transparency</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Every state transition in the LICEN protocol — access requests, grants, job starts,
              completions, and royalty settlements — is recorded as an on-chain event indexed by
              Envio HyperIndex. All data here is public and verifiable.
            </p>
          </div>
        </div>

        {/* Search */}
        <Card className="border-border/40 shadow-sm overflow-hidden">
          <CardHeader className="pb-4 bg-muted/5 border-b border-border/20">
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-lg bg-foreground/5 flex items-center justify-center border border-border/40">
                <SearchIcon className="size-3.5 text-foreground" />
              </div>
              <CardTitle className="text-sm font-semibold">Protocol Explorer</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Search by transaction hash, job ID, or dataset root to view the full audit trail.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="0x… txHash, jobId, or datasetRoot"
                className="flex-1 h-10 rounded-lg border border-border/60 bg-muted/10 px-4 text-xs font-mono placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground/20 transition-all"
              />
              <Button type="submit" className="h-10 px-6 font-bold shadow-md">
                Explore
              </Button>
            </form>
            
            <div className="flex flex-wrap gap-2 pt-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider self-center mr-2">Recent:</span>
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="size-3 animate-spin text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">Indexing latest events...</span>
                </div>
              ) : (
                <>
                  {data.recentJobs.slice(0, 2).map((j: any) => (
                    <Link
                      key={j.id}
                      href={`/app/audit/job/${j.id}`}
                      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-border/60 bg-background text-[10px] font-mono text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all shadow-sm"
                    >
                      <span className="size-1 rounded-full bg-muted-foreground/40" />
                      job: {j.id.slice(0, 10)}…
                    </Link>
                  ))}
                  {data.recentDatasets.slice(0, 2).map((d: any) => (
                    <Link
                      key={d.id}
                      href={`/app/audit/dataset/${d.id}`}
                      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-border/60 bg-background text-[10px] font-mono text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all shadow-sm"
                    >
                      <span className="size-1 rounded-full bg-muted-foreground/40" />
                      dataset: {d.id.slice(0, 10)}…
                    </Link>
                  ))}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent events */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold tracking-tight uppercase tracking-wider text-muted-foreground">Global Activity Stream</h3>
            {!loading && (
               <Badge variant="outline" className="text-[9px] font-bold px-2 py-0.5 animate-pulse bg-background">Live Monitoring</Badge>
            )}
          </div>
          
          <div className="space-y-2">
            {loading ? (
              Array(5).fill(0).map((_, i) => (
                <div key={i} className="h-16 rounded-xl border border-border/20 bg-muted/5 animate-pulse" />
              ))
            ) : data.recentEvents.length === 0 ? (
               <Card className="border-dashed py-12 text-center text-muted-foreground">
                 <p className="text-xs">No protocol events recorded yet.</p>
               </Card>
            ) : (
              data.recentEvents.map((e: any, i: number) => (
                <Link
                  key={i}
                  href={`/app/audit/tx/${e.txHash}`}
                  className="flex items-center gap-4 rounded-xl border border-border/40 bg-background p-4 hover:border-foreground/20 hover:shadow-md transition-all group"
                >
                  <div className="size-10 rounded-lg bg-muted/30 flex items-center justify-center shrink-0 group-hover:bg-foreground/5 transition-colors">
                    <Badge variant="secondary" className="font-mono text-[9px] h-5 bg-foreground text-background border-none px-1.5">
                      {e.eventType.replace(/([A-Z])/g, ' $1').trim()}
                    </Badge>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                       <span className="text-[11px] font-bold text-foreground">Transaction detected</span>
                       <HashChip hash={e.txHash} front={10} back={8} className="bg-muted/10" />
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="font-medium">Dataset:</span>
                      <span className="font-mono">{e.datasetRoot?.slice(0, 16)}…</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="font-mono text-[10px] text-muted-foreground font-medium">
                      {new Date(Number(e.timestamp) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <ArrowRight className="size-3 text-muted-foreground/0 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all" />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
