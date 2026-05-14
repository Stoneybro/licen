# Native 0G Migration Plan

This document describes what it would take to migrate LICEN from an ERC-20 payment model (`MockUSDC`/USDC-like flows) to native 0G for escrow, settlement, and refunds.

## Summary

Today the project assumes an ERC-20 payment token end-to-end:

- The contract stores `paymentToken` and uses `safeTransferFrom` / `safeTransfer`.
- The researcher request flow uses `approve`, `allowance`, and `balanceOf`.
- The UI exposes a USDC balance, a test USDC mint action, and USDC-specific copy.
- Deployment scripts require `PAYMENT_TOKEN_ADDRESS`.
- Tests use a mock ERC-20 token.

Moving to native 0G is feasible, but it is a real protocol migration, not a search-and-replace.

The biggest architectural change is:

- `requestAccess()` becomes `payable`.
- Escrow is enforced with `msg.value`.
- Settlement and refunds are paid with native transfers.
- The client stops doing token approvals entirely.

## Current ERC-20 Assumptions

### Contract layer

Main contract:

- [packages/contracts/src/DataPolicy.sol](/home/dev/licen/packages/contracts/src/DataPolicy.sol:10)
- Constructor currently takes `address _paymentToken`.
- Escrow lock:
  - `paymentToken.safeTransferFrom(msg.sender, address(this), requiredEscrow)`
- Settlement:
  - `paymentToken.safeTransfer(policy.owner, settleAmount)`
- Refund:
  - `paymentToken.safeTransfer(job.requester, refundAmount)`

### Frontend payment flow

Researcher request page:

- [apps/web/src/app/app/marketplace/[datasetRoot]/request/page.tsx](/home/dev/licen/apps/web/src/app/app/marketplace/[datasetRoot]/request/page.tsx:18)
- Reads ERC-20 `balanceOf`.
- Reads `allowance`.
- Sends `approve(...)`.
- Then sends `requestAccess(...)`.
- Uses USDC-specific faucet minting.

Topbar wallet balance:

- [apps/web/src/components/app/app-topbar.tsx](/home/dev/licen/apps/web/src/components/app/app-topbar.tsx:22)
- Displays USDC balance.
- Has “Get 1,000 Test USDC”.

Shared chain helpers:

- [apps/web/src/lib/publish/onchain.ts](/home/dev/licen/apps/web/src/lib/publish/onchain.ts:49)
- Contains `ERC20_ABI`.
- Contains `USDC_TOKEN_ADDRESS`.
- Encodes `royaltyPerEpoch` with 6 decimals.

### Tests and deployment

Tests:

- [packages/contracts/test/DataPolicy.t.sol](/home/dev/licen/packages/contracts/test/DataPolicy.t.sol:18)
- Uses `MockLUSD`.
- Approves token before requests.

Deployment:

- [packages/contracts/script/DeployDataPolicy.s.sol](/home/dev/licen/packages/contracts/script/DeployDataPolicy.s.sol:9)
- Requires `PAYMENT_TOKEN_ADDRESS`.

## Target Model

The target protocol should look like this:

1. Publisher registers a dataset with `royaltyPerEpoch` denominated in native 0G base units.
2. Researcher submits a request and sends native value with the transaction.
3. Contract verifies `msg.value == royaltyPerEpoch * requestedEpochs` (or `>=`, with explicit refund policy).
4. Contract records the escrow amount internally.
5. Orchestrator completes/fails/times out the job exactly as today.
6. On completion:
   - publisher receives native 0G
   - unspent escrow is refunded in native 0G
7. On failure/timeout:
   - escrow is refunded in native 0G

## Recommended Contract Changes

### 1. Remove ERC-20 dependency

Current:

- `IERC20 public immutable paymentToken;`
- `using SafeERC20 for IERC20;`
- constructor requires token address

Target:

- remove `paymentToken`
- remove `SafeERC20`
- constructor only takes `backendWallet`

### 2. Make `requestAccess()` payable

Current:

```solidity
function requestAccess(
    bytes32 datasetRoot,
    bytes32 purposeId,
    uint32 requestedEpochs,
    bytes32 termsHash
) external returns (bytes32 jobId)
```

Target:

```solidity
function requestAccess(
    bytes32 datasetRoot,
    bytes32 purposeId,
    uint32 requestedEpochs,
    bytes32 termsHash
) external payable returns (bytes32 jobId)
```

Add:

```solidity
uint256 requiredEscrow = policy.royaltyPerEpoch * requestedEpochs;
require(msg.value == requiredEscrow, "Incorrect escrow amount");
```

Why exact equality:

- simpler accounting
- fewer accidental overpayments
- no separate excess refund path inside request

Alternative:

- allow `msg.value >= requiredEscrow`
- immediately refund `msg.value - requiredEscrow`

That is less strict but adds more transfer logic and edge cases.

### 3. Replace token settlement with native transfers

Current:

```solidity
paymentToken.safeTransfer(policy.owner, settleAmount);
paymentToken.safeTransfer(job.requester, refundAmount);
```

Target:

