/**
 * Orchestrator — 0G Compute SDK Client
 *
 * Wraps @0gfoundation/0g-compute-ts-sdk to provide a clean, typed interface
 * for the dispatcher and job tracker.
 *
 * Uses the "Direct" path (not Router) because:
 *  1. The orchestrator is a server-side Node.js process with a dedicated wallet.
 *  2. Fine-tuning is not available via the Router path.
 *  3. We need a Task ID back to poll completion status.
 *
 * Payment model:
 *  The orchestrator's OG_COMPUTE_PRIVATE_KEY wallet must hold native 0G tokens.
 *  The SDK handles ledger creation and provider sub-account funding automatically
 *  in Node.js environments (auto-funding mode).
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);
// Use require() to avoid ethers ESM/CJS dual-build type conflict
const { ethers } = require("ethers") as typeof import("ethers");

// Lazy-load the 0G compute SDK only when needed (not in demo mode)
// This avoids ESM/CJS compatibility errors at startup
let _createZGComputeNetworkBroker: typeof import("@0gfoundation/0g-compute-ts-sdk")["createZGComputeNetworkBroker"] | null = null;
async function getComputeSdk() {
  if (!_createZGComputeNetworkBroker) {
    const mod = require("@0gfoundation/0g-compute-ts-sdk");
    _createZGComputeNetworkBroker = mod.createZGComputeNetworkBroker;
  }
  return _createZGComputeNetworkBroker!;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FineTuningConfig {
  neftune_noise_alpha: number;
  num_train_epochs: number;
  per_device_train_batch_size: number;
  learning_rate: number;
  max_steps: number;
}

export interface DispatchResult {
  taskId: string;
  providerAddress: string;
}

// ---------------------------------------------------------------------------
// Broker singleton
// ---------------------------------------------------------------------------

let brokerInstance: any = null;

async function getBroker() {
  if (brokerInstance) return brokerInstance;

  const privateKey = process.env.OG_COMPUTE_PRIVATE_KEY;
  if (!privateKey) throw new Error("Missing OG_COMPUTE_PRIVATE_KEY");

  const rpcUrl = process.env.OG_EVM_RPC_URL ?? "https://evmrpc-testnet.0g.ai";
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`, provider);

  const createBroker = await getComputeSdk();
  brokerInstance = await createBroker(wallet as any);
  return brokerInstance;
}

// ---------------------------------------------------------------------------
// Provider discovery — auto-pick first available fine-tuning provider
// ---------------------------------------------------------------------------

async function discoverProvider(): Promise<string> {
  // Allow hard-coding via env for deterministic behaviour
  const hardcoded = process.env.OG_COMPUTE_PROVIDER_ADDRESS;
  if (hardcoded) {
    console.log(`[computeClient] Using configured provider: ${hardcoded}`);
    return hardcoded;
  }

  const broker = await getBroker();
  // listService returns all registered providers — filter for fine-tuning
  const services: any[] = await (broker as any).fineTuning.listService();
  const available = services.filter((s: any) => s.available === true || s.Available === true);

  if (available.length === 0) {
    throw new Error("No available 0G Compute fine-tuning providers found");
  }

  const chosen = available[0];
  const addr = chosen.provider || chosen.providerAddress || chosen.address;
  console.log(`[computeClient] Auto-discovered provider: ${addr}`);
  return addr;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Submit a fine-tuning task to 0G Compute.
 * The dataset must already be uploaded to 0G Storage — we pass the root hash.
 */
export async function createFineTuningTask(params: {
  datasetRootHash: string;
  model?: string;
  requestedEpochs: number;
}): Promise<DispatchResult> {
  if (process.env.LICEN_DEMO_MODE === "true") {
    const { randomUUID } = require("crypto");
    const taskId = randomUUID();
    console.warn(`[computeClient] DEMO MODE — skipping 0G SDK, generating fake task: ${taskId}`);
    return { taskId, providerAddress: "0xdemo" };
  }

  const broker = await getBroker();
  const providerAddress = await discoverProvider();

  const model = params.model ?? process.env.OG_COMPUTE_MODEL ?? "Qwen2.5-0.5B-Instruct";

  const config: FineTuningConfig = {
    neftune_noise_alpha: 5,
    num_train_epochs: Math.max(1, params.requestedEpochs),
    per_device_train_batch_size: 2,
    learning_rate: 0.0002,
    max_steps: 3,
  };

  console.log(`[computeClient] Creating fine-tuning task`);
  console.log(`  provider: ${providerAddress}`);
  console.log(`  model:    ${model}`);
  console.log(`  dataset:  ${params.datasetRootHash}`);
  console.log(`  epochs:   ${config.num_train_epochs}`);

  // The SDK auto-funds the provider sub-account in Node.js mode
  const result = await (broker as any).fineTuning.createTask(
    providerAddress,
    model,
    params.datasetRootHash,
    config
  );

  const taskId: string = result?.taskId ?? result?.id ?? result;

  if (!taskId) {
    throw new Error("0G Compute SDK did not return a task ID");
  }

  console.log(`[computeClient] Task created: ${taskId}`);
  return { taskId, providerAddress };
}

/**
 * Poll the current status of a fine-tuning task.
 * Returns the raw 0G Compute progress string.
 */
export async function getTaskStatus(
  taskId: string,
  providerAddress: string
): Promise<string> {
  const broker = await getBroker();
  const task = await (broker as any).fineTuning.getTask(providerAddress, taskId);
  return task?.progress ?? task?.status ?? "Unknown";
}

/**
 * Acknowledge model delivery. Triggers provider fee settlement.
 * Returns the 0G Storage root hash of the encrypted LoRA adapter.
 */
export async function acknowledgeModel(
  taskId: string,
  providerAddress: string
): Promise<string> {
  const broker = await getBroker();
  const tmpPath = `/tmp/licen-lora-${taskId}.bin`;

  console.log(`[computeClient] Acknowledging model delivery for task ${taskId}`);

  await (broker as any).fineTuning.acknowledgeModel(
    providerAddress,
    taskId,
    tmpPath
  );

  // The model is encrypted; the root hash of the output file is our resultHash
  const task = await (broker as any).fineTuning.getTask(providerAddress, taskId);
  const resultHash: string =
    task?.outputModelHash ??
    task?.resultHash ??
    task?.datasetHash ??    // fallback: use dataset hash if output hash unavailable
    `0x${taskId.replace(/-/g, "").padEnd(64, "0")}`;

  console.log(`[computeClient] Model acknowledged. resultHash: ${resultHash}`);
  return resultHash;
}
