# Track D: Settlement & UI Phase — Implementation Report

**Date:** 2026-05-02  
**Status:** ✅ Phase 1 Complete (Publisher earnings wired; TEE attestation UI pending)  
**Packages affected:** `apps/web`

---

## 1. What Track D Implements

Track D closes the loop for both sides of the LICEN marketplace:

- **Researchers** can see their training session lifecycle in real time (Requested → Granted → Running → Completed/Failed), view the payment ledger (escrow locked, royalty settled, refund issued), and access the on-chain artifacts (resultHash, attestationRef).
- **Publishers** can see which datasets are being used, how many training sessions have run, and how much royalty has been earned lifetime.

Track D Phase 1 also fixed a critical deployment blocker: 13 pages had the Envio GraphQL endpoint hardcoded to `127.0.0.1:8080`, which would cause every page to return empty data on Vercel.

---

## 2. Changes Made

### 2.1 Envio URL Fix — 13 Pages Patched

**Problem:** Every server component that queries the Envio HyperIndex had the URL hardcoded:
```typescript
const res = await fetch("http://127.0.0.1:8080/v1/graphql", { ... });
```
This works in local dev but silently breaks on Vercel deployment.

**Fix:** All 13 files were patched to use:
```typescript
process.env.NEXT_PUBLIC_ENVIO_GRAPHQL_URL ?? "http://127.0.0.1:8080/v1/graphql"
```

**Files patched:**
- `app/app/marketplace/page.tsx`
- `app/app/marketplace/[datasetRoot]/request/page.tsx`
- `app/app/marketplace/[datasetRoot]/page.tsx`
- `app/app/audit/tx/[txHash]/page.tsx`
- `app/app/audit/job/[jobId]/page.tsx`
- `app/app/audit/dataset/[datasetRoot]/page.tsx`
- `app/app/audit/page.tsx`
- `app/app/research/page.tsx`
- `app/app/sessions/[jobId]/page.tsx`
- `app/app/sessions/page.tsx`
- `app/app/page.tsx`
- `app/app/datasets/page.tsx`
- `app/app/datasets/[datasetRoot]/page.tsx`

**New env var to add to Vercel:**
```
NEXT_PUBLIC_ENVIO_GRAPHQL_URL=https://your-envio-endpoint.com/v1/graphql
```

### 2.2 Shared Envio Utility — `src/lib/envio.ts`

Created a reusable fetch utility that all pages can migrate to in the future:

```typescript
export async function envioFetch<T>(query: string, variables?): Promise<T>
export async function envioFetchSafe<T>(query: string, variables?): Promise<T | null>
```

`envioFetchSafe` swallows errors and returns `null` — appropriate for server components where a failed Envio query shouldn't crash the page.

### 2.3 Publisher Earnings — Real Data Wired

**Problem:** `apps/web/src/app/app/datasets/page.tsx` showed hardcoded zeroes:
```typescript
lifetimeRoyalties: "0",
jobCount: 0,
activeJobCount: 0,
policyExpiry: "2026-12-31T00:00:00Z",   // ← also hardcoded
```

**Fix:** The page now fetches real job stats from Envio for each publisher dataset in parallel:

```typescript
// Per-dataset: fetch all jobs, sum royaltySettled, count active
const jobs: Job[] = await envio.fetch(`query { Job(where: { datasetRoot: ... }) { state, royaltySettled } }`);

lifetimeRoyalties = formatUnits(
  jobs.reduce((acc, j) => acc + BigInt(j.royaltySettled ?? 0), BigInt(0)),
  18
);
activeJobCount = jobs.filter(j => j.state === "Running" || j.state === "Granted").length;
jobCount = jobs.length;
```

**`policyExpiry` fixed:** Previously hardcoded to `"2026-12-31"`. Now decoded from the on-chain `uint64` timestamp:
```typescript
policyExpiry: policy[7] ? new Date(Number(policy[7]) * 1000).toISOString() : "—"
```

---

## 3. What the Session UI Already Had (Pre-Track D)

The researcher-facing Training Session pages were already well-implemented from an earlier session. For completeness:

### `app/app/sessions/page.tsx`
- Fetches all jobs from Envio ordered by timestamp desc
- Hydrates each with `royaltyPerEpoch` from the on-chain `policies()` read to compute total escrow
- Shows: Session ID, Dataset, Purpose, Provider (0G Compute), Epochs (actual/requested), Payment locked, Status badge
- Click-through to detail page

### `app/app/sessions/[jobId]/page.tsx`
This page is the most complete UI element in the entire app:

**State timeline:** Visual step-by-step `Requested → Granted → Running → Completed` with fork path for `Failed/TimedOut/Refunded`. Each step shows:
- Dot indicator (completed/active/pending/fork)
- On-chain transaction hash (from Envio AuditLog)
- Timestamp
- Epoch progress bar (when Running)

**Event log:** Full `AuditLog` from Envio — every `AccessRequested`, `AccessGranted`, `JobStarted`, `JobCompleted`, `RoyaltySettled`, `RefundIssued` event with tx hash, timestamp, and decoded details.

**Payment ledger:**
- Locked: `royaltyPerEpoch × requestedEpochs` USDC with tx link
- Settled to publisher: `royaltySettled` from Envio (post-completion)
- Refunded to researcher: `refundIssued` from Envio
- Net cost: total USDC spent

**Compute card:**
- Provider name/address
- Epochs (actual vs requested with progress bar and refund note)
- Attestation proof status: `verified` / `pending` badge

**Artifacts card** (shown when job completes):
- `resultHash` — 0G Storage root of the LoRA adapter zip
- `attestationRef` — task UUID encoded as bytes32

**Policy snapshot card:**
- Dataset root, manifest hash, royalty rate, session window, expiry
- "Request refund" button (shown on Failed/TimedOut)
- "Refresh status" button (shown when Running)

---

## 4. What Track D Phase 2 Will Add

> [!IMPORTANT]
> The following are explicitly NOT implemented yet. They require Track D Phase 2.

| Feature | Status | Notes |
|:---|:---|:---|
| On-chain TEE attestation verification | ⏳ | Verify Intel TDX/AMD SEV-SNP quote on-chain |
| Researcher LoRA download | ⏳ | Decrypt LoRA adapter using key from 0G contract |
| Publisher dataset management | ⏳ | Pause/resume policy, update pricing |
| Refund request button (functional) | ⏳ | Currently renders but has no `onClick` |
| Download receipt button (functional) | ⏳ | Currently renders but has no `onClick` |
| Real-time WebSocket session updates | ⏳ | Replace polling with push notifications |
| Audit dashboard aggregates | ⏳ | Platform-wide volume, total royalties, top datasets |

---

## 5. Deployment Checklist

To make the full Track D UI work in production, these env vars must be set in Vercel:

```env
# Required for all 13 pages that query Envio
NEXT_PUBLIC_ENVIO_GRAPHQL_URL=https://your-envio-endpoint/v1/graphql

# Required for on-chain reads (already set)
NEXT_PUBLIC_OG_DATA_POLICY_ADDRESS=0x...
NEXT_PUBLIC_OG_EVM_RPC_URL=https://evmrpc-testnet.0g.ai

# Required for key sealing (already set)
NEXT_PUBLIC_ORCHESTRATOR_PUBLIC_KEY=<hex>
ORCHESTRATOR_PRIVATE_KEY=<hex>         # server only

# Database (already set)
LICEN_STORAGE_DATABASE_URL=postgresql://...
LICEN_STORAGE_DATABASE_URL_UNPOOLED=postgresql://...
```
