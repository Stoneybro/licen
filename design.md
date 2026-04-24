# LICEN UX/UI Specification

Derived strictly from `architecture.md` (v1) and `doc.md`. Every element below maps to a contract function, a contract event, or a wrapper lifecycle state. No invented features.

**Style bible:** monochrome, dark, developer-grade. shadcn/ui primitives only (Card, Table, Dialog, Sheet, Tabs, Badge, Command, Alert, Separator, Progress, Toast/Sonner, Accordion, DropdownMenu, Tooltip, Skeleton). Typography: `font-mono` for hashes/IDs/addresses, `font-sans` for everything else. Color: `zinc-950` background, `zinc-900` surfaces, `zinc-800` borders, `zinc-400` secondary text, `zinc-50` primary text. Single accent via text weight, not hue.

---

## 1) User Flows

### 1.1 Publisher Flow (end-to-end)

1. **Connect wallet** → authenticated via Privy (social login or external wallet). Auto-drip of `lUSD` test tokens on first login.
2. **New Dataset** (`/datasets/new`) — 4-step wizard:
   1. **Encrypt & Upload** — client-side AES-256 encryption, chunked upload to 0G Storage via `ZgFile` + `Indexer.upload()`. UI streams `merkleTree()` progress and finally surfaces `datasetRoot`.
   2. **Author Policy Manifest** — off-chain signed JSON (domain taxonomy, legal text, attribution, derivative rights). UI computes `manifestHash`.
   3. **Configure On-Chain Policy** — the authoritative fields from §6.1 (purposes, providers, royaltyPerEpoch in `lUSD`, minEscrow, epochs caps, TTLs, TEE flag, attestation flag).
   4. **Sign & Anchor** — wrapper submits `registerDataset` + policy activation via UserOp. UI watches for `PolicyActivated`-equivalent state (or the first successful read confirming `active=true`).
3. **Dashboard** (`/datasets`) — list datasets, lifetime royalties, active jobs, pending settlements.
4. **Dataset detail** (`/datasets/:datasetRoot`) — policy view/edit (`updatePolicy`, `pausePolicy`, `resumePolicy`), job history, earnings, audit log.
5. **Settlement events** auto-surface via `RoyaltySettled` listener; toasts and a persistent Activity panel.

### 1.2 Researcher Flow (end-to-end)

1. **Connect wallet** → authenticated via Privy (social login or external wallet). Auto-drip of `lUSD` test tokens on first login.
2. **Discover** (`/catalog`) — browse datasets with their on-chain policy summary. Filter by purpose, provider, price/epoch, TEE-required.
3. **Request Access** (`/catalog/:datasetRoot/request`) — form constrained by policy (purpose ∈ `allowedPurposeIds`, provider ∈ `approvedProviders`, epochs ≤ `maxEpochsPerRun`). Live escrow quote = `royaltyPerEpoch × requestedEpochs` (≥ `minEscrow`) in `lUSD`. If allowance < quote, batch `approve` + `requestAccess` in one UserOp. Submit triggers wrapper → `requestAccess(...)`.
4. **Job lifecycle view** (`/jobs/:jobId`) — state timeline: Requested → Granted → Running → Completed/Failed/TimedOut (→ Refunded). Every state links to the emitting tx hash.
5. **Artifacts** — on Completed, show `resultHash`, `attestationRef`, `actualEpochs`. Download gate (if any) is off-spec for now; only references are shown.
6. **Refund** — if Failed/TimedOut, wrapper auto-calls `refund(jobId)`; user can also trigger manually from the job page; `RefundIssued` closes the job.

### 1.3 Split Dashboards

Users can act as both publisher and researcher from a single identity. The two roles each get a dedicated home page with role-specific stats, explanatory notes on every card, and prominent CTAs. There is no toggle — the sidebar groups (`Publish` and `Research`) provide navigation between roles. All routes remain accessible regardless of which home the user is on.

---

## 2) Navigation Structure

App shell: left collapsible rail (three groups: Publish / Research / Protocol), topbar with lUSD balance pill + wallet dropdown, content area. No Publish/Research toggle — role context is conveyed by the active sidebar group and the page itself.

