"use client";

import * as React from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronDownIcon, CoinsIcon, WalletIcon } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { truncHash } from "@/lib/mock";
import { toast } from "sonner";
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

export function AppTopbar({ title }: { title?: string }) {
  const { user, logout } = usePrivy();
  const walletAddress = user?.wallet?.address;
  const [balance, setBalance] = React.useState<string>("0");

  React.useEffect(() => {
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
      setBalance(Number(formatUnits(b as bigint, 6)).toFixed(2));
    }).catch(console.error);
  }, [walletAddress]);

  const handleCopyAddress = async () => {
    if (!walletAddress) {
      toast.error("No wallet address to copy");
      return;
    }

    try {
      await navigator.clipboard.writeText(walletAddress);
      toast.success("Wallet address copied");
    } catch {
      toast.error("Failed to copy wallet address");
    }
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = "/";
  };

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-4" />

      {title && (
        <span className="text-sm font-medium text-foreground">{title}</span>
      )}

      <div className="ml-auto flex items-center gap-3">
        {/* USDC balance */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="font-mono text-xs gap-1 cursor-default">
              <CoinsIcon className="size-3" />
              {balance} USDC
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">
              Live on-chain balance
            </p>
          </TooltipContent>
        </Tooltip>

        {/* Wallet dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 gap-1.5 font-mono text-xs">
              <WalletIcon className="size-3" data-icon="inline-start" />
              {walletAddress ? truncHash(walletAddress) : "No wallet"}
              <ChevronDownIcon className="size-3" data-icon="inline-end" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-mono text-xs text-muted-foreground break-all">
              {walletAddress ?? "No wallet connected"}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs" onClick={handleCopyAddress}>
              Copy wallet address
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs text-muted-foreground" onClick={handleLogout}>
              Disconnect
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
