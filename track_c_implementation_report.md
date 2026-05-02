# Track C: Compute Phase — Implementation Report

**Date:** 2026-05-02  
**Status:** ✅ Complete  
**Packages affected:** `packages/orchestrator`

---

## 1. What Track C Implements

Track C is the engine of the LICEN protocol. When a researcher pays escrow and receives an `AccessGranted` event on-chain, Track C is what actually executes the AI fine-tuning job. It bridges three systems:

1. **0G Storage** — where the encrypted dataset lives
2. **0G Compute** — where GPU fine-tuning runs
3. **DataPolicy.sol** — the on-chain state machine that gates access and settles royalties

---

## 2. Architecture Overview

```
Envio Indexer (GraphQL)
        │
        ▼
   poller.ts (polls every 5s for Granted jobs)
        │
        ▼  fetchKeyEnvelope → /api/orchestrator/key-envelope
   dispatcher.ts
        │
        ├─ 1. Guard: verify on-chain state = Granted
        ├─ 2. Unseal AES key from ECIES envelope (keyExchange.ts)
        ├─ 3. Download encrypted dataset from 0G Storage (Indexer.download)
        ├─ 4. Decrypt AES-256-GCM in memory
        ├─ 5. Re-upload plaintext JSONL to 0G Storage → new rootHash
        ├─ 6. Delete temp file (finally block) + zero AES key
        ├─ 7. createFineTuningTask(plaintextRootHash) → taskId
        ├─ 8. registerJob in DB (Drizzle compute_jobs)
        └─ 9. startJob(jobId) on-chain → state: Running
                          │
                          ▼
                   jobTracker.ts (polls every 30s)
                          │
                    0G task status?
                          │
             ┌────────────┼────────────┐
          Delivered     Finished     Failed
             │             │           │
      acknowledgeModel  confirmTraining  markJobFailed
      (fee settlement)  Complete()      on-chain
```

---

## 3. New Files Created

### `packages/orchestrator/src/computeClient.ts`

The sole interface between the orchestrator and the 0G Compute SDK (`@0gfoundation/0g-compute-ts-sdk`).

**Key design decisions:**
- Uses **Direct path** (not Router) — only Direct supports fine-tuning and returns a Task ID.
- Initialises `ethers.Wallet` via `OG_COMPUTE_PRIVATE_KEY`. Uses `createRequire` to force CJS resolution of `ethers` (avoiding the ESM/CJS dual-build `Wallet` type conflict).
- **Auto-discovers providers** at runtime via `broker.fineTuning.listService()` — picks the first `available: true` provider. A specific provider can be pinned via `OG_COMPUTE_PROVIDER_ADDRESS` env var.
- The broker singleton is initialised once and reused across all dispatch calls.

**Public functions:**
```typescript
createFineTuningTask(params)  // → { taskId, providerAddress }
getTaskStatus(taskId, provider) // → "Training" | "Delivered" | "Finished" | "Failed" | ...
acknowledgeModel(taskId, provider) // → resultHash (0G Storage root of LoRA zip)
```

**Fine-tuning config sent to 0G Compute:**
```typescript
{
  neftune_noise_alpha: 5,
  num_train_epochs: requestedEpochs,   // ← from on-chain job
  per_device_train_batch_size: 2,
  learning_rate: 0.0002,
  max_steps: 3,
}
```

### `packages/orchestrator/src/jobTracker.ts`

A persistent, database-backed completion poller.

**Why it's needed:** The 0G Compute SDK's `createTask()` is asynchronous — it submits the job and returns immediately. Training takes minutes. The `jobTracker` runs a `setInterval` loop that polls every `OG_TASK_POLL_MS` (default 30,000ms) to check each active job's status and drive the on-chain lifecycle forward.

**State machine:**

| DB status | Trigger | Action |
|:---|:---|:---|
| `running` | 0G reports `Delivered` | Set DB → `acknowledging`, call `acknowledgeModel()` |
| `acknowledging` | 0G reports `Finished` | Call `confirmTrainingComplete()` on-chain, set DB → `completed` |
| `running` | 0G reports `Failed` | Call `markJobFailed()` on-chain, set DB → `failed` |

**Restart safety:** On orchestrator startup, the tracker queries the DB for all `running` or `acknowledging` jobs and resumes polling them. No jobs are lost on crash/restart.

### `packages/orchestrator/src/dispatcher.ts` (rewritten)

The core dispatch pipeline. Replaced the stub with the full 9-step flow:

**Critical design decision — download/decrypt/re-upload:**

The 0G Compute SDK's `createTask(provider, model, datasetRootHash, config)` takes only a root hash. Providers pull the dataset from 0G Storage directly. Since the publisher's dataset is AES-256-GCM encrypted, the provider cannot decrypt it. The orchestrator must:

1. Download the encrypted blob (`Indexer.download`)
2. Decrypt in-memory using the unsealed AES key
3. Write plaintext to `/tmp/licen-plain-<jobId>.jsonl` (mode `0o600`, owner-read-only)
4. Re-upload plaintext to 0G Storage via `ZgFile + Indexer.upload` → receive new `plaintextRootHash`
5. Pass `plaintextRootHash` to `createFineTuningTask`
6. Delete temp file in `finally` block regardless of outcome

**AES-256-GCM decryption implementation:**

Blob format from the publisher (matching `encryption.ts`):
```
[ ciphertext bytes... ][ 16 bytes GCM auth tag ]
```
The IV is NOT in the blob — it comes from the ECIES envelope. This is correct because the IV is part of the sealed key payload, not stored alongside the ciphertext.