```
Sidebar groups:
  Publish
    Home              → /app            (Publisher Dashboard)
    My Datasets       → /app/datasets

  Research
    Home              → /app/research   (Researcher Dashboard)
    Catalog           → /app/catalog
    My Jobs           → /app/jobs

  Protocol
    Audit             → /app/audit

  (footer)
    Settings          → /app/settings

Routes:
  /app                                 → Publisher Dashboard (dataset cards + royalty stats)
  /app/datasets                        → full datasets table
  /app/datasets/new                    → 4-step publish wizard
  /app/datasets/:datasetRoot           → dataset detail (policy, jobs, earnings)

  /app/research                        → Researcher Dashboard (job list + escrow stats)
  /app/catalog                         → discover datasets
  /app/catalog/:datasetRoot            → dataset read-only detail + Request CTA
                                         (CTA disabled if me == owner)
  /app/catalog/:datasetRoot/request    → 3-step request flow

  /app/jobs                            → my jobs table
  /app/jobs/:jobId                     → job lifecycle detail + event log + escrow ledger

  /app/audit                           → protocol event search + recent log
  /app/audit/tx/:txHash                → single transaction drilldown
  /app/audit/job/:jobId                → public job lifecycle (no owner actions)
  /app/audit/dataset/:datasetRoot      → public dataset view (no keys, no editing)

  /app/settings                        → wallet, chain, token info (read-only)
```

Command menu (`⌘K`) actions: "Go to job…", "Go to dataset…", "Paste txHash…", "New dataset", "New request".

### 2.1 Authentication & Wallet

- **Privy authentication**: supports social login (email, phone, Google, etc.) and external wallets (WalletConnect, injected). Both paths expose an EIP-1193 provider that feeds the wrapper's UserOp flow.
- **0G testnet config**: registered as custom chain in Privy config.
- **Auto-drip on login**: frontend POSTs to wrapper `/onboard` with Privy JWT after successful auth. Wrapper verifies JWT, checks token balance and onboarded status, sends UserOp calling `dripTo(user, amount)` if needed, marks Privy ID as onboarded. Optional toast "Funded 1,000 lUSD for testing".
- **External wallet funding prompt**: for users importing external wallets without prior drip, a one-time banner "Get testnet gas" points to the public 0G faucet.
- **Top-up affordance**: wallet dropdown includes "Top up test balance" menu item (hidden when balance > threshold). Calls public `claim()` via UserOp with Stepper in small popover. Per-address lifetime cap enforced in contract.

---

## 3) Screen-by-Screen Breakdown

Format: **Purpose · Data · Components · Actions · System responses · States**.

### 3.1 Unified Dashboard `/`
- **Purpose:** overview of portfolio and live jobs for a single identity acting in both capacities.
- **Data:**
  - datasets: `datasetRoot`, short label, `active`, `policyExpiry`, lifetime royalty (sum of `RoyaltySettled.amount`).
  - in-flight jobs on my datasets (state ∈ {Requested, Granted, Running}).
  - my jobs as researcher (all states).
  - last 10 events across both roles.
- **Components:** stat `Card`s (Total datasets, Active policies, Lifetime royalties, Jobs in flight), two stacked sections: "My datasets" table and "My jobs" table, right-side `ScrollArea` activity feed, `Button` "New dataset", `Button` "Browse catalog".
- **Actions:** open dataset, pause/resume policy (inline DropdownMenu), open job, switch to catalog.
- **System responses:** indexer subscription; contract events via Envio.
- **States:** loading (`Skeleton` rows), empty datasets ("No datasets yet — upload your first"), empty jobs ("No jobs yet — browse catalog"), stale (Badge "indexer lag 23s").

### 3.2 Datasets List `/datasets`
- **Purpose:** publisher-focused view of owned datasets.
- **Data:** same as dashboard datasets section, expanded with more columns (royalty rate, policy expiry, job count).
- **Components:** `Table` with filters, `Button` "New dataset".
- **Actions:** open dataset, pause/resume, copy root.
- **States:** same as dashboard.

### 3.3 New Dataset Wizard `/datasets/new`
Four-step `Tabs` with forward-only progression until each step resolves.