```solidity
(bool paidOwner, ) = payable(policy.owner).call{value: settleAmount}("");
require(paidOwner, "Publisher payout failed");

(bool refunded, ) = payable(job.requester).call{value: refundAmount}("");
require(refunded, "Refund failed");
```

Use checks-effects-interactions carefully:

- compute amounts
- update state first where appropriate
- then transfer

### 4. Update refund path

Current refund:

```solidity
paymentToken.safeTransfer(job.requester, amount);
```

Target:

```solidity
(bool ok, ) = payable(job.requester).call{value: amount}("");
require(ok, "Refund transfer failed");
```

### 5. Add `receive()` only if needed

You do **not** need a generic `receive()` function unless you explicitly want the contract to accept arbitrary direct deposits.

Recommended:

- do **not** add an unrestricted `receive()`
- only accept value through `requestAccess()`

This reduces accidental deposits.

### 6. Consider a reentrancy guard

Because native transfers introduce external calls, add OpenZeppelin `ReentrancyGuard` or carefully order state writes before transfers.

Recommended:

- add `nonReentrant` on:
  - `requestAccess`
  - `confirmTrainingComplete`
  - `refund`

Even if current logic is simple, this is the standard defensive move once native value is involved.

## Decimal / Pricing Model Changes

Current pricing model:

- frontend treats `royaltyPerEpoch` like a 6-decimal token amount
- `parseUnits(..., 6)` in [onchain.ts](/home/dev/licen/apps/web/src/lib/publish/onchain.ts:121)

Native 0G should use:

- 18 decimals
- `parseUnits(..., 18)`
- `formatUnits(..., 18)`

This impacts:

- publish form price encoding
- researcher quote display
- dashboard/session amount formatting
- tests and fixtures

## Frontend Migration

### 1. Remove token approval flow

Researcher request page should stop doing:

- `allowance`
- `approve`
- ERC-20 `balanceOf`

Instead:

- read wallet native 0G balance with `getBalance`
- compute `quoteRaw`
- send `eth_sendTransaction` with:
  - `to: DataPolicy`
  - `data: requestAccess calldata`
  - `value: quoteRaw`

Pseudo-shape:

```ts
await provider.request({
  method: "eth_sendTransaction",
  params: [{
    from: walletAddress,
    to: policyAddress,
    data: requestData,
    value: toHex(quoteRaw),
  }],
});
```

### 2. Replace ERC-20 balance reads

Current:

- `balanceOf(USDC_TOKEN_ADDRESS, wallet)`

Target:

- `publicClient.getBalance({ address })`

Affected files include:

- [apps/web/src/app/app/marketplace/[datasetRoot]/request/page.tsx](/home/dev/licen/apps/web/src/app/app/marketplace/[datasetRoot]/request/page.tsx:149)
- [apps/web/src/components/app/app-topbar.tsx](/home/dev/licen/apps/web/src/components/app/app-topbar.tsx:49)
- [apps/web/src/app/app/settings/page.tsx](/home/dev/licen/apps/web/src/app/app/settings/page.tsx:39)

### 3. Remove test USDC faucet UX

Current app includes:

- MockUSDC minting from UI

Target options:

1. Remove entirely.
2. Replace with “Get testnet 0G” link/instructions.
3. If 0G testnet has a faucet API/site, link to it rather than trying to mint on-chain.

Native gas cannot be minted by arbitrary contract calls the same way a mock token can.

### 4. Update wording

Replace copy such as:

- “Approve USDC”
- “Your USDC balance”
- “Lock X USDC”
- “paid to publishers”

with:

- “Send 0G”
- “Your 0G balance”
- “Lock X 0G”
- “settled in 0G”

## Shared Client/Chain Helpers

Update [apps/web/src/lib/publish/onchain.ts](/home/dev/licen/apps/web/src/lib/publish/onchain.ts:1):

- remove `ERC20_ABI`
- remove `USDC_TOKEN_ADDRESS`
- change `requestAccess` assumptions to payable usage in call sites
- change `buildRegisterDatasetArgs()` pricing encoding from 6 to 18 decimals

Potentially add:

```ts
export function formatOg(value: bigint | string) { ... }
export function parseOg(value: string) { ... }
```

That helps centralize formatting.

## Contract Deployment Changes

Update deployment script:

- [packages/contracts/script/DeployDataPolicy.s.sol](/home/dev/licen/packages/contracts/script/DeployDataPolicy.s.sol:9)

Current:

- `new DataPolicy(paymentToken, backendWallet)`

Target:

- `new DataPolicy(backendWallet)`

Also remove obsolete env:

- `PAYMENT_TOKEN_ADDRESS`

## Indexer Impact

Minimal schema impact:

- `royaltySettled`, `refundIssued`, `escrowAmount` can stay as `uint256`/`BigInt`
- event names do not need to change

No required indexer schema change unless you want explicit denomination metadata.

Optional improvement:

- add a protocol metadata entity or constant documenting that values are now 18-decimal native 0G

## Orchestrator Impact

Very little change is needed in the orchestrator:

- it already treats monetary values mostly as opaque on-chain amounts
- completion/failure calls remain the same

