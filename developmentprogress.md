# Development Progress

## Executive Summary

The initial MVP phase focusing on the **End-to-End Dataset Publish Flow** is complete. We have successfully implemented a streamlined, batch-oriented flow where dataset metadata is generated via a web form, file encryption/uploads are automated, and user consent is captured through a single authoritative on-chain registration transaction. 

This phase established a **contract-first, high-quality, dependency-ordered** foundation. We have moved from simulated, in-memory stubs to production-grade integrations (real 0G storage, real AES-256-GCM encryption, and real chain orchestration).

---

## 1. The Streamlined Publish Flow

The publication flow has been refactored from a multi-step manual process into a single-click orchestrated sequence in `/app/datasets/new`:

1. **Client-Side Encryption:** The selected dataset file is encrypted locally in the browser using AES-256-GCM. The encryption outputs a ciphertext hash which serves as the `datasetRoot`.
2. **0G Storage Dataset Upload:** The encrypted dataset is uploaded directly to 0G Storage via a dedicated Next.js API route (`/api/publish/dataset/upload`), yielding the 0G Merkle root hash.
3. **Manifest Generation & Upload:** A canonical manifest JSON is generated using the user's input, policy configuration, and `datasetRoot`. This manifest is uploaded to 0G Storage via `/api/publish/manifest/upload`, yielding a `manifestUri` and `manifestHash`.
4. **On-Chain Anchoring:** The dataset is registered on the `DataPolicy` contract. The user signs a single transaction via their Privy wallet using `eth_sendTransaction`. This transaction binds the `datasetRoot`, `manifestHash`, and policy parameters directly on-chain.
5. **Status Polling:** The client polls the status endpoint (`/api/publish/status/[requestId]`) until the transaction is confirmed, providing real-time feedback to the user.

---

## 2. Implemented Architecture & Components

### Authentication & Authorization
- **Dedicated Login Flow:** Centralized at `/login` with `returnTo` redirect logic.
- **Route Protection:** `/app/*` routes are guarded; unauthenticated users are redirected.
- **Privy Wallet Support:** Fully integrated wallet login and transaction signing using Privy's EIP-1193 provider.

### DataPolicy Smart Contract (`packages/contracts/src/DataPolicy.sol`)
- **Job Lifecycle Functions:** `registerDataset`, `requestAccess`, `startJob`, `confirmTrainingComplete`, and `markJobFailed`.
- **Backend Authorization:** `onlyBackend` modifier restricts job lifecycle functions to a dedicated backend wallet.
- **Dynamic Escrow:** Escrow is dynamically calculated as `royaltyPerEpoch × requestedEpochs`.
- **Policy Parameters:** Configurable limits including `maxRunsPerRequester` and `policyExpiry`.

### API & Contracts Foundation (`apps/web/src/lib/publish/contracts.ts`)
- **Shared Schemas:** Defined enums, typed requests/responses for publish operations (`PublishSubmitRequest`, `PublishManifestUploadRequest`, etc.).
- **Validation:** Runtime validation for all API inputs and manifest schemas.
- **State Store:** In-memory store for tracking publish requests and simulating backend lifecycle processing.

### 0G Storage Integration (`apps/web/src/lib/publish/storage.ts`)
- **Storage Adapter:** Server-side functions to interact with `@0gfoundation/0g-ts-sdk`.
- **Dataset & Manifest Uploads:** Handled securely via server components to prevent bundling sensitive SDK logic into the client.

### Client-Side Encryption (`apps/web/src/lib/publish/encryption.ts`)
- **AES-256-GCM:** Native Web Crypto API integration.
- **Secure Key Generation:** Random IVs and robust key generation, displaying the critical `ivHex` and `keyHex` to the user upon a successful publish for safekeeping.

---

## 3. What Remains To Be Done

As we finalize the Publish Flow, focus now shifts to the consumer side and production hardening.

### A. Production Hardening
- **Fix Sync Issues:** Align `contracts.ts` validators with the simplified `PublishPolicyConfig` type (remove outdated `allowedProviderIds`, `escrowCap`, `requireTEE` checks).
- **Key-Handling UX:** Replace the temporary display of encryption keys on the success screen with a robust delivery mechanism (e.g., encrypted file download, secure wallet-based storage).
- **Resilience:** Add draft persistence across refresh/navigation, robust idempotency guarantees for on-chain submissions, and graceful retry semantics for transient storage/chain errors.
- **Observability:** Integrate structured logging and monitoring for tracking API and transaction performance.

### B. Researcher App & Access Request Flow
- **Dataset Catalog:** UI for browsing published datasets and viewing manifests.
- **Access Form:** Enable researchers to request access (select purposes, configure epochs, approve escrow).
- **Smart Contract Integration:** Wire up the `requestAccess` contract call via user wallets.
- **Job Tracking:** UI for researchers to monitor job status and retrieve training results.

### C. Backend Orchestration
- Implement a secure backend worker (using the authorized backend wallet) to handle `startJob`, `confirmTrainingComplete`, and `markJobFailed`.
- Integrate directly with 0G Compute for off-chain job submission and monitoring.

### D. Testing & Quality
- Expand Foundry test coverage for `DataPolicy.sol` edge cases.
- Write robust integration tests covering the end-to-end publish flow and API route handlers.
- Conduct security reviews, specifically targeting client-side key material handling.