#### Step 1 — Encrypt & Upload
- **Data:** file handle, key (derived client-side), progress %, chunked upload state, final `datasetRoot`.
- **Components:** `Input type=file`, `Progress`, inline `Card` showing: encryption %, upload %, `datasetRoot` when available (with copy button, `font-mono`, truncated middle).
- **Actions:** select file, begin, cancel.
- **System responses:** SDK `merkleTree()` then `indexer.upload()`; no on-chain tx yet.
- **States:** idle, encrypting, uploading (with ETA), failed (Alert with retry), done (root displayed).
- **Trust boundary:** labeled "Client-side" via a subtle `Badge`.

#### Step 2 — Author Manifest
- **Data:** manifest JSON fields: human-readable terms, domain taxonomy, allowed/prohibited classes, model/task constraints, region notes, attribution requirements, derivative rights, version, owner signature.
- **Components:** structured form on left, live JSON preview (`Card` with monospace) on right, "Sign manifest" `Button` → EIP-191 signature over canonical bytes; `manifestHash` appears as `Badge`.
- **Actions:** fill fields, sign, upload manifest to 0G Storage (separate `ZgFile`).
- **States:** drafting, signing, uploading, anchored.

#### Step 3 — On-Chain Policy
- **Data (maps 1:1 to §6.1):**
  - `allowedPurposeIds: bytes32[]` — multi-select `Command` over a curated taxonomy (`NEURAL_RESEARCH`, `ACADEMIC`, `COMMERCIAL_R&D`, …). Stored as keccak256 of the label.
  - `allowedRequesters: address[]` — `Textarea` or row editor; empty = open.
  - `approvedProviders: address[]` — provider pickers (prepopulated from wrapper registry).
  - `royaltyPerEpoch` — number + unit (`lUSD`) `Input`.
  - `minEscrow` — number + unit (`lUSD`).
  - `maxEpochsPerRun`, `maxRunsPerRequester` — numeric.
  - `accessTtlSeconds`, `policyExpiry` — duration + absolute date pickers.
  - `requireTEE`, `requireResultAttestation` — `Switch`.
- **Components:** one `Card` per policy group, left-side sticky "Policy summary" preview showing the exact on-chain tuple and estimated cost-per-run examples in `lUSD`.
- **Actions:** validate locally; compute cost-per-run examples (e.g. 5 epochs → X lUSD).
- **States:** invalid (inline field errors), valid.

#### Step 4 — Sign & Anchor
- **Data:** calldata preview, signer, wrapper endpoint, gas abstracted (no gas UI), expected events.
- **Components:** `Dialog` "Review & Submit" with the full tuple (`datasetRoot`, `manifestHash`, fields). Primary `Button` "Submit via Orchestrator".
- **System responses:** wrapper returns UserOp hash, then tx hash, then confirmation, then derived state `active=true`. A live checklist renders each milestone.
- **States:** submitting (Stepper: submitted → included → confirmed → activated), failed (`Alert` with wrapper reason code + retry), success (redirect to `/datasets/:datasetRoot`).

### 3.4 Dataset Detail `/datasets/:datasetRoot`
- **Purpose:** single source of truth for a dataset policy, its jobs, earnings, and audit trail.
- **Data:** on-chain policy tuple, `manifestHash` (link to manifest viewer), `active`, lifetime royalties, paused flag, last tx.
- **Components:** header with `datasetRoot` (truncated, copy, explorer link) + status `Badge` (Active / Paused / Expired). `Tabs`:
  - **Policy** — read view of all fields; `Button` "Edit policy" opens `Sheet` editing fields that `updatePolicy` allows; destructive actions `Pause`/`Resume` behind `AlertDialog`.
  - **Jobs** — `Table` (jobId, requester, purpose, provider, requested/actual epochs, escrow, state, last tx). Row → job detail.
  - **Earnings** — `Table` of `RoyaltySettled` rows: jobId, amount in `lUSD`, blockNumber, txHash, timestamp. Summary `Card`s above (period filter).
  - **Audit** — chronological event log: `AccessRequested`, `AccessGranted`, `JobStarted`, `JobCompleted`, `JobFailed`, `JobTimedOut`, `RoyaltySettled`, `RefundIssued`. Each row shows topic, decoded args, tx hash.
- **Actions:** pause/resume, update policy (only fields the contract permits in `updatePolicy`), copy root/manifestHash, export audit CSV.
- **States:** loading, partial (policy loaded but event backfill pending — show `Badge` "backfilling"), error.

