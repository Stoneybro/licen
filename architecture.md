# LICEN Architecture

## 1) Purpose and Scope

LICEN is a decentralized protocol for programmable AI data licensing on the 0G ecosystem.

The system enables dataset owners to:
- Publish encrypted datasets securely.
- Attach code-enforceable usage policies.
- Gate training access through smart contracts and a backend key exchange layer.
- Automatically settle royalties when licensed training sessions complete.

This document captures the current architecture decisions, tradeoffs, and implementation plans.

---

## 2) Core Goals

- Enforce policy-bound dataset usage in a controlled compute path.
- Make licensing and payment transparent, auditable, and automated.
- Keep the initial implementation hackathon-feasible, then harden incrementally.
- Clearly separate what is technically enforced vs what is governance/legal intent.

---

## 3) High-Level System Architecture

LICEN maps directly to decentralized primitives:

1. **Dataset Storage**: 0G Storage (encrypted blob).
2. **Policy Enforcement**: `DataPolicy` smart contract on 0G Chain.
3. **Key Management**: ECIES Envelope Encryption (MVP) → Lit Protocol / Threshold Network (production upgrade).
4. **Licensed Training Execution**: 0G Compute (hardware TEE enclaves like Intel TDX/AMD SEV-SNP).
5. **Orchestration & Indexing**: Envio Indexer + Backend Orchestrator.
6. **Royalty Settlement**: Smart contract state transition based on compute attestation.

### 3.1 Component Map

- **Publisher App/UI**: dataset owner uploads encrypted data, sets policy, monitors revenue.
- **Researcher App/UI**: browses the Marketplace, requests licensed access, and submits training intent.
- **DataPolicy Contract**: policy authority, access gate, escrow, settlement rules.
- **Key Custodian (Orchestrator ECIES Key)**: holds dataset decryption keys, releasing them only after verifying on-chain job state.
- **Orchestrator & Indexer (Envio)**: reads 0G Chain events, updates the UI Marketplace, and dispatches training jobs to 0G Compute.
- **0G Storage**: stores encrypted dataset, public policy manifest, and encrypted key envelope.
- **0G Compute**: runs fine-tuning jobs in attested secure environments.

---

## 4) Key Management: ECIES Envelope Encryption

### 4.1 Design Rationale

The `DataPolicy` contract already establishes a single trusted party — the `backendWallet` — which is the only address permitted to call `startJob`, `confirmTrainingComplete`, and `markJobFailed`. The ECIES approach extends this existing trust boundary to key custody rather than introducing a new trusted party.

### 4.2 How It Works

```
PUBLISH PHASE
  1. Browser generates a random AES-256-GCM key (never leaves browser plaintext)
  2. Browser encrypts the dataset file with that AES key
  3. Browser encrypts the AES key with the orchestrator's ECIES public key
  4. Encrypted blob + encrypted key envelope uploaded to 0G Storage
  5. DataPolicy.registerDataset() anchors datasetRoot + manifestHash on-chain

ACCESS PHASE (triggered by AccessGranted event)
  1. Researcher pays escrow → contract emits AccessGranted
  2. Envio Indexer picks up event → Orchestrator is notified
  3. Orchestrator reads job state from contract (must be Granted/Running)
  4. Orchestrator fetches encrypted key envelope from 0G Storage
  5. Orchestrator decrypts AES key with its ECIES private key
  6. AES key is passed to 0G Compute job, zeroed from memory after dispatch
  7. Orchestrator calls startJob(jobId) on-chain
```

### 4.3 Trust Model

| What is trusted | Why acceptable |
|---|---|
| Orchestrator holds ECIES private key | Same trust level the contract grants `backendWallet` for state transitions |
| Orchestrator only decrypts for Granted jobs | Gating enforced in code before decryption |
| AES key is zeroed after dispatch | Limits exposure window to seconds |

### 4.4 What We Cannot Perfectly Enforce (MVP)

- The orchestrator server is a centralised key custodian. A compromised orchestrator could theoretically decrypt any key it holds.
- Key exposure window exists between decryption and compute node receipt.

---

## 5) Trust and Enforcement Model

### 5.1 What we can enforce strongly

- Access is granted only after on-chain policy checks and payment/escrow.
- Raw dataset AES keys are never exposed to the browser or researchers.
- The orchestrator enforces on-chain job state before releasing any key.
- Training execution is restricted to attested compute environments.
- Job lifecycle and payout are tied to hardware-verified attestations (verifying epoch counts).
- Every granted/settled access is auditable on an immutable ledger.

