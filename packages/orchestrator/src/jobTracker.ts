/**
 * Orchestrator — Job Tracker
 *
 * Persists dispatched 0G Compute tasks to the database and runs a background
 * poll loop that transitions jobs through the full lifecycle:
 *
 *   pending → dispatching → running → acknowledging → completed
 *                                                  ↘ failed
 *
 * The tracker calls the corresponding DataPolicy.sol functions:
 *   - SetUp       → (already handled by dispatcher calling startJob())
 *   - Delivered   → acknowledgeModel() to trigger provider fee settlement
 *   - Finished    → confirmTrainingComplete() with resultHash + attestationRef
 *   - Failed      → markJobFailed()
 *
 * Survives orchestrator restarts: on boot, all "running" and "acknowledging"
 * jobs are rehydrated from the database and resume polling.
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
import { eq, or } from "drizzle-orm";
import { db } from "./db/db.js";
import { computeJobs } from "./db/schema.js";
import { DATA_POLICY_ABI } from "./contract.js";
import * as ComputeClient from "./computeClient.js";

// ---------------------------------------------------------------------------
// Chain + contract setup (mirrors dispatcher.ts)
// ---------------------------------------------------------------------------

function getOgChain() {
  const rpcUrl = process.env.OG_EVM_RPC_URL ?? "https://evmrpc-testnet.0g.ai";
  return defineChain({
    id: 16602,
    name: "0G Testnet",
    network: "0g-testnet",
    nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
}

function getClients() {
  const rpcUrl = process.env.OG_EVM_RPC_URL ?? "https://evmrpc-testnet.0g.ai";
  const backendKey = process.env.BACKEND_WALLET_PRIVATE_KEY;
  if (!backendKey) throw new Error("Missing env: BACKEND_WALLET_PRIVATE_KEY");

  const chain = getOgChain();
  const account = privateKeyToAccount(backendKey as Hex);
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ chain, transport: http(rpcUrl), account });

  return { publicClient, walletClient, account };
}

function getContractAddress(): Address {
  const addr = process.env.OG_DATA_POLICY_ADDRESS;
  if (!addr) throw new Error("Missing env: OG_DATA_POLICY_ADDRESS");
  return addr as Address;
}

// ---------------------------------------------------------------------------
// Poll interval
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = parseInt(process.env.OG_TASK_POLL_MS ?? "30000", 10);

// ---------------------------------------------------------------------------
// Public API — called by dispatcher after submitting a 0G task
// ---------------------------------------------------------------------------

export async function registerJob(params: {
  licenJobId: string;
  datasetRoot: string;
  zeroGTaskId: string;
  providerAddress: string;
  requestedEpochs: number;
}): Promise<void> {
  await db.insert(computeJobs).values({
    licenJobId: params.licenJobId,
    datasetRoot: params.datasetRoot,
    zeroGTaskId: params.zeroGTaskId,
    providerAddress: params.providerAddress,
    requestedEpochs: params.requestedEpochs,
    status: "running",
  });
  console.log(`[jobTracker] Registered job ${params.licenJobId} → 0G task ${params.zeroGTaskId}`);
}

// ---------------------------------------------------------------------------
// Completion poll loop
// ---------------------------------------------------------------------------

async function pollActiveJobs(): Promise<void> {
  const active = await db.query.computeJobs.findMany({
    where: (j) => or(eq(j.status, "running"), eq(j.status, "acknowledging")),
  });

  if (active.length === 0) return;
  console.log(`[jobTracker] Polling ${active.length} active job(s)...`);

  const { walletClient, account } = getClients();
  const contractAddress = getContractAddress();

  for (const job of active) {
    if (!job.zeroGTaskId || !job.providerAddress) continue;

    try {
      const progress = await ComputeClient.getTaskStatus(job.zeroGTaskId, job.providerAddress);
      console.log(`[jobTracker] Job ${job.licenJobId} → 0G status: ${progress}`);

      // ── Delivered: acknowledge to trigger provider fee settlement ────────
      if (progress === "Delivered" && job.status === "running") {
        await db
          .update(computeJobs)
          .set({ status: "acknowledging", updatedAt: new Date() })
          .where(eq(computeJobs.licenJobId, job.licenJobId));

        const resultHash = await ComputeClient.acknowledgeModel(job.zeroGTaskId, job.providerAddress);

        await db
          .update(computeJobs)
          .set({ resultHash, updatedAt: new Date() })
          .where(eq(computeJobs.licenJobId, job.licenJobId));

        console.log(`[jobTracker] Model acknowledged for job ${job.licenJobId}`);
      }

      // ── Finished: confirm on-chain ────────────────────────────────────────
      if (progress === "Finished") {
        const resultHash = job.resultHash ?? `0x${"0".repeat(64)}`;
        // Use task ID as on-chain attestation reference (Track D will do full TEE verification)
        const attestationRef = `0x${job.zeroGTaskId.replace(/-/g, "").padEnd(64, "0").slice(0, 64)}` as Hex;
        const actualEpochs = job.requestedEpochs; // 0G Compute does not expose actual epoch count yet

        const txHash = await walletClient.writeContract({
          address: contractAddress,
          abi: DATA_POLICY_ABI,
          functionName: "confirmTrainingComplete",
          args: [job.licenJobId as Hex, actualEpochs, resultHash as Hex, attestationRef],
          account,
          chain: null,
        });

        await db
          .update(computeJobs)
          .set({
            status: "completed",
            actualEpochs,
            attestationRef,
            updatedAt: new Date(),
          })
          .where(eq(computeJobs.licenJobId, job.licenJobId));

        console.log(`[jobTracker] ✅ Job ${job.licenJobId} completed. confirmTrainingComplete tx: ${txHash}`);
      }

      // ── Failed: mark on-chain ─────────────────────────────────────────────
      if (progress === "Failed") {
        await walletClient.writeContract({
          address: contractAddress,
          abi: DATA_POLICY_ABI,
          functionName: "markJobFailed",
          args: [job.licenJobId as Hex, "0G_COMPUTE_TASK_FAILED"],
          account,
          chain: null,
        });

        await db
          .update(computeJobs)
          .set({ status: "failed", updatedAt: new Date() })
          .where(eq(computeJobs.licenJobId, job.licenJobId));

        console.log(`[jobTracker] ❌ Job ${job.licenJobId} failed.`);
      }
    } catch (err) {
      console.error(`[jobTracker] Error polling job ${job.licenJobId}:`, err);
      // Don't mark as failed on poll error — will retry next interval
    }
  }
}

// ---------------------------------------------------------------------------
// Entry point — called from index.ts alongside startPoller()
// ---------------------------------------------------------------------------

export function startJobTracker(): void {
  console.log(`[jobTracker] Starting job tracker (interval: ${POLL_INTERVAL_MS}ms)`);

  // Rehydrate on startup: log any jobs that were in-flight at last shutdown
  db.query.computeJobs
    .findMany({ where: (j) => eq(j.status, "running") })
    .then((jobs) => {
      if (jobs.length > 0) {
        console.log(`[jobTracker] Rehydrated ${jobs.length} in-flight job(s) from DB`);
      }
    })
    .catch(console.error);

  pollActiveJobs();
  setInterval(pollActiveJobs, POLL_INTERVAL_MS);
}
