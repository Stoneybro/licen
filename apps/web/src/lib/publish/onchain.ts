import { createPublicClient, defineChain, http, isAddress, keccak256, toHex, type Address, type Hex } from "viem";
import type { PublishPolicyConfig, PublishPurpose } from "@/lib/publish/contracts";

export const DATA_POLICY_ABI = [
  {
    type: "function",
    name: "registerDataset",
    stateMutability: "nonpayable",
    inputs: [
      { name: "datasetRoot", type: "bytes32" },
      { name: "manifestHash", type: "bytes32" },
      { name: "royaltyPerEpoch", type: "uint256" },
      { name: "maxEpochsPerRun", type: "uint32" },
      { name: "maxRunsPerRequester", type: "uint32" },
      { name: "accessTtlSeconds", type: "uint64" },
      { name: "policyExpiry", type: "uint64" },
      { name: "requireResultAttestation", type: "bool" },
      { name: "openRequesters", type: "bool" },
      { name: "_allowedPurposeIds", type: "bytes32[]" },
      { name: "_allowedRequesters", type: "address[]" },
    ],
    outputs: [],
  },
] as const;



function purposeToBytes32(purpose: PublishPurpose): Hex {
  return keccak256(toHex(purpose));
}

function toUint32(value: number): number {
  return Math.max(1, Math.floor(value));
}

export function getDataPolicyAddress(): Address {
  const address =
    process.env.NEXT_PUBLIC_OG_DATA_POLICY_ADDRESS ?? "0x6c6b5c86752D8B5330Cb055A967E2f6253D09195";
  if (!isAddress(address)) {
    throw new Error("NEXT_PUBLIC_OG_DATA_POLICY_ADDRESS must be a valid EVM address");
  }

  return address;
}

export function buildRegisterDatasetArgs(input: {
  datasetRoot: Hex;
  manifestHash: Hex;
  ownerAddress: Address;
  policy: PublishPolicyConfig;
}) {
  const ttlSeconds = BigInt(Math.max(3600, Math.floor(input.policy.ttlHours * 60 * 60)));

  return [
    input.datasetRoot,
    input.manifestHash,
    BigInt(Math.max(1, Math.floor(input.policy.royaltyPerEpoch))),
    toUint32(input.policy.maxEpochsPerRun),
    toUint32(input.policy.maxRunsPerRequester),
    ttlSeconds,
    BigInt(input.policy.policyExpiry),
    false,
    true,
    input.policy.allowedPurposeIds.map(purposeToBytes32),
    [] as Address[],
  ] as const;
}

export function getOgPublicClient() {
  const resolvedRpcUrl = process.env.OG_EVM_RPC_URL ?? process.env.NEXT_PUBLIC_OG_EVM_RPC_URL;
  if (!resolvedRpcUrl) {
    throw new Error("Missing required env var: OG_EVM_RPC_URL or NEXT_PUBLIC_OG_EVM_RPC_URL");
  }

  const ogChain = getOgChain(resolvedRpcUrl);

  return createPublicClient({
    chain: ogChain,
    transport: http(resolvedRpcUrl),
  });
}

export function getOgChain(rpcUrl?: string) {
  const resolvedRpcUrl =
    rpcUrl ??
    process.env.OG_EVM_RPC_URL ??
    process.env.NEXT_PUBLIC_OG_EVM_RPC_URL ??
    "https://evmrpc-testnet.0g.ai";

  const chainId = 16602;

  return defineChain({
    id: Number.isFinite(chainId) ? chainId : 16601,
    name: "0G",
    network: "0g",
    nativeCurrency: {
      name: "0G",
      symbol: "0G",
      decimals: 18,
    },
    rpcUrls: {
      default: {
        http: [resolvedRpcUrl],
      },
    },
  });
}