### 5.2 What we cannot perfectly enforce (MVP)

- True human intent behind declared purpose.
- Absolute prevention of off-platform misuse in highly adversarial environments.
- The orchestrator's ECIES private key is a centralised secret (see upgrade path below).

---

## 6) Data and Identity Model

### 6.1 Dataset Identity

- Dataset is encrypted client-side (AES-256-GCM) before upload.
- AES key is wrapped (ECIES) with the orchestrator's public key and stored alongside the dataset.
- Merkle root from uploaded encrypted blob becomes canonical dataset identifier (`datasetRoot`).
- Contract references dataset by `datasetRoot`.

### 6.2 Policy Identity

- Rich policy stored off-chain as a JSON manifest in 0G Storage.
- Hash of manifest (`manifestHash`) anchored on-chain.
- On-chain stores only enforcement-critical fields.

### 6.3 Training Session Identity

Each training access request creates a unique `jobId` (keccak256 hash) bound to:
- `datasetRoot`
- requester wallet
- purpose ID
- requested epochs
- session duration (TTL)

---

## 7) Policy Schema v1

### 7.1 On-chain policy fields (authoritative, source: DataPolicy.sol)

The `Policy` struct in `DataPolicy.sol` defines the canonical on-chain fields:

- `datasetRoot: bytes32` — unique identifier
- `owner: address` — royalty recipient
- `manifestHash: bytes32` — hash of the off-chain policy manifest (integrity anchor)

**Access Limits & Pricing:**
- `royaltyPerEpoch: uint256` — cost per epoch of training
- `maxEpochsPerRun: uint32` — epoch cap per training session
- `maxRunsPerRequester: uint32` — lifetime session cap per researcher
- `accessTtlSeconds: uint64` — session validity window after grant
- `policyExpiry: uint64` — unix timestamp after which no new access can be requested

*Note: Legacy fields like `minEscrow`, `requireTEE`, and `approvedProviders` have been removed to streamline the architecture around modern attestations and dynamic escrow calculation (`royaltyPerEpoch` * `requestedEpochs`).*

### 7.2 Job Struct (source: DataPolicy.sol)

```solidity
struct Job {
    bytes32 datasetRoot;    // dataset being trained on
    address requester;      // researcher who paid
    address provider;       // = backendWallet
    bytes32 purposeId;      // declared use case
    uint32 requestedEpochs; // epochs requested
    uint256 escrowAmount;   // USDC locked
    uint64 requestTime;     // unix timestamp of request
    JobState state;         // None|Requested|Granted|Running|Completed|Failed|TimedOut|Refunded
    bytes32 termsHash;      // must match manifestHash
}
```

### 7.3 Off-chain policy manifest

Required fields:
- `manifestType`, `version`, `title`, `description`, `datasetRoot`, `ownerAddress`, `createdAt`

Optional publisher-defined fields:
- `legalText`, `usageTaxonomy`, `taskConstraints`, `complianceNotes`, `attribution`, `derivativeRights`

---

## 8) Pricing Semantics: Epochs and Runs

- **Run/Session**: one training execution.
- **Epoch**: one full pass through the dataset during a run.

### 8.1 Cost model
- Escrow required: `royaltyPerEpoch * requestedEpochs`

### 8.2 Measurement and Settlement
- Track both `requestedEpochs` and `actualEpochs` (from 0G Compute TEE attestation).
- Settlement mode: escrow by requested epochs, settle by actual epochs completed, refund the difference.

---

## 9) End-to-End Flow

### 9.1 Phase 1: Publish ✅ Complete
1. Publisher encrypts dataset client-side (AES-256-GCM).
2. Browser wraps AES key with orchestrator ECIES public key.
3. Upload encrypted blob + wrapped key + public manifest to 0G Storage.
4. Anchor `datasetRoot`, `manifestHash`, and policy tuple to `DataPolicy` contract.

### 9.2 Phase 2: Read & Index ✅ Complete
1. Envio indexer detects `DatasetRegistered` events.
2. Frontend Marketplace hydrates from Envio GraphQL + on-chain policy reads.
3. All mock data removed; balances read from live ERC-20 contract.

### 9.3 Phase 3: Key Exchange 🔄 In Progress
1. Publisher's encrypted key envelope is stored in 0G Storage metadata.
2. On `AccessGranted`, Orchestrator fetches and decrypts the AES key (ECIES).
3. AES key dispatched to 0G Compute job, then zeroed.

