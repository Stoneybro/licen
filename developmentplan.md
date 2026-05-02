# LICEN Development Plan

This plan reflects the **current codebase state and roadmap**:

- **Publish Flow** ✅ Complete — unified Settings Dashboard UX for dataset creation.
- **Crypto & Storage** ✅ Complete — client-side AES-256-GCM encryption, 0G Storage upload, manifest generation.
- **Auth** ✅ Complete — Privy integration with `/login` and protected `/app/*` routes.
- **Contracts** ✅ Complete — `DataPolicy.sol` refined (removed legacy `minEscrow`, `requireTEE`; standardised on `royaltyPerEpoch`, `accessTtlSeconds`).
- **Read Phase (Marketplace)** ✅ Complete — Envio Indexer live, all mock data removed, real ERC-20 balance reads.
- **Key Exchange** ✅ Complete — ECIES envelope encryption using `@noble/curves` securely passing keys to the orchestrator.
- **Compute Phase** ✅ Complete — Backend Orchestrator fully wired to 0G Compute: download/decrypt/re-upload pipeline, job tracker with DB persistence, on-chain lifecycle (startJob → confirmTrainingComplete / markJobFailed).
- **Settlement & Audit** 🔄 Next — Researcher result UI, training session status dashboard, royalty settlement display.

---

## Architecture Tracks

### Track A — Read Phase (Marketplace & Indexer) ✅ DONE
- Deployed Envio Indexer listening to `DatasetRegistered`, `AccessGranted`, `RoyaltySettled` events.
- Frontend Marketplace hydrated from Envio GraphQL + on-chain policy reads via viem.
- `lUSD` renamed to `USDC`. All mock data (`MOCK_DATASETS`, `MOCK_JOBS`, `MOCK_WALLET`) removed.
- Real ERC-20 balance (`0x6A0C73162c20Bc56212D643112c339f654C45198`) fetched in Topbar, Settings, and Request flow.
- Empty state placeholders added to Marketplace, Sessions, and Publisher Dashboard.

### Track B — Key Exchange (ECIES Envelope) ✅ DONE
**Target: Remove raw AES key exposure and implement secure provisioning.**

#### What we're building
The publish flow currently exports the raw `keyHex` and `ivHex` from the browser. This is the only remaining security gap — the key is visible during the publish step. We are sealing it server-side before the user ever sees it.

#### Implementation Steps

**Step B.1 — Install `eciesjs`**
```bash
pnpm add eciesjs --filter web
```

**Step B.2 — Orchestrator ECIES Key Setup (one-time)**
Generate a secp256k1 keypair for the orchestrator:
```bash
node -e "const {PrivateKey} = require('eciesjs'); const k = new PrivateKey(); console.log('PRIV:', k.secret.toString('hex')); console.log('PUB:', k.publicKey.toBytes(false).toString('hex'));"
```
Store in environment:
```
ORCHESTRATOR_PRIVATE_KEY=<hex>           # server only, never in browser
NEXT_PUBLIC_ORCHESTRATOR_PUBLIC_KEY=<hex> # safe to expose
```

**Step B.3 — Client: Seal AES Key After Encryption**
In `src/lib/publish/encryption.ts`, add a `sealKey()` function that:
1. Takes the raw AES key bytes + IV bytes
2. Calls `POST /api/lit/seal-key` with `{ aesKeyHex, ivHex, datasetRoot, publisherAddress }`
3. Returns `{ encryptedKeyEnvelope: string }` — the ECIES ciphertext hex

The raw `keyHex` is zeroed from memory after sealing; only `encryptedKeyEnvelope` is stored.

**Step B.4 — API Route: `POST /api/lit/seal-key`**
Server-side Next.js route in `src/app/api/lit/seal-key/route.ts`:
1. Receives `{ aesKeyHex, ivHex, datasetRoot, publisherAddress }`
2. Verifies `publisherAddress` matches the dataset owner on-chain (read `DataPolicy.policies(datasetRoot).owner`)
3. ECIES-encrypts the AES key using `ORCHESTRATOR_PRIVATE_KEY`
4. Returns `{ encryptedKeyEnvelope: string }`

**Step B.5 — Store Envelope in 0G Storage Metadata**
The `encryptedKeyEnvelope` is included in the 0G Storage metadata blob alongside the encrypted dataset. The manifest hash continues to link everything together.

**Step B.6 — Orchestrator: Decrypt on AccessGranted**
In `packages/orchestrator/src/keyExchange.ts`:
1. On `AccessGranted` event, fetch metadata from 0G Storage
2. Extract `encryptedKeyEnvelope`
3. ECIES-decrypt using `ORCHESTRATOR_PRIVATE_KEY` → raw AES key
4. Dispatch AES key to 0G Compute job
5. Zero AES key from memory (`keyBytes.fill(0)`)

#### Key naming convention
The route is named `/api/lit/seal-key` intentionally — when we upgrade to Lit Protocol, we swap the implementation of this route without changing any callers. The interface stays identical.

### Track C — Compute Phase (Orchestration & 0G Compute) ✅ DONE
**Target: Enable researchers to run training sessions securely.**