**Security protocol:**
- AES key is zeroed via `unsealedKey.zero()` in a `finally` block — runs even if decryption or upload fails
- Temp plaintext file is deleted in a `finally` block — runs even if 0G Compute dispatch fails
- On any pre-dispatch error: `markJobFailed()` is called so the researcher is refunded

### `packages/orchestrator/src/db/schema.ts`

Drizzle ORM schema for the `compute_jobs` table:

```typescript
export const computeJobs = pgTable("compute_jobs", {
  licenJobId: text("licen_job_id").primaryKey(),  // bytes32 from DataPolicy.sol
  datasetRoot: text("dataset_root").notNull(),
  zeroGTaskId: text("zerog_task_id"),              // UUID from 0G Compute SDK
  providerAddress: text("provider_address"),
  requestedEpochs: integer("requested_epochs").notNull(),
  actualEpochs: integer("actual_epochs"),
  resultHash: text("result_hash"),                 // 0G Storage root of LoRA adapter
  attestationRef: text("attestation_ref"),         // taskId encoded as bytes32
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

### `packages/orchestrator/src/db/db.ts`

Uses `postgres-js` + `drizzle-orm/postgres-js`. **Not** the `@neondatabase/serverless` HTTP driver — the orchestrator is a long-running Node.js process, not a serverless function, so it benefits from a persistent connection pool.

### `packages/orchestrator/drizzle.config.ts`

Drizzle Kit config pointing to `DATABASE_URL` (the Neon unpooled connection string).

---

## 4. The 10-State 0G Lifecycle Mapping

0G Compute's fine-tuning flow has more states than our on-chain contract. The `jobTracker` bridges them:

| 0G Task Status | Meaning | Orchestrator action | On-chain state |
|:---|:---|:---|:---|
| `Init` | Task submitted | — | Running |
| `SettingUp` | Provider fetching dataset | — | Running |
| `SetUp` | Ready to train | — | Running |
| `Training` | GPU training | — | Running |
| `Trained` | Training done | — | Running |
| `Delivering` | Encrypting + uploading LoRA | — | Running |
| `Delivered` | LoRA ready | `acknowledgeModel()` → triggers provider fee settlement | Running |
| `UserAcknowledged` | Requester confirmed | — | Running |
| `Finished` | Provider settled fees + uploaded decryption key | `confirmTrainingComplete(jobId, epochs, resultHash, attestationRef)` | **Completed** |
| `Failed` | Task error | `markJobFailed(jobId, "0G_COMPUTE_TASK_FAILED")` | **Failed** |

**The `startJob()` timing:** Called immediately after `createFineTuningTask()` returns (Task in `Init` state). This is correct — `startJob()` is our protocol's state change (Granted → Running), not a 0G-specific transition.

---

## 5. The `resultHash` and `attestationRef`

When training completes:

- **`resultHash`**: The 0G Storage root hash of the encrypted LoRA adapter zip file. Retrieved from `acknowledgeModel()` response. Stored on-chain via `confirmTrainingComplete()`. This is the researcher's proof that training produced a verifiable output.
- **`attestationRef`**: The 0G Compute task UUID, encoded as a `bytes32` hex: `0x<taskId-without-dashes-padded-to-64-chars>`. Stored on-chain as the reference for future TEE attestation verification (Track D upgrade).

> [!NOTE]
> The output is a **LoRA adapter**, not a full model. It is ~50–200MB of delta weights for `Qwen2.5-0.5B-Instruct`. Researchers must load it on top of the base model to run inference.

---

## 6. Environment Variables Added

```env
# Required
OG_COMPUTE_PRIVATE_KEY=<hex>        # Wallet holding 0G tokens (funded: 15 OG)
DATABASE_URL=<neon-unpooled-url>     # Neon PostgreSQL, unpooled connection

# Optional (have defaults)
OG_COMPUTE_PROVIDER_ADDRESS=        # Pin provider; unset = auto-discover
OG_COMPUTE_MODEL=Qwen2.5-0.5B-Instruct
OG_INDEXER_RPC_URL=https://indexer-storage-testnet-standard.0g.ai
OG_TASK_POLL_MS=30000
```

---

## 7. Dependencies Added

```json
{
  "@0gfoundation/0g-compute-ts-sdk": "^0.8.0",
  "@0gfoundation/0g-ts-sdk": "^1.2.6",
  "ethers": "^6.16.0",
  "drizzle-orm": "^0.31.x",
  "postgres": "^3.x"
}
```

`@types/node` upgraded from `^20` to `^22` to resolve Node 22's strict `Buffer ↔ Uint8Array` type incompatibility in the crypto API.

---

## 8. Known Limitations & Track D Upgrade Path

| Limitation | Current behaviour | Track D fix |
|:---|:---|:---|
| Plaintext dataset temporarily on 0G Storage | Required for 0G Compute SDK v0.8 | Replace with TEE key-injection API when 0G exposes one |
| `attestationRef` is task UUID, not a signed TEE quote | Stored as bytes32 reference | On-chain Intel TDX/AMD SEV-SNP quote verification |
| `actualEpochs` = `requestedEpochs` | 0G Compute SDK doesn't expose actual epoch count yet | Parse from 0G attestation output when available |
| Provider discovery uses first available | Simple for hackathon | Add scoring: prefer TEE-verified, high-uptime providers |
