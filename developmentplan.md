# Publish Phase Development Plan (From Scratch)

This plan reflects the **actual current codebase state**:

- Frontend is implemented as UI-only with mock data.
- `/app/datasets/new` is currently a placeholder wizard shell.
- No 0G SDK integration exists in dependencies.
- No wrapper/orchestrator service exists yet.
- Contracts package is still default Foundry scaffold (`Counter.sol`), no `DataPolicy` implementation yet.
- Auth is integrated via Privy with `/login` and `/app/*` route protection.

---

## Agreed Decisions

1. Build functionality from scratch, in phases.
2. Purpose IDs use a **fixed enum** for MVP.
3. 0G SDK/provider registry details must be validated by implementation research.
4. Manifest storage approach to decide jointly; initial recommendation included below.

---

## Scope of Publish Phase

We will implement the end-to-end publisher flow:

1. Encrypt dataset client-side.
2. Upload encrypted dataset to 0G storage.
3. Author + sign policy manifest and upload manifest.
4. Configure on-chain policy fields.
5. Submit anchor transaction through backend orchestration.

---

## Architecture Tracks (Built in Parallel)

### Track A — Frontend Wizard (Next.js)

Target page: `/app/datasets/new`

- Convert placeholder into a real 4-step stateful wizard.
- Persist wizard progress and outputs between steps.
- Add step validation and robust error/retry UX.
- Replace mock placeholders with real async actions.

### Track B — Storage + Crypto Integration

- Add encryption module (AES-256, client-side only).
- Add storage adapter for 0G upload (SDK if available, HTTP fallback if not).
- Implement upload progress + completion outputs (`datasetRoot`, blob references).
- Upload signed manifest as a separate object.

### Track C — Contract Layer (`packages/contracts`)

- Implement `DataPolicy` contract v1 (schema from `architecture.md` §6.1).
- Add functions for dataset registration + policy activation/update.
- Add events needed by publish flow.
- Write Foundry unit tests for publish-path invariants.

### Track D — Orchestrator/Backend (new service)

- Build minimal wrapper API for publish route(s).
- Verify payload and call contract write flow.
- Return operation status + tx hash lifecycle.
- Prepare status endpoint/polling hooks for frontend stepper.

---

## Execution Strategy (Industry-Standard)

We will execute with **dependency-ordered parallelism** instead of strict track-by-track sequencing:

1. Define stable shared contracts first (types, status model, error envelope).
2. Implement backend API stubs against those contracts (`submit`, `status`).
3. Build frontend wizard flows against the stable contract surface.
4. Replace backend internals with real storage/chain orchestration without breaking contract shape.
5. Harden with idempotency, retries, observability, and end-to-end checks.

This minimizes churn, reduces integration risk, and keeps frontend/backend development unblocked.

### Current Focus: Milestone 1 (Contract-First Foundation)

Deliverables:

- Shared publish request/response types in web app.
- Runtime payload validation for publish submit.
- Route handlers:
  - `POST /api/publish/submit`
  - `GET /api/publish/status/:requestId`
- Deterministic status lifecycle for UI integration (`queued` -> `validating` -> `accepted`).

Acceptance criteria:

- API contracts compile with strict typing.
- Invalid payloads return structured `400` errors.
- Valid payloads return stable request identifiers.
- Status endpoint returns a typed response for known/unknown request IDs.

---

## Wizard Build Plan

### Step 1 — Encrypt & Upload

Outputs:

- `datasetRoot`
- encrypted object reference(s)
- file metadata

Implementation notes:

- Use browser-native crypto first (Web Crypto API).
- Stream progress: encryption then upload.
- No chain call in this step.

### Step 2 — Manifest Authoring

Outputs:

- canonical manifest JSON
- owner signature
- `manifestHash`
- manifest storage reference

Implementation notes:

- Fixed-purpose enum source of truth in shared constants.
- Sign canonicalized JSON bytes.

### Step 3 — On-Chain Policy Settings

Outputs:

- validated policy config object matching contract tuple

Implementation notes:

- All required fields from §6.1.
- Providers initially sourced from static backend config until registry exists.

### Step 4 — Sign & Anchor

Outputs:

- contract address (if factory/deployer returns it)
- transaction hash
- activation confirmation

Implementation notes:

- Wizard submits final payload to wrapper endpoint.
- UI shows milestone state: submitted -> included -> confirmed -> active.

---

## Manifest Storage Decision (Recommended)

Recommended flow:

1. Frontend creates and signs manifest.
2. Frontend uploads manifest to 0G storage directly.
3. Frontend sends to wrapper only:
   - `datasetRoot`
   - `manifestHash`
   - manifest URI/reference
   - on-chain policy fields
4. Wrapper verifies coherence and anchors on-chain.

Why this default:

- Keeps manifest authoring trust boundary on client.
- Reduces backend responsibility for document custody.
- Keeps wrapper focused on policy + chain orchestration.

---

## Authentication Milestone (Pre-Publish)

**Status**: Complete

**Implementation**:
- Privy SDK configured with Base Sepolia and Sepolia chains
- `/login` page with `returnTo` redirect logic
- `AuthGuard` component protecting all `/app/*` routes
- Homepage CTAs (Hero, Navigation, FinalCTA) wired to navigate to `/login?returnTo=...`
- `AppTopbar` displays real wallet address from Privy user object
- Logout functionality in wallet dropdown

**Flow**:
- Unauthenticated user clicks homepage CTA → redirected to `/login?returnTo=...`
- User authenticates on `/login` → redirected to intended route
- Direct navigation to `/app/*` → redirect to `/login?returnTo=...`
- After login → redirect to `returnTo` or `/app`

---

## Phase Milestones

### Milestone P0 — Foundations

- Shared types for wizard payloads.
- Fixed purpose enum and provider source abstraction.
- Error model and status enums.

### Milestone P1 — Functional Step 1 + Step 2

- Real encryption/upload.
- Real manifest creation/signing/upload.
- Persisted intermediate outputs.

### Milestone P2 — Functional Step 3 + Contract v1

- Full policy form + validation.
- DataPolicy contract + tests.

### Milestone P3 — Functional Step 4 + Wrapper Integration

- Publish endpoint calls contract path.
- End-to-end submit and confirmation in UI.

### Milestone P4 — Hardening

- Retry/resume behavior.
- Better observability/logging.
- Integration tests for publish happy path and key failures.

---

## Immediate Next Actions

1. Confirm 0G storage integration path (SDK package name/version or HTTP API fallback).
2. Define initial wrapper API contract for publish submit + status.
3. Implement shared publish types (frontend + backend).
4. Build Step 1 functional vertical slice first.
