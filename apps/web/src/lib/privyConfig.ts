import type { PrivyClientConfig } from "@privy-io/react-auth";
import { baseSepolia, sepolia } from "viem/chains";

export const privyConfig: PrivyClientConfig = {
  embeddedWallets: {
    ethereum: {
      createOnLogin: "users-without-wallets",
    },
  },
  defaultChain: baseSepolia,
  supportedChains: [baseSepolia, sepolia],
  loginMethods: ["email", "google", "github"],
  appearance: {
    accentColor: "#ffffff",
    theme: "#000000",
    logo: "/licen-logo-light.svg",
    walletChainType: "ethereum-only",
  },
};
