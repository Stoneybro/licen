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

import { PUBLISH_PURPOSES } from "@/lib/publish/contracts";
import type { JobState } from "@/lib/mock";
import { getOgPublicClient, DATA_POLICY_ABI, getDataPolicyAddress } from "@/lib/publish/onchain";
import { formatUnits } from "viem";

function getPurposeLabel(id: string) {
  const match = PUBLISH_PURPOSES.find((p) => p === id);
  return match ? match.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : id.slice(0, 8);
}

export default async function AuditDatasetPage({ params }: { params: Promise<{ datasetRoot: string }> }) {
  const { datasetRoot } = await params;
  const query = `
    query GetDatasetDetails {
      Dataset(where: { id: { _ilike: "${datasetRoot}" } }) {
        id
        owner
        manifestHash
        active
        jobs {
          id
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
      }
      AuditLog(where: { datasetRoot: { _ilike: "${datasetRoot}" } }, order_by: { timestamp: desc }) {
        id
        eventType
        timestamp
        txHash
        jobId
        details
      }
    }
  `;

  let d: any = null;
  let datasetJobs: any[] = [];
  let allEvents: any[] = [];

  try {
    const res = await fetch("http://127.0.0.1:8080/v1/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      cache: "no-store",
    });
    if (res.ok) {
      const json = await res.json();
      d = json.data?.Dataset?.[0];
      datasetJobs = d?.jobs || [];
      allEvents = json.data?.AuditLog || [];
    }
  } catch (err) {
    console.error("Failed to fetch audit data from indexer", err);
  }

  if (!d) notFound();

  const publicClient = getOgPublicClient();
  const policyAddress = getDataPolicyAddress();
  const policy: any = await publicClient.readContract({
    address: policyAddress,
    abi: DATA_POLICY_ABI,
    functionName: "policies",
    args: [d.id as `0x${string}`],
  }).catch(() => null);

  const dataset = {
    datasetRoot: d.id,
    label: `Secure Dataset ${d.id.slice(2, 6).toUpperCase()}`,
    description: "Encrypted data blob verified via 0G Storage with hardware TEE access enforcement.",
    owner: d.owner,
    manifestHash: d.manifestHash,
    active: d.active,
    royaltyPerEpoch: policy ? formatUnits(policy[3] || BigInt(0), 18) : "0",
    lifetimeRoyalties: "0",
    jobCount: datasetJobs.length,
    allowedPurposeIds: ["0x6e657572616c5f72657365617263680000000000000000000000000000000000"],
  };

  return (
    <div className="flex flex-col min-h-full">
      <AppTopbar title="Audit — Dataset" />
      <div className="flex-1 p-6 flex flex-col gap-4 max-w-2xl">

        <Button asChild variant="ghost" size="sm" className="h-7 -ml-2 text-xs text-muted-foreground w-fit">
          <Link href="/app/audit">
            <ArrowLeftIcon data-icon="inline-start" />
            Audit log
          </Link>
        </Button>

        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">Dataset (public view — no keys exposed)</p>
          <h2 className="text-base font-semibold">{dataset.label}</h2>
          <HashChip hash={dataset.datasetRoot} front={14} back={10} />
          <p className="text-xs text-muted-foreground mt-1">{dataset.description}</p>
        </div>

        {/* Policy summary */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Policy (on-chain)</CardTitle>
              <Badge variant={dataset.active ? "outline" : "secondary"} className="text-[10px] h-4">
                {dataset.active ? "Active" : "Paused"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Owner</span>
              <HashChip hash={dataset.owner} front={10} back={8} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Manifest hash</span>
              <HashChip hash={dataset.manifestHash} front={10} back={8} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Rate</span>
              <span className="font-mono font-medium">{dataset.royaltyPerEpoch} USDC/epoch</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Lifetime royalties settled</span>
              <span className="font-mono font-medium">{dataset.lifetimeRoyalties} USDC</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total access jobs</span>
              <span className="font-mono font-medium">{dataset.jobCount}</span>
            </div>
            <Separator />
            <div>
              <span className="text-muted-foreground block mb-1">Allowed purposes</span>
              <div className="flex flex-wrap gap-1">
                {dataset.allowedPurposeIds.map((pid) => (
                  <Badge key={pid} variant="secondary" className="font-mono text-[10px] h-4">
                    {getPurposeLabel(pid)}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Jobs */}
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Access Jobs ({datasetJobs.length})</h3>
          {datasetJobs.map((j) => (
            <Link
              key={j.jobId}
              href={`/app/audit/job/${j.jobId}`}
              className="flex items-center gap-3 rounded-md border border-border px-4 py-2.5 hover:border-foreground/20 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <HashChip hash={j.id} />
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1 py-0.5 rounded">Neural Research</span>
                  <span className="text-[10px] text-muted-foreground">{j.requestedEpochs} epochs</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-xs">{j.royaltySettled ? formatUnits(BigInt(j.royaltySettled), 18) : "—"} USDC</span>
                <JobStateBadge state={j.state as JobState} />
              </div>
            </Link>
          ))}
        </div>

        {/* Full event log */}
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">All Events ({allEvents.length})</h3>
          <Card>
            <CardContent className="p-0">
              {allEvents.map((e, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-0">
                  <Badge variant="secondary" className="font-mono text-[10px] h-4 shrink-0">{e.eventType}</Badge>
                  {e.jobId && (
                    <Link href={`/app/audit/job/${e.jobId}`} className="hover:underline shrink-0">
                      <HashChip hash={e.jobId} />
                    </Link>
                  )}
                  <div className="flex-1" />
                  <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                    {new Date(Number(e.timestamp) * 1000).toLocaleString()}
                  </span>
                  <Link href={`/app/audit/tx/${e.txHash}`} className="hover:underline shrink-0">
                    <HashChip hash={e.txHash} />
                  </Link>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