Files to review:

- [packages/orchestrator/src/contract.ts](/home/dev/licen/packages/orchestrator/src/contract.ts:1)
- [packages/orchestrator/src/jobTracker.ts](/home/dev/licen/packages/orchestrator/src/jobTracker.ts:1)

Main concern:

- any human-readable logging or UI that assumes 6 decimals must be updated to 18 decimals

## Test Migration

The contract tests need a full rewrite from ERC-20 escrow to native value tests.

Current tests:

- mint token
- approve token
- call `requestAccess()`

Target tests:

- fund requester with native balance
- call `requestAccess{value: ...}()`
- assert contract balance changes
- assert owner/requester native balance deltas on settlement/refund

Important note:

Native balance assertions in Foundry are slightly trickier because gas costs affect EOAs. Prefer patterns like:

- checking contract balance
- or using `vm.deal(...)` and carefully structuring assertions around known state transitions

Tests to keep:

- max runs per requester
- max epochs per run
- purpose restrictions
- expiry restriction
- requester whitelist restriction
- attestation requirement
- actual epochs <= requested

## Docs / Product Copy Changes

Docs currently reference USDC heavily:

- [architecture.md](/home/dev/licen/architecture.md:213)
- [design.md](/home/dev/licen/design.md:27)
- [README.md](/home/dev/licen/README.md:29)

These must be updated to native 0G wording after the migration.

## Backward Compatibility Strategy

There are two realistic approaches.

### Option A: Clean break

Deploy a new native-0G `DataPolicy` contract and move the app entirely to it.

Pros:

- simplest implementation
- no mixed payment semantics

Cons:

- old ERC-20 datasets/jobs remain on old contract
- migration is operational, not seamless

### Option B: Versioned contracts

Support:

- `DataPolicyV1` = ERC-20
- `DataPolicyV2` = native 0G

UI chooses behavior based on configured contract version.

Pros:

- safer rollout
- can preserve old datasets

Cons:

- more code complexity
- more environment/config branching

Recommendation:

- use **Option A** unless preserving live old datasets/jobs is a hard requirement

## Recommended Rollout Plan

### Phase 1: Contract + tests

1. Create `DataPolicyNative.sol` or refactor `DataPolicy.sol`.
2. Add `nonReentrant`.
3. Convert tests to native-value escrow.
4. Deploy to testnet.

### Phase 2: Shared client layer

1. Remove ERC-20 helpers.
2. Add native 0G quote/balance helpers.
3. Switch 6-decimal formatting to 18-decimal formatting.

### Phase 3: Researcher request UX

1. Remove approve flow.
2. Remove allowance checks.
3. Use native balance checks.
4. Send `value` with `requestAccess`.
5. Replace faucet/mint UX with testnet funding instructions.

### Phase 4: Publisher/researcher dashboards

1. Update copy from USDC to 0G.
2. Update all formatting.
3. Verify session ledger and dataset cards still display correct numbers.

### Phase 5: Deployment + docs

1. Deploy native contract.
2. Update env vars.
3. Update docs and architecture copy.
4. Cut over frontend to new address.

## Risks

### 1. Native transfer failure semantics

ERC-20 `safeTransfer` failure behavior differs from native transfer failure behavior. Native `call{value: ...}` must be explicitly checked.

### 2. Reentrancy

Native payouts/refunds mean external calls to arbitrary addresses. Guard accordingly.

### 3. Decimal confusion

USDC-like 6 decimals vs native 18 decimals is the easiest place to introduce silent accounting bugs.

### 4. UX shock

Users are used to:

- balance badge in USDC
- approve flow
- test token mint

Native gas economics feel different, especially on testnet.

### 5. Analytics/reporting migration

Historical data may mix denominations if you do not clearly version the contract or data source.

## Suggested Implementation Decision

If you want the least risky path:

1. Deploy a new native-only `DataPolicy` contract.
2. Update the web app to point to that contract.
3. Remove all ERC-20 logic from the request flow and topbar/settings.
4. Keep event names and job/indexer model unchanged.
5. Treat this as a protocol version bump rather than an in-place patch.

## Estimated Work

Rough engineering effort if done carefully:

- Contract refactor + tests: 0.5 to 1 day
- Frontend request flow + balance UX + copy: 1 to 1.5 days
- Dashboard/session formatting cleanup: 0.5 day
- Docs + deployment + testnet verification: 0.5 day

Total:

- about 2 to 3.5 engineering days for a solid migration

## Minimal Checklist

- [ ] Remove `paymentToken` from contract
- [ ] Make `requestAccess()` payable
- [ ] Enforce exact `msg.value`
- [ ] Replace token settlement/refund with native transfers
- [ ] Add reentrancy protection
- [ ] Update Foundry tests
- [ ] Remove `approve` / `allowance` from frontend
- [ ] Replace ERC-20 balance reads with native balance reads
- [ ] Remove MockUSDC mint flow
- [ ] Convert all 6-decimal formatting to 18-decimal formatting
- [ ] Update docs/copy from USDC to 0G
- [ ] Deploy new contract and update envs