### 3.5 Catalog `/catalog`
- **Purpose:** discover datasets and their policies.
- **Data:** for each dataset row: `datasetRoot`, short label (from manifest), `allowedPurposeIds`, `royaltyPerEpoch` in `lUSD`, `minEscrow` in `lUSD`, `maxEpochsPerRun`, `requireTEE`, `active`, policy expiry.
- **Components:** `Table` with column filters, `Command` palette search by root/label, detail drawer (`Sheet`).
- **Actions:** open detail; "Request access".
- **States:** loading `Skeleton`, empty filters, policy inactive rows dimmed.

### 3.6 Dataset Detail (Catalog) `/catalog/:datasetRoot`
- **Purpose:** read-only policy + request CTA.
- **Data:** same as 3.4 Policy tab, plus public job stats (counts per state) and manifest viewer (rendered JSON with schema labels).
- **Components:** policy `Card` groups, "Request access" `Button` (disabled with `Tooltip` if: wallet ∉ `allowedRequesters` when set, policy paused/expired, chain mismatch, wrapper down, **or me == owner** with tooltip "You own this dataset").
- **States:** ineligible (clear reason from the disabled tooltip), eligible.

### 3.7 Request Flow `/catalog/:datasetRoot/request`
- **Purpose:** construct a policy-compatible access request.
- **Data (maps to `requestAccess` params):** `datasetRoot` (locked), `purposeId` (Select over `allowedPurposeIds`), `provider` (Select over `approvedProviders`), `requestedEpochs` (constrained ≤ `maxEpochsPerRun`), `termsHash` (auto = `manifestHash` acknowledged by checkbox).
- **Derived:** `escrowQuote = max(minEscrow, royaltyPerEpoch × requestedEpochs)` in `lUSD`; TTL preview = `accessTtlSeconds`.
- **Components:** left form; right `Card` "Escrow & Terms" with quote, TTL, TEE/attestation flags (read-only), and "I accept the manifest terms" `Checkbox`. If allowance < quote, show "Enable lUSD" one-time state with explanation.
- **Actions:** Submit → wrapper batches `approve` (if needed) + `requestAccess` (UserOp). Cancel.
- **System responses:** `AccessRequested` event → jobId assigned → redirect to `/jobs/:jobId`.
- **States:** validating, submitting, rejected (policy mismatch — inline Alert quoting the violated field), accepted.

### 3.8 Jobs Table `/jobs`
- **Purpose:** all my jobs as researcher.
- **Components:** `Table`: jobId, datasetRoot (trunc), purpose, provider, requested/actual epochs, escrow in `lUSD`, state `Badge`, last event time, txHash.
- **Actions:** open detail, copy jobId/tx.
- **States:** filters by state.

### 3.9 Job Detail `/jobs/:jobId`  ← **most important async screen**
- **Purpose:** authoritative lifecycle view with audit anchors.
- **Data:** `jobId`, `datasetRoot`, requester, provider, `purposeId`, `requestedEpochs`, `actualEpochs` (null until Completed), `escrow` in `lUSD`, `settledAmount` in `lUSD`, `refundAmount` in `lUSD`, `resultHash`, `attestationRef`, state, all event txHashes, wrapper internal phase.
- **Components:**
  - Header: jobId (mono, copy), state `Badge`, last-updated relative time.
  - **State Timeline** (`Card` with stepped list): Requested → Granted → Running → Completed (or Failed/TimedOut → Refunded). Each node: timestamp, txHash link, decoded event args. Unreached nodes are muted; current node pulses via reduced-motion-safe `Skeleton`.
  - **Policy snapshot** (`Card`): the exact on-chain fields at request time (pinned).
  - **Compute** (`Card`): provider address, whether `requireTEE`, attestation present Y/N (only after Granted), model/task (echoed from request), `actualEpochs` vs `requestedEpochs` comparator (see §6).
  - **Escrow ledger** (`Card`): locked, settled, refunded, net — each row has a txHash. Amounts in `lUSD`.
  - **Artifacts** (`Card`): `resultHash`, `attestationRef` (both mono, copy, link to audit drilldown).
  - **Actions**: `Dialog` "Mark failed / Timeout / Refund" — these are primarily wrapper-driven; manual buttons exist only when the contract permits the caller and a guard passes (e.g. `timeoutJob(jobId)` after TTL, `refund(jobId)` post terminal-non-settled).
