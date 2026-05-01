# LICEN UX/UI Specification

Derived strictly from the updated `architecture.md` and current codebase implementation. Every element below maps to a contract function, a contract event, or an orchestrator lifecycle state.

**Style Bible:** A premium, modern developer aesthetic. We utilize a "Settings Dashboard" layout for complex forms, ensuring progressive disclosure and minimal friction. We rely on `shadcn/ui` primitives (Card, Accordion, Badge, Dialog, Separator, Progress, etc.). Typography uses `font-sans` (e.g., Inter/Geist) for reading and `font-mono` for hashes/IDs. We use subtle gradients, glassmorphic touches, and clear visual hierarchies with a primary accent color to create a "wow" factor without sacrificing professional clarity.

---

## 1) User Flows

### 1.1 Publisher Flow (end-to-end)

1. **Connect wallet** → authenticated via Privy.
2. **New Dataset** (`/datasets/new`) — Unified Settings Dashboard:
   - **Details**: Upload file (client-side encrypted), define Title & Description.
   - **Allowed Purposes**: Select from an icon-driven grid of training purposes (e.g., Neural Research, Generative Art).
   - **Access Policy**: Configure `royaltyPerEpoch`, `maxEpochsPerRun`, `maxRunsPerRequester`, `ttlHours` (Session Duration), and `policyExpiry`.
   - **Advanced Details**: Accordion for optional manifest metadata (Legal terms, taxonomy).
   - **Publish Action**: A sticky side-nav button triggers client-side encryption, Lit Protocol key sharing, 0G Storage upload, and finally, on-chain anchoring via `DataPolicy`.
3. **Dashboard** (`/datasets`) — List datasets, view lifetime royalties, active sessions, and settlements.
4. **Dataset detail** (`/datasets/:datasetRoot`) — View/edit policy, view session history, and claim earnings.

### 1.2 Researcher Flow (end-to-end)

1. **Connect wallet** → authenticated via Privy.
2. **Discover** (`/marketplace`) — Browse datasets with their on-chain policy summaries. Filter by purpose and price. Data populated instantly via Envio Indexer.
3. **Request Access** (`/marketplace/:datasetRoot/request`) — Form constrained by policy. Live escrow quote = `royaltyPerEpoch × requestedEpochs`. Submit triggers an on-chain escrow payment.
4. **Session Lifecycle View** (`/sessions/:sessionId`) — Timeline: Requested → Provisioned → Running → Completed/Failed → Settled. 
5. **Artifacts** — On Completed, show the hardware Attestation Report from the 0G Compute TEE, actual epochs run, and download links for the final model weights.

---

## 2) Navigation Structure

App shell: Topbar with route title, wallet dropdown, and network status. The main navigation occurs either through a sidebar or a top-level tab structure distinguishing the dual roles.

```
Routes:
  /app                                 → Publisher Dashboard (dataset cards + royalty stats)
  /app/datasets                        → Full datasets table
  /app/datasets/new                    → Unified settings dashboard for publishing
  /app/datasets/:datasetRoot           → Dataset detail (policy, sessions, earnings)

  /app/marketplace                     → Discover datasets
  /app/marketplace/:datasetRoot        → Dataset read-only detail + Request CTA
  
  /app/sessions                        → My training sessions table
  /app/sessions/:sessionId             → Session lifecycle detail + event log + escrow ledger

  /app/audit                           → Protocol event search + recent log
```

### 2.1 Authentication & Wallet
- **Privy authentication**: Supports social login and external wallets. Both paths expose an EIP-1193 provider for viem integration.
- **Top-up affordance**: Wallet dropdown includes standard UX for acquiring testnet gas if required for anchoring/escrow.

---

## 3) Screen-by-Screen Breakdown

### 3.1 Unified Dashboard (Publisher) `/`
- **Purpose:** Overview of portfolio.
- **Data:** Datasets (`datasetRoot`, title, `active`, lifetime royalty).
- **Components:** Stat `Card`s, "My datasets" table, `Button` "New Dataset".
- **States:** Loading (`Skeleton` rows), empty datasets ("No datasets yet").

### 3.2 New Dataset Dashboard `/datasets/new`
- **Purpose:** Unified, scrollable form to replace the legacy 4-step wizard.
- **Components:** Sticky left Scrollspy navigation. Main content area stacked with `Card`s for Details, Purposes, and Policy. `Accordion` for Advanced Details.
- **System responses:** 
  1. Client-side encryption.
  2. Upload encrypted blob to 0G.
  3. Upload manifest to 0G.
  4. Call `registerDataset` on 0G Chain.
