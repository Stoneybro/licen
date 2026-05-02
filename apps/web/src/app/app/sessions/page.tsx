import Link from "next/link";
import { InfoIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AppTopbar } from "@/components/app/app-topbar";
import { HashChip } from "@/components/app/hash-chip";
import { JobStateBadge } from "@/components/app/job-state-badge";
import { getOgPublicClient, DATA_POLICY_ABI, getDataPolicyAddress } from "@/lib/publish/onchain";
import { formatUnits } from "viem";

async function fetchJobsFromEnvio() {
  const query = `
    query GetJobs {
      Job(order_by: { timestamp: desc }) {
        id
        datasetRoot
        requester
        requestedEpochs
        state
        timestamp
        txHash
        lastUpdatedTimestamp
        actualEpochs
        resultHash
        attestationRef
        failReason
        royaltySettled
        refundIssued
      }
    }
  `;
  try {
    const res = await fetch("http://127.0.0.1:8080/v1/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data?.Job || [];
  } catch (e) {
    console.error("Envio fetch failed", e);
    return [];
  }
}

async function hydrateJobs() {
  const indexerJobs = await fetchJobsFromEnvio();
  const publicClient = getOgPublicClient();
  const policyAddress = getDataPolicyAddress();

  const hydrated = await Promise.all(
    indexerJobs.map(async (j: any) => {
      let escrow = "0";
      try {
        const policy: any = await publicClient.readContract({
          address: policyAddress,
          abi: DATA_POLICY_ABI,
          functionName: "policies",
          args: [j.datasetRoot as `0x${string}`],
        });
        const royaltyPerEpoch = policy[3] || BigInt(0);
        const total = royaltyPerEpoch * BigInt(j.requestedEpochs);
        escrow = formatUnits(total, 18);
      } catch (err) {
        console.error(`Failed to read policy for dataset ${j.datasetRoot}:`, err);
      }

      return {
        jobId: j.id,
        datasetRoot: j.datasetRoot,
        datasetLabel: `Secure Dataset ${j.datasetRoot.slice(2, 6).toUpperCase()}`,
        requester: j.requester,
        providerId: "0G Compute",
        purposeLabel: "NEURAL_RESEARCH",
        requestedEpochs: j.requestedEpochs,
        actualEpochs: j.actualEpochs,
        escrow,
        settledAmount: j.royaltySettled ? formatUnits(BigInt(j.royaltySettled), 18) : null,
        refundAmount: j.refundIssued ? formatUnits(BigInt(j.refundIssued), 18) : null,
        resultHash: j.resultHash,
        attestationRef: j.attestationRef,
        state: j.state,
        createdAt: new Date(Number(j.timestamp) * 1000).toISOString(),
        updatedAt: new Date(Number(j.lastUpdatedTimestamp) * 1000).toISOString(),
      };
    })
  );

  return hydrated;
}

export default async function SessionsPage() {
  const jobs = await hydrateJobs();

  return (
    <div className="flex flex-col min-h-full">
      <AppTopbar title="My Sessions" />
      <div className="flex-1 p-6 flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{jobs.length} training session{jobs.length !== 1 ? "s" : ""}</p>

        {/* Overview */}
        <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 px-4 py-3">
          <InfoIcon className="size-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            A training session is started when you request access to a dataset from the Marketplace. Your payment is locked securely upfront to cover the epochs you requested. The AI model trains on the encrypted data, royalties are paid to the owner, and any unused portion is refunded to you automatically. Click any row to see the full lifecycle and payment ledger.
          </p>
        </div>

        {jobs.length === 0 ? (
          <Card className="border-dashed mt-4">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <InfoIcon className="size-8 text-muted-foreground/40" />
              <div>
                <p className="text-sm font-medium">No sessions yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[36ch]">
                  You have not requested any training sessions. Head to the Marketplace to find a dataset and start training.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6 text-xs">Session ID</TableHead>
                    <TableHead className="text-xs">Dataset</TableHead>
                    <TableHead className="text-xs">Purpose</TableHead>
                    <TableHead className="text-xs">Provider</TableHead>
                    <TableHead className="text-xs text-center">Epochs</TableHead>
                    <TableHead className="text-xs text-right">Payment locked</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((j) => (
                    <TableRow key={j.jobId} className="cursor-pointer hover:bg-muted/40">
                      <TableCell className="pl-6">
                        <Link href={`/app/sessions/${j.jobId}`} className="block">
                          <HashChip hash={j.jobId} front={8} back={6} />
                          <p className="text-[10px] text-muted-foreground mt-0.5">{j.createdAt.split("T")[0]}</p>
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-[160px]">
                        <p className="text-xs truncate">{j.datasetLabel}</p>
                        <HashChip hash={j.datasetRoot} className="mt-0.5" />
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                          {j.purposeLabel}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{j.providerId}</TableCell>
                      <TableCell className="text-center font-mono text-xs">
                        {j.actualEpochs !== null ? (
                          <span>
                            {j.actualEpochs}
                            {j.actualEpochs !== j.requestedEpochs && (
                              <span className="text-muted-foreground">/{j.requestedEpochs}</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">{j.requestedEpochs} req</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {j.escrow} USDC
                      </TableCell>
                      <TableCell>
                        <JobStateBadge state={j.state as any} />
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
  );
}