- **System responses:** subscription to `AccessGranted`, `JobStarted`, `JobCompleted`, `JobFailed`, `JobTimedOut`, `RoyaltySettled`, `RefundIssued` filtered by `jobId` via Envio.
- **States:** each lifecycle state rendered distinctly (see §4).

### 3.10 Universal Audit `/audit/...`
- **Purpose:** shareable, read-only drilldowns.
- **Data:** minimal: decoded event, txHash, block, addresses, referenced jobId/datasetRoot.
- **Components:** `Card` + `Table`. No wallet required.

### 3.11 Settings `/settings`
- Wrapper base URL, chain id, explorer, Envio GraphQL endpoint, signer address. Read-only in MVP.

---

## 4) Job Lifecycle UX

Single component: `<JobStateTimeline state=... events=... />`. Each state has: label, icon glyph (outline, monochrome), copy, primary action (if any), and data rendered.

| State       | Trigger                                    | UI signal                                                                                                   | Progress pattern                                           | Action/fallback                                                  |
|-------------|--------------------------------------------|-------------------------------------------------------------------------------------------------------------|------------------------------------------------------------|------------------------------------------------------------------|
| Requested   | `AccessRequested` emitted                  | `Badge` outline; node 1 active; "Awaiting policy check…"                                                     | Indeterminate `Progress` on node 1                         | None; auto-advance                                               |
| Granted     | `AccessGranted`                            | `Badge` subtle; shows `jobId` grant tx; banner "Escrow locked: X lUSD. Orchestrator provisioning compute."   | Node 2 active                                              | Cancel before Running (if contract permits) via `Dialog`          |
| Running     | `JobStarted` (+ optional attestation)      | `Badge` solid-outline; live wrapper phase subline (e.g. "epoch 3/5"). Wrapper data is labeled "off-chain"     | Determinate progress if `actualEpochs` streamable, else indeterminate | None manually; wait                                     |
| Completed   | `JobCompleted` + `RoyaltySettled`          | `Badge` filled; Escrow ledger shows settlement row in `lUSD`; Artifacts card populated                        | Full bar; celebratory-free, just a checkmark glyph         | "Download receipt" (JSON of all tx hashes + hashes)               |
| Failed      | `JobFailed(reasonCode)`                    | `Badge` outlined "Failed"; `Alert` with reasonCode + human copy; links to wrapper logs if authorized         | Halt at Running node; fork to Refunded                     | `Button` "Request refund" → `refund(jobId)` (if not auto)         |
| TimedOut    | `JobTimedOut` after `accessTtlSeconds`     | `Badge` "Timed out"; `Alert` "TTL exceeded at <ts>"                                                          | Halt + fork                                                | Same refund path; retry requires a new `requestAccess`            |
| Refunded    | `RefundIssued`                             | Final node; Escrow ledger shows refund row in `lUSD`; net=0 or partial                                         | Final check on Refunded node                               | "Start new request" CTA                                           |

**Retry UX:** never "retry same job". Always present "Start new request" prefilled from the old job's parameters (`purposeId`, `provider`, `requestedEpochs`) — new job gets a new `jobId`. This matches the state machine invariant "one terminal state per job" (§11).

**Partial completion:** when `actualEpochs < requestedEpochs` and job is Completed, show a comparator bar (`requestedEpochs` vs `actualEpochs`) and a "Refund pending" Badge until `RefundIssued` lands; settlement mode is settle-by-actual with refund diff (confirmed).

---

## 5) Transaction & Async UX

### 5.1 Action → chain pipeline
Every mutating action flows: **UI form → wrapper API (`POST /userop`) → wrapper signs/sponsors → bundler → chain → Envio index → UI update**. The UI never prompts for gas.

### 5.2 Pending states
Three-phase `Stepper` used everywhere a mutation happens (wizard Step 4, request submit, pause/resume, manual refund):

1. **Submitted to orchestrator** (wrapper accepted payload; has `userOpHash`).
2. **Included on-chain** (`txHash` known, 1 block).
3. **Confirmed** (N confirmations configurable; default 1 on 0G testnet).