- **Post-Publish UI:** Premium success receipt rendering the Dataset ID and IV Hex, with prominent buttons to "Copy Details" and "Download Keys".

### 3.3 Marketplace `/marketplace`
- **Purpose:** Discover datasets and their policies.
- **Data:** For each dataset row: `datasetRoot`, title, `allowedPurposeIds`, `royaltyPerEpoch`, `active`. Sourced from Envio Indexer.
- **Components:** Search palette, filtering chips by purpose.
- **States:** Policy inactive rows dimmed/hidden.

### 3.4 Session Detail `/sessions/:sessionId` (The Research Core)
- **Purpose:** Authoritative lifecycle view with hardware audit anchors.
- **Data:** `sessionId`, `datasetRoot`, requester, `purposeId`, `requestedEpochs`, `actualEpochs` (from TEE attestation), escrow locked, state.
- **Components:**
  - **State Timeline**: Stepped progress (Requested → Running → Completed).
  - **Escrow Ledger**: Locked, settled, refunded, net.
  - **Artifacts**: Attestation Hash (proves hardware execution), Model output links.
- **System responses:** Subscription to Envio events for the specific `sessionId`.

---

## 4) Job Lifecycle UX

| State       | Trigger                                    | UI signal                                                                                                   | Action/Fallback                                                  |
|-------------|--------------------------------------------|-------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------|
| Requested   | Escrow transaction confirmed               | Node 1 active; "Awaiting compute node assignment…"                                                            | Auto-advance when Orchestrator picks up                          |
| Running     | Orchestrator provisions 0G Compute         | Node 2 active; "Training model inside secure enclave"                                                       | None manually; wait                                              |
| Completed   | TEE generates Attestation + Settlement tx  | Escrow ledger shows settlement row; Artifacts card populated with verification hashes                       | "Download Model Weights"                                         |
| Failed      | Node reports failure / Timeout             | `Alert` with reason + human copy                                                                            | Orchestrator triggers `refund()`                                 |

**Retry UX:** Never "retry same session". Always present "Start new request" prefilled from the old session's parameters.

---

## 5) Escrow & Payment UX

### 5.1 Before execution (lock)
- Request screen shows total `escrowQuote` breakdown (`royaltyPerEpoch × requestedEpochs`).
- User signs transaction. Escrow is locked in the `DataPolicy` contract.

### 5.2 After completion (settlement)
- Settle-by-actual: If `actualEpochs < requestedEpochs` (due to early stopping or errors), settlement is for `actualEpochs` only.
- The remainder is automatically refunded to the researcher.

---

## 6) Data Model → UI Mapping

| Field                        | UI representation                                                                                              |
|------------------------------|----------------------------------------------------------------------------------------------------------------|
| `datasetRoot: bytes32`       | Primary identity chip: mono, middle-truncated (`0x123...abcd`), copy icon.                                     |
| `allowedPurposeIds`          | Icon-backed dynamic grid/cards.                                                                                |
| `royaltyPerEpoch`            | Numeric input field with currency adornment.                                                                   |
| `maxEpochsPerRun`            | Numeric input defining limits per session.                                                                     |
| `ttlHours`                   | Rendered as "Session Duration" with a dropdown for unit conversion (Hours/Days/Weeks) behind the scenes.       |
| `actualEpochs`               | Comparator graphic on session detail (Requested vs Actual) sourced from TEE hardware attestation.              |

---

## 7) Design Justification

- **Unified Settings Dashboard vs Multi-Step Wizard** — Wizard fatigue is real. A scrollable dashboard with sticky navigation keeps all context visible at once, making complex policy configuration much faster for power users.
- **Jargon Removal** — "Anchored on-chain" is now "Published securely". "Manifest Metadata" is now "Advanced Details". The focus is on benefits and clarity for non-technical users.
- **Post-Publish Receipt** — Encryption keys are critical. Instead of raw JSON dumps, we format them beautifully and provide a dedicated "Download Keys" button to ensure they aren't lost.
- **Envio Indexer as Runtime Truth** — The blockchain is authoritative for smart contract state, but Envio is authoritative for querying and populating the UI cleanly and instantly.
