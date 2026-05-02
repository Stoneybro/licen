/**
 * Orchestrator — Job Dispatcher
 *
 * Called by the main loop when an AccessGranted job is ready for compute.
 *
 * Responsibilities:
 *  1. Verify on-chain job state is Granted (guard against race conditions).
 *  2. Fetch the encrypted key envelope from 0G Storage metadata.
 *  3. Unseal the AES key using ECIES private key.
 *  4. Dispatch to 0G Compute (stub — replace with real API call).
 *  5. Call startJob() on-chain to move state to Running.
 *  6. Zero the AES key from memory.
 *
 * On any error: call markJobFailed() on-chain so the researcher can be refunded.
 */

import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { DATA_POLICY_ABI, JobState } from "./contract.js";
import { unsealDatasetKey } from "./keyExchange.js";

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// Chain + client setup
// ---------------------------------------------------------------------------

function getOgChain() {
  const rpcUrl =
    process.env.OG_EVM_RPC_URL ?? "https://evmrpc-testnet.0g.ai";

  return defineChain({
    id: 16602,
    name: "0G Testnet",
    network: "0g-testnet",
    nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
}

function getClients() {
  const rpcUrl =
    process.env["OG_EVM_RPC_URL"] ?? "https://evmrpc-testnet.0g.ai";
  const backendKey = process.env["BACKEND_WALLET_PRIVATE_KEY"];
  if (!backendKey) throw new Error("Missing env: BACKEND_WALLET_PRIVATE_KEY");

  const chain = getOgChain();
  const account = privateKeyToAccount(backendKey as Hex);

  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const walletClient = createWalletClient({
    chain,
    transport: http(rpcUrl),
    account,
  });

  return { publicClient, walletClient, account };
}

function getContractAddress(): Address {
  const addr = process.env["OG_DATA_POLICY_ADDRESS"];
  if (!addr) throw new Error("Missing env: OG_DATA_POLICY_ADDRESS");
  return addr as Address;
}

// ---------------------------------------------------------------------------
// 0G Compute dispatch (stub)
// ---------------------------------------------------------------------------

/**
 * Dispatch a training job to a 0G Compute node.
 *
 * TODO: Replace this stub with the real 0G Compute API call.
 * The compute node needs:
 *   - datasetCid: the 0G Storage root hash of the encrypted dataset blob
 *   - aesKeyHex: decrypted AES key (32 bytes, hex)
 *   - ivHex: the IV (12 bytes, hex)
 *   - requestedEpochs: how many epochs to train
 *
 * The node should zero the key after loading the dataset into memory.
 */
async function dispatchTo0GCompute(params: {
  jobId: string;
  datasetCid: string;
  aesKeyHex: string;
  ivHex: string;
  requestedEpochs: number;
}): Promise<void> {
  // STUB — log for now. In production, call the 0G Compute node API.
  console.log(`[dispatcher] 0G Compute dispatch stub for job ${params.jobId}`);
  console.log(`  datasetCid:      ${params.datasetCid}`);
  console.log(`  requestedEpochs: ${params.requestedEpochs}`);
  console.log(`  aesKey:          ████████████████████████████████ (redacted)`);

  // TODO: Replace with actual HTTP call to 0G Compute API:
  //
  // await fetch(process.env.OG_COMPUTE_API_URL + "/jobs", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({
  //     jobId: params.jobId,
  //     datasetCid: params.datasetCid,
  //     aesKeyHex: params.aesKeyHex,
  //     ivHex: params.ivHex,
  //     requestedEpochs: params.requestedEpochs,
  //   }),
  // });
}

// ---------------------------------------------------------------------------
// Main dispatch function — called per AccessGranted job
// ---------------------------------------------------------------------------

export type GrantedJob = {
  /** On-chain job ID (bytes32 hex) */
  jobId: string;
  /** Dataset root hash — used to fetch the encrypted key from 0G Storage */
  datasetRoot: string;
  /** ECIES-encrypted AES key envelope stored at publish time */
  encryptedKeyEnvelope: string;
  /** 0G Storage CID of the encrypted dataset blob */
  datasetCid: string;
  /** Number of epochs the researcher requested */
  requestedEpochs: number;
};

export async function processGrantedJob(job: GrantedJob): Promise<void> {
  const { publicClient, walletClient, account } = getClients();
  const contractAddress = getContractAddress();

  console.log(`[dispatcher] Processing job ${job.jobId}`);

  // ── Step 1: Guard — verify on-chain state is Granted ──────────────────────
  const onChainJob = await publicClient.readContract({
    address: contractAddress,
    abi: DATA_POLICY_ABI,
    functionName: "jobs",
    args: [job.jobId as Hex],
  });

  const onChainState = Number(onChainJob[7]); // state is slot [7]

  if (onChainState !== JobState.Granted) {
    console.warn(
      `[dispatcher] Job ${job.jobId} is not in Granted state (got ${onChainState}). Skipping.`
    );
    return;
  }

  // ── Step 2: Unseal the AES key ─────────────────────────────────────────────
  let unsealedKey;
  try {
    unsealedKey = unsealDatasetKey(job.encryptedKeyEnvelope);
  } catch (err) {
    console.error(`[dispatcher] Failed to unseal key for job ${job.jobId}:`, err);
    await markFailed(walletClient, account, contractAddress, job.jobId, "KEY_UNSEAL_FAILED");
    return;
  }

  // ── Step 3: Dispatch to 0G Compute ────────────────────────────────────────
  try {
    const aesKeyHex = bytesToHex(unsealedKey.aesKey);
    const ivHex = bytesToHex(unsealedKey.iv);

    await dispatchTo0GCompute({
      jobId: job.jobId,
      datasetCid: job.datasetCid,
      aesKeyHex,
      ivHex,
      requestedEpochs: job.requestedEpochs,
    });
  } catch (err) {
    console.error(`[dispatcher] 0G Compute dispatch failed for job ${job.jobId}:`, err);
    unsealedKey.zero();
    await markFailed(walletClient, account, contractAddress, job.jobId, "COMPUTE_DISPATCH_FAILED");
    return;
  } finally {
    // ── Step 4: Zero the AES key from memory regardless of outcome ──────────
    unsealedKey.zero();
  }

  // ── Step 5: Mark job as Running on-chain ──────────────────────────────────
  try {
    const txHash = await walletClient.writeContract({
      address: contractAddress,
      abi: DATA_POLICY_ABI,
      functionName: "startJob",
      args: [job.jobId as Hex],
      account,
      chain: null,
    });
    console.log(`[dispatcher] startJob tx: ${txHash}`);
  } catch (err) {
    console.error(`[dispatcher] startJob failed for job ${job.jobId}:`, err);
    // The compute job may already be running — log but don't mark failed
    // as that would prevent settlement. Operator must monitor manually.
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function markFailed(
  walletClient: ReturnType<typeof createWalletClient>,
  account: ReturnType<typeof privateKeyToAccount>,
  contractAddress: Address,
  jobId: string,
  reason: string
): Promise<void> {
  try {
    await walletClient.writeContract({
      address: contractAddress,
      abi: DATA_POLICY_ABI,
      functionName: "markJobFailed",
      args: [jobId as Hex, reason],
      account,
      chain: null,
    });
    console.log(`[dispatcher] Marked job ${jobId} as failed: ${reason}`);
  } catch (err) {
    console.error(`[dispatcher] markJobFailed also failed for ${jobId}:`, err);
  }
}