Between steps: `Skeleton` on dependent data, disabled primary button, Sonner toast "Orchestrator accepted — waiting for chain…". ETA hints only if wrapper reports mempool telemetry; otherwise elapsed counter only.

### 5.3 Confirmations & failures
- **Confirmed:** Sonner success toast with `txHash` shortlink; Activity feed prepends the event; relevant screen auto-refreshes.
- **Wrapper error (pre-chain):** `Alert` with wrapper reason code + recommended action (retry / fix field / wait). Do NOT expose as chain failure.
- **Chain revert:** `Alert` with decoded revert reason (via error selector) and a "Diagnose" link that shows: function signature, args, block, gas, reason string. Offer "Adjust & retry" that prefills the form.
- **Timeout waiting for inclusion:** after configurable window, show degraded `Alert` "Still pending — you can safely leave this page; we'll notify on completion" with local `Notification` API.

### 5.4 Exposing `txHash` and `jobId`
- All table rows show a 6/4 truncation of hashes in `font-mono` with click-to-copy and an explorer out-link icon (icon-only `Button` + `Tooltip`).
- `jobId` is the stable anchor for the research-side UI and is the share URL for support (`/audit/job/:jobId`).
- Job detail header exposes a one-line "Cite this job" block with jobId + first tx hash, copyable together.

---

## 6) Escrow & Payment UX

### 6.1 Before execution (lock)
- On request screen, Escrow card shows `escrowQuote` breakdown in `lUSD`:
  - `royaltyPerEpoch × requestedEpochs`
  - `minEscrow` floor (shown if it raises the total; labeled "policy floor")
  - Total locked
- Submit reveals Stepper; once `AccessGranted` lands, Job detail Escrow ledger shows a "Locked" row with `txHash`.

### 6.2 After completion (settlement)
- On `RoyaltySettled`: ledger adds "Settled to publisher: X lUSD" with txHash; running net balance updates. Publisher dashboard aggregates into lifetime royalties.
- Settle-by-actual: if `actualEpochs < requestedEpochs`, settlement is for `actualEpochs` only; a second row "Refund to requester: Δ lUSD" appears on `RefundIssued`.

### 6.3 Refunds
- Displayed identically to settlement but on the requester side. Triggered automatically by wrapper on Failed/TimedOut. Manual button (`refund(jobId)`) is visible only when:
  - state ∈ {Failed, TimedOut}, AND
  - no prior `RefundIssued` for jobId, AND
  - wallet is the requester.
- `AlertDialog` confirms before sending. Success → state transitions to Refunded, ledger closes.

### 6.4 Escrow-at-risk UI
- Researcher dashboard stat "Escrow locked" sums non-terminal jobs' escrow in `lUSD` and links to a filtered jobs view. This makes the user's economic exposure legible at a glance — important because execution is async and can span minutes.

### 6.5 Token allowance
- Request flow checks `lUSD.allowance(user, contract)`. If < quote, show "Enable lUSD" state with explanation. Wrapper batches `approve` + `requestAccess` into one UserOp, so user sees a single Stepper.

---

## 7) Data Model → UI Mapping

| Field                        | UI representation                                                                                              |
|------------------------------|----------------------------------------------------------------------------------------------------------------|
| `datasetRoot: bytes32`       | Primary identity chip: mono, middle-truncated (`0x1234…abcd`), copy icon, `Tooltip` full value, link to `/audit/dataset/:datasetRoot`. |
| `manifestHash: bytes32`      | Secondary chip next to datasetRoot, labeled "manifest". Click opens manifest viewer drawer (rendered JSON + signature check badge). |
| `owner: address`             | Avatar (blockies) + truncated address + ENS/label if resolvable.                                               |
| `allowedPurposeIds: bytes32[]` | `Badge` cluster with decoded label (from local taxonomy) and hash on hover.                                   |
| `approvedProviders: address[]` | Provider list `Card` with names from wrapper registry; on request form, becomes a constrained `Select`.      |
| `royaltyPerEpoch`, `minEscrow` | Rendered in `lUSD` only (single unit).                                                                       |
| `maxEpochsPerRun`, `maxRunsPerRequester` | Shown as caps with a small "used / cap" bar per-requester on dataset detail.                        |
| `accessTtlSeconds`, `policyExpiry` | Humanized duration + absolute timestamp; TTL during Running renders as a countdown on Job detail.          |
| `requireTEE`, `requireResultAttestation`, `active` | `Badge`s (outline when true, muted when false).                                                  |
| `jobId`                      | Header chip on Job detail; row anchor in all job tables; URL segment.                                          |
| `requestedEpochs` vs `actualEpochs` | Side-by-side numeric comparator on Job detail with a thin bar chart; delta labeled "refund candidate" when positive. |
| Events (`AccessRequested`, …) | Typed rows in Audit tabs: topic badge, decoded args accordion, txHash, block, timestamp.                      |
| `resultHash`, `attestationRef` | Mono chips in Artifacts card; click opens audit drilldown (not a download).                                  |
| `reasonCode` (from `markJobFailed`) | Mapped to a human message via a local dictionary; raw code shown in `Tooltip`.                           |
| `lUSD balance`               | Shown in wallet pill next to address; faucet/drip affects this value.                                        |

