import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AppTopbar } from "@/components/app/app-topbar";
import { HashChip } from "@/components/app/hash-chip";
import { PURPOSES } from "@/lib/mock";
import { getOgPublicClient, DATA_POLICY_ABI, getDataPolicyAddress } from "@/lib/publish/onchain";
import { formatUnits } from "viem";

const ME = "0x4f3a8b2c1d9e6f7a0b5c3d2e1f8a9b4c5d6e7f80";

function getPurposeLabel(id: string): string {
  return PURPOSES.find((p) => p.id === id)?.label ?? id.slice(0, 8);
}

async function fetchDatasetFromEnvio(datasetRoot: string) {
  const query = `
    query GetDataset {
      Dataset(where: { id: { _ilike: "${datasetRoot}" } }) {
        id
        owner
        manifestHash
        active
        timestamp
      }
    }
  `;
  try {
    const res = await fetch(process.env.NEXT_PUBLIC_ENVIO_GRAPHQL_URL ?? process.env.NEXT_PUBLIC_ENVIO_GRAPHQL_URL ?? "http://127.0.0.1:8080/v1/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data?.Dataset?.[0] || null;
  } catch (e) {
    console.error("Envio fetch failed", e);
    return null;
  }
}

async function hydrateDataset(datasetRoot: string) {
  const d = await fetchDatasetFromEnvio(datasetRoot);
  if (!d) return null;

  const publicClient = getOgPublicClient();
  const policyAddress = getDataPolicyAddress();

  try {
    const policy: any = await publicClient.readContract({
      address: policyAddress,
      abi: DATA_POLICY_ABI,
      functionName: "policies",
      args: [d.id as `0x${string}`],
    });

    return {
      datasetRoot: d.id,
      owner: d.owner,
      manifestHash: d.manifestHash,
      active: d.active,
      label: `Secure Dataset ${d.id.slice(2, 6).toUpperCase()}`,
      description: "Encrypted data blob verified via 0G Storage with hardware TEE access enforcement.",
      royaltyPerEpoch: formatUnits(policy[3] || BigInt(0), 18),
      maxEpochsPerRun: policy[4] || 0,
      maxRunsPerRequester: policy[5] || 0,
      accessTtlSeconds: policy[6] || BigInt(0),
      requireResultAttestation: policy[8] || false,
      openRequesters: policy[10] || false,
      allowedPurposeIds: ["0x6e657572616c5f72657365617263680000000000000000000000000000000000"],
    };
  } catch (err) {
    console.error(`Failed to hydrate dataset ${d.id}:`, err);
    return null;
  }
}

export default async function MarketplaceDetailPage({ params }: { params: Promise<{ datasetRoot: string }> }) {
  const { datasetRoot } = await params;
  const dataset = await hydrateDataset(datasetRoot);
  if (!dataset) notFound();

  const isOwner = dataset.owner.toLowerCase() === ME.toLowerCase();

  return (
    <div className="flex flex-col min-h-full">
      <AppTopbar title="Dataset Details" />
      <div className="flex-1 p-6 flex flex-col gap-4 max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Button asChild variant="ghost" size="sm" className="h-7 -ml-2 text-xs text-muted-foreground w-fit">
              <Link href="/app/marketplace">
                <ArrowLeftIcon data-icon="inline-start" />
                Marketplace
              </Link>
            </Button>
            <h2 className="text-base font-semibold">{dataset.label}</h2>
            <HashChip hash={dataset.datasetRoot} front={10} back={8} />
            <p className="text-sm text-muted-foreground mt-1">{dataset.description}</p>
          </div>
          <div className="shrink-0">
            {isOwner ? (
              <Button size="sm" variant="outline" className="h-8 text-xs" disabled>You own this</Button>
            ) : !dataset.active ? (
              <Button size="sm" variant="outline" className="h-8 text-xs" disabled>Unavailable</Button>
            ) : (
              <Button asChild size="sm" className="h-8 text-xs">
                <Link href={`/app/marketplace/${dataset.datasetRoot}/request`}>Start training →</Link>
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Policy</CardTitle>
                <Badge variant="secondary" className="text-[10px] h-4">on-chain</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Rate</span>
                <span className="font-mono font-medium">{dataset.royaltyPerEpoch} USDC/epoch</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Max epochs/session</span>
                <span className="font-mono font-medium">{dataset.maxEpochsPerRun}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Max sessions/researcher</span>
                <span className="font-mono font-medium">{dataset.maxRunsPerRequester}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Session window</span>
                <span className="font-mono font-medium">{dataset.accessTtlSeconds.toString()}s</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Proof required</span>
                <Badge variant={dataset.requireResultAttestation ? "outline" : "secondary"} className="text-[10px] h-4">
                  {dataset.requireResultAttestation ? "Yes" : "No"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Researchers</span>
                <span className="font-medium">{dataset.openRequesters ? "Open" : "Restricted"}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Allowed Purposes</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {dataset.allowedPurposeIds.map((pid) => (
                <div key={pid} className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-mono text-xs">{getPurposeLabel(pid)}</Badge>
                </div>
              ))}
              <Separator />
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Manifest</span>
                <HashChip hash={dataset.manifestHash} front={10} back={8} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
