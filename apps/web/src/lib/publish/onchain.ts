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
  {
    type: "function",
    name: "policies",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [
      { type: "bytes32" },
      { type: "address" },
      { type: "bytes32" },
      { type: "uint256" },
      { type: "uint32" },
      { type: "uint32" },
      { type: "uint64" },
      { type: "uint64" },
      { type: "bool" },
      { type: "bool" },
      { type: "bool" }
    ],
  },
  {
    type: "function",
    name: "requestAccess",
    stateMutability: "nonpayable",
    inputs: [
      { name: "datasetRoot", type: "bytes32" },
      { name: "purposeId", type: "bytes32" },
      { name: "requestedEpochs", type: "uint32" },
      { name: "termsHash", type: "bytes32" },
    ],
    outputs: [{ type: "bytes32", name: "jobId" }],
  }
] as const;

export const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  }
] as const;

export const USDC_TOKEN_ADDRESS = "0x6A0C73162c20Bc56212D643112c339f654C45198";



function purposeToBytes32(purpose: PublishPurpose): Hex {
  return keccak256(toHex(purpose));
}

function toUint32(value: number): number {
  return Math.max(1, Math.floor(value));
}

export function getDataPolicyAddress(): Address {
  const address =
    process.env.NEXT_PUBLIC_OG_DATA_POLICY_ADDRESS ?? "0x6Fe8B5E16df9E0Aaf5E3dDf0E39BFA66dA25bD0b";
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
