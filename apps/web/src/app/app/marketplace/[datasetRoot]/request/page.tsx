"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeftIcon, AlertTriangleIcon, Loader2, CheckCircle2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectGroup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { HashChip } from "@/components/app/hash-chip";
import { AppTopbar } from "@/components/app/app-topbar";
import { PURPOSES } from "@/lib/mock";
import { getOgPublicClient, DATA_POLICY_ABI, getDataPolicyAddress, getOgChain } from "@/lib/publish/onchain";
import { formatEther, createPublicClient, http, encodeFunctionData, keccak256, toHex, type Address, type Hex } from "viem";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { cn } from "@/lib/utils";

const STEPS = ["Configure", "Review", "Confirm"];

function getPurposeLabel(id: string): string {
  if (id.startsWith("0x")) {
    const found = PURPOSES.find((p) => p.id.toLowerCase() === id.toLowerCase());
    if (found) return found.label;
    return id.slice(0, 8);
  }
  return id
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function RequestAccessPage() {
  const { datasetRoot } = useParams<{ datasetRoot: string }>();
  const router = useRouter();
  
  const [dataset, setDataset] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  
  const [step, setStep] = React.useState(0);
  const [epochs, setEpochs] = React.useState("5");
  const [purposeId, setPurposeId] = React.useState("");

  const { user } = usePrivy();
  const { wallets } = useWallets();
  const walletAddress = user?.wallet?.address;
  const [balanceStr, setBalanceStr] = React.useState<string>("0");
  const [hasBalance, setHasBalance] = React.useState<boolean>(true);
  const [isCheckingBalance, setIsCheckingBalance] = React.useState(true);
  
  const [submitting, setSubmitting] = React.useState(false);
  const [submissionStep, setSubmissionStep] = React.useState<string | null>(null);
  const [submissionProgress, setSubmissionProgress] = React.useState(0);
  const [submissionError, setSubmissionError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const fetchDataset = React.useCallback(async () => {
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
      const res = await fetch(process.env.NEXT_PUBLIC_ENVIO_GRAPHQL_URL ?? "https://indexer.dev.hyperindex.xyz/001fb92/v1/graphql", {
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
      const summaryRes = await fetch("/api/app/dataset-summaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetRoots: [d.id],
          includeJobStats: false,
        }),
      });
      const summaryJson = summaryRes.ok ? await summaryRes.json() : { datasets: [] };
      const datasetSummary = summaryJson.datasets?.[0] ?? null;

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
        manifestHash: d.manifestHash,
        label: datasetSummary?.title || `Dataset ${d.id.slice(0, 10)}`,
        description: datasetSummary?.description || "Encrypted data blob verified via 0G Storage with hardware TEE access enforcement.",
        royaltyPerEpoch: formatEther(policy[3] || BigInt(0)),
        royaltyPerEpochRaw: policy[3] || BigInt(0),
        maxEpochsPerRun: Number(policy[4] || 0),
        requireResultAttestation: policy[8] || false,
        allowedPurposeIds: datasetSummary?.policy?.allowedPurposeIds?.length 
          ? datasetSummary.policy.allowedPurposeIds 
          : ["NEURAL_RESEARCH"],
      };

      setDataset(hydrated);
      setPurposeId(hydrated.allowedPurposeIds[0]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [datasetRoot]);

  const fetchOnChainData = React.useCallback(async () => {
    if (!walletAddress) return;
    try {
      setIsCheckingBalance(true);
      const rpcUrl = process.env.NEXT_PUBLIC_OG_EVM_RPC_URL || "https://evmrpc-testnet.0g.ai";
      const client = createPublicClient({
        chain: getOgChain(rpcUrl),
        transport: http(rpcUrl)
      });
      const balance = await client.getBalance({
        address: walletAddress as `0x${string}`,
      });

      setBalanceStr(Number(formatEther(balance)).toFixed(4));
    } catch (e) {
      console.error(e);
    } finally {
      setIsCheckingBalance(false);
    }
  }, [walletAddress]);

  React.useEffect(() => {
    fetchDataset();
    fetchOnChainData();
  }, [fetchDataset, fetchOnChainData]);

  const waitForTx = React.useCallback(async (txHash: string) => {
    const rpcUrl = process.env.NEXT_PUBLIC_OG_EVM_RPC_URL || "https://evmrpc-testnet.0g.ai";
    const client = createPublicClient({
      chain: getOgChain(rpcUrl),
      transport: http(rpcUrl),
    });

    return client.waitForTransactionReceipt({
      hash: txHash as `0x${string}`,
      confirmations: 1,
      pollingInterval: 1500,
      timeout: 120000,
    });
  }, []);

  const epochsNum = parseInt(epochs, 10) || 0;
  const quoteRaw = BigInt(epochsNum) * (dataset?.royaltyPerEpochRaw || BigInt(0));
  const quote = Number(formatEther(quoteRaw));
  
  React.useEffect(() => {
    setHasBalance(parseFloat(balanceStr) >= quote);
  }, [balanceStr, quote]);

  const handleRequestAccess = async () => {
    setSubmissionError(null);
    setSubmitting(true);
    setSubmissionProgress(10);
    setSubmissionStep("Preparing transaction...");

    try {
      const activeWallet = wallets.find((w) => w.address.toLowerCase() === walletAddress?.toLowerCase());
      if (!activeWallet) throw new Error("Wallet not found. Please reconnect.");
      
      const ethereumProvider = await activeWallet.getEthereumProvider();
      const policyAddress = getDataPolicyAddress();

      setSubmissionStep("Locking escrow...");
      setSubmissionProgress(55);

      const requestData = encodeFunctionData({
        abi: DATA_POLICY_ABI,
        functionName: "requestAccess",
        args: [
          dataset.datasetRoot as Hex,
          keccak256(toHex(purposeId)) as Hex,
          epochsNum,
          dataset.manifestHash as Hex,
        ],
      });

      const txHash = await ethereumProvider.request({
        method: "eth_sendTransaction",
        params: [{
          from: walletAddress as Address,
          to: policyAddress,
          data: requestData,
          value: `0x${quoteRaw.toString(16)}`,
        }],
      }) as string;

      console.log("Transaction sent:", txHash);
      setSubmissionStep("Waiting for escrow confirmation...");
      setSubmissionProgress(90);
      await waitForTx(txHash);
      await fetchOnChainData();

      setSubmissionProgress(100);
      setSuccess(true);
      setSubmissionStep("Success!");

      // Redirect after success
      setTimeout(() => {
        router.push("/app/sessions");
      }, 2500);

    } catch (err: any) {
      console.error(err);
      setSubmissionError(err?.message || "Transaction failed or was cancelled.");
      setSubmitting(false);
      setSubmissionStep(null);
      setSubmissionProgress(0);
    }
  };

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

  return (
    <div className="flex flex-col min-h-full">
      <AppTopbar title="Start Training" />
      
      {/* Progress Sub-header */}
      {submitting && (
        <div className="border-b bg-background/50 backdrop-blur-sm sticky top-12 z-10 px-6 py-2 flex items-center justify-between animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-3 flex-1 max-w-md mx-auto">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground whitespace-nowrap">
              {submissionStep}
            </span>
            <Progress value={submissionProgress} className="h-1" />
          </div>
        </div>
      )}

      <div className="flex-1 p-6 flex flex-col gap-4 max-w-xl mx-auto w-full">
        {/* Breadcrumb */}
        <Button asChild variant="ghost" size="sm" className="h-7 -ml-2 text-xs text-muted-foreground w-fit hover:bg-foreground/5 transition-colors">
          <Link href={`/app/marketplace/${datasetRoot}`}>
            <ArrowLeftIcon className="size-3 mr-1" />
            {dataset.label}
          </Link>
        </Button>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-2">
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div className="flex items-center gap-1.5">
                <div className={cn(
                  "size-5 rounded-full flex items-center justify-center text-[10px] font-medium transition-colors",
                  i < step ? "bg-foreground text-background" :
                  i === step ? "border border-foreground text-foreground" :
                  "border border-border text-muted-foreground"
                )}>
                  {i < step ? "✓" : i + 1}
                </div>
                <span className={cn(
                  "text-xs transition-colors",
                  i === step ? "text-foreground font-medium" : "text-muted-foreground"
                )}>{s}</span>
              </div>
              {i < STEPS.length - 1 && <div className="flex-1 h-px bg-border" />}
            </React.Fragment>
          ))}
        </div>

        {/* Step 0: Configure */}
        {step === 0 && (
          <Card className="border-border/40 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold tracking-tight">Configure Request</CardTitle>
              <CardDescription className="text-xs">Set training parameters for this access request.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Dataset</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{dataset.label}</span>
                  <HashChip hash={dataset.datasetRoot} />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Purpose</label>
                <Select value={purposeId} onValueChange={setPurposeId}>
                  <SelectTrigger className="h-9 text-xs bg-muted/5 border-border/60">
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
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Epochs to train (max {dataset.maxEpochsPerRun})
                </label>
                <Input
                  type="number"
                  value={epochs}
                  onChange={(e) => setEpochs(e.target.value)}
                  min={1}
                  max={dataset.maxEpochsPerRun}
                  className="h-9 text-xs font-mono bg-muted/5 border-border/60"
                />
              </div>

              <Separator className="opacity-40" />

              <div className="flex flex-col gap-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Royalty Rate</span>
                  <span className="font-mono font-medium">{dataset.royaltyPerEpoch} 0G / epoch</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Requested Epochs</span>
                  <span className="font-mono font-medium">{epochsNum}</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="font-semibold">Total escrow required</span>
                  <span className="font-mono font-bold text-sm">{quote} 0G</span>
                </div>
              </div>

              <Button
                className="w-full h-10 text-xs font-semibold"
                onClick={() => setStep(1)}
                disabled={epochsNum < 1 || epochsNum > dataset.maxEpochsPerRun}
              >
                Continue to Review
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 1: Review */}
        {step === 1 && (
          <Card className="border-border/40 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold tracking-tight">Review Terms</CardTitle>
              <CardDescription className="text-xs">Confirm the policy terms before submitting.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-xs">
              <div className="space-y-3 p-3 rounded-lg bg-muted/5 border border-border/40">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Dataset</span>
                  <HashChip hash={dataset.datasetRoot} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Purpose</span>
                  <Badge variant="secondary" className="font-mono text-[10px] h-5 px-2 bg-foreground/5 text-foreground border-foreground/10">
                    {getPurposeLabel(purposeId)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Epochs</span>
                  <span className="font-mono font-medium">{epochsNum}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Rate</span>
                  <span className="font-mono">{dataset.royaltyPerEpoch} 0G/epoch</span>
                </div>
                <Separator className="opacity-40" />
                <div className="flex items-center justify-between pt-1">
                  <span className="font-semibold">Escrow to lock</span>
                  <span className="font-mono font-bold text-sm">{quote} 0G</span>
                </div>
              </div>

              <div className="space-y-2 px-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Settlement Mode</span>
                  <span className="font-medium">Settle-by-actual · refund delta</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Proof required</span>
                  <Badge variant="outline" className="text-[10px] h-4 font-normal">
                    {dataset.requireResultAttestation ? "Hardware Attestation" : "None"}
                  </Badge>
                </div>
              </div>

              <Separator className="opacity-40" />

              <div className="flex flex-col gap-2 px-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Your 0G balance</span>
                  <span className={cn(
                    "font-mono font-bold",
                    !hasBalance ? "text-destructive" : "text-foreground"
                  )}>
                    {balanceStr} 0G
                  </span>
                </div>
                {!hasBalance && (
                  <Alert variant="destructive" className="py-2 bg-destructive/5 border-destructive/20">
                    <AlertTriangleIcon className="size-3" />
                    <AlertDescription className="text-[10px] font-medium">
                      Insufficient 0G. You need {quote} but have {balanceStr}. Fund the connected wallet before continuing.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <div className="flex items-center gap-2 mt-2">
                <Button variant="outline" className="h-10 text-xs flex-1" onClick={() => setStep(0)}>Back</Button>
                <Button className="h-10 text-xs flex-1 font-semibold" onClick={() => setStep(2)} disabled={!hasBalance}>
                  Confirm Details
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Confirm */}
        {step === 2 && (
          <Card className="border-border/40 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold tracking-tight">Final Confirmation</CardTitle>
              <CardDescription className="text-xs">Sign the transaction to lock native 0G in escrow and submit your request.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="space-y-2">
                <div className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-3 bg-muted/5">
                  <div className="size-2 rounded-full bg-muted-foreground shrink-0" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold">Step 1: Request Access</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">Lock {quote} 0G in the policy escrow.</span>
                  </div>
                  <Badge variant="outline" className="ml-auto text-[10px] h-5 bg-background">pending</Badge>
                </div>
              </div>

              {submissionError && (
                <p className="text-[11px] text-destructive font-medium flex items-center gap-1.5 bg-destructive/5 p-2 rounded border border-destructive/20 mt-2">
                  <X className="size-3 shrink-0" />
                  {submissionError}
                </p>
              )}

              <div className="flex items-center gap-2 mt-4">
                <Button variant="outline" className="h-11 text-xs flex-1" onClick={() => setStep(1)} disabled={submitting}>Back</Button>
                <Button 
                  className="h-11 text-xs flex-1 font-bold tracking-wide shadow-md" 
                  onClick={handleRequestAccess}
                  disabled={submitting || isCheckingBalance || !hasBalance}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Broadcasting...
                    </>
                  ) : (
                    "Sign & Submit"
                  )}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground text-center mt-2 font-medium">This request sends native 0G as escrow from the connected wallet.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Success Dialog */}
      {success && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
          <Card className="w-full max-w-sm mx-4 shadow-2xl border-2">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto size-16 rounded-full bg-foreground/5 flex items-center justify-center mb-4">
                <CheckCircle2 className="size-10 text-foreground" />
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight">Request Sent!</CardTitle>
              <CardDescription className="text-sm">
                Your access request has been broadcast. The compute provider is being notified.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="flex flex-col gap-2">
                <Button 
                  className="w-full h-11 font-bold" 
                  onClick={() => router.push("/app/sessions")}
                >
                  View My Sessions
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
