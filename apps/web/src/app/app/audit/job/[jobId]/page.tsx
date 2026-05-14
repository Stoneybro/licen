import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { AppTopbar } from "@/components/app/app-topbar";
import { HashChip } from "@/components/app/hash-chip";
import { JobStateBadge } from "@/components/app/job-state-badge";

import type { JobState } from "@/lib/mock";
import { formatEther } from "viem";
import { PUBLISH_PURPOSES } from "@/lib/publish/contracts";

export default async function AuditJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const query = `
    query GetJobDetails {
      Job(where: { id: { _ilike: "${jobId}" } }) {
        id
        datasetRoot
        requester
        requestedEpochs
        state
        actualEpochs
        resultHash
        attestationRef
        failReason
        royaltySettled
        refundIssued
      }
      AuditLog(where: { jobId: { _ilike: "${jobId}" } }, order_by: { timestamp: desc }) {
        id
        eventType
        timestamp
        txHash
        details
      }
    }
  `;

  let j: any = null;
  let jobEvents: any[] = [];

  try {
    const res = await fetch(process.env.NEXT_PUBLIC_ENVIO_GRAPHQL_URL ?? process.env.NEXT_PUBLIC_ENVIO_GRAPHQL_URL ?? "https://indexer.dev.hyperindex.xyz/001fb92/v1/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      cache: "no-store",
    });
    if (res.ok) {
      const json = await res.json();
      j = json.data?.Job?.[0];
      jobEvents = json.data?.AuditLog || [];
    }
  } catch (err) {
    console.error("Failed to fetch audit data from indexer", err);
  }

  if (!j) notFound();

  const datasetLabel = `Secure Dataset ${j.datasetRoot.slice(2, 6).toUpperCase()}`;

  return (
    <div className="flex flex-col min-h-full">
      <AppTopbar title="Audit — Job" />
      <div className="flex-1 p-6 flex flex-col gap-4 max-w-2xl">

        <Button asChild variant="ghost" size="sm" className="h-7 -ml-2 text-xs text-muted-foreground w-fit">
          <Link href="/app/audit">
            <ArrowLeftIcon data-icon="inline-start" />
            Audit log
          </Link>
        </Button>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">Job ID</p>
            <HashChip hash={j.id} front={14} back={10} />
          </div>
          <JobStateBadge state={j.state as JobState} />
        </div>

        {/* Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Summary</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Dataset</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">{datasetLabel}</span>
                <HashChip hash={j.datasetRoot} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Requester</span>
              <HashChip hash={j.requester} front={10} back={8} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Purpose</span>
              <Badge variant="secondary" className="font-mono text-[10px] h-4">Neural Research</Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Requested epochs</span>
              <span className="font-mono font-medium">{j.requestedEpochs}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Actual epochs run</span>
              <span className="font-mono font-medium">{j.actualEpochs ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Settled royalty</span>
              <span className="font-mono font-medium">{j.royaltySettled ? `${formatEther(BigInt(j.royaltySettled))} 0G` : "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Refund issued</span>
              <span className="font-mono font-medium">{j.refundIssued ? `${formatEther(BigInt(j.refundIssued))} 0G` : "—"}</span>
            </div>
            {j.resultHash && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Result hash</span>
                  <HashChip hash={j.resultHash} front={10} back={8} />
                </div>
              </>
            )}
            {j.attestationRef && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Attestation ref</span>
                <HashChip hash={j.attestationRef} front={10} back={8} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* On-chain event log */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">On-chain Event Log</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-0 p-0">
            {jobEvents.map((e: any, i: number) => {
              const args = e.details ? JSON.parse(e.details) : {};
              return (
                <div key={i} className="flex items-start gap-3 px-6 py-3 border-b border-border last:border-0">
                  <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                    <div className="size-1.5 rounded-full bg-muted-foreground" />
                    {i < jobEvents.length - 1 && <div className="w-px h-6 bg-border" />}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="font-mono text-[10px] h-4">{e.eventType}</Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(Number(e.timestamp) * 1000).toLocaleString()} UTC
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href={`/app/audit/tx/${e.txHash}`} className="hover:underline">
                        <HashChip hash={e.txHash} front={10} back={8} />
                      </Link>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5">
                      {Object.entries(args).map(([k, v]) => (
                        <span key={k} className="text-[10px] text-muted-foreground">
                          <span className="text-foreground/60">{k}:</span> {String(v)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
