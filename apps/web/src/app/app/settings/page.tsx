"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AppTopbar } from "@/components/app/app-topbar";
import { HashChip } from "@/components/app/hash-chip";
import { usePrivy } from "@privy-io/react-auth";
import { createPublicClient, http, formatEther } from "viem";
import { getOgChain } from "@/lib/publish/onchain";

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
    const refreshBalance = () => {
      client.getBalance({
        address: walletAddress as `0x${string}`,
      }).then(b => {
        setBalance(Number(formatEther(b)).toFixed(4));
      }).catch(console.error);
    };

    refreshBalance();
    const id = setInterval(refreshBalance, 10000);
    return () => clearInterval(id);
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
              <span className="text-muted-foreground">0G balance</span>
              <span className="font-mono font-medium">{balance} 0G</span>
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
            <CardTitle className="text-sm font-medium">Settlement Asset</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Asset</span>
              <Badge variant="outline" className="font-mono text-xs">0G</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Transfer mode</span>
              <span className="font-mono">Native value</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