#### What was built
- **`computeClient.ts`**: 0G Compute SDK wrapper (`@0gfoundation/0g-compute-ts-sdk`). Auto-discovers available fine-tuning providers via `broker.fineTuning.listService()`. Initialises an `ethers.Wallet` from `OG_COMPUTE_PRIVATE_KEY`. Handles `createTask`, `getTask`, and `acknowledgeModel` SDK calls.
- **`dispatcher.ts`**: Full dataset pipeline — downloads encrypted blob from 0G Storage (`Indexer.download`), decrypts in-memory with AES-256-GCM using the unsealed ECIES key, re-uploads plaintext to 0G Storage (`ZgFile + Indexer.upload`) to get a clean root hash, dispatches to 0G Compute, calls `startJob()` on-chain, zeros the AES key in `finally`.
- **`jobTracker.ts`**: Persistent completion poller backed by Drizzle `compute_jobs` table. Polls every 30s. On `Delivered` → calls `acknowledgeModel` (triggers provider fee settlement). On `Finished` → calls `confirmTrainingComplete()` on-chain. On `Failed` → calls `markJobFailed()`. Rehydrates in-flight jobs from DB on restart.
- **`src/db/schema.ts` + `src/db/db.ts`**: Drizzle ORM with `postgres-js` driver (long-running connection). `compute_jobs` table live in Neon PostgreSQL.
- **`@types/node` upgraded to v22** to match Node 22's strict `Buffer ↔ Uint8Array` typing.

#### 0G Compute lifecycle mapping
| 0G Task Status | Orchestrator action | On-chain state |
|---|---|---|
| Init → Training | Monitor only | Running |
| Delivered | `acknowledgeModel()` | Running |
| Finished | `confirmTrainingComplete()` | Completed |
| Failed | `markJobFailed()` | Failed |

#### New env vars required
```
OG_COMPUTE_PRIVATE_KEY=  # wallet holding 0G tokens for compute payment
OG_COMPUTE_MODEL=Qwen2.5-0.5B-Instruct
OG_INDEXER_RPC_URL=https://indexer-storage-testnet-standard.0g.ai
OG_TASK_POLL_MS=30000
DATABASE_URL=postgresql://...  # unpooled Neon connection
```

### Track D — Audit Phase (Settlement & UI) ⏳ FUTURE
**Target: Trustless settlement based on hardware attestation.**
- **Attestation Verification**: verify cryptographic TEE report on-chain.
- **Royalty Settlement**: pay publisher `royaltyPerEpoch * actualEpochs`; refund researcher the rest.
- **Audit Dashboard**: publishers view dataset usage, verify attestations, and claim earnings.

---

## Phase Milestones

### Milestone 1: Publish Flow MVP ✅ Complete
- Unified settings dashboard UX for publishing.
- Client-side AES-256-GCM encryption and 0G Storage upload.
- Manifest generation and on-chain `DataPolicy.registerDataset()` anchoring.

### Milestone 2: Read Phase ✅ Complete
- Envio Indexer setup and deployment.
- Real-time marketplace hydration from Envio GraphQL and on-chain reads.
- All mock data removed. Live ERC-20 balance integration.

### Milestone 3: Key Exchange (ECIES → Lit Protocol upgrade path)

**MVP (current sprint):**
- `eciesjs` installed as the crypto primitive.
- `/api/lit/seal-key` API route seals AES key with orchestrator's ECIES public key.
- Publish form updated to call seal-key and store `encryptedKeyEnvelope` in 0G metadata.
- Orchestrator decrypts on `AccessGranted` before dispatching to 0G Compute.

**Production upgrade (post-launch):**
- Replace `/api/lit/seal-key` implementation with Lit Protocol Chipotle API.
- Deploy `encrypt-dataset-key` and `decrypt-dataset-key` Lit Actions to IPFS.
- Orchestrator calls Lit API for decryption instead of local ECIES key.
- Optional: Shamir Secret Sharing across 3–5 nodes as intermediate decentralisation step.

### Milestone 4: Compute Orchestration ✅ Complete
- Backend Orchestrator dispatching real jobs to 0G Compute via `@0gfoundation/0g-compute-ts-sdk`.
- Full download/decrypt/re-upload pipeline for AES-encrypted datasets.
- `startJob` / `confirmTrainingComplete` / `markJobFailed` lifecycle on-chain.
- Job state persisted to Neon PostgreSQL (`compute_jobs` table) — survives restarts.

### Milestone 5: Settlement & Training Session UI 🔄 Next
- Researcher can view live training session status (Running → Completed).
- Publisher dashboard shows dataset usage and royalty earnings.
- Settlement verification UI — on-chain `resultHash` and `attestationRef` displayed.
- (Future) On-chain Intel TDX/AMD SEV-SNP attestation quote verification.

---

## Production Upgrade Paths Summary

| Component | MVP | Production |
|---|---|---|
| Key Management | ECIES (orchestrator keypair) | Lit Protocol Chipotle or Threshold Network TACo |
| Key Decentralisation | Single orchestrator | Shamir 3-of-5 or fully decentralised TEE network |
| Compute Attestation | Trusted orchestrator report | On-chain Intel TDX/AMD SEV-SNP quote verification |
| Researcher Identity | Wallet address only | Verifiable credentials / ZK purpose proofs |
| Royalty Token | USDC on 0G Testnet | Mainnet USDC or native governance token |

---

## Immediate Next Actions

1. ~~Scaffold Envio Indexer~~ ✅ Done
2. ~~Replace mock data in Marketplace~~ ✅ Done
3. ~~Implement ECIES envelope sealing route `/api/lit/seal-key`~~ ✅ Done
4. ~~Update publish form to store sealed envelope~~ ✅ Done
5. ~~Build orchestrator key unsealing and job polling~~ ✅ Done
6. ~~Move `encryptedKeyEnvelope` storage to Neon (Drizzle)~~ ✅ Done
7. ~~Wire orchestrator to 0G Compute SDK for real job dispatch~~ ✅ Done
8. **Build Training Session status UI** — researcher sees live job state (Running → Completed)
9. **Publisher earnings dashboard** — show royalties settled per dataset
