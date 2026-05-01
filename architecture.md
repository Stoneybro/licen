# LICEN Architecture

## 1) Purpose and Scope

LICEN is a decentralized protocol for programmable AI data licensing on the 0G ecosystem.

The system enables dataset owners to:
- Publish encrypted datasets securely.
- Attach code-enforceable usage policies.
- Gate training access through smart contracts and access control networks (Lit Protocol).
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
3. **Key Management**: Lit Protocol (secure KMS via Access Control Conditions).
4. **Licensed Training Execution**: 0G Compute (hardware TEE enclaves like Intel TDX/AMD SEV-SNP).
5. **Orchestration & Indexing**: Envio Indexer + Backend Orchestrator.
6. **Royalty Settlement**: Smart contract state transition based on compute attestation.

### 3.1 Component Map

- **Publisher App/UI**: dataset owner uploads encrypted data, sets policy, monitors revenue.
- **Researcher App/UI**: browses the Marketplace, requests licensed access, and submits training intent.
- **DataPolicy Contract**: policy authority, access gate, escrow, settlement rules.
- **Key Network (Lit Protocol)**: holds dataset decryption keys, releasing them only to secure enclaves after on-chain payment verification.
- **Orchestrator & Indexer (Envio)**: reads 0G Chain events, updates the UI Marketplace, and dispatches training jobs to 0G Compute.
- **0G Storage**: stores encrypted dataset and public policy manifest.
- **0G Compute**: runs fine-tuning jobs in attested secure environments.

---

## 4) Trust and Enforcement Model

### 4.1 What we can enforce strongly

- Access is granted only after on-chain policy checks and payment/escrow.
- Raw dataset keys are never exposed to humans (client-side encryption -> Lit Protocol -> TEE decryption).
- Training execution is restricted to attested compute environments.
- Job lifecycle and payout are tied to hardware-verified attestations (verifying epoch counts).
- Every granted/settled access is auditable on an immutable ledger.

### 4.2 What we cannot perfectly enforce

- True human intent behind declared purpose (for example, proving a user is genuinely doing "neural research").
- Absolute prevention of all off-platform misuse in highly adversarial environments.

---

## 5) Data and Identity Model

### 5.1 Dataset Identity

- Dataset is encrypted client-side before upload.
- Encrypted key is stored on Lit Protocol.
- Merkle root from uploaded encrypted blob becomes canonical dataset identifier (`datasetRoot`).
- Contract references dataset by `datasetRoot`.

### 5.2 Policy Identity

- Rich policy stored off-chain as a JSON manifest in 0G Storage.
- Hash of manifest (`manifestHash`) anchored on-chain.
- On-chain stores only enforcement-critical fields.

### 5.3 Training Session Identity

Each training access request creates a unique `sessionId` (formerly `jobId`) bound to:
- `datasetRoot`
- requester wallet
- purpose ID
- requested epochs
- session duration (TTL)

---

## 6) Policy Schema v1

### 6.1 On-chain policy fields (authoritative, source: DataPolicy.sol)

The `Policy` struct in `DataPolicy.sol` defines the canonical on-chain fields:

- `datasetRoot: bytes32` — unique identifier
- `owner: address` — royalty recipient
- `manifestHash: bytes32` — hash of the off-chain policy manifest (integrity anchor)

**Access Limits & Pricing:**
- `royaltyPerEpoch: uint256` — cost per epoch of training
- `maxEpochsPerRun: uint32` — epoch cap per training session
- `maxRunsPerRequester: uint32` — lifetime session cap per researcher
- `ttlHours: uint32` — session validity window after grant
- `policyExpiry: uint64` — unix timestamp after which no new access can be requested

*Note: Legacy fields like `minEscrow`, `requireTEE`, and `approvedProviders` have been removed to streamline the architecture around modern attestations and dynamic escrow calculation (`royaltyPerEpoch` * `requestedEpochs`).*

### 6.2 Off-chain policy manifest

The off-chain manifest is concise and public. It excludes enforcement fields that already live on-chain.

Required fields:
- `manifestType: string` (`licen.public-manifest`)
- `version: string` (policy/manifest version)
- `title: string`
- `description: string`
- `datasetRoot: bytes32`
- `ownerAddress: address`
- `createdAt: ISO datetime`

Optional publisher-defined fields (Advanced Details):
- `legalText`, `usageTaxonomy`, `taskConstraints`, `complianceNotes`, `attribution`, `derivativeRights`.

---

## 7) Pricing Semantics: Epochs and Runs

- **Run/Session**: one training execution.
- **Epoch**: one full pass through the dataset during a run.

### 7.1 Cost model
- Escrow required: `royaltyPerEpoch * requestedEpochs`

### 7.2 Measurement and Settlement
- Track both `requestedEpochs` and `actualEpochs` (from 0G Compute TEE attestation).
- Settlement mode: escrow by requested epochs, settle by actual epochs completed, refund the difference.

---

## 8) End-to-End Flow

### 8.1 Phase 1: Publish (Complete)
1. Publisher encrypts dataset client-side.
2. Dataset decryption key is provisioned to Lit Protocol.
3. Upload encrypted blob + public manifest to 0G Storage.
4. Anchor `datasetRoot`, `manifestHash`, and policy tuple to `DataPolicy` contract.

### 8.2 Phase 2: Read & Index
1. Envio indexer detects `registerDataset` events.
2. Backend hydrates the frontend Marketplace by combining on-chain data with JSON manifests from 0G Storage.

### 8.3 Phase 3: Compute & Research
1. Researcher requests access via UI and escrows tokens.
2. Backend Orchestrator detects escrow event.
3. Orchestrator dispatches a compute job to a 0G Compute node.
4. 0G Compute node pulls encrypted data from 0G Storage.
5. Node retrieves decryption key from Lit Protocol (satisfying the ACC).
6. Training runs securely inside a TEE enclave.
7. Node generates an Attestation Report and model weights.

### 8.4 Phase 4: Audit & Settlement
1. Attestation report is submitted on-chain or via Orchestrator.
2. Contract verifies the TEE signature and actual epochs used.
3. Royalties are paid to the publisher; unspent escrow is refunded to the researcher.
4. Publisher views usage in the Audit Dashboard.

---

## 9) Orchestrator & Indexer Architecture

The Backend Orchestrator and Envio Indexer replace the generic "wrapper".

- **Envio Indexer**: Extremely fast, EVM-compatible indexer to populate the Marketplace and track escrow/settlement events.
- **Backend Orchestrator**: 
  - Listens to Envio webhooks/events.
  - Dispatches tasks to 0G Compute.
  - Manages the asynchronous flow of training sessions.

---

## 10) Security and Reliability Decisions

- **Zero-Knowledge Keys**: Raw decryption keys never hit the client during the research phase. Lit Protocol + 0G TEE ensures hardware-enforced privacy.
- **Hardware Attestation**: Settlement relies purely on cryptographic proofs from secure enclaves, preventing oracle manipulation.
- **Escrow-First**: Compute cannot be provisioned without on-chain payment.
