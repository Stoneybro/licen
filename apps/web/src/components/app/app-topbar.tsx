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
import { ChevronDownIcon, CoinsIcon, Loader2, WalletIcon, ZapIcon } from "lucide-react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { truncHash } from "@/lib/mock";
import { toast } from "sonner";
import { createPublicClient, encodeFunctionData, http, formatUnits, type Address } from "viem";
import { getOgChain, USDC_TOKEN_ADDRESS } from "@/lib/publish/onchain";

const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

const MINT_ABI = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [],
  },
] as const;

// 1,000 USDC in raw units (6 decimals)
const FAUCET_AMOUNT = BigInt(1_000 * 1_000_000);

export function AppTopbar({ title }: { title?: string }) {
  const { user, logout } = usePrivy();
  const { wallets } = useWallets();
  const walletAddress = user?.wallet?.address;
  const [balance, setBalance] = React.useState<string>("0");
  const [minting, setMinting] = React.useState(false);

  const refreshBalance = React.useCallback(() => {
    if (!walletAddress) return;
    const rpcUrl = process.env.NEXT_PUBLIC_OG_EVM_RPC_URL || "https://evmrpc-testnet.0g.ai";
    const client = createPublicClient({ chain: getOgChain(rpcUrl), transport: http(rpcUrl) });
    client
      .readContract({
        address: USDC_TOKEN_ADDRESS as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [walletAddress as `0x${string}`],
      })
      .then((b) => setBalance(Number(formatUnits(b as bigint, 6)).toFixed(2)))
      .catch(console.error);
  }, [walletAddress]);

  React.useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  const handleMintUsdc = async () => {
    if (!walletAddress) return;
    setMinting(true);
    try {
      const activeWallet = wallets.find(
        (w) => w.address.toLowerCase() === walletAddress.toLowerCase()
      );
      if (!activeWallet) throw new Error("Wallet not found");
      const provider = await activeWallet.getEthereumProvider();
      const data = encodeFunctionData({
        abi: MINT_ABI,
        functionName: "mint",
        args: [walletAddress as Address, FAUCET_AMOUNT],
      });
      await provider.request({
        method: "eth_sendTransaction",
        params: [{ from: walletAddress as Address, to: USDC_TOKEN_ADDRESS, data }],
      });
      toast.success("⚡ Minting 1,000 test USDC — balance will update shortly.");
      await new Promise((r) => setTimeout(r, 4500));
      refreshBalance();
    } catch (e: any) {
      toast.error(e?.message || "Mint failed");
    } finally {
      setMinting(false);
    }
  };

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
            <p className="text-xs">Live on-chain MockUSDC balance</p>
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
            <DropdownMenuItem
              className="text-xs gap-2"
              onClick={handleMintUsdc}
              disabled={minting}
            >
              {minting ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <ZapIcon className="size-3 text-amber-400" />
              )}
              {minting ? "Minting..." : "Get 1,000 Test USDC"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-xs text-muted-foreground"
              onClick={handleLogout}
            >
              Disconnect
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
