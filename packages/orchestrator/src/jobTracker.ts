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
  const rawKey = process.env.BACKEND_WALLET_PRIVATE_KEY;
  if (!rawKey) throw new Error("Missing env: BACKEND_WALLET_PRIVATE_KEY");

  // viem requires 0x-prefixed hex — normalise regardless of what's in .env
  const backendKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as Hex;

  const chain = getOgChain();
  const account = privateKeyToAccount(backendKey);
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

const POLL_INTERVAL_MS = parseInt(process.env.OG_TASK_POLL_MS ?? "3000", 10);

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
  const isDemo = process.env.LICEN_DEMO_MODE === "true" && params.providerAddress === "0xdemo";
  await db.insert(computeJobs).values({
    licenJobId: params.licenJobId,
    datasetRoot: params.datasetRoot,
    zeroGTaskId: params.zeroGTaskId,
    providerAddress: params.providerAddress,
    requestedEpochs: params.requestedEpochs,
    status: "running",
    mockDispatchedAt: isDemo ? new Date() : null,
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
      let progress = "";

      if (process.env.LICEN_DEMO_MODE === "true" && job.providerAddress === "0xdemo") {
        // ── Demo mode: simulate staged epoch progression ─────────────────────
        // Each epoch takes MOCK_EPOCH_SECONDS. After all epochs, deliver + finish.
        const MOCK_EPOCH_SECONDS = parseInt(process.env.MOCK_EPOCH_SECONDS ?? "2", 10);
        const dispatchedAt = job.mockDispatchedAt ? job.mockDispatchedAt.getTime() : job.createdAt.getTime();
        const elapsedSeconds = (Date.now() - dispatchedAt) / 1000;
        const totalTrainSeconds = job.requestedEpochs * MOCK_EPOCH_SECONDS;
        const deliverAfter = totalTrainSeconds + 3; // short delivery phase for demo pacing
        const finishAfter = deliverAfter + 4;       // short finalization phase for demo pacing

        if (elapsedSeconds < totalTrainSeconds) {
          // Training in progress — update epoch count on-chain via actualEpochs column
          const completedEpochs = Math.min(
            Math.floor(elapsedSeconds / MOCK_EPOCH_SECONDS),
            job.requestedEpochs - 1 // don't mark all done until Delivered
          );
          progress = "Training";

          // Update actualEpochs in DB so frontend polling shows progress
          if ((job.actualEpochs ?? -1) !== completedEpochs) {
            await db
              .update(computeJobs)
              .set({ actualEpochs: completedEpochs, updatedAt: new Date() })
              .where(eq(computeJobs.licenJobId, job.licenJobId));
            console.log(`[jobTracker] DEMO — job ${job.licenJobId}: epoch ${completedEpochs}/${job.requestedEpochs}`);
          }
          continue; // not yet Delivered — skip the rest of this iteration
        } else if (elapsedSeconds < deliverAfter) {
          progress = "Delivering";
        } else if (elapsedSeconds < finishAfter) {
          progress = "Delivered";
        } else {
          progress = "Finished";
        }
      } else {
        progress = await ComputeClient.getTaskStatus(job.zeroGTaskId, job.providerAddress);
      }
      console.log(`[jobTracker] Job ${job.licenJobId} → status: ${progress}`);

      // ── Delivered: acknowledge to trigger provider fee settlement ────────
      if (progress === "Delivered" && job.status === "running") {
        await db
          .update(computeJobs)
          .set({ status: "acknowledging", updatedAt: new Date() })
          .where(eq(computeJobs.licenJobId, job.licenJobId));

        let resultHash: string;
        if (process.env.LICEN_DEMO_MODE === "true" && job.providerAddress === "0xdemo") {
          resultHash = `0x${job.zeroGTaskId.replace(/-/g, "").padEnd(64, "0").slice(0, 64)}`;
        } else {
          resultHash = await ComputeClient.acknowledgeModel(job.zeroGTaskId, job.providerAddress);
        }

        await db
          .update(computeJobs)
          .set({ resultHash, updatedAt: new Date() })
          .where(eq(computeJobs.licenJobId, job.licenJobId));

        console.log(`[jobTracker] Model acknowledged for job ${job.licenJobId}`);
      }

      // ── Finished: confirm on-chain ────────────────────────────────────────
      if (progress === "Finished") {
        const resultHash = (job.resultHash ?? `0x${"0".repeat(64)}`) as Hex;
        const attestationRef = `0x${job.zeroGTaskId.replace(/-/g, "").padEnd(64, "0").slice(0, 64)}` as Hex;
        const actualEpochs = job.requestedEpochs;

        console.log(`[jobTracker] Calling confirmTrainingComplete for job ${job.licenJobId}...`);
        try {
          const txHash = await walletClient.writeContract({
            address: contractAddress,
            abi: DATA_POLICY_ABI,
            functionName: "confirmTrainingComplete",
            args: [job.licenJobId as Hex, actualEpochs, resultHash, attestationRef],
            account,
            chain: getOgChain(),
          });

          await db
            .update(computeJobs)
            .set({ status: "completed", actualEpochs, attestationRef, updatedAt: new Date() })
            .where(eq(computeJobs.licenJobId, job.licenJobId));

          console.log(`[jobTracker] ✅ Job ${job.licenJobId} completed. tx: ${txHash}`);
        } catch (confirmErr: any) {
          console.error(`[jobTracker] confirmTrainingComplete FAILED for ${job.licenJobId}:`, confirmErr?.shortMessage ?? confirmErr?.message ?? confirmErr);
          // Mark as completed in DB anyway so we don't loop forever on demo jobs
          if (process.env.LICEN_DEMO_MODE === "true") {
            await db
              .update(computeJobs)
              .set({ status: "completed", actualEpochs, attestationRef, updatedAt: new Date() })
              .where(eq(computeJobs.licenJobId, job.licenJobId));
            console.warn(`[jobTracker] DEMO MODE — marked job ${job.licenJobId} as completed in DB despite tx failure.`);
          }
        }
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
    .catch((e) => console.error("[jobTracker] Rehydration query failed:", e.message));

  const safePoll = () =>
    pollActiveJobs().catch((e) =>
      console.error("[jobTracker] Poll error (will retry):", e.message)
    );

  safePoll();
  setInterval(safePoll, POLL_INTERVAL_MS);
}
