"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeftIcon, AlertTriangleIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectGroup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { HashChip } from "@/components/app/hash-chip";
import { AppTopbar } from "@/components/app/app-topbar";
import { PURPOSES } from "@/lib/mock";
import { getOgPublicClient, DATA_POLICY_ABI, getDataPolicyAddress, getOgChain } from "@/lib/publish/onchain";
import { formatUnits, createPublicClient, http } from "viem";
import { usePrivy } from "@privy-io/react-auth";

const TOKEN_ADDRESS = "0x6A0C73162c20Bc56212D643112c339f654C45198";
const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  }
] as const;

const STEPS = ["Configure", "Review", "Confirm"];

function getPurposeLabel(id: string): string {
  return PURPOSES.find((p) => p.id === id)?.label ?? id.slice(0, 8);
}

export default function RequestAccessPage() {
  const { datasetRoot } = useParams<{ datasetRoot: string }>();
  
  const [dataset, setDataset] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  
  const [step, setStep] = React.useState(0);
  const [epochs, setEpochs] = React.useState("5");
  const [purposeId, setPurposeId] = React.useState("");

  const { user } = usePrivy();
  const walletAddress = user?.wallet?.address;
  const [balanceStr, setBalanceStr] = React.useState<string>("0");
  const [hasBalance, setHasBalance] = React.useState<boolean>(true);

  React.useEffect(() => {
    async function fetchDataset() {
      if (!datasetRoot) return;
      try {
        const query = `
          query GetDataset {
            Dataset(where: { id: { _ilike: "${datasetRoot}" } }) {
              id
              owner
              manifestHash
              active
            }
          }
        `;
        const res = await fetch("http://127.0.0.1:8080/v1/graphql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query })
        });
        const json = await res.json();
        const d = json.data?.Dataset?.[0];
        if (!d) {
          setLoading(false);
          return;
        }

        const publicClient = getOgPublicClient();
        const policyAddress = getDataPolicyAddress();
        const policy: any = await publicClient.readContract({
          address: policyAddress,
          abi: DATA_POLICY_ABI,
          functionName: "policies",
          args: [d.id as `0x${string}`],
        });

        const hydrated = {
          datasetRoot: d.id,
          label: `Secure Dataset ${d.id.slice(2, 6).toUpperCase()}`,
          royaltyPerEpoch: formatUnits(policy[3] || BigInt(0), 18),
          maxEpochsPerRun: Number(policy[4] || 0),
          requireResultAttestation: policy[8] || false,
          allowedPurposeIds: ["0x6e657572616c5f72657365617263680000000000000000000000000000000000"],
        };

        setDataset(hydrated);
        setPurposeId(hydrated.allowedPurposeIds[0]);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }

    async function fetchBalance() {
      if (!walletAddress) return;
      const rpcUrl = process.env.NEXT_PUBLIC_OG_EVM_RPC_URL || "https://evmrpc-testnet.0g.ai";
      const client = createPublicClient({
        chain: getOgChain(rpcUrl),
        transport: http(rpcUrl)
      });
      client.readContract({
        address: TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [walletAddress as `0x${string}`],
      }).then(b => {
        setBalanceStr(Number(formatUnits(b as bigint, 18)).toFixed(2));
      }).catch(console.error);
    }
    
    fetchDataset();
    fetchBalance();
  }, [datasetRoot, walletAddress]);

  const epochsNum = parseInt(epochs, 10) || 0;
  const quote = epochsNum * parseInt(dataset?.royaltyPerEpoch || "0", 10);
  
  React.useEffect(() => {
    setHasBalance(parseFloat(balanceStr) >= quote);
  }, [balanceStr, quote]);

  if (loading) {
    return (
      <div className="flex flex-col min-h-full">
        <AppTopbar title="Start Training" />
        <div className="flex-1 p-6 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading dataset...</p>
        </div>
      </div>
    );
  }

  if (!dataset) return null;
  
  const hasAllowance = false;

  return (
    <div className="flex flex-col min-h-full">
      <AppTopbar title="Start Training" />
      <div className="flex-1 p-6 flex flex-col gap-4 max-w-xl">
        {/* Breadcrumb */}
        <Button asChild variant="ghost" size="sm" className="h-7 -ml-2 text-xs text-muted-foreground w-fit">
          <Link href={`/app/marketplace/${datasetRoot}`}>
            <ArrowLeftIcon data-icon="inline-start" />
            {dataset.label}
          </Link>
        </Button>

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div className="flex items-center gap-1.5">
                <div className={`size-5 rounded-full flex items-center justify-center text-[10px] font-medium ${
                  i < step ? "bg-foreground text-background" :
                  i === step ? "border border-foreground text-foreground" :
                  "border border-border text-muted-foreground"
                }`}>
                  {i < step ? "✓" : i + 1}
                </div>
                <span className={`text-xs ${i === step ? "text-foreground" : "text-muted-foreground"}`}>{s}</span>
              </div>
              {i < STEPS.length - 1 && <div className="flex-1 h-px bg-border" />}
            </React.Fragment>
          ))}
        </div>

        {/* Step 0: Configure */}
        {step === 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Configure Request</CardTitle>
              <CardDescription className="text-xs">Set training parameters for this access request.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">Dataset</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{dataset.label}</span>
                  <HashChip hash={dataset.datasetRoot} />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">Purpose</label>
                <Select value={purposeId} onValueChange={setPurposeId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {dataset.allowedPurposeIds.map((pid: string) => (
                        <SelectItem key={pid} value={pid} className="text-xs font-mono">
                          {getPurposeLabel(pid)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">
                  Epochs to train (max {dataset.maxEpochsPerRun})
                </label>
                <Input
                  type="number"
                  value={epochs}
                  onChange={(e) => setEpochs(e.target.value)}
                  min={1}
                  max={dataset.maxEpochsPerRun}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <Separator />

              <div className="flex flex-col gap-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Rate</span>
                  <span className="font-mono">{dataset.royaltyPerEpoch} USDC/epoch</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Epochs</span>
                  <span className="font-mono">{epochsNum}</span>
                </div>
                <div className="flex items-center justify-between font-medium">
                  <span>Total escrow required</span>
                  <span className="font-mono">{quote} USDC</span>
                </div>
              </div>

              <Button
                className="w-full h-8 text-xs"
                onClick={() => setStep(1)}
                disabled={epochsNum < 1 || epochsNum > dataset.maxEpochsPerRun}
              >
                Continue →
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 1: Review */}
        {step === 1 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Review</CardTitle>
              <CardDescription className="text-xs">Confirm the policy terms before submitting.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Dataset</span>
                <HashChip hash={dataset.datasetRoot} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Purpose</span>
                <Badge variant="secondary" className="font-mono text-[10px] h-4">{getPurposeLabel(purposeId)}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Epochs</span>
                <span className="font-mono font-medium">{epochsNum}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Rate</span>
                <span className="font-mono">{dataset.royaltyPerEpoch} USDC/epoch</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between font-medium">
                <span>Escrow to lock</span>
                <span className="font-mono">{quote} USDC</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Settlement</span>
                <span>Settle-by-actual · refund delta</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Proof required</span>
                <Badge variant={dataset.requireResultAttestation ? "outline" : "secondary"} className="text-[10px] h-4">
                  {dataset.requireResultAttestation ? "Yes" : "No"}
                </Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Your USDC balance</span>
                <span className={`font-mono font-medium ${!hasBalance ? "text-destructive" : ""}`}>
                  {balanceStr} USDC
                </span>
              </div>
              {!hasBalance && (
                <Alert>
                  <AlertTriangleIcon className="size-3" />
                  <AlertDescription className="text-xs">
                    Insufficient USDC. You need {quote} but have {balanceStr}. Top up via wallet menu.
                  </AlertDescription>
                </Alert>
              )}
              <div className="flex items-center gap-2 mt-1">
                <Button variant="outline" className="h-8 text-xs flex-1" onClick={() => setStep(0)}>← Back</Button>
                <Button className="h-8 text-xs flex-1" onClick={() => setStep(2)} disabled={!hasBalance}>
                  Continue →
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Confirm */}
        {step === 2 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Confirm</CardTitle>
              <CardDescription className="text-xs">
                {hasAllowance
                  ? "Sign the transaction to lock escrow and submit your request."
                  : "Two steps: approve USDC spend, then submit request. Batched in one UserOp."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {!hasAllowance && (
                <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
                  <div className="size-1.5 rounded-full bg-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground">
                    <span className="text-foreground font-medium">Enable USDC</span> — approve allowance for the contract
                  </span>
                  <Badge variant="outline" className="ml-auto text-[10px] h-4">pending</Badge>
                </div>
              )}
              <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
                <div className="size-1.5 rounded-full bg-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground">
                  <span className="text-foreground font-medium">requestAccess</span> — lock {quote} USDC escrow
                </span>
                <Badge variant="outline" className="ml-auto text-[10px] h-4">pending</Badge>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Button variant="outline" className="h-8 text-xs flex-1" onClick={() => setStep(1)}>← Back</Button>
                <Button className="h-8 text-xs flex-1">
                  Sign & Submit
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground text-center">Gas is abstracted — no ETH required.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