---

## 8) Edge Cases

1. **Failed jobs.** `JobFailed(reasonCode)` → state Failed, ledger unchanged until refund. UI shows `Alert` with mapped reason + "Request refund" (or auto status if wrapper handles it). Audit tab keeps the failure event verbatim.
2. **Timeouts.** `accessTtlSeconds` exceeded with no `JobStarted` or `JobCompleted` → anyone (per contract) can call `timeoutJob(jobId)`; UI exposes this only to the requester or owner after TTL, guarded by `AlertDialog`. Countdown appears on Job detail during Granted/Running.
3. **Partial completion / actualEpochs < requestedEpochs.** Comparator + pending refund Badge, confirmed on `RefundIssued`. Settlement is settle-by-actual with refund diff.
4. **Invalid policy request.** Client-side validation rejects pre-submit (purpose not allowed, provider not approved, epochs over cap, manifest acknowledgement missing, requester not in allowlist). If it slips past and the contract reverts, the revert reason is decoded into the same field error idiom (e.g. "Purpose not permitted" highlights the purpose `Select`).
5. **Wrapper failure scenarios.**
   - Wrapper unreachable: global `Alert` banner "Orchestrator offline — read-only". All mutating buttons disabled with `Tooltip`.
   - Wrapper accepted but never produced tx: Submitted step stalls; after timeout, offer "Retry submission" (idempotency key = UI-generated nonce so wrapper doesn't double-submit).
   - Wrapper reports attestation failure pre-Running: job Failed with reasonCode `ATTESTATION_FAILED`; normal refund path.
   - Wrapper crashed mid-Running: Job detail shows "Compute callback missing" sub-alert; TTL path eventually triggers Timeout+Refund. UI never fabricates Completed.
6. **Paused policy with in-flight jobs.** Existing `Granted`/`Running` jobs continue (contract-dependent); new `requestAccess` rejected. Catalog row shows `Badge` "Paused" and disables CTA.
7. **Chain mismatch / wrong signer.** Topbar wallet pill renders destructive state; all mutating CTAs disabled.
8. **Indexer lag.** Any screen that depends on event backfill shows a `Badge` "indexer +Ns" when the latest block known to Envio trails the RPC head by > threshold. On-chain reads remain authoritative for policy fields.
9. **Replayed completion callback.** Contract rejects; UI surfaces nothing to the user — wrapper handles silently. Audit shows the accepted event only.
10. **Empty `allowedRequesters`.** Treated as open policy — UI renders `Badge` "Open policy"; do not display an empty list.
11. **Self-ownership request.** User attempts to request access to a dataset they own. CTA disabled with tooltip "You own this dataset".

---

## 9) Design Justification

- **Single job detail as the centerpiece** — because execution is asynchronous (5–20s per tx, compute job minutes). Users need a stable URL (`/jobs/:jobId`) they can leave and come back to. Maps directly to the §11 state machine and §12 events.
- **State machine mirrored as a Timeline, not a spinner** — §11 defines explicit states with non-linear forks (Failed/TimedOut → Refunded). A linear progress bar would misrepresent the system; a stepped timeline with forks is faithful.
- **No gas UI, Stepper instead of "Confirm in wallet"** — per UX constraints and wrapper design (§10). The user mental model is "submit to orchestrator", not "sign a transaction".
- **Escrow ledger as a first-class card** — §8.2 recommends settle-by-actual with refund. The ledger makes the economic state unambiguous at every moment, and each row is anchored to a tx hash for audit (§4.1, §13).
- **Trust boundaries labeled in-UI** — §4 explicitly separates what's enforced vs attested. Every card that shows wrapper-reported data (`actualEpochs` stream before `JobCompleted`, phase strings) carries a muted "off-chain · orchestrator" label. On-chain-derived data carries "on-chain". Attestation-derived data carries "attested" when `requireResultAttestation` is true and present.
- **`datasetRoot` and `jobId` as ubiquitous, copyable anchors** — §5 makes these canonical identifiers. Every table row, every detail header, every event exposes them consistently to enable the auditability guarantee in §4.1.
- **Policy Manifest editor separated from on-chain policy** — §6.1 vs §6.2 separate authoritative enforcement fields from rich off-chain terms. Conflating them in one form would hide which fields are actually enforced. The two-step wizard (Manifest then On-Chain) matches the authority model.
- **Constrained request form (purposes/providers/epochs)** — §6, §8.1 encode hard constraints. Client-side enforcement prevents doomed `requestAccess` calls and aligns with §13 "strict role checks" philosophy.
- **Retry = new request** — §11 "one terminal state per job" invariant. UI must not suggest reusing a failed jobId.
- **Read-only public audit routes** — §4.1 ("auditable by wallet/job ID") and §17 ("UI displays full lifecycle with verifiable references") require shareable views without wallet connection.
- **shadcn primitives + monochrome** — developer audience, high-density data (hashes, states, numbers). Consumer flashiness actively harms legibility of the lifecycle, which is the core product.
- **Role-free navigation** — nothing in the architecture binds a wallet to a single role. `owner` is per-`datasetRoot`, requester is per-`jobId`. The Publish/Research toggle is a view filter, not an identity mode.
- **Privy authentication** — lowers researcher onboarding friction (social login) while preserving gas-abstracted UX via wrapper UserOp sponsorship. Auto-drip on login eliminates the faucet screen entirely.
- **Custom ERC-20 (`lUSD`) for royalties** — native-token faucet drip is too small for realistic demo numbers. ERC-20 gives unlimited test liquidity, readable amounts, and separates payment rail from gas rail.
- **Envio HyperIndex as runtime truth** — contract authoritative for policy state, Envio-indexed events authoritative for job history. GraphQL out of the box drives tables and timelines without bespoke API layer.

---

## 10) Gaps in Architecture That Block Final UI Decisions

Explicitly calling out, not guessing:

1. **Attestation verification mechanism** — "Attested" badge semantics on Job detail and Artifacts card depend on whether verification happens in the contract, wrapper, or client. Current design labels it but does not re-verify client-side.
2. **Contract surface not fully specified.** §12 lists suggested functions; UI assumes:
   - a `registerDataset(datasetRoot, manifestHash, policyTuple)` (or equivalent) exists for Step 4 of the wizard — name and exact shape must be fixed.
   - `updatePolicy` scope (which fields are mutable post-activation) must be explicit; the edit Sheet in §3.4 should gray out immutable fields.
   - Whether `timeoutJob` and `refund` are permissionless or role-gated affects which buttons render on Job detail.
3. **Event argument shapes** (`jobId` type, indexed topics, inclusion of `escrow`, `provider`, etc.) affect exactly what the Timeline and tables can render without extra RPC reads. Freezing §12 event ABIs will tighten the UI.
4. **`allowedRequesters` mandatory vs optional at launch** — UI treats empty as open policy; if launch mandates non-empty, the catalog eligibility tooltip copy must change.
5. **Key management in wrapper/compute** — Any UI that claims "session-scoped key released" needs the exact surface; for now no UI asserts this beyond `requireTEE` badge.
6. **Provider registry** — `approvedProviders` are addresses; human labels are needed for the provider `Select`. Source (on-chain registry, manifest, wrapper config?) is undecided.
7. **Manifest signature verification path** — UI shows a "signature valid" badge but needs a decision on signer = dataset owner at registration time vs. at display time (owner rotation case).

Resolving these unblocks the final data contracts between wrapper, contract, and UI.
