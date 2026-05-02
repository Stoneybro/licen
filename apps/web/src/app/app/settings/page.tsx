"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AppTopbar } from "@/components/app/app-topbar";
import { HashChip } from "@/components/app/hash-chip";
import { usePrivy } from "@privy-io/react-auth";
import { createPublicClient, http, formatUnits } from "viem";
import { getOgChain } from "@/lib/publish/onchain";

const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  }
] as const;

const TOKEN_ADDRESS = "0x6A0C73162c20Bc56212D643112c339f654C45198";

export default function SettingsPage() {
  const { user } = usePrivy();
  const walletAddress = user?.wallet?.address;
  const [balance, setBalance] = useState<string>("0.00");

  useEffect(() => {
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
      setBalance(Number(formatUnits(b as bigint, 18)).toFixed(2));
    }).catch(console.error);
  }, [walletAddress]);

  return (
    <div className="flex flex-col min-h-full">
      <AppTopbar title="Settings" />
      <div className="flex-1 p-6 flex flex-col gap-4 max-w-2xl">
        {/* Wallet */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Wallet</CardTitle>
            <CardDescription className="text-xs">Connected via Privy</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Address</span>
              {walletAddress ? (
                <HashChip hash={walletAddress} front={10} back={8} />
              ) : (
                <span className="text-muted-foreground">Not connected</span>
              )}
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">USDC balance</span>
              <span className="font-mono font-medium">{balance} USDC</span>
            </div>
          </CardContent>
        </Card>

        {/* Network */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Network</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Chain</span>
              <span className="font-mono font-medium">0G Testnet</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Indexer</span>
              <span className="font-medium">Envio HyperIndex</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Compute</span>
              <span className="font-medium">0G Compute (fine-tune path)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Storage</span>
              <span className="font-medium">0G Storage</span>
            </div>
          </CardContent>
        </Card>

        {/* Token */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Royalty Token</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Token</span>
              <Badge variant="outline" className="font-mono text-xs">USDC</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Standard</span>
              <span className="font-mono">ERC-20</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Contract</span>
              <HashChip hash={TOKEN_ADDRESS} front={8} back={6} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