### 9.4 Phase 4: Compute & Research
1. Researcher requests access via UI and escrows USDC tokens.
2. Backend Orchestrator detects `AccessGranted` event via Envio.
3. Orchestrator decrypts AES key and dispatches a compute job to 0G Compute.
4. 0G Compute node trains on the encrypted data using the decrypted key.
5. Node generates an Attestation Report and model weights.

### 9.5 Phase 5: Audit & Settlement
1. Orchestrator calls `confirmTrainingComplete(jobId, actualEpochs, resultHash, attestationRef)`.
2. Contract verifies state and actual epochs used.
3. Royalties are paid to the publisher; unspent escrow is refunded to the researcher.
4. Publisher views usage in the Audit Dashboard.

---

## 10) Orchestrator & Indexer Architecture

The Backend Orchestrator and Envio Indexer replace the generic "wrapper".

- **Envio Indexer**: Extremely fast, EVM-compatible indexer to populate the Marketplace and track escrow/settlement events.
- **Backend Orchestrator**:
  - Listens to Envio webhooks/events.
  - Verifies on-chain job state before any key operation.
  - Decrypts dataset AES key via ECIES and dispatches to 0G Compute.
  - Manages the asynchronous flow of training sessions.
  - Calls `startJob`, `confirmTrainingComplete`, or `markJobFailed` on-chain.

---

## 11) Security and Reliability Decisions

- **Zero-Knowledge Key Exposure**: Raw AES decryption keys never appear in the browser or researcher context. The publisher generates and wraps the key client-side; the orchestrator holds it only for milliseconds during dispatch.
- **On-Chain Gating**: The orchestrator only decrypts a key after confirming the job is in `Granted` state on-chain. This is the primary security invariant.
- **Escrow-First**: Compute cannot be provisioned without on-chain USDC payment.
- **Hardware Attestation**: Settlement relies on cryptographic proofs from secure enclaves, preventing oracle manipulation.
- **Zeroing**: AES key bytes are explicitly zeroed from orchestrator memory after dispatch.

---

## 12) Upgrade Path: MVP → Production

### 12.1 Key Management Upgrade

The ECIES approach is designed to be swapped without changing the `DataPolicy` contract or the publish flow. The encrypted key envelope format is system-agnostic.

| Stage | Key Custodian | Decentralisation | Cost |
|---|---|---|---|
| **MVP (current)** | Orchestrator ECIES key | Centralised (trusted operator) | Free |
| **Hardening** | Shamir Secret Sharing (3-of-5 nodes) | Partial (collude 3 nodes to break) | ~$30/mo VMs |
| **Production** | Lit Protocol (Chipotle) or Threshold Network | Fully decentralised TEE network | Usage credits |

#### Upgrade to Lit Protocol (when ready)

1. Create a Lit Chipotle account at [dashboard.chipotle.litprotocol.com](https://dashboard.chipotle.litprotocol.com)
2. Create a PKP wallet that will own the encryption key.
3. Write and deploy two Lit Actions to IPFS:
   - `encrypt-dataset-key.js` — verifies publisher owns the dataset on-chain, then encrypts the AES key.
   - `decrypt-dataset-key.js` — reads `DataPolicy.jobs(jobId)` on-chain, confirms state is `Granted`/`Running`, then decrypts.
4. At publish time, call the Lit API instead of the orchestrator seal-key route.
5. At access time, the orchestrator calls Lit to decrypt instead of using its local ECIES private key.
6. No changes to the contract, Envio indexer, or frontend publish flow.

#### Upgrade to Threshold Network (free decentralised alternative)

- Use TACo (Threshold Access Control) from [docs.threshold.network](https://docs.threshold.network)
- Proxy Re-Encryption: the publisher creates a re-encryption key fragment allowing the Threshold network to transform the ciphertext for the compute node's public key — without any party ever seeing the plaintext AES key.
- Free on testnet; staking costs on mainnet.

### 12.2 Compute Attestation Upgrade

- **MVP**: Orchestrator trusts 0G Compute's reported `actualEpochs`.
- **Production**: On-chain verification of Intel TDX/AMD SEV-SNP attestation quote submitted alongside `confirmTrainingComplete`.

### 12.3 Compliance Upgrade

- Add ZK-proof of purpose compliance (researcher proves they used the model only for declared purpose).
- Integrate with decentralised identity (e.g., verifiable credentials) for researcher reputation scoring.
