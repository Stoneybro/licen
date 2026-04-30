import type { PrivyClientConfig } from "@privy-io/react-auth";
import { defineChain } from "viem";
import { baseSepolia, sepolia } from "viem/chains";

export const zeroGGalileo = defineChain({
  id: 16602,
  name: '0G Galileo Testnet',
  network: '0g-galileo',
  nativeCurrency: {
    decimals: 18,
    name: '0G Token',
    symbol: '0G',
  },
  rpcUrls: {
    default: {
      http: ['https://evmrpc-testnet.0g.ai'],
    },
    public: {
      http: ['https://evmrpc-testnet.0g.ai'],
    },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'https://chainscan-galileo.0g.ai' },
  },
});

export const privyConfig: PrivyClientConfig = {
  embeddedWallets: {
    ethereum: {
      createOnLogin: "users-without-wallets",
    },
  },
  defaultChain: zeroGGalileo,
  supportedChains: [zeroGGalileo],
  loginMethods: ["email", "google", "github"],
  appearance: {
    accentColor: "#ffffff",
    theme: "#000000",
    logo: "/licen-logo-light.svg",
    walletChainType: "ethereum-only",
  },
};